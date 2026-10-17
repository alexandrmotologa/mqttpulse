import { describe, it, expect, vi } from 'vitest';
import { computePayloadDiff } from '../src/core/diff.js';
import { SchemaDriftDetector } from '../src/core/schema_drift.js';
import { RulesEngine } from '../src/core/rules.js';
import { TelemetryRecorder } from '../src/core/recorder.js';
import { generatePrometheusMetrics } from '../src/server/metrics.js';

describe('Advanced Observability & Simulation Features', () => {
  describe('Live Payload Diffing (computePayloadDiff)', () => {
    it('detects added, modified, and deleted properties in nested objects', () => {
      const prev = {
        sensorId: 'node-01',
        metrics: {
          temp: 22.4,
          humidity: 55,
          battery: 98
        },
        tags: ['indoor', 'zone-a']
      };

      const curr = {
        sensorId: 'node-01',
        metrics: {
          temp: 24.1, // modified
          humidity: 55, // unchanged
          // battery deleted
          voltage: 3.3 // added
        },
        tags: ['indoor', 'zone-a', 'active'] // array modified
      };

      const diff = computePayloadDiff(prev, curr);

      expect(diff.hasChanges).toBe(true);
      expect(diff.summary.modified).toBeGreaterThanOrEqual(1);
      expect(diff.summary.added).toBeGreaterThanOrEqual(1);
      expect(diff.summary.deleted).toBeGreaterThanOrEqual(1);

      const modEntry = diff.entries.find((e) => e.path === 'metrics.temp');
      expect(modEntry).toBeDefined();
      expect(modEntry?.type).toBe('modified');
      expect(modEntry?.oldValue).toBe(22.4);
      expect(modEntry?.newValue).toBe(24.1);

      const addedEntry = diff.entries.find((e) => e.path === 'metrics.voltage');
      expect(addedEntry).toBeDefined();
      expect(addedEntry?.type).toBe('added');
      expect(addedEntry?.newValue).toBe(3.3);

      const delEntry = diff.entries.find((e) => e.path === 'metrics.battery');
      expect(delEntry).toBeDefined();
      expect(delEntry?.type).toBe('deleted');
      expect(delEntry?.oldValue).toBe(98);
    });

    it('returns hasChanges false when payloads are identical', () => {
      const p1 = { a: 1, b: 'test', c: { deep: true } };
      const p2 = { a: 1, b: 'test', c: { deep: true } };

      const diff = computePayloadDiff(p1, p2);
      expect(diff.hasChanges).toBe(false);
      expect(diff.entries.length).toBe(0);
    });
  });

  describe('Schema Drift Detector', () => {
    it('establishes schema baseline and flags type mutations', () => {
      const detector = new SchemaDriftDetector();
      const topic = 'fleet/vehicle/telemetry';

      // Train baseline with 5 consistent samples
      for (let i = 0; i < 5; i++) {
        detector.observe(topic, {
          speedKmh: 65.5 + i,
          fuelLevel: 80,
          active: true
        });
      }

      // 6th message has speedKmh mutated to string!
      const report = detector.observe(topic, {
        speedKmh: '68.2 km/h', // type mutation!
        fuelLevel: 79,
        active: true
      });

      expect(report.isDrift).toBe(true);
      const anomaly = report.anomalies.find((a) => a.path === 'speedKmh');
      expect(anomaly).toBeDefined();
      expect(anomaly?.issue).toBe('type_mutation');
      expect(anomaly?.expected).toBe('number');
      expect(anomaly?.actual).toBe('string');
    });

    it('flags unexpected new fields after schema stabilization', () => {
      const detector = new SchemaDriftDetector();
      const topic = 'devices/hvac/01';

      for (let i = 0; i < 10; i++) {
        detector.observe(topic, { temp: 21.0, mode: 'cooling' });
      }

      const report = detector.observe(topic, {
        temp: 21.5,
        mode: 'cooling',
        secretDebugToken: 'xyz-999' // unexpected new field
      });

      expect(report.isDrift).toBe(true);
      const anomaly = report.anomalies.find((a) => a.path === 'secretDebugToken');
      expect(anomaly).toBeDefined();
      expect(anomaly?.issue).toBe('new_unexpected_field');
    });
  });

  describe('Rules & Telemetry Alerts Engine', () => {
    it('triggers alerts on threshold comparison and respects topic filters', () => {
      const engine = new RulesEngine();
      engine.clearRules();

      engine.addRule({
        id: 'temp_threshold',
        name: 'Critical Heat Alert',
        topicFilter: 'facility/+/temperature',
        field: 'temp',
        operator: '>',
        value: 30,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0
      });

      // Normal message -> no alert
      const normalAlerts = engine.evaluate('facility/zone1/temperature', { temp: 24.5 });
      expect(normalAlerts.length).toBe(0);

      // Exceeded threshold on matching topic -> triggers alert
      const hotAlerts = engine.evaluate('facility/zone1/temperature', { temp: 34.2 });
      expect(hotAlerts.length).toBe(1);
      expect(hotAlerts[0].ruleName).toBe('Critical Heat Alert');
      expect(hotAlerts[0].severity).toBe('critical');
      expect(hotAlerts[0].triggerValue).toBe(34.2);

      // Same payload on non-matching topic -> no alert
      const otherTopicAlerts = engine.evaluate('warehouse/zone1/temperature', { temp: 34.2 });
      expect(otherTopicAlerts.length).toBe(0);
    });

    it('enforces cooldown period between alerts', () => {
      const engine = new RulesEngine();
      engine.clearRules();

      engine.addRule({
        id: 'cooldown_test',
        name: 'Rapid Alert',
        topicFilter: 'sensor/test',
        field: 'val',
        operator: '>',
        value: 10,
        severity: 'warning',
        enabled: true,
        cooldownMs: 5000 // 5 seconds cooldown
      });

      const first = engine.evaluate('sensor/test', { val: 20 });
      expect(first.length).toBe(1);

      // Immediate second call should be suppressed by cooldown
      const second = engine.evaluate('sensor/test', { val: 25 });
      expect(second.length).toBe(0);
    });
  });

  describe('Session Recording & Replay Engine', () => {
    it('records incoming messages and compiles a session', () => {
      const recorder = new TelemetryRecorder();
      recorder.start('Integration Test Session');
      expect(recorder.isRecording).toBe(true);

      recorder.recordMessage({
        topic: 'test/node1',
        payloadHex: '7b7d',
        qos: 1,
        retain: false
      });

      recorder.recordMessage({
        topic: 'test/node2',
        payloadHex: '3031',
        qos: 0,
        retain: true
      });

      expect(recorder.currentBufferLength).toBe(2);

      const session = recorder.stop();
      expect(recorder.isRecording).toBe(false);
      expect(session).not.toBeNull();
      expect(session?.messageCount).toBe(2);
      expect(session?.messages[0].topic).toBe('test/node1');
      expect(session?.messages[1].topic).toBe('test/node2');
    });

    it('replays recorded session with playback callback', async () => {
      const recorder = new TelemetryRecorder();
      recorder.start('Replay Test');

      recorder.recordMessage({ topic: 'a', payloadHex: '01', qos: 0, retain: false });
      recorder.recordMessage({ topic: 'b', payloadHex: '02', qos: 0, retain: false });
      recorder.stop();

      const received: string[] = [];
      await recorder.replay(100, (msg) => {
        received.push(msg.topic);
      });

      expect(received).toEqual(['a', 'b']);
    });
  });

  describe('Prometheus Metrics Generation', () => {
    it('formats Prometheus text with all standard gauges and counters', () => {
      const state = {
        getStats: () => ({
          totalTopics: 42,
          totalMessages: 1250,
          totalBytes: 512000,
          messagesPerSec: 150,
          bytesPerSec: 32000
        }),
        getFleetStats: () => ({
          running: true,
          fleetSize: 25,
          totalGenerated: 500,
          totalPublished: 490,
          totalDropped: 10,
          totalCorrupted: 2,
          totalDisconnects: 1
        }),
        getAlerts: () => [
          { read: false },
          { read: true }
        ],
        getRules: () => [
          { enabled: true },
          { enabled: false }
        ]
      } as any;

      const metrics = generatePrometheusMetrics(state);

      expect(metrics).toContain('# TYPE mqtt_topics_active gauge');
      expect(metrics).toContain('mqtt_topics_active 42');
      expect(metrics).toContain('mqtt_messages_received_total 1250');
      expect(metrics).toContain('mqtt_message_rate_current 150');
      expect(metrics).toContain('mqtt_fleet_nodes_active 25');
      expect(metrics).toContain('mqtt_fleet_dropped_total 10');
      expect(metrics).toContain('mqtt_alerts_total 2');
      expect(metrics).toContain('mqtt_alerts_unread 1');
      expect(metrics).toContain('mqtt_rules_total 2');
      expect(metrics).toContain('mqtt_rules_active 1');
    });
  });
});
