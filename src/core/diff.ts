/**
 * Structural Payload Diff Calculator
 * Compares two parsed payload states on the same topic and computes additions, modifications, and deletions.
 */

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

export function computePayloadDiff(prev: unknown, curr: unknown, prefix = ''): PayloadDiffResult {
  const entries: DiffEntry[] = [];

  const isObject = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null && !Array.isArray(val);

  const compare = (oldVal: unknown, newVal: unknown, currentPath: string) => {
    // Both are objects -> recurse keys
    if (isObject(oldVal) && isObject(newVal)) {
      const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
      for (const k of allKeys) {
        const nextPath = currentPath ? `${currentPath}.${k}` : k;
        if (!(k in oldVal)) {
          entries.push({ path: nextPath, type: 'added', oldValue: undefined, newValue: newVal[k] });
        } else if (!(k in newVal)) {
          entries.push({ path: nextPath, type: 'deleted', oldValue: oldVal[k], newValue: undefined });
        } else {
          compare(oldVal[k], newVal[k], nextPath);
        }
      }
      return;
    }

    // Both are arrays
    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      const maxLen = Math.max(oldVal.length, newVal.length);
      for (let i = 0; i < maxLen; i++) {
        const nextPath = `${currentPath}[${i}]`;
        if (i >= oldVal.length) {
          entries.push({ path: nextPath, type: 'added', oldValue: undefined, newValue: newVal[i] });
        } else if (i >= newVal.length) {
          entries.push({ path: nextPath, type: 'deleted', oldValue: oldVal[i], newValue: undefined });
        } else {
          compare(oldVal[i], newVal[i], nextPath);
        }
      }
      return;
    }

    // Primitive values comparison
    if (oldVal !== newVal) {
      entries.push({
        path: currentPath || 'value',
        type: 'modified',
        oldValue: oldVal,
        newValue: newVal
      });
    }
  };

  compare(prev, curr, prefix);

  const summary = {
    added: entries.filter((e) => e.type === 'added').length,
    modified: entries.filter((e) => e.type === 'modified').length,
    deleted: entries.filter((e) => e.type === 'deleted').length
  };

  return {
    hasChanges: entries.length > 0,
    entries,
    summary
  };
}
