import mqtt, { MqttClient, IClientOptions, IPublishPacket, ISubscriptionGrant } from 'mqtt';
import { EventEmitter } from 'events';

export type MqttVersion = '5.0' | '3.1.1';

export interface BrokerConnectionConfig {
  url: string; // e.g. mqtt://localhost:1883 or wss://broker.emqx.io:8084/mqtt
  clientId?: string;
  protocolVersion?: MqttVersion;
  clean?: boolean;
  username?: string;
  password?: string;
  keepalive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  sessionExpiryInterval?: number; // MQTT 5.0
  will?: {
    topic: string;
    payload: string | Buffer;
    qos?: 0 | 1 | 2;
    retain?: boolean;
    properties?: {
      willDelayInterval?: number;
      messageExpiryInterval?: number;
      contentType?: string;
      userProperties?: Record<string, string>;
    };
  };
  ca?: string;
  cert?: string;
  key?: string;
  rejectUnauthorized?: boolean;
}

export interface InboundMqttMessage {
  id: string;
  topic: string;
  payload: Buffer;
  qos: 0 | 1 | 2;
  retain: boolean;
  dup: boolean;
  timestamp: number;
  properties?: {
    payloadFormatIndicator?: boolean | number;
    messageExpiryInterval?: number;
    topicAlias?: number;
    responseTopic?: string;
    correlationData?: string;
    userProperties?: Record<string, string | string[]>;
    subscriptionIdentifier?: number | number[];
    contentType?: string;
  };
  latencyMs?: number;
}

