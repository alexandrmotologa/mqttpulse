import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { AppState } from './state.js';

export function registerWebSocket(app: FastifyInstance, state: AppState): void {
  const clients = new Set<WebSocket>();

  const broadcast = (data: Record<string, unknown>) => {
    const json = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  };

  // Wire fastify-websocket
  app.get('/ws', { websocket: true }, (socket /* WebSocket */) => {
    clients.add(socket);

    // Send initial snapshot on connect
    socket.send(
      JSON.stringify({
        type: 'init',
        status: state.mqttClient.currentStatus,
        subscriptions: state.mqttClient.activeSubscriptions,
        stats: state.trie.getGlobalStats(),
        tree: state.trie.toHierarchy(),
        fleetStats: state.simulator.getStats(),
        embeddedBroker: {
          running: state.embeddedBroker.isRunning,
          url: state.embeddedBroker.brokerUrl
        },
        alerts: state.rulesEngine.getAlerts(20),
        geoMarkers: Array.from(state.geoMarkers.values()),
        recording: {
          isRecording: state.recorder.isRecording,
          bufferedCount: state.recorder.currentBufferLength
        }
      })
    );

    socket.on('close', () => {
      clients.delete(socket);
    });

    socket.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore malformed ping
      }
    });
  });

  // 1. Inbound MQTT messages broadcast
  state.mqttClient.on('message', () => {
    const latest = state.recentMessages[0];
    if (latest) {
      broadcast({
        type: 'message',
        message: latest
      });
    }
  });

  // 2. Alert event broadcast
  state.rulesEngine.on('alert', (alert) => {
    broadcast({
      type: 'alert',
      alert
    });
  });

  // 3. Broker status changes
  state.mqttClient.on('statusChange', (status) => {
    broadcast({
      type: 'status',
      status,
      subscriptions: state.mqttClient.activeSubscriptions
    });
  });

  // 4. Simulator stats updates
  state.simulator.on('stats', (stats) => {
    broadcast({
      type: 'fleet_stats',
      stats
    });
  });

  // 5. Recorder events
  state.recorder.on('start', (info) => {
    broadcast({ type: 'recording_status', isRecording: true, info });
  });
  state.recorder.on('stop', (session) => {
    broadcast({ type: 'recording_status', isRecording: false, session });
  });

  // 6. Periodic Topic Tree, Geo & Global Stats Sync (Every 1000ms)
  setInterval(() => {
    if (clients.size > 0) {
      broadcast({
        type: 'tree_update',
        tree: state.trie.toHierarchy(),
        stats: state.trie.getGlobalStats(),
        geoMarkers: Array.from(state.geoMarkers.values()).slice(0, 200)
      });
    }
  }, 1000);
}
