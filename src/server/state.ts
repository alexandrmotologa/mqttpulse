import { TopicTrie } from '../core/trie.js';
import { MqttConnectionManager } from '../core/client.js';
import { FleetSimulatorManager } from '../simulator/fleet_manager.js';
import { EmbeddedBroker } from '../broker/embedded.js';
import { detectAndDecodePayload, DecodedPayloadResult } from '../decoders/detector.js';
import { computePayloadDiff, PayloadDiffResult } from '../core/diff.js';
import { SchemaDriftDetector, SchemaDriftReport } from '../core/schema_drift.js';
import { RulesEngine, AlertEvent } from '../core/rules.js';
import { TelemetryRecorder, TelemetryReplayer } from '../core/recorder.js';

export interface GeoMarker {
  id: string;
  topic: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speedKmh?: number;
  timestamp: number;
  status?: string;
  dataSnippet?: string;
}

export interface TimeSeriesPoint {
  timestamp: number;
  values: Record<string, number>;
}

export interface AppState {
  trie: TopicTrie;
  mqttClient: MqttConnectionManager;
  simulator: FleetSimulatorManager;
  embeddedBroker: EmbeddedBroker;
  schemaDetector: SchemaDriftDetector;
  rulesEngine: RulesEngine;
  recorder: TelemetryRecorder;
  replayer: TelemetryReplayer;
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
    diff?: PayloadDiffResult;
    drift?: SchemaDriftReport;
  }>;
  lastPayloadPerTopic: Map<string, unknown>;
  geoMarkers: Map<string, GeoMarker>;
  timeSeriesHistory: Map<string, TimeSeriesPoint[]>;
  rpcPending: Map<string, { correlationData: string; startTime: number; resolve: (val: any) => void; timeout: NodeJS.Timeout }>;
}

export function createAppState(): AppState {
  const trie = new TopicTrie();
  const mqttClient = new MqttConnectionManager();
  const simulator = new FleetSimulatorManager();
  const embeddedBroker = new EmbeddedBroker();
  const schemaDetector = new SchemaDriftDetector();
  const rulesEngine = new RulesEngine();
  const recorder = new TelemetryRecorder();
  const replayer = new TelemetryReplayer();

  simulator.setMqttClient(mqttClient);

  const state: AppState = {
    trie,
    mqttClient,
    simulator,
    embeddedBroker,
    schemaDetector,
    rulesEngine,
    recorder,
    replayer,
    recentMessages: [],
    lastPayloadPerTopic: new Map(),
    geoMarkers: new Map(),
    timeSeriesHistory: new Map(),
    rpcPending: new Map()
  };

  // Wire incoming MQTT messages into engines
  mqttClient.on('message', (msg) => {
    // 1. In-flight decode
    const decoded = detectAndDecodePayload(msg.payload, undefined);

    // 2. Diff calculation against previous message on this same topic
    const prevPayload = state.lastPayloadPerTopic.get(msg.topic);
    let diff: PayloadDiffResult | undefined;
    if (prevPayload !== undefined && decoded.parsed !== null) {
      diff = computePayloadDiff(prevPayload, decoded.parsed);
    }
    if (decoded.parsed !== null) {
      state.lastPayloadPerTopic.set(msg.topic, decoded.parsed);
    }

    // 3. Schema drift detection
    const drift = schemaDetector.analyzeMessage(msg.topic, decoded.parsed);

    // 4. Rule evaluations & Alerts
    rulesEngine.evaluate(msg.topic, decoded.parsed);

    // 5. Session recording if active
    if (recorder.isRecording) {
      recorder.record(msg.topic, msg.payload, msg.qos, msg.retain, msg.properties);
    }

    // 6. Record into Topic Trie
    trie.insert(msg.topic, {
      bytes: msg.payload.length,
      qos: msg.qos,
      retained: msg.retain,
      format: decoded.format,
      payloadSnippet: decoded.format === 'hex' ? `${decoded.byteLength} bytes` : (decoded.rawString.length > 80 ? decoded.rawString.substring(0, 80) + '...' : decoded.rawString),
      timestamp: msg.timestamp
    });

    // 7. Geo markers extraction (for Fleet Map)
    extractGeoData(msg.topic, decoded.parsed, msg.timestamp, state.geoMarkers);

    // 8. Numeric time-series history extraction (for Live Plotter)
    extractTimeSeriesData(msg.topic, decoded.parsed, msg.timestamp, state.timeSeriesHistory);

    // 9. Match pending RPC correlationData
    if (msg.properties?.correlationData) {
      const corr = msg.properties.correlationData;
      const pending = state.rpcPending.get(corr);
      if (pending) {
        clearTimeout(pending.timeout);
        state.rpcPending.delete(corr);
        pending.resolve({
          topic: msg.topic,
          payload: decoded.parsed || decoded.rawString,
          latencyMs: Date.now() - pending.startTime,
          properties: msg.properties
        });
      }
    }

    // 10. Store in recent buffer
    state.recentMessages.unshift({
      id: msg.id,
      topic: msg.topic,
      payloadRawHex: decoded.hexDump.rawHex,
      decoded,
      qos: msg.qos,
      retain: msg.retain,
      timestamp: msg.timestamp,
      properties: msg.properties,
      latencyMs: msg.latencyMs,
      diff,
      drift: drift.isDrift ? drift : undefined
    });

    if (state.recentMessages.length > 500) {
      state.recentMessages.pop();
    }
  });

  return state;
}

function extractGeoData(topic: string, data: unknown, timestamp: number, map: Map<string, GeoMarker>): void {
  if (typeof data !== 'object' || data === null) return;
  const obj = data as Record<string, any>;

  let lat: number | undefined;
  let lon: number | undefined;
  let heading: number | undefined;
  let speed: number | undefined;
  let status: string | undefined;

  if (obj.location && typeof obj.location.latitude === 'number') {
    lat = obj.location.latitude;
    lon = obj.location.longitude;
    heading = obj.location.heading;
  } else if (typeof obj.latitude === 'number' && typeof obj.longitude === 'number') {
    lat = obj.latitude;
    lon = obj.longitude;
    heading = obj.heading;
  }

  if (typeof obj.speedKmh === 'number') speed = obj.speedKmh;
  else if (typeof obj.speed === 'number') speed = obj.speed;

  if (typeof obj.status === 'string') status = obj.status;

  if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
    const id = obj.deviceId || obj.vin || obj.stationId || topic;
    map.set(id, {
      id,
      topic,
      latitude: lat,
      longitude: lon,
      heading,
      speedKmh: speed,
      timestamp,
      status,
      dataSnippet: speed !== undefined ? `${speed} km/h` : `${lat.toFixed(4)}, ${lon.toFixed(4)}`
    });
  }
}

function extractTimeSeriesData(
  topic: string,
  data: unknown,
  timestamp: number,
  history: Map<string, TimeSeriesPoint[]>
): void {
  if (typeof data !== 'object' || data === null) return;
  const obj = data as Record<string, any>;

  const numericValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && !isNaN(v) && k !== 'timestamp') {
      numericValues[k] = v;
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const [subK, subV] of Object.entries(v as Record<string, any>)) {
        if (typeof subV === 'number' && !isNaN(subV)) {
          numericValues[`${k}.${subK}`] = subV;
        }
      }
    }
  }

  if (Object.keys(numericValues).length === 0) return;

  let points = history.get(topic);
  if (!points) {
    points = [];
    history.set(topic, points);
  }

  points.push({ timestamp, values: numericValues });
  if (points.length > 60) {
    points.shift();
  }
}
