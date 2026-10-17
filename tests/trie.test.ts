import { describe, it, expect } from 'vitest';
import { TopicTrie } from '../src/core/trie.js';

describe('Topic Tree Trie Data Structure', () => {
  it('inserts and organizes nested topic paths', () => {
    const trie = new TopicTrie();
    trie.insert('factory/line1/sensor/temperature', {
      bytes: 120,
      qos: 1,
      retained: false,
      format: 'json',
      payloadSnippet: '{"temp": 24.5}'
    });

    const node = trie.find('factory/line1/sensor/temperature');
    expect(node).not.toBeNull();
    expect(node?.isLeaf).toBe(true);
    expect(node?.messageCount).toBe(1);
    expect(node?.byteCount).toBe(120);
    expect(node?.lastQoS).toBe(1);
    expect(node?.lastFormat).toBe('json');

    const intermediate = trie.find('factory/line1');
    expect(intermediate).not.toBeNull();
    expect(intermediate?.isLeaf).toBe(false);

    // Aggregate metrics
    const agg = intermediate?.getAggregateMetrics();
    expect(agg?.aggregateMessageCount).toBe(1);
    expect(agg?.aggregateByteCount).toBe(120);
  });

  it('aggregates multiple siblings and leaf messages', () => {
    const trie = new TopicTrie();
    trie.insert('sensors/hallway/temp', { bytes: 50, qos: 0, retained: false });
    trie.insert('sensors/hallway/humidity', { bytes: 70, qos: 0, retained: false });
    trie.insert('sensors/kitchen/temp', { bytes: 40, qos: 1, retained: true });

    const rootAgg = trie.root.getAggregateMetrics();
    expect(rootAgg.aggregateMessageCount).toBe(3);
    expect(rootAgg.aggregateByteCount).toBe(160);

    const hallway = trie.find('sensors/hallway');
    const hallwayAgg = hallway?.getAggregateMetrics();
    expect(hallwayAgg?.aggregateMessageCount).toBe(2);
    expect(hallwayAgg?.aggregateByteCount).toBe(120);
  });

  it('finds nodes matching MQTT wildcard filters', () => {
    const trie = new TopicTrie();
    trie.insert('fleet/truck01/speed', { bytes: 20, qos: 0, retained: false });
    trie.insert('fleet/truck02/speed', { bytes: 20, qos: 0, retained: false });
    trie.insert('fleet/truck01/gps', { bytes: 40, qos: 0, retained: false });

    const speedMatches = trie.findMatching('fleet/+/speed');
    expect(speedMatches.length).toBe(2);
    expect(speedMatches.map(n => n.fullTopic)).toContain('fleet/truck01/speed');
    expect(speedMatches.map(n => n.fullTopic)).toContain('fleet/truck02/speed');

    const allFleet = trie.findMatching('fleet/#');
    expect(allFleet.length).toBeGreaterThanOrEqual(3);
  });

  it('serializes to valid D3 hierarchy tree format', () => {
    const trie = new TopicTrie();
    trie.insert('device/001/status', { bytes: 30, qos: 0, retained: false });

    const hierarchy = trie.toHierarchy();
    expect(hierarchy.name).toBe('root');
    expect(hierarchy.children).toBeDefined();
    expect(hierarchy.children?.length).toBe(1);
    expect(hierarchy.children?.[0].name).toBe('device');
  });

  it('clears trie structure completely', () => {
    const trie = new TopicTrie();
    trie.insert('a/b/c', { bytes: 10, qos: 0, retained: false });
    expect(trie.getAllTopics().length).toBe(1);

    trie.clear();
    expect(trie.getAllTopics().length).toBe(0);
    expect(trie.find('a/b/c')).toBeNull();
  });
});
