import { describe, it, expect } from 'vitest';
import { TopicTrie } from '../src/core/trie.js';

describe('Performance Benchmarks', () => {
  it('processes > 20,000 messages/sec through the Trie data structure', () => {
    const trie = new TopicTrie();
    const messageCount = 50000;
    const testTopics = [
      'factory/line1/sensor/temperature',
      'factory/line1/sensor/pressure',
      'factory/line2/sensor/temperature',
      'fleet/truck01/gps',
      'fleet/truck02/gps',
      'fleet/truck03/speed',
      'meters/residential/zone4/energy',
      'weather/station01/wind',
      'robotics/arm/joint3/torque',
      'hvac/buildingB/chiller/flow'
    ];

    const start = performance.now();
    for (let i = 0; i < messageCount; i++) {
      const topic = testTopics[i % testTopics.length];
      trie.insert(topic, {
        bytes: 128,
        qos: (i % 3) as 0 | 1 | 2,
        retained: false,
        format: 'json',
        payloadSnippet: '{"val": 42}'
      });
    }
    const durationMs = performance.now() - start;
    const throughputPerSec = Math.round((messageCount / (durationMs / 1000)));

    console.log(`[BENCHMARK] Ingested ${messageCount} messages in ${durationMs.toFixed(2)}ms (${throughputPerSec.toLocaleString()} msgs/sec)`);

    expect(throughputPerSec).toBeGreaterThan(20000);
    expect(trie.getGlobalStats().totalMessages).toBe(messageCount);
  });
});
