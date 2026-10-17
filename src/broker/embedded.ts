import Aedes from 'aedes';
import { createServer, Server as NetServer } from 'net';
import { EventEmitter } from 'events';

export interface EmbeddedBrokerOptions {
  port?: number;
  host?: string;
}

export class EmbeddedBroker extends EventEmitter {
  private aedes: any = null;
  private server: NetServer | null = null;
  private port: number;
  private host: string;
  private running = false;
  private connectedClientsCount = 0;

  constructor(options: EmbeddedBrokerOptions = {}) {
    super();
    this.port = options.port ?? 18883; // Default to 18883 to avoid clashing with an existing local mosquitto on 1883
    this.host = options.host ?? '127.0.0.1';
  }

  public get isRunning(): boolean {
    return this.running;
  }

  public get brokerPort(): number {
    return this.port;
  }

  public get brokerUrl(): string {
    return `mqtt://${this.host}:${this.port}`;
  }

  public get clientCount(): number {
    return this.connectedClientsCount;
  }

  public start(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.running) {
        return resolve(this.brokerUrl);
      }

      try {
        this.aedes = new (Aedes as any)();
        this.server = createServer(this.aedes.handle);

        this.aedes.on('client', (client: any) => {
          this.connectedClientsCount++;
          this.emit('clientConnected', client.id);
        });

        this.aedes.on('clientDisconnect', (client: any) => {
          this.connectedClientsCount = Math.max(0, this.connectedClientsCount - 1);
          this.emit('clientDisconnected', client.id);
        });

        this.server.listen(this.port, this.host, () => {
          this.running = true;
          this.emit('ready', { url: this.brokerUrl, port: this.port });
          resolve(this.brokerUrl);
        });

        this.server.on('error', (err: any) => {
          this.running = false;
          this.emit('error', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running || !this.server) {
        return resolve();
      }

      this.aedes.close(() => {
        this.server?.close(() => {
          this.running = false;
          this.connectedClientsCount = 0;
          this.emit('closed');
          resolve();
        });
      });
    });
  }
}
