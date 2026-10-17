import { AppState } from './state.js';

export function renderPrometheusMetrics(state: AppState): string {
  const globalStats = (state.trie?.getGlobalStats ? state.trie.getGlobalStats() : (state as any).getStats?.()) || {
    totalMessages: 0,
    totalBytes: 0,
    totalTopics: 0,
    messagesPerSec: 0,
    bytesPerSec: 0
  };

  const fleetStats = (state.simulator?.getStats ? state.simulator.getStats() : (state as any).getFleetStats?.()) || {
    running: false,
    fleetSize: 0,
    totalPublished: 0,
    totalDropped: 0,
    totalCorrupted: 0,
    totalDisconnects: 0
  };

  const rules = state.rulesEngine?.getRules ? state.rulesEngine.getRules() : ((state as any).getRules?.() || []);
  const alerts = state.rulesEngine?.getAlerts ? state.rulesEngine.getAlerts() : ((state as any).getAlerts?.() || []);
  const unreadAlerts = alerts.filter((a: any) => !a.read).length;
  const activeRules = rules.filter((r: any) => r.enabled).length;

  const lines: string[] = [
    '# HELP mqtt_messages_received_total Cumulative count of MQTT messages indexed into the Trie',
    '# TYPE mqtt_messages_received_total counter',
    `mqtt_messages_received_total ${globalStats.totalMessages}`,
    '',
    '# HELP mqtt_bytes_received_total Cumulative payload bytes received',
    '# TYPE mqtt_bytes_received_total counter',
    `mqtt_bytes_received_total ${globalStats.totalBytes}`,
    '',
    '# HELP mqtt_topics_active Number of unique active topic paths in the Trie',
    '# TYPE mqtt_topics_active gauge',
    `mqtt_topics_active ${globalStats.totalTopics}`,
    '',
    '# HELP mqtt_message_rate_current Moving 10-second message rate per second',
    '# TYPE mqtt_message_rate_current gauge',
    `mqtt_message_rate_current ${globalStats.messagesPerSec}`,
    '',
    '# HELP mqtt_bytes_rate_current Moving 10-second throughput in bytes per second',
    '# TYPE mqtt_bytes_rate_current gauge',
    `mqtt_bytes_rate_current ${globalStats.bytesPerSec}`,
    '',
    '# HELP mqtt_fleet_nodes_active Number of simulated IoT virtual nodes',
    '# TYPE mqtt_fleet_nodes_active gauge',
    `mqtt_fleet_nodes_active ${fleetStats.fleetSize}`,
    '',
    '# HELP mqtt_fleet_published_total Number of messages published by fleet simulator',
    '# TYPE mqtt_fleet_published_total counter',
    `mqtt_fleet_published_total ${fleetStats.totalPublished}`,
    '',
    '# HELP mqtt_fleet_dropped_total Number of messages dropped by chaos fault injector',
    '# TYPE mqtt_fleet_dropped_total counter',
    `mqtt_fleet_dropped_total ${fleetStats.totalDropped}`,
    '',
    '# HELP mqtt_fleet_corrupted_total Number of messages with bit corruption injected',
    '# TYPE mqtt_fleet_corrupted_total counter',
    `mqtt_fleet_corrupted_total ${fleetStats.totalCorrupted}`,
    '',
    '# HELP mqtt_fleet_disconnects_total Number of simulated sudden connection terminations',
    '# TYPE mqtt_fleet_disconnects_total counter',
    `mqtt_fleet_disconnects_total ${fleetStats.totalDisconnects}`,
    '',
    '# HELP mqtt_rules_total Total number of configured telemetry evaluation rules',
    '# TYPE mqtt_rules_total gauge',
    `mqtt_rules_total ${rules.length}`,
    '',
    '# HELP mqtt_rules_active Number of active enabled rules',
    '# TYPE mqtt_rules_active gauge',
    `mqtt_rules_active ${activeRules}`,
    '',
    '# HELP mqtt_alerts_total Total count of triggered telemetry alerts',
    '# TYPE mqtt_alerts_total counter',
    `mqtt_alerts_total ${alerts.length}`,
    '',
    '# HELP mqtt_alerts_unread Number of unread alerts',
    '# TYPE mqtt_alerts_unread gauge',
    `mqtt_alerts_unread ${unreadAlerts}`,
    ''
  ];

  return lines.join('\n');
}

export const generatePrometheusMetrics = renderPrometheusMetrics;
