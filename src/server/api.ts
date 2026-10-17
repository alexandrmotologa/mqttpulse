import { FastifyInstance } from 'fastify';
import { AppState } from './state.js';
import { protobufManager } from '../decoders/protobuf.js';
import { renderPrometheusMetrics } from './metrics.js';

export function registerRoutes(app: FastifyInstance, state: AppState): void {
  // 1. Prometheus / OpenTelemetry Metrics Endpoint
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return renderPrometheusMetrics(state);
  });

  // 2. Connection & Broker Status
  app.get('/api/status', async () => {
    return {
      status: state.mqttClient.currentStatus,
      error: state.mqttClient.currentError,
      config: state.mqttClient.currentConfig,
      subscriptions: state.mqttClient.activeSubscriptions,
      stats: state.trie.getGlobalStats(),
      embeddedBroker: {
        running: state.embeddedBroker.isRunning,
        url: state.embeddedBroker.brokerUrl,
        port: state.embeddedBroker.brokerPort,
        clients: state.embeddedBroker.clientCount
      },
      simulator: state.simulator.getStats(),
      recorder: {
        isRecording: state.recorder.isRecording,
        bufferedCount: state.recorder.currentBufferLength
      },
      replayer: {
        isReplaying: state.replayer.isReplaying,
        isPaused: state.replayer.isPaused
      },
      unreadAlertsCount: state.rulesEngine.getAlerts().filter((a) => !a.read).length
    };
  });

  // 3. Connect to MQTT Broker
  app.post('/api/connect', async (req, reply) => {
    const body = (req.body || {}) as any;
    const url = body.url;
    if (!url) {
      reply.status(400);
      return { error: 'Broker URL is required (e.g. mqtt://localhost:1883)' };
    }

    try {
      await state.mqttClient.connect({
        url,
        clientId: body.clientId,
        protocolVersion: body.protocolVersion || '5.0',
        clean: body.clean ?? true,
        username: body.username,
        password: body.password,
        keepalive: body.keepalive ? Number(body.keepalive) : 60,
        sessionExpiryInterval: body.sessionExpiryInterval ? Number(body.sessionExpiryInterval) : undefined
      });

      const initialTopic = body.topic || '#';
      await state.mqttClient.subscribe(initialTopic, 0);

      return {
        success: true,
        status: state.mqttClient.currentStatus,
        subscribed: initialTopic
      };
    } catch (err: unknown) {
      reply.status(500);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  });

  // 4. Disconnect
  app.post('/api/disconnect', async () => {
    await state.mqttClient.disconnect();
    return { success: true, status: state.mqttClient.currentStatus };
  });

  // 5. Topic Subscriptions
  app.post('/api/subscribe', async (req, reply) => {
    const body = (req.body || {}) as any;
    const filter = body.topicFilter;
    const qos = body.qos ?? 0;
    if (!filter) {
      reply.status(400);
      return { error: 'Topic filter is required' };
    }

    try {
      await state.mqttClient.subscribe(filter, qos);
      return { success: true, subscriptions: state.mqttClient.activeSubscriptions };
    } catch (err: unknown) {
      reply.status(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  app.post('/api/unsubscribe', async (req, reply) => {
    const body = (req.body || {}) as any;
    const filter = body.topicFilter;
    if (!filter) {
      reply.status(400);
      return { error: 'Topic filter is required' };
    }

    try {
      await state.mqttClient.unsubscribe(filter);
      return { success: true, subscriptions: state.mqttClient.activeSubscriptions };
    } catch (err: unknown) {
      reply.status(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 6. Publish Message
  app.post('/api/publish', async (req, reply) => {
    const body = (req.body || {}) as any;
    const topic = body.topic;
    const payload = body.payload;
    const qos = body.qos ?? 0;
    const retain = body.retain ?? false;
    const properties = body.properties;

    if (!topic || payload === undefined) {
      reply.status(400);
      return { error: 'Topic and payload are required' };
    }

    try {
      const payloadBuf = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload));
      const res = await state.mqttClient.publish(topic, payloadBuf, {
        qos,
        retain,
        properties
      });
      return { success: true, latencyMs: res.latencyMs };
    } catch (err: unknown) {
      reply.status(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 7. Bidirectional MQTT 5.0 RPC Request-Response
  app.post('/api/rpc', async (req, reply) => {
    const body = (req.body || {}) as any;
    const requestTopic = body.requestTopic;
    const responseTopic = body.responseTopic || `rpc/response/${Math.random().toString(16).substring(2, 8)}`;
    const payload = body.payload;
    const timeoutMs = body.timeoutMs || 8000;

    if (!requestTopic || payload === undefined) {
      reply.status(400);
      return { error: 'requestTopic and payload are required' };
    }

    // Subscribe to response topic
    await state.mqttClient.subscribe(responseTopic, 0);

    const correlationData = `corr_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        state.rpcPending.delete(correlationData);
        state.mqttClient.unsubscribe(responseTopic).catch(() => {});
        resolve({
          success: false,
          error: `RPC timed out after ${timeoutMs}ms waiting on topic ${responseTopic}`
        });
      }, timeoutMs);

      state.rpcPending.set(correlationData, {
        correlationData,
        startTime: Date.now(),
        resolve: (result) => {
          state.mqttClient.unsubscribe(responseTopic).catch(() => {});
          resolve({
            success: true,
            correlationData,
            ...result
          });
        },
        timeout
      });

      const payloadBuf = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(JSON.stringify(payload));
      state.mqttClient.publish(requestTopic, payloadBuf, {
        qos: 1,
        properties: {
          responseTopic,
          correlationData
        }
      }).catch((err) => {
        clearTimeout(timeout);
        state.rpcPending.delete(correlationData);
        state.mqttClient.unsubscribe(responseTopic).catch(() => {});
        resolve({ success: false, error: err.message });
      });
    });
  });

  // 8. Topic Tree & Stats
  app.get('/api/tree', async (req) => {
    const maxDepth = Number((req.query as any)?.maxDepth || 20);
    return state.trie.toHierarchy(maxDepth);
  });

  app.get('/api/stats', async () => {
    return state.trie.getGlobalStats();
  });

  app.post('/api/tree/clear', async () => {
    state.trie.clear();
    state.recentMessages = [];
    state.lastPayloadPerTopic.clear();
    state.geoMarkers.clear();
    state.timeSeriesHistory.clear();
    state.schemaDetector.reset();
    return { success: true };
  });

  // 9. Recent Messages
  app.get('/api/messages', async (req) => {
    const limit = Number((req.query as any)?.limit || 100);
    return state.recentMessages.slice(0, Math.min(limit, 500));
  });

  // 10. Rules & Alerts Endpoints
  app.get('/api/rules', async () => {
    return state.rulesEngine.getRules();
  });

  app.post('/api/rules', async (req) => {
    const rule = req.body as any;
    state.rulesEngine.addRule(rule);
    return { success: true, rules: state.rulesEngine.getRules() };
  });

  app.delete('/api/rules/:id', async (req) => {
    const { id } = req.params as any;
    state.rulesEngine.removeRule(id);
    return { success: true, rules: state.rulesEngine.getRules() };
  });

  app.post('/api/rules/:id/toggle', async (req) => {
    const { id } = req.params as any;
    const { enabled } = req.body as any;
    state.rulesEngine.toggleRule(id, enabled);
    return { success: true, rules: state.rulesEngine.getRules() };
  });

  app.get('/api/alerts', async () => {
    return state.rulesEngine.getAlerts();
  });

  app.post('/api/alerts/clear', async () => {
    state.rulesEngine.clearAlerts();
    return { success: true };
  });

  app.post('/api/alerts/read', async () => {
    state.rulesEngine.markAlertsRead();
    return { success: true };
  });

  // 11. Session Recording & Playback Endpoints
  app.post('/api/recording/start', async (req) => {
    const name = (req.body as any)?.name || 'Telemetry Test Recording';
    state.recorder.start(name);
    return { success: true, isRecording: true };
  });

  app.post('/api/recording/stop', async () => {
    const session = state.recorder.stop();
    return { success: true, isRecording: false, session };
  });

  app.get('/api/recording/export', async (_req, reply) => {
    const jsonl = state.recorder.exportJsonl();
    reply.header('Content-Type', 'application/x-ndjson');
    reply.header('Content-Disposition', 'attachment; filename="mqttpulse_session.jsonl"');
    return jsonl;
  });

  app.post('/api/recording/replay', async (req, reply) => {
    const body = (req.body || {}) as any;
    const speed = body.speed || 1.0;
    const session = body.session || state.recorder.currentSession;

    if (!session || !session.messages || session.messages.length === 0) {
      reply.status(400);
      return { error: 'No session data to replay' };
    }

    // Start replay in background
    state.replayer.replay(session, speed, async (m) => {
      const buf = Buffer.from(m.payloadHex, 'hex');
      await state.mqttClient.publish(m.topic, buf, {
        qos: m.qos,
        retain: m.retain,
        properties: m.properties as any
      }).catch(() => {});
    }).catch(() => {});

    return { success: true, speed, messageCount: session.messages.length };
  });

  app.post('/api/recording/replay/pause', async () => {
    state.replayer.pause();
    return { success: true, isPaused: true };
  });

  app.post('/api/recording/replay/resume', async () => {
    state.replayer.resume();
    return { success: true, isPaused: false };
  });

  app.post('/api/recording/replay/stop', async () => {
    state.replayer.stop();
    return { success: true, isReplaying: false };
  });

  // 12. Geo Markers (GPS Fleet Map)
  app.get('/api/geo/markers', async () => {
    return Array.from(state.geoMarkers.values());
  });

  // 13. Time-Series Telemetry History (Live Plotter)
  app.get('/api/timeseries', async (req) => {
    const topic = (req.query as any)?.topic;
    if (!topic) {
      // Return list of available topics with numeric series
      const available: Record<string, string[]> = {};
      for (const [top, points] of state.timeSeriesHistory.entries()) {
        if (points.length > 0) {
          available[top] = Object.keys(points[points.length - 1].values);
        }
      }
      return { available };
    }
    const points = state.timeSeriesHistory.get(topic) || [];
    return { topic, points };
  });

  // 14. Simulator Controls
  app.get('/api/simulator', async () => {
    return {
      config: state.simulator.getConfig(),
      stats: state.simulator.getStats()
    };
  });

  app.post('/api/simulator/config', async (req) => {
    const body = (req.body || {}) as any;
    state.simulator.updateConfig(body);
    return {
      success: true,
      config: state.simulator.getConfig(),
      stats: state.simulator.getStats()
    };
  });

  app.post('/api/simulator/start', async () => {
    state.simulator.start();
    return { success: true, stats: state.simulator.getStats() };
  });

  app.post('/api/simulator/stop', async () => {
    state.simulator.stop();
    return { success: true, stats: state.simulator.getStats() };
  });

  app.post('/api/simulator/reset', async () => {
    state.simulator.reset();
    return { success: true, stats: state.simulator.getStats() };
  });

  // 15. Protobuf Schema Registry
  app.get('/api/schemas', async () => {
    return protobufManager.getSchemas();
  });

  app.post('/api/schemas', async (req, reply) => {
    const body = (req.body || {}) as any;
    const name = body.name;
    const protoText = body.protoText;
    if (!name || !protoText) {
      reply.status(400);
      return { error: 'Schema name and protoText are required' };
    }

    const res = protobufManager.registerSchema(name, protoText);
    if (!res.success) {
      reply.status(400);
      return { error: res.error };
    }
    return { success: true, types: res.types };
  });

  // 16. Embedded Broker Control
  app.post('/api/broker/embedded', async (req, reply) => {
    const body = (req.body || {}) as any;
    const action = body.action;

    try {
      if (action === 'start') {
        const url = await state.embeddedBroker.start();
        return {
          success: true,
          running: true,
          url,
          port: state.embeddedBroker.brokerPort
        };
      } else if (action === 'stop') {
        await state.embeddedBroker.stop();
        return {
          success: true,
          running: false
        };
      } else {
        reply.status(400);
        return { error: "Action must be 'start' or 'stop'" };
      }
    } catch (err: unknown) {
      reply.status(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
