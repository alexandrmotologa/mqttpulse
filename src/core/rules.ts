import { EventEmitter } from 'events';
import { matchesTopic } from './wildcard.js';

export type RuleOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RuleDefinition {
  id: string;
  name: string;
  topicFilter: string;
  field: string;
  operator: RuleOperator;
  value: number | string | boolean;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMs?: number; // Minimum time between consecutive alerts from this rule
  lastTriggered?: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  topic: string;
  severity: AlertSeverity;
  timestamp: number;
  message: string;
  field: string;
  triggerValue: unknown;
  expectedCondition: string;
  read: boolean;
}

export class RulesEngine extends EventEmitter {
  private rules: Map<string, RuleDefinition> = new Map();
  private alerts: AlertEvent[] = [];

  constructor() {
    super();
    // Preload useful default rules
    this.addRule({
      id: 'rule_high_temp',
      name: 'HVAC Overheat Alarm',
      topicFilter: 'hvac/+/telemetry',
      field: 'zoneTemperatureC',
      operator: '>',
      value: 26.0,
      severity: 'critical',
      enabled: true,
      cooldownMs: 5000
    });

    this.addRule({
      id: 'rule_high_speed',
      name: 'Fleet Speeding Alert',
      topicFilter: 'fleet/+/telemetry',
      field: 'speedKmh',
      operator: '>',
      value: 110,
      severity: 'warning',
      enabled: true,
      cooldownMs: 5000
    });

    this.addRule({
      id: 'rule_high_vibration',
      name: 'Robot Vibration Warning',
      topicFilter: 'factory/robots/+/joint_state',
      field: 'vibrationFrequencyHz',
      operator: '>',
      value: 95.0,
      severity: 'warning',
      enabled: true,
      cooldownMs: 5000
    });
  }

  public addRule(rule: RuleDefinition): void {
    this.rules.set(rule.id, { ...rule, enabled: rule.enabled ?? true });
  }

  public removeRule(id: string): void {
    this.rules.delete(id);
  }

  public clearRules(): void {
    this.rules.clear();
  }

  public toggleRule(id: string, enabled: boolean): void {
    const r = this.rules.get(id);
    if (r) {
      r.enabled = enabled;
    }
  }

  public getRules(): RuleDefinition[] {
    return Array.from(this.rules.values());
  }

  public getAlerts(limit = 100): AlertEvent[] {
    return this.alerts.slice(0, limit);
  }

  public markAlertsRead(): void {
    for (const a of this.alerts) {
      a.read = true;
    }
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  private getFieldValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) return undefined;
    const parts = path.split('.');
    let curr: any = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  private checkCondition(val: unknown, op: RuleOperator, target: unknown): boolean {
    if (val === undefined || val === null) return false;

    if (op === 'contains') {
      return String(val).toLowerCase().includes(String(target).toLowerCase());
    }

    if (typeof target === 'number') {
      const numVal = Number(val);
      if (isNaN(numVal)) return false;
      if (op === '>') return numVal > target;
      if (op === '<') return numVal < target;
      if (op === '>=') return numVal >= target;
      if (op === '<=') return numVal <= target;
      if (op === '==') return numVal === target;
      if (op === '!=') return numVal !== target;
    }

    if (op === '==') return String(val) === String(target);
    if (op === '!=') return String(val) !== String(target);

    return false;
  }

  public evaluate(topic: string, parsedData: unknown): AlertEvent[] {
    if (typeof parsedData !== 'object' || parsedData === null) return [];

    const now = Date.now();
    const triggered: AlertEvent[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (!matchesTopic(rule.topicFilter, topic)) continue;

      // Check cooldown
      const cooldown = rule.cooldownMs ?? 3000;
      if (rule.lastTriggered && now - rule.lastTriggered < cooldown) {
        continue;
      }

      const val = this.getFieldValue(parsedData, rule.field);
      if (val === undefined) continue;

      if (this.checkCondition(val, rule.operator, rule.value)) {
        rule.lastTriggered = now;

        const alert: AlertEvent = {
          id: `alert_${now}_${Math.random().toString(16).substring(2, 6)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          topic,
          severity: rule.severity,
          timestamp: now,
          field: rule.field,
          triggerValue: val,
          expectedCondition: `${rule.field} ${rule.operator} ${rule.value}`,
          message: `${rule.name}: ${rule.field} = ${val} (${rule.operator} ${rule.value}) on ${topic}`,
          read: false
        };

        this.alerts.unshift(alert);
        if (this.alerts.length > 300) {
          this.alerts.pop();
        }

        triggered.push(alert);
        this.emit('alert', alert);
      }
    }

    return triggered;
  }
}
