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

export interface InboundMessage {
  id: string;
  topic: string;
  payloadRawHex: string;
  decoded: DecodedPayloadResult;
  qos: 0 | 1 | 2;
  retain: boolean;
  timestamp: number;
  properties?: {
    payloadFormatIndicator?: number;
    messageExpiryInterval?: number;
    topicAlias?: number;
    responseTopic?: string;
    correlationData?: string;
    userProperties?: Record<string, string | string[]>;
    subscriptionIdentifier?: number;
    contentType?: string;
  };
  latencyMs?: number;
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