export interface PublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
  dup?: boolean;
  properties?: {
    payloadFormatIndicator?: number;
    messageExpiryInterval?: number;
    topicAlias?: number;
    responseTopic?: string;
    correlationData?: Buffer | string;
    userProperties?: Record<string, string | string[]>;
    contentType?: string;
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export class MqttConnectionManager extends EventEmitter {
  private client: MqttClient | null = null;
  private config: BrokerConnectionConfig | null = null;
  private status: ConnectionStatus = 'disconnected';
  private errorMessage: string | null = null;
  private subscriptions: Set<string> = new Set();
  private messageCounter = 0;

  constructor() {
    super();
  }

  public get currentStatus(): ConnectionStatus {
    return this.status;
  }

  public get currentError(): string | null {
    return this.errorMessage;
  }

  public get currentConfig(): BrokerConnectionConfig | null {
    return this.config;
  }

  public get activeSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  public connect(config: BrokerConnectionConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.config = config;
      this.setStatus('connecting');

      const protocolVersion = config.protocolVersion === '3.1.1' ? 4 : 5;
      const opts: IClientOptions = {
        clientId: config.clientId || `mqttpulse_${Math.random().toString(16).substring(2, 10)}`,
        clean: config.clean ?? true,
        protocolVersion: protocolVersion as 4 | 5,
        keepalive: config.keepalive ?? 60,
        connectTimeout: config.connectTimeout ?? 10000,
        reconnectPeriod: config.reconnectPeriod ?? 3000,
        rejectUnauthorized: config.rejectUnauthorized ?? false
      };

      if (config.username) opts.username = config.username;
      if (config.password) opts.password = config.password;
      if (config.will) {
        opts.will = {
          topic: config.will.topic,
          payload: Buffer.from(config.will.payload),
          qos: config.will.qos ?? 0,
          retain: config.will.retain ?? false,
          properties: config.will.properties as any
        };
      }

      if (protocolVersion === 5 && config.sessionExpiryInterval !== undefined) {
        opts.properties = {
          sessionExpiryInterval: config.sessionExpiryInterval
        };
      }

      try {
        const client = mqtt.connect(config.url, opts);
        this.client = client;

        let hasResolved = false;

        client.on('connect', (ack) => {
          this.setStatus('connected');
          this.errorMessage = null;

          // Resubscribe to existing subscriptions
          if (this.subscriptions.size > 0) {
            for (const sub of this.subscriptions) {
              client.subscribe(sub, { qos: 0 });
            }
          }

          this.emit('connect', { ack, config: this.config });
          if (!hasResolved) {
            hasResolved = true;
            resolve();
          }
        });

        client.on('reconnect', () => {
          this.setStatus('reconnecting');
          this.emit('reconnect');
        });

        client.on('close', () => {
          if (this.status !== 'reconnecting') {
            this.setStatus('disconnected');
          }
          this.emit('close');
        });

        client.on('offline', () => {
          this.setStatus('reconnecting');
          this.emit('offline');
        });

        client.on('error', (err) => {
          if (protocolVersion === 5 && err.message?.includes('Unacceptable protocol version')) {
            // Broker only supports MQTT 3.1.1, downgrade seamlessly
            client.end(true, {}, () => {
              this.connect({ ...config, protocolVersion: '3.1.1' }).then(resolve).catch(reject);
            });
            return;
          }

          this.errorMessage = err.message;
          this.setStatus('error');
          this.emit('error', err);
          if (!hasResolved) {
            hasResolved = true;
            reject(err);
          }
        });

        client.on('message', (topic: string, payload: Buffer, packet: IPublishPacket) => {
          const now = Date.now();
          this.messageCounter++;
          const msgId = `msg_${now}_${this.messageCounter}`;

          let correlationDataStr: string | undefined;
          if (packet.properties?.correlationData) {
            correlationDataStr = Buffer.isBuffer(packet.properties.correlationData)
              ? packet.properties.correlationData.toString('utf8')
              : String(packet.properties.correlationData);
          }

          let userProps: Record<string, string | string[]> | undefined;
          if (packet.properties?.userProperties) {
            userProps = packet.properties.userProperties as Record<string, string | string[]>;
          }

          // Latency calculation if timestamp provided in userProperties
          let latencyMs: number | undefined;
          if (userProps?.['timestamp']) {
            const sentTs = Number(Array.isArray(userProps['timestamp']) ? userProps['timestamp'][0] : userProps['timestamp']);
            if (!isNaN(sentTs) && sentTs > 0 && sentTs <= now) {
              latencyMs = now - sentTs;
            }
          }

          const message: InboundMqttMessage = {
            id: msgId,
            topic,
            payload,
            qos: packet.qos as 0 | 1 | 2,
            retain: packet.retain,
            dup: packet.dup,
            timestamp: now,
            properties: packet.properties ? {
              payloadFormatIndicator: packet.properties.payloadFormatIndicator,
              messageExpiryInterval: packet.properties.messageExpiryInterval,
              topicAlias: packet.properties.topicAlias,
              responseTopic: packet.properties.responseTopic,
              correlationData: correlationDataStr,
              userProperties: userProps,
              subscriptionIdentifier: packet.properties.subscriptionIdentifier,
              contentType: packet.properties.contentType
            } : undefined,
            latencyMs
          };

          this.emit('message', message);
        });
      } catch (err: unknown) {
        this.setStatus('error');
        this.errorMessage = err instanceof Error ? err.message : String(err);
        reject(err);
      }
    });
  }

  public subscribe(topicFilter: string, qos: 0 | 1 | 2 = 0): Promise<ISubscriptionGrant[]> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        // Still save it to subscriptions so it subscribes when connected
        this.subscriptions.add(topicFilter);
        return resolve([]);
      }

      this.client.subscribe(topicFilter, { qos }, (err, granted) => {
        if (err) {
          reject(err);
        } else {
          this.subscriptions.add(topicFilter);
          this.emit('subscribed', { topicFilter, granted });
          resolve(granted || []);
        }
      });
    });
  }

  public unsubscribe(topicFilter: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.subscriptions.delete(topicFilter);
      if (!this.client || !this.client.connected) {
        return resolve();
      }

      this.client.unsubscribe(topicFilter, undefined, (err) => {
        if (err) reject(err);
        else {
          this.emit('unsubscribed', topicFilter);
          resolve();
        }
      });
    });
  }

  public publish(
    topic: string,
    message: string | Buffer,
    options: PublishOptions = {}
  ): Promise<{ latencyMs: number }> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        return reject(new Error('MQTT client is not connected to any broker'));
      }

      const startTime = Date.now();
      const qos = options.qos ?? 0;
      const retain = options.retain ?? false;
      const dup = options.dup ?? false;

      const publishOpts: any = { qos, retain, dup };
      if (options.properties) {
        publishOpts.properties = { ...options.properties };
        if (typeof options.properties.correlationData === 'string') {
          publishOpts.properties.correlationData = Buffer.from(options.properties.correlationData);
        }
      }

      this.client.publish(topic, message, publishOpts, (err) => {
        if (err) {
          reject(err);
        } else {
          const latencyMs = Date.now() - startTime;
          resolve({ latencyMs });
        }
      });
    });
  }

  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        this.setStatus('disconnected');
        return resolve();
      }

      this.client.end(true, {}, () => {
        this.client = null;
        this.setStatus('disconnected');
        resolve();
      });
    });
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('statusChange', this.status);
    }
  }
}
