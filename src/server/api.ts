import { FastifyInstance } from 'fastify';
import { AppState } from './state.js';
import { protobufManager } from '../decoders/protobuf.js';

export function registerRoutes(app: FastifyInstance, state: AppState): void {
  // 1. Connection & Broker Status
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
      simulator: state.simulator.getStats()
    };
  });

  // 2. Connect to MQTT Broker
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

      // Auto-subscribe to default topic pattern if provided or '#'
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

  // 3. Disconnect from Broker
  app.post('/api/disconnect', async () => {
    await state.mqttClient.disconnect();
    return { success: true, status: state.mqttClient.currentStatus };
  });

  // 4. Topic Subscriptions
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

  // 5. Publish Message (with MQTT 5.0 Properties)
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

  // 6. Topic Tree & Statistics
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
    return { success: true };
  });

  // 7. Recent Messages List
  app.get('/api/messages', async (req) => {
    const limit = Number((req.query as any)?.limit || 100);
    return state.recentMessages.slice(0, Math.min(limit, 500));
  });

  // 8. Fleet Simulator Endpoints
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

  // 9. Protobuf Schema Registry
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

  // 10. Embedded Broker Control
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
