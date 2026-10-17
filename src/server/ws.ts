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

  // Listen to incoming MQTT messages and broadcast to UI clients
  state.mqttClient.on('message', () => {
    // The message was already decoded and inserted into recentMessages[0] in state.ts
    const latest = state.recentMessages[0];
    if (latest) {
      broadcast({
        type: 'message',
        message: latest
      });
    }
  });

  // Broker status changes
  state.mqttClient.on('statusChange', (status) => {
    broadcast({
      type: 'status',
      status,
      subscriptions: state.mqttClient.activeSubscriptions
    });
  });

  // Simulator stats updates
  state.simulator.on('stats', (stats) => {
    broadcast({
      type: 'fleet_stats',
      stats
    });
  });

  // Periodic Topic Tree & Global Stats Sync (Every 1000ms)
  setInterval(() => {
    if (clients.size > 0) {
      broadcast({
        type: 'tree_update',
        tree: state.trie.toHierarchy(),
        stats: state.trie.getGlobalStats()
      });
    }
  }, 1000);
}
