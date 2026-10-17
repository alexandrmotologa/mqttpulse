import protobuf from 'protobufjs';

export interface ProtobufDecodeResult {
  success: boolean;
  data: unknown;
  formattedJson?: string;
  matchedSchema?: string;
  matchedType?: string;
  error?: string;
}

export interface RegisteredSchema {
  name: string;
  types: string[];
  protoText: string;
  root: protobuf.Root;
}

const DEFAULT_IOT_PROTO = `
syntax = "proto3";
package iot;

message SensorTelemetry {
  string device_id = 1;
  double timestamp = 2;
  double temperature = 3;
  double humidity = 4;
  double pressure = 5;
  double battery_pct = 6;
  double latitude = 7;
  double longitude = 8;
}

message VehicleTelemetry {
  string vin = 1;
  double timestamp = 2;
  double speed_kmh = 3;
  double fuel_pct = 4;
  double engine_temp = 5;
  double latitude = 6;
  double longitude = 7;
  int32 rpm = 8;
}

message SmartMeter {
  string meter_id = 1;
  double timestamp = 2;
  double active_power = 3;
  double reactive_power = 4;
  double voltage = 5;
  double current = 6;
  double total_kwh = 7;
}
`;

class ProtobufManager {
  private schemas: Map<string, RegisteredSchema> = new Map();

  constructor() {
    this.registerSchema('default_iot', DEFAULT_IOT_PROTO);
  }

  public registerSchema(name: string, protoText: string): { success: boolean; types: string[]; error?: string } {
    try {
      const parsed = protobuf.parse(protoText);
      const types: string[] = [];

      // Extract all message types recursively
      const extractTypes = (namespace: protobuf.NamespaceBase, prefix = '') => {
        for (const [key, item] of Object.entries(namespace.nested || {})) {
          const fullName = prefix ? `${prefix}.${key}` : key;
          if (item instanceof protobuf.Type) {
            types.push(fullName);
          } else if (item instanceof protobuf.Namespace) {
            extractTypes(item, fullName);
          }
        }
      };

      extractTypes(parsed.root);

      this.schemas.set(name, {
        name,
        types,
        protoText,
        root: parsed.root
      });

      return { success: true, types };
    } catch (err: unknown) {
      return {
        success: false,
        types: [],
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  public getSchemas(): Array<{ name: string; types: string[]; protoText: string }> {
    return Array.from(this.schemas.values()).map(s => ({
      name: s.name,
      types: s.types,
      protoText: s.protoText
    }));
  }

  public tryDecode(buffer: Buffer | Uint8Array, schemaName?: string, typeName?: string): ProtobufDecodeResult {
    const raw = Buffer.from(buffer);
    if (raw.length === 0) {
      return { success: false, data: null, error: 'Empty buffer' };
    }

    // If specific schema and type provided
    if (schemaName && typeName) {
      const schema = this.schemas.get(schemaName);
      if (!schema) {
        return { success: false, data: null, error: `Schema '${schemaName}' not found` };
      }
      try {
        const type = schema.root.lookupType(typeName);
        const decoded = type.decode(raw);
        const obj = type.toObject(decoded, { defaults: true, longs: String });
        return {
          success: true,
          data: obj,
          formattedJson: JSON.stringify(obj, null, 2),
          matchedSchema: schemaName,
          matchedType: typeName
        };
      } catch (err: unknown) {
        return {
          success: false,
          data: null,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }

    // Auto-discovery: try all types across registered schemas
    for (const [sName, schema] of this.schemas.entries()) {
      for (const tName of schema.types) {
        try {
          const type = schema.root.lookupType(tName);
          const decoded = type.decode(raw);
          // Verify that decoding is plausible (not all defaults and fields look valid)
          const obj = type.toObject(decoded, { defaults: false, longs: String });
          if (Object.keys(obj).length > 0) {
            return {
              success: true,
              data: obj,
              formattedJson: JSON.stringify(obj, null, 2),
              matchedSchema: sName,
              matchedType: tName
            };
          }
        } catch {
          // Continue trying other types
        }
      }
    }

    return {
      success: false,
      data: null,
      error: 'Could not match any registered Protobuf schema'
    };
  }

  public encode(schemaName: string, typeName: string, payload: Record<string, unknown>): Buffer {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }
    const type = schema.root.lookupType(typeName);
    const errMsg = type.verify(payload);
    if (errMsg) throw new Error(errMsg);

    const message = type.create(payload);
    return Buffer.from(type.encode(message).finish());
  }
}

export const protobufManager = new ProtobufManager();
