import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EmbeddedBroker } from '../src/broker/embedded.js';
import { MqttConnectionManager } from '../src/core/client.js';
import { TopicTrie } from '../src/core/trie.js';
import { detectAndDecodePayload } from '../src/decoders/detector.js';

describe('Embedded Broker & Client End-to-End Integration', () => {
  let broker: EmbeddedBroker;
  let client: MqttConnectionManager;
  let trie: TopicTrie;
  const testPort = 19883;

  beforeAll(async () => {
    broker = new EmbeddedBroker({ port: testPort, host: '127.0.0.1' });
    await broker.start();

    client = new MqttConnectionManager();
    trie = new TopicTrie();

    // Wire trie indexing on message
    client.on('message', (msg) => {
      const decoded = detectAndDecodePayload(msg.payload);
      trie.insert(msg.topic, {
        bytes: msg.payload.length,
        qos: msg.qos,
        retained: msg.retain,
        format: decoded.format,
        payloadSnippet: decoded.rawString
      });
    });

    await client.connect({
      url: `mqtt://127.0.0.1:${testPort}`,
      protocolVersion: '3.1.1',
      clean: true
    });
  });

  afterAll(async () => {
    await client.disconnect();
    await broker.stop();
  });

  it('connects to embedded broker successfully', () => {
    expect(client.currentStatus).toBe('connected');
    expect(broker.isRunning).toBe(true);
    expect(broker.clientCount).toBeGreaterThanOrEqual(1);
  });

  it('subscribes, publishes, and indexes MQTT 5.0 messages into the Trie', async () => {
    await client.subscribe('telemetry/#', 1);

    const testPayload = JSON.stringify({ temperature: 27.8, pressure: 1012.3 });
    const publishRes = await client.publish('telemetry/factory01/sensor_temp', testPayload, {
      qos: 1,
      retain: false,
      properties: {
        contentType: 'application/json',
        userProperties: {
          building: 'Zone-A',
          rack: 'R-14'
        }
      }
    });

    expect(publishRes.latencyMs).toBeGreaterThanOrEqual(0);

    // Give broker and socket a brief moment to deliver
    await new Promise(r => setTimeout(r, 100));

    // Verify Trie has indexed the topic
    const node = trie.find('telemetry/factory01/sensor_temp');
    expect(node).not.toBeNull();
    expect(node?.isLeaf).toBe(true);
    expect(node?.messageCount).toBe(1);
    expect(node?.lastQoS).toBe(1);
    expect(node?.lastFormat).toBe('json');
  });
});
