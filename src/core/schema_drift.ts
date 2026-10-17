/**
 * Schema Drift and Anomaly Detector
 * Maintains topic schema fingerprints and flags structural or type mutations.
 */

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' | 'unknown';

export interface FieldSignature {
  path: string;
  expectedTypes: Set<PrimitiveType>;
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
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

export class SchemaDriftDetector {
  // Topic path -> Map<FieldPath, FieldSignature>
  private topicSignatures: Map<string, Map<string, FieldSignature>> = new Map();
  private topicSampleCount: Map<string, number> = new Map();

  private getType(val: unknown): PrimitiveType {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    const t = typeof val;
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'object') return 'object';
    return 'unknown';
  }

  private extractFieldTypes(data: unknown, prefix = '', out: Map<string, PrimitiveType> = new Map()): Map<string, PrimitiveType> {
    if (typeof data !== 'object' || data === null) {
      out.set(prefix || 'root', this.getType(data));
      return out;
    }

    if (Array.isArray(data)) {
      out.set(prefix || 'array', 'array');
      if (data.length > 0) {
        this.extractFieldTypes(data[0], `${prefix}[]`, out);
      }
      return out;
    }

    const obj = data as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const type = this.getType(val);
      out.set(fieldPath, type);

      if (type === 'object') {
        this.extractFieldTypes(val, fieldPath, out);
      } else if (type === 'array' && Array.isArray(val) && val.length > 0) {
        this.extractFieldTypes(val[0], `${fieldPath}[]`, out);
      }
    }

    return out;
  }

  public observe(topic: string, parsedData: unknown): SchemaDriftReport {
    return this.analyzeMessage(topic, parsedData);
  }

  public analyzeMessage(topic: string, parsedData: unknown): SchemaDriftReport {
    if (typeof parsedData !== 'object' || parsedData === null) {
      return { isDrift: false, anomalies: [] };
    }

    const currentFields = this.extractFieldTypes(parsedData);
    let established = this.topicSignatures.get(topic);
    const count = (this.topicSampleCount.get(topic) || 0) + 1;
    this.topicSampleCount.set(topic, count);

    // Initial warm-up: establish baseline on first 3 messages without flagging
    if (!established) {
      established = new Map();
      this.topicSignatures.set(topic, established);
    }

    const anomalies: SchemaDriftAnomaly[] = [];

    if (count > 3) {
      // 1. Check for type mutations & new unexpected fields
      for (const [fieldPath, actualType] of currentFields.entries()) {
        const signature = established.get(fieldPath);
        if (!signature) {
          anomalies.push({
            path: fieldPath,
            issue: 'new_unexpected_field',
            expected: '(none established)',
            actual: actualType,
            message: `Field '${fieldPath}' appeared unexpectedly (type: ${actualType})`
          });
        } else if (!signature.expectedTypes.has(actualType)) {
          const expectedList = Array.from(signature.expectedTypes).join(' | ');
          anomalies.push({
            path: fieldPath,
            issue: 'type_mutation',
            expected: expectedList,
            actual: actualType,
            message: `Type mutation on '${fieldPath}': expected [${expectedList}] but received '${actualType}'`
          });
        }
      }
    }

    // Update established signatures
    const now = Date.now();
    for (const [fieldPath, actualType] of currentFields.entries()) {
      let signature = established.get(fieldPath);
      if (!signature) {
        signature = {
          path: fieldPath,
          expectedTypes: new Set([actualType]),
          firstSeen: now,
          lastSeen: now,
          occurrences: 1
        };
        established.set(fieldPath, signature);
      } else {
        signature.expectedTypes.add(actualType);
        signature.lastSeen = now;
        signature.occurrences++;
      }
    }

    return {
      isDrift: anomalies.length > 0,
      anomalies
    };
  }

  public reset(): void {
    this.topicSignatures.clear();
    this.topicSampleCount.clear();
  }
}
