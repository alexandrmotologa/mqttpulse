import { TopicTrie } from '../core/trie.js';
import { MqttConnectionManager } from '../core/client.js';
import { FleetSimulatorManager } from '../simulator/fleet_manager.js';
import { EmbeddedBroker } from '../broker/embedded.js';
import { detectAndDecodePayload, DecodedPayloadResult } from '../decoders/detector.js';

export interface AppState {
  trie: TopicTrie;
  mqttClient: MqttConnectionManager;
  simulator: FleetSimulatorManager;
  embeddedBroker: EmbeddedBroker;
  recentMessages: Array<{
    id: string;
    topic: string;
    payloadRawHex: string;
    decoded: DecodedPayloadResult;
    qos: 0 | 1 | 2;
    retain: boolean;
    timestamp: number;
    properties?: any;
    latencyMs?: number;
  }>;
}

export function createAppState(): AppState {
  const trie = new TopicTrie();
  const mqttClient = new MqttConnectionManager();
  const simulator = new FleetSimulatorManager();
  const embeddedBroker = new EmbeddedBroker();
  simulator.setMqttClient(mqttClient);

  const state: AppState = {
    trie,
    mqttClient,
    simulator,
    embeddedBroker,
    recentMessages: []
  };

  // Wire incoming MQTT messages into the Trie and recent message buffer
  mqttClient.on('message', (msg) => {
    // Decode in-flight payload
    const decoded = detectAndDecodePayload(msg.payload, undefined);

    // Record into Topic Trie
    trie.insert(msg.topic, {
      bytes: msg.payload.length,
      qos: msg.qos,
      retained: msg.retain,
      format: decoded.format,
      payloadSnippet: decoded.format === 'hex' ? `${decoded.byteLength} bytes` : (decoded.rawString.length > 80 ? decoded.rawString.substring(0, 80) + '...' : decoded.rawString),
      timestamp: msg.timestamp
    });

    // Store in recent buffer (capped at 500 items for in-memory responsiveness)
    state.recentMessages.unshift({
      id: msg.id,
      topic: msg.topic,
      payloadRawHex: decoded.hexDump.rawHex,
      decoded,
      qos: msg.qos,
      retain: msg.retain,
      timestamp: msg.timestamp,
      properties: msg.properties,
      latencyMs: msg.latencyMs
    });

    if (state.recentMessages.length > 500) {
      state.recentMessages.pop();
    }
  });

  return state;
}
