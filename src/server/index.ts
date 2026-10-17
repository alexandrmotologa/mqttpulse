import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWs from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createAppState, AppState } from './state.js';
import { registerRoutes } from './api.js';
import { registerWebSocket } from './ws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function createMqttPulseServer(options: ServerOptions = {}, existingState?: AppState) {
  const port = options.port ?? 4100;
  const host = options.host ?? '0.0.0.0';

  const app = Fastify({
    logger: false
  });

  await app.register(cors, {
    origin: true
  });

  await app.register(fastifyWs);

  const state = existingState ?? createAppState();

  // Register REST & WS
  registerRoutes(app, state);
  registerWebSocket(app, state);

  // Check if frontend build exists in web/dist or ../../web/dist or dist/web
  const possiblePaths = [
    path.join(__dirname, '../../web/dist'),
    path.join(__dirname, '../web/dist'),
    path.join(process.cwd(), 'web/dist'),
    path.join(process.cwd(), 'dist/web')
  ];

  let staticRoot = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      staticRoot = p;
      break;
    }
  }

  if (staticRoot) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/'
    });

    // Fallback for SPA routing
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && !req.raw.url.startsWith('/api') && !req.raw.url.startsWith('/ws')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: 'Not Found' });
    });
  }

  const start = async () => {
    await app.listen({ port, host });
    return `http://localhost:${port}`;
  };

  const stop = async () => {
    await app.close();
    await state.mqttClient.disconnect();
    state.simulator.stop();
    await state.embeddedBroker.stop();
  };

  return { app, state, start, stop, port, host };
}
