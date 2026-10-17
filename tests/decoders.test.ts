import { describe, it, expect } from 'vitest';
import { encode as encodeCbor } from 'cbor-x';
import { encode as encodeMsgPack } from '@msgpack/msgpack';
import { tryDecodeJson } from '../src/decoders/json.js';
import { tryDecodeCbor } from '../src/decoders/cbor.js';
import { tryDecodeMsgPack } from '../src/decoders/msgpack.js';
import { protobufManager } from '../src/decoders/protobuf.js';
import { formatHexDump } from '../src/decoders/hex.js';
import { detectAndDecodePayload } from '../src/decoders/detector.js';

describe('In-Flight Payload Decoders', () => {
  it('decodes standard JSON objects', () => {
    const raw = Buffer.from(JSON.stringify({ temperature: 24.5, unit: 'celsius' }));
    const res = tryDecodeJson(raw);
    expect(res.success).toBe(true);
    expect((res.data as any).temperature).toBe(24.5);
    expect((res.data as any).unit).toBe('celsius');
  });

  it('decodes CBOR binary objects', () => {
    const original = { sensor: 'temp_01', reading: 22.8, active: true };
    const buffer = Buffer.from(encodeCbor(original));
    const res = tryDecodeCbor(buffer);
    expect(res.success).toBe(true);
    expect((res.data as any).sensor).toBe('temp_01');
    expect((res.data as any).reading).toBe(22.8);
    expect((res.data as any).active).toBe(true);
  });

  it('decodes MessagePack binary objects', () => {
    const original = { id: 104, command: 'SET_VALVE', values: [1.2, 3.4, 5.6] };
    const buffer = Buffer.from(encodeMsgPack(original));
    const res = tryDecodeMsgPack(buffer);
    expect(res.success).toBe(true);
    expect((res.data as any).id).toBe(104);
    expect((res.data as any).command).toBe('SET_VALVE');
    expect((res.data as any).values.length).toBe(3);
  });

  it('encodes and decodes Protocol Buffers dynamically', () => {
    const payload = {
      vin: 'VIN99887766',
      timestamp: 1700000000,
      speedKmh: 88.5,
      fuelPct: 75.0,
      engineTemp: 92.4,
      latitude: 47.0245,
      longitude: 28.8322,
      rpm: 2400
    };

    const encoded = protobufManager.encode('default_iot', 'iot.VehicleTelemetry', payload);
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = protobufManager.tryDecode(encoded, 'default_iot', 'iot.VehicleTelemetry');
    expect(decoded.success).toBe(true);
    expect((decoded.data as any).vin).toBe('VIN99887766');
    expect((decoded.data as any).speedKmh).toBeCloseTo(88.5);
    expect((decoded.data as any).fuelPct).toBeCloseTo(75.0);
  });

  it('formats clean Hex dumps with offsets and ASCII preview', () => {
    const buf = Buffer.from('Hello MQTT World! 1234');
    const hex = formatHexDump(buf);
    expect(hex.byteLength).toBe(buf.length);
    expect(hex.lines.length).toBeGreaterThan(0);
    expect(hex.lines[0].offset).toBe('00000000');
    expect(hex.lines[0].ascii).toContain('Hello MQTT World');
  });

  it('auto-detects formats accurately in detectAndDecodePayload', () => {
    // 1. JSON
    const jsonBuf = Buffer.from(JSON.stringify({ test: 1 }));
    expect(detectAndDecodePayload(jsonBuf).format).toBe('json');

    // 2. CBOR
    const cborBuf = Buffer.from(encodeCbor({ sensor: 'cbor_test', value: 99 }));
    expect(detectAndDecodePayload(cborBuf).format).toBe('cbor');

    // 3. Protobuf
    const protoBuf = protobufManager.encode('default_iot', 'iot.SensorTelemetry', {
      deviceId: 'dev_01',
      timestamp: 1000,
      temperature: 20.5
    });
    expect(detectAndDecodePayload(protoBuf).format).toBe('protobuf');
  });
});
