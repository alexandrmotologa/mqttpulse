import { SlidingRateCalculator } from './stats.js';
import { matchesTopic } from './wildcard.js';

export interface MessageMeta {
  bytes: number;
  qos: number;
  retained: boolean;
  format?: string;
  payloadSnippet?: string;
  timestamp?: number;
}

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

export interface TrieGlobalStats {
  totalTopics: number;
  totalMessages: number;
  totalBytes: number;
  messagesPerSec: number;
  bytesPerSec: number;
}

export class TopicNode {
  public segment: string;
  public fullTopic: string;
  public isLeaf = false;
  public messageCount = 0;
  public byteCount = 0;
  public lastSeen: number | null = null;
  public lastQoS: number | null = null;
  public lastRetained = false;
  public lastFormat: string | null = null;
  public lastPayloadSnippet: string | null = null;
  public children: Map<string, TopicNode> = new Map();
  public parent: TopicNode | null = null;

  private rateCalc = new SlidingRateCalculator(10000);

  constructor(segment: string, fullTopic: string, parent: TopicNode | null = null) {
    this.segment = segment;
    this.fullTopic = fullTopic;
    this.parent = parent;
  }

  public recordMessage(meta: MessageMeta): void {
    const now = meta.timestamp ?? Date.now();
    this.isLeaf = true;
    this.messageCount++;
    this.byteCount += meta.bytes;
    this.lastSeen = now;
    this.lastQoS = meta.qos;
    this.lastRetained = meta.retained;
    if (meta.format) this.lastFormat = meta.format;
    if (meta.payloadSnippet) this.lastPayloadSnippet = meta.payloadSnippet;
    this.rateCalc.record(meta.bytes, now);
  }

  public getRates(now = Date.now()): { messagesPerSec: number; bytesPerSec: number } {
    return this.rateCalc.getRates(now);
  }

  public getAggregateMetrics(now = Date.now()): {
    aggregateMessageCount: number;
    aggregateByteCount: number;
    aggregateMessagesPerSec: number;
    aggregateBytesPerSec: number;
  } {
    let aggMsgs = this.messageCount;
    let aggBytes = this.byteCount;
    const directRates = this.getRates(now);
    let aggMsgRate = directRates.messagesPerSec;
    let aggByteRate = directRates.bytesPerSec;

    for (const child of this.children.values()) {
      const childAgg = child.getAggregateMetrics(now);
      aggMsgs += childAgg.aggregateMessageCount;
      aggBytes += childAgg.aggregateByteCount;
      aggMsgRate += childAgg.aggregateMessagesPerSec;
      aggByteRate += childAgg.aggregateBytesPerSec;
    }

    return {
      aggregateMessageCount: aggMsgs,
      aggregateByteCount: aggBytes,
      aggregateMessagesPerSec: Number(aggMsgRate.toFixed(2)),
      aggregateBytesPerSec: Number(aggByteRate.toFixed(2))
    };
  }

  public serialize(maxDepth = 15, currentDepth = 0, now = Date.now()): SerializedTopicNode {
    const agg = this.getAggregateMetrics(now);
    const directRates = this.getRates(now);

    const serialized: SerializedTopicNode = {
      name: this.segment,
      fullTopic: this.fullTopic,
      isLeaf: this.isLeaf,
      messageCount: this.messageCount,
      byteCount: this.byteCount,
      aggregateMessageCount: agg.aggregateMessageCount,
      aggregateByteCount: agg.aggregateByteCount,
      messagesPerSec: directRates.messagesPerSec > 0 ? directRates.messagesPerSec : agg.aggregateMessagesPerSec,
      bytesPerSec: directRates.bytesPerSec > 0 ? directRates.bytesPerSec : agg.aggregateBytesPerSec,
      lastSeen: this.lastSeen,
      lastQoS: this.lastQoS,
      lastRetained: this.lastRetained,
      lastFormat: this.lastFormat,
      lastPayloadSnippet: this.lastPayloadSnippet
    };

    if (currentDepth < maxDepth && this.children.size > 0) {
      serialized.children = Array.from(this.children.values()).map(child =>
        child.serialize(maxDepth, currentDepth + 1, now)
      );
    }

    return serialized;
  }
}

export class TopicTrie {
  public root: TopicNode;
  private totalMessagesCount = 0;
  private totalBytesCount = 0;
  private globalRate = new SlidingRateCalculator(10000);

  constructor() {
    this.root = new TopicNode('root', '');
  }

  /**
   * Inserts a message on a given topic, dynamically building the trie levels.
   */
  public insert(topic: string, meta: MessageMeta): TopicNode {
    const now = meta.timestamp ?? Date.now();
    this.totalMessagesCount++;
    this.totalBytesCount += meta.bytes;
    this.globalRate.record(meta.bytes, now);

    const levels = topic.split('/');
    let current = this.root;
    let accumulatedPath = '';

    for (let i = 0; i < levels.length; i++) {
      const seg = levels[i];
      accumulatedPath = i === 0 ? seg : `${accumulatedPath}/${seg}`;

      let child = current.children.get(seg);
      if (!child) {
        child = new TopicNode(seg, accumulatedPath, current);
        current.children.set(seg, child);
      }
      current = child;
    }

    current.recordMessage(meta);
    return current;
  }

  /**
   * Finds a node by exact topic path.
   */
  public find(topic: string): TopicNode | null {
    if (!topic || topic === '') return this.root;
    const levels = topic.split('/');
    let current = this.root;

    for (const seg of levels) {
      const child = current.children.get(seg);
      if (!child) return null;
      current = child;
    }

    return current;
  }

  /**
   * Finds all leaf or intermediate topics matching an MQTT topic filter (e.g. "sensors/+/temperature", "factory/#").
   */
  public findMatching(filter: string): TopicNode[] {
    const results: TopicNode[] = [];
    const queue: TopicNode[] = [this.root];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node !== this.root && matchesTopic(filter, node.fullTopic)) {
        results.push(node);
      }
      for (const child of node.children.values()) {
        queue.push(child);
      }
    }

    return results;
  }

  /**
   * Returns all active topics with at least one message.
   */
  public getAllTopics(): string[] {
    const topics: string[] = [];
    const walk = (node: TopicNode) => {
      if (node.isLeaf) {
        topics.push(node.fullTopic);
      }
      for (const child of node.children.values()) {
        walk(child);
      }
    };
    walk(this.root);
    return topics;
  }

  /**
   * Serializes the entire trie tree into a hierarchy object suitable for D3.js.
   */
  public toHierarchy(maxDepth = 20): SerializedTopicNode {
    return this.root.serialize(maxDepth, 0);
  }

  /**
   * Computes global metrics across the trie.
   */
  public getGlobalStats(): TrieGlobalStats {
    const rates = this.globalRate.getRates();
    return {
      totalTopics: this.getAllTopics().length,
      totalMessages: this.totalMessagesCount,
      totalBytes: this.totalBytesCount,
      messagesPerSec: rates.messagesPerSec,
      bytesPerSec: rates.bytesPerSec
    };
  }

  /**
   * Clears the entire trie tree and resets counters.
   */
  public clear(): void {
    this.root = new TopicNode('root', '');
    this.totalMessagesCount = 0;
    this.totalBytesCount = 0;
    this.globalRate = new SlidingRateCalculator(10000);
  }
}
