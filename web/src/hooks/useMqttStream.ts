import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SerializedTopicNode,
  InboundMessage,
  GlobalStats,
  FleetStats,
  FleetConfig,
  ConnectionStatus
} from '../types';

export function useMqttStream() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [brokerUrl, setBrokerUrl] = useState<string>('');
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [stats, setStats] = useState<GlobalStats>({
    totalTopics: 0,
    totalMessages: 0,
    totalBytes: 0,
    messagesPerSec: 0,
    bytesPerSec: 0
  });
  const [treeData, setTreeData] = useState<SerializedTopicNode | null>(null);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [fleetConfig, setFleetConfig] = useState<FleetConfig | null>(null);
  const [embeddedRunning, setEmbeddedRunning] = useState<boolean>(false);
  const [selectedNodeTopic, setSelectedNodeTopic] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<InboundMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Handled by Vite proxy in dev or Fastify directly
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // connected
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          setStatus(data.status);
          setSubscriptions(data.subscriptions || []);
          setStats(data.stats);
          setTreeData(data.tree);
          setFleetStats(data.fleetStats);
          setEmbeddedRunning(data.embeddedBroker?.running ?? false);
        } else if (data.type === 'status') {
          setStatus(data.status);
          if (data.subscriptions) setSubscriptions(data.subscriptions);
        } else if (data.type === 'message') {
          setMessages((prev) => [data.message, ...prev.slice(0, 499)]);
        } else if (data.type === 'tree_update') {
          setTreeData(data.tree);
          setStats(data.stats);
        } else if (data.type === 'fleet_stats') {
          setFleetStats(data.stats);
        }
      } catch {
        // ignore malformed ws messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWs();
    // Load initial simulator config and broker status via REST
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status);
        if (d.config?.url) setBrokerUrl(d.config.url);
        if (d.subscriptions) setSubscriptions(d.subscriptions);
        if (d.stats) setStats(d.stats);
        if (d.simulator) setFleetStats(d.simulator);
        if (d.embeddedBroker?.running !== undefined) setEmbeddedRunning(d.embeddedBroker.running);
      })
      .catch(() => {});

    fetch('/api/simulator')
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setFleetConfig(d.config);
        if (d.stats) setFleetStats(d.stats);
      })
      .catch(() => {});

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  // REST API Actions
  const connectBroker = async (params: {
    url: string;
    clientId?: string;
    protocolVersion?: string;
    clean?: boolean;
    username?: string;
    password?: string;
    topic?: string;
  }) => {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    setBrokerUrl(params.url);
    setStatus('connected');
    return d;
  };

  const disconnectBroker = async () => {
    await fetch('/api/disconnect', { method: 'POST' });
    setStatus('disconnected');
  };

  const subscribeTopic = async (topicFilter: string, qos: 0 | 1 | 2 = 0) => {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicFilter, qos })
    });
    const d = await res.json();
    if (d.subscriptions) setSubscriptions(d.subscriptions);
  };

  const unsubscribeTopic = async (topicFilter: string) => {
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicFilter })
    });
    const d = await res.json();
    if (d.subscriptions) setSubscriptions(d.subscriptions);
  };

  const publishMessage = async (params: {
    topic: string;
    payload: unknown;
    qos?: 0 | 1 | 2;
    retain?: boolean;
    properties?: Record<string, unknown>;
  }) => {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d;
  };

  const clearTree = async () => {
    await fetch('/api/tree/clear', { method: 'POST' });
    setMessages([]);
    setStats({
      totalTopics: 0,
      totalMessages: 0,
      totalBytes: 0,
      messagesPerSec: 0,
      bytesPerSec: 0
    });
  };

  const startSimulator = async () => {
    const res = await fetch('/api/simulator/start', { method: 'POST' });
    const d = await res.json();
    if (d.stats) setFleetStats(d.stats);
  };

  const stopSimulator = async () => {
    const res = await fetch('/api/simulator/stop', { method: 'POST' });
    const d = await res.json();
    if (d.stats) setFleetStats(d.stats);
  };

  const resetSimulator = async () => {
    const res = await fetch('/api/simulator/reset', { method: 'POST' });
    const d = await res.json();
    if (d.stats) setFleetStats(d.stats);
  };

  const updateSimulatorConfig = async (newConfig: Partial<FleetConfig>) => {
    const res = await fetch('/api/simulator/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    const d = await res.json();
    if (d.config) setFleetConfig(d.config);
    if (d.stats) setFleetStats(d.stats);
  };

  const toggleEmbeddedBroker = async (action: 'start' | 'stop') => {
    const res = await fetch('/api/broker/embedded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    setEmbeddedRunning(d.running);
    return d;
  };

  return {
    status,
    brokerUrl,
    subscriptions,
    stats,
    treeData,
    messages,
    fleetStats,
    fleetConfig,
    embeddedRunning,
    selectedNodeTopic,
    setSelectedNodeTopic,
    selectedMessage,
    setSelectedMessage,
    connectBroker,
    disconnectBroker,
    subscribeTopic,
    unsubscribeTopic,
    publishMessage,
    clearTree,
    startSimulator,
    stopSimulator,
    resetSimulator,
    updateSimulatorConfig,
    toggleEmbeddedBroker
  };
}
