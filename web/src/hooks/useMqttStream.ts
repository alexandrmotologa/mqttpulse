import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SerializedTopicNode,
  InboundMessage,
  GlobalStats,
  FleetStats,
  FleetConfig,
  ConnectionStatus,
  AlertEvent,
  RuleDefinition,
  GeoMarker,
  RpcTransaction
} from '../types';
import { audioEngine } from '../utils/audio';

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

  // New states
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [geoMarkers, setGeoMarkers] = useState<GeoMarker[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [rpcHistory, setRpcHistory] = useState<RpcTransaction[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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
          if (data.alerts) setAlerts(data.alerts);
          if (data.geoMarkers) setGeoMarkers(data.geoMarkers);
          if (data.recording) {
            setIsRecording(data.recording.isRecording);
            setRecordingCount(data.recording.bufferedCount);
          }
        } else if (data.type === 'status') {
          setStatus(data.status);
          if (data.subscriptions) setSubscriptions(data.subscriptions);
        } else if (data.type === 'message') {
          setMessages((prev) => [data.message, ...prev.slice(0, 499)]);
          audioEngine.playTick();
        } else if (data.type === 'tree_update') {
          setTreeData(data.tree);
          setStats(data.stats);
          if (data.geoMarkers) setGeoMarkers(data.geoMarkers);
        } else if (data.type === 'alert') {
          setAlerts((prev) => [data.alert, ...prev.slice(0, 199)]);
          audioEngine.playAlert(data.alert.severity);
        } else if (data.type === 'fleet_stats') {
          setFleetStats(data.stats);
        } else if (data.type === 'recording_status') {
          setIsRecording(data.isRecording);
        }
      } catch {
        // ignore
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

    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status);
        if (d.config?.url) setBrokerUrl(d.config.url);
        if (d.subscriptions) setSubscriptions(d.subscriptions);
        if (d.stats) setStats(d.stats);
        if (d.simulator) setFleetStats(d.simulator);
        if (d.embeddedBroker?.running !== undefined) setEmbeddedRunning(d.embeddedBroker.running);
        if (d.recorder) setIsRecording(d.recorder.isRecording);
      })
      .catch(() => {});

    fetch('/api/simulator')
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setFleetConfig(d.config);
        if (d.stats) setFleetStats(d.stats);
      })
      .catch(() => {});

    fetch('/api/rules')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRules(d);
      })
      .catch(() => {});

    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setAlerts(d);
      })
      .catch(() => {});

    fetch('/api/geo/markers')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setGeoMarkers(d);
      })
      .catch(() => {});

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMuted(next);
  };

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
    audioEngine.playPublish();
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
    audioEngine.playPublish();
    return d;
  };

  const sendRpc = async (params: { requestTopic: string; payload: unknown; responseTopic?: string; timeoutMs?: number }) => {
    const sentAt = Date.now();
    const corrPreview = `req_${sentAt}`;

    const tx: RpcTransaction = {
      id: corrPreview,
      requestTopic: params.requestTopic,
      responseTopic: params.responseTopic || 'auto-assigned',
      correlationData: corrPreview,
      sentAt,
      status: 'pending',
      requestPayload: params.payload
    };

    setRpcHistory((prev) => [tx, ...prev]);

    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const d = await res.json();
      audioEngine.playPublish();

      setRpcHistory((prev) =>
        prev.map((item) =>
          item.id === corrPreview
            ? {
                ...item,
                status: d.success ? 'success' : 'error',
                latencyMs: d.latencyMs,
                responsePayload: d.payload,
                error: d.error
              }
            : item
        )
      );

      return d;
    } catch (err: unknown) {
      setRpcHistory((prev) =>
        prev.map((item) =>
          item.id === corrPreview
            ? { ...item, status: 'error', error: err instanceof Error ? err.message : String(err) }
            : item
        )
      );
      throw err;
    }
  };

  const clearTree = async () => {
    await fetch('/api/tree/clear', { method: 'POST' });
    setMessages([]);
    setGeoMarkers([]);
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
    audioEngine.playPublish();
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
    audioEngine.playPublish();
    return d;
  };

  // Recording & Replay
  const startRecording = async (name?: string) => {
    await fetch('/api/recording/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    setIsRecording(true);
    audioEngine.playPublish();
  };

  const stopRecording = async () => {
    const res = await fetch('/api/recording/stop', { method: 'POST' });
    const d = await res.json();
    setIsRecording(false);
    return d.session;
  };

  const startReplay = async (speed = 1.0) => {
    await fetch('/api/recording/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    });
    setIsReplaying(true);
    audioEngine.playPublish();
  };

  const stopReplay = async () => {
    await fetch('/api/recording/replay/stop', { method: 'POST' });
    setIsReplaying(false);
  };

  // Alerts & Rules
  const addRule = async (rule: RuleDefinition) => {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    const d = await res.json();
    if (d.rules) setRules(d.rules);
  };

  const deleteRule = async (id: string) => {
    const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.rules) setRules(d.rules);
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/rules/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const d = await res.json();
    if (d.rules) setRules(d.rules);
  };

  const clearAlerts = async () => {
    await fetch('/api/alerts/clear', { method: 'POST' });
    setAlerts([]);
  };

  const markAlertsRead = async () => {
    await fetch('/api/alerts/read', { method: 'POST' });
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
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
    alerts,
    rules,
    geoMarkers,
    isRecording,
    recordingCount,
    isReplaying,
    isMuted,
    rpcHistory,
    toggleMute,
    connectBroker,
    disconnectBroker,
    subscribeTopic,
    unsubscribeTopic,
    publishMessage,
    sendRpc,
    clearTree,
    startSimulator,
    stopSimulator,
    resetSimulator,
    updateSimulatorConfig,
    toggleEmbeddedBroker,
    startRecording,
    stopRecording,
    startReplay,
    stopReplay,
    addRule,
    deleteRule,
    toggleRule,
    clearAlerts,
    markAlertsRead
  };
}
