export interface SerializedTopicNode {
  name: string;
  fullTopic: string;
  isLeaf: boolean;
  messageCount: number;
  byteCount: number;
  aggregateMessageCount: number;
  aggregateByteCount: number;
  messagesPerSec: number;
  bytesPerSec: number;
  lastSeen: number | null;
  lastQoS: number | null;
  lastRetained: boolean;
  lastFormat: string | null;
  lastPayloadSnippet: string | null;
  children?: SerializedTopicNode[];
}

export interface HexDumpLine {
  offset: string;
  hex: string;
  ascii: string;
}

export interface HexDumpView {
  lines: HexDumpLine[];
  rawHex: string;
  byteLength: number;
}

export interface DecodedPayloadResult {
  format: 'json' | 'cbor' | 'msgpack' | 'protobuf' | 'utf8' | 'hex';
  parsed: unknown;
  formattedJson: string;
  rawString: string;
  hexDump: HexDumpView;
  isBinary: boolean;
  byteLength: number;
  metadata?: Record<string, unknown>;
}

export type DiffChangeType = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface DiffEntry {
  path: string;
  type: DiffChangeType;
  oldValue: unknown;
  newValue: unknown;
}

export interface PayloadDiffResult {
  hasChanges: boolean;
  entries: DiffEntry[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface SchemaDriftAnomaly {
  path: string;
  issue: 'type_mutation' | 'new_unexpected_field' | 'missing_established_field';
  expected: string;
  actual: string;
  message: string;
}

export interface SchemaDriftReport {
  isDrift: boolean;
  anomalies: SchemaDriftAnomaly[];
}

export interface InboundMessage {
  id: string;
  topic: string;
  payloadRawHex: string;
  decoded: DecodedPayloadResult;
  qos: 0 | 1 | 2;
  retain: boolean;
  timestamp: number;
  properties?: {
    payloadFormatIndicator?: number | boolean;
    messageExpiryInterval?: number;
    topicAlias?: number;
    responseTopic?: string;
    correlationData?: string;
    userProperties?: Record<string, string | string[]>;
    subscriptionIdentifier?: number | number[];
    contentType?: string;
  };
  latencyMs?: number;
  diff?: PayloadDiffResult;
  drift?: SchemaDriftReport;
}

export interface GlobalStats {
  totalTopics: number;
  totalMessages: number;
  totalBytes: number;
  messagesPerSec: number;
  bytesPerSec: number;
}

export interface FleetStats {
  running: boolean;
  fleetSize: number;
  profile: string;
  format: 'json' | 'cbor' | 'msgpack' | 'protobuf';
  intervalMs: number;
  totalGenerated: number;
  totalPublished: number;
  totalDropped: number;
  totalCorrupted: number;
  totalDisconnects: number;
  messagesPerSec: number;
  bytesPerSec: number;
}

export interface FleetConfig {
  fleetSize: number;
  profile: 'fleet_vehicle' | 'hvac_industrial' | 'smart_meter' | 'weather_station' | 'robotics_actuator' | 'mixed';
  format: 'json' | 'cbor' | 'msgpack' | 'protobuf';
  intervalMs: number;
  qos: 0 | 1 | 2;
  retain: boolean;
  useMqtt5Properties: boolean;
  chaos: {
    jitterMinMs: number;
    jitterMaxMs: number;
    dropRatePct: number;
    disconnectRatePct: number;
    corruptRatePct: number;
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type RuleOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RuleDefinition {
  id: string;
  name: string;
  topicFilter: string;
  field: string;
  operator: RuleOperator;
  value: number | string | boolean;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMs?: number;
  lastTriggered?: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  topic: string;
  severity: AlertSeverity;
  timestamp: number;
  message: string;
  field: string;
  triggerValue: unknown;
  expectedCondition: string;
  read: boolean;
}

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

export interface RecordedMessage {
  deltaMs: number;
  topic: string;
  payloadHex: string;
  qos: 0 | 1 | 2;
  retain: boolean;
  properties?: Record<string, unknown>;
}

export interface RecordedSession {
  sessionId: string;
  name: string;
  startTime: number;
  durationMs: number;
  messageCount: number;
  messages: RecordedMessage[];
}

export interface RpcTransaction {
  id: string;
  requestTopic: string;
  responseTopic: string;
  correlationData: string;
  sentAt: number;
  latencyMs?: number;
  status: 'pending' | 'success' | 'timeout' | 'error';
  requestPayload: unknown;
  responsePayload?: unknown;
  error?: string;
}
