import { tryDecodeJson } from './json.js';
import { tryDecodeCbor } from './cbor.js';
import { tryDecodeMsgPack } from './msgpack.js';
import { protobufManager } from './protobuf.js';
import { formatHexDump, HexDumpView } from './hex.js';

export type PayloadFormat = 'json' | 'cbor' | 'msgpack' | 'protobuf' | 'utf8' | 'hex';

export interface DecodedPayloadResult {
  format: PayloadFormat;
  parsed: unknown;
  formattedJson: string;
  rawString: string;
  hexDump: HexDumpView;
  isBinary: boolean;
  byteLength: number;
  metadata?: Record<string, unknown>;
}

export function detectAndDecodePayload(
  buffer: Buffer | Uint8Array,
  hintFormat?: string,
  protoSchema?: string,
  protoType?: string
): DecodedPayloadResult {
  const buf = Buffer.from(buffer);
  const hexDump = formatHexDump(buf);
  let rawString = '';
  try {
    rawString = buf.toString('utf8');
  } catch {
    rawString = '';
  }

  // If explicit hint provided
  if (hintFormat === 'json') {
    const jsonRes = tryDecodeJson(buf);
    if (jsonRes.success) {
      return {
        format: 'json',
        parsed: jsonRes.data,
        formattedJson: jsonRes.formattedJson,
        rawString,
        hexDump,
        isBinary: false,
        byteLength: buf.length
      };
    }
  } else if (hintFormat === 'cbor') {
    const cborRes = tryDecodeCbor(buf);
    if (cborRes.success) {
      return {
        format: 'cbor',
        parsed: cborRes.data,
        formattedJson: cborRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length
      };
    }
  } else if (hintFormat === 'msgpack') {
    const msgRes = tryDecodeMsgPack(buf);
    if (msgRes.success) {
      return {
        format: 'msgpack',
        parsed: msgRes.data,
        formattedJson: msgRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length
      };
    }
  } else if (hintFormat === 'protobuf') {
    const protoRes = protobufManager.tryDecode(buf, protoSchema, protoType);
    if (protoRes.success) {
      return {
        format: 'protobuf',
        parsed: protoRes.data,
        formattedJson: protoRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length,
        metadata: { schema: protoRes.matchedSchema, type: protoRes.matchedType }
      };
    }
  }

  // 1. Try JSON first (most common in modern IoT)
  const jsonRes = tryDecodeJson(buf);
  if (jsonRes.success) {
    return {
      format: 'json',
      parsed: jsonRes.data,
      formattedJson: jsonRes.formattedJson,
      rawString,
      hexDump,
      isBinary: false,
      byteLength: buf.length
    };
  }

  // 2. Try MessagePack / CBOR if binary
  // Check if buffer contains binary non-printable control characters
  let nonPrintableCount = 0;
  for (let i = 0; i < Math.min(buf.length, 64); i++) {
    const byte = buf[i];
    if (byte < 9 || (byte > 13 && byte < 32)) {
      nonPrintableCount++;
    }
  }
  const isLikelyBinary = nonPrintableCount > 2;

  if (isLikelyBinary) {
    // Try Protobuf against registered schemas
    const protoRes = protobufManager.tryDecode(buf);
    if (protoRes.success) {
      return {
        format: 'protobuf',
        parsed: protoRes.data,
        formattedJson: protoRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length,
        metadata: { schema: protoRes.matchedSchema, type: protoRes.matchedType }
      };
    }

    // Try CBOR
    const cborRes = tryDecodeCbor(buf);
    if (cborRes.success && typeof cborRes.data === 'object' && cborRes.data !== null) {
      return {
        format: 'cbor',
        parsed: cborRes.data,
        formattedJson: cborRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length
      };
    }

    // Try MsgPack
    const msgRes = tryDecodeMsgPack(buf);
    if (msgRes.success && typeof msgRes.data === 'object' && msgRes.data !== null) {
      return {
        format: 'msgpack',
        parsed: msgRes.data,
        formattedJson: msgRes.formattedJson ?? '',
        rawString,
        hexDump,
        isBinary: true,
        byteLength: buf.length
      };
    }

    // Fallback to Hex Dump
    return {
      format: 'hex',
      parsed: null,
      formattedJson: '',
      rawString,
      hexDump,
      isBinary: true,
      byteLength: buf.length
    };
  }

  // 3. Fallback to clean UTF-8 string
  return {
    format: 'utf8',
    parsed: rawString,
    formattedJson: JSON.stringify({ text: rawString }, null, 2),
    rawString,
    hexDump,
    isBinary: false,
    byteLength: buf.length
  };
}
