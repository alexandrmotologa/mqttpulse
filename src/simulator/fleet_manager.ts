import { EventEmitter } from 'events';
import { encode as encodeCbor } from 'cbor-x';
import { encode as encodeMsgPack } from '@msgpack/msgpack';
import { DEVICE_PROFILES, DeviceProfileType, DeviceTelemetryState } from './device_profile.js';
import { ChaosConfig, ChaosEngine } from './chaos.js';
import { SlidingRateCalculator } from '../core/stats.js';
import { protobufManager } from '../decoders/protobuf.js';
import { MqttConnectionManager } from '../core/client.js';

export type SimulatorFormat = 'json' | 'cbor' | 'msgpack' | 'protobuf';

export interface FleetSimulatorConfig {
  fleetSize: number; // 10 to 1,000
  profile: DeviceProfileType | 'mixed';
  format: SimulatorFormat;
  intervalMs: number;
  qos: 0 | 1 | 2;
  retain: boolean;
  useMqtt5Properties: boolean;
  chaos: ChaosConfig;
}

export interface FleetStats {
  running: boolean;
  fleetSize: number;
  profile: string;
  format: SimulatorFormat;
  intervalMs: number;
  totalGenerated: number;
  totalPublished: number;
  totalDropped: number;
  totalCorrupted: number;
  totalDisconnects: number;
  messagesPerSec: number;
  bytesPerSec: number;
}

export const DEFAULT_FLEET_CONFIG: FleetSimulatorConfig = {
  fleetSize: 50,
  profile: 'mixed',
  format: 'json',
  intervalMs: 1000,
  qos: 0,
  retain: false,
  useMqtt5Properties: true,
  chaos: {
    jitterMinMs: 0,
    jitterMaxMs: 0,
    dropRatePct: 0,
    disconnectRatePct: 0,
    corruptRatePct: 0
  }
};

export class FleetSimulatorManager extends EventEmitter {
  private config: FleetSimulatorConfig;
  private chaosEngine: ChaosEngine;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private devices: DeviceTelemetryState[] = [];
  private mqttClient: MqttConnectionManager | null = null;

  private totalGenerated = 0;
  private totalPublished = 0;
  private totalDropped = 0;
  private totalCorrupted = 0;
  private totalDisconnects = 0;
  private rateCalculator = new SlidingRateCalculator(10000);

  constructor(initialConfig: Partial<FleetSimulatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_FLEET_CONFIG, ...initialConfig };
    this.chaosEngine = new ChaosEngine(this.config.chaos);
    this.initDevices();
  }

  public setMqttClient(client: MqttConnectionManager): void {
    this.mqttClient = client;

    // Automated RPC acknowledgment for virtual fleet devices
    client.on('message', (msg) => {
      if (msg.properties?.responseTopic && msg.properties?.correlationData) {
        const responseTopic = msg.properties.responseTopic;
        const correlationData = msg.properties.correlationData;
        const ackPayload = Buffer.from(
          JSON.stringify({
            status: 'SUCCESS',
            code: 200,
            commandTopic: msg.topic,
            acknowledgedAt: Date.now(),
            details: 'Virtual IoT node processed command successfully'
          })
        );

        setTimeout(() => {
          this.mqttClient?.publish(responseTopic, ackPayload, {
            qos: 1,
            properties: {
              correlationData
            }
          }).catch(() => {});
        }, 120);
      }
    });
  }

  public updateConfig(newConfig: Partial<FleetSimulatorConfig>): void {
    const prevSize = this.config.fleetSize;
    const prevProfile = this.config.profile;

    this.config = {
      ...this.config,
      ...newConfig,
      chaos: {
        ...this.config.chaos,
        ...(newConfig.chaos || {})
      }
    };

    this.chaosEngine.updateConfig(this.config.chaos);

    if (newConfig.fleetSize !== undefined && newConfig.fleetSize !== prevSize) {
      this.initDevices();
    } else if (newConfig.profile !== undefined && newConfig.profile !== prevProfile) {
      this.initDevices();
    }

    if (this.running && newConfig.intervalMs !== undefined) {
      this.restartTimer();
    }

    this.emit('configChange', this.config);
  }

  public getConfig(): FleetSimulatorConfig {
    return { ...this.config };
  }

  public getStats(): FleetStats {
    const rates = this.rateCalculator.getRates();
    return {
      running: this.running,
      fleetSize: this.devices.length,
      profile: this.config.profile,
      format: this.config.format,
      intervalMs: this.config.intervalMs,
      totalGenerated: this.totalGenerated,
      totalPublished: this.totalPublished,
      totalDropped: this.totalDropped,
      totalCorrupted: this.totalCorrupted,
      totalDisconnects: this.totalDisconnects,
      messagesPerSec: rates.messagesPerSec,
      bytesPerSec: rates.bytesPerSec
    };
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.restartTimer();
    this.emit('statusChange', { running: true });
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit('statusChange', { running: false });
  }

  public reset(): void {
    this.stop();
    this.totalGenerated = 0;
    this.totalPublished = 0;
    this.totalDropped = 0;
    this.totalCorrupted = 0;
    this.totalDisconnects = 0;
    this.rateCalculator = new SlidingRateCalculator(10000);
    this.initDevices();
    this.emit('stats', this.getStats());
  }

  private initDevices(): void {
    const profileTypes: DeviceProfileType[] = [
      'fleet_vehicle',
      'hvac_industrial',
      'smart_meter',
      'weather_station',
      'robotics_actuator'
    ];

    this.devices = [];
    const size = Math.min(Math.max(this.config.fleetSize, 1), 1000);

    for (let i = 0; i < size; i++) {
      let selectedType: DeviceProfileType;
      if (this.config.profile === 'mixed') {
        selectedType = profileTypes[i % profileTypes.length];
      } else {
        selectedType = this.config.profile;
      }

      const deviceId = `node_${String(i + 1).padStart(4, '0')}`;
      const definition = DEVICE_PROFILES[selectedType];
      const state = definition.createState(deviceId, i);
      this.devices.push(state);
    }
  }

  private restartTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Sub-batches to distribute load smoothly across the interval window
    const interval = Math.max(this.config.intervalMs, 100);
    this.timer = setInterval(() => {
      this.tick();
    }, interval);
  }

  private async tick(): Promise<void> {
    if (!this.running || this.devices.length === 0) return;

    const dtSeconds = this.config.intervalMs / 1000;

    for (const device of this.devices) {
      this.totalGenerated++;

      // 1. Simulate random disconnects
      if (this.chaosEngine.shouldDisconnect()) {
        this.totalDisconnects++;
        continue;
      }

      // 2. Simulate packet drop
      if (this.chaosEngine.shouldDrop()) {
        this.totalDropped++;
        continue;
      }

      // 3. Update device physical model
      const definition = DEVICE_PROFILES[device.type];
      const data = definition.updateState(device, dtSeconds);
      device.data = data;

      // 4. Encode according to selected format
      let payloadBuffer: Buffer;
      let contentType = 'application/json';

      try {
        if (this.config.format === 'cbor') {
          payloadBuffer = Buffer.from(encodeCbor(data));
          contentType = 'application/cbor';
        } else if (this.config.format === 'msgpack') {
          payloadBuffer = Buffer.from(encodeMsgPack(data));
          contentType = 'application/msgpack';
        } else if (this.config.format === 'protobuf') {
          payloadBuffer = this.encodeProtobufData(device.type, data);
          contentType = 'application/x-protobuf';
        } else {
          payloadBuffer = Buffer.from(JSON.stringify(data));
          contentType = 'application/json';
        }
      } catch (encodeErr) {
        payloadBuffer = Buffer.from(JSON.stringify(data));
      }

      // 5. Simulate payload bit corruption
      let isCorrupted = false;
      if (this.chaosEngine.shouldCorrupt()) {
        payloadBuffer = this.chaosEngine.corruptBuffer(payloadBuffer);
        this.totalCorrupted++;
        isCorrupted = true;
      }

      // 6. Simulate network jitter delay
      const jitterDelay = this.chaosEngine.getJitterDelay();

      const executePublish = async () => {
        if (!this.mqttClient) return;

        const publishOptions: any = {
          qos: this.config.qos,
          retain: this.config.retain
        };

        if (this.config.useMqtt5Properties) {
          publishOptions.properties = {
            contentType,
            userProperties: {
              deviceId: device.deviceId,
              sensorType: device.type,
              timestamp: String(Date.now()),
              format: this.config.format,
              simulated: 'true'
            }
          };
        }

        try {
          await this.mqttClient.publish(device.topic, payloadBuffer, publishOptions);
          this.totalPublished++;
          this.rateCalculator.record(payloadBuffer.length);
        } catch {
          // Broker might be offline or busy
        }
      };

      if (jitterDelay > 0) {
        setTimeout(executePublish, jitterDelay);
      } else {
        executePublish();
      }
    }

    this.emit('stats', this.getStats());
  }

  private encodeProtobufData(type: DeviceProfileType, data: Record<string, any>): Buffer {
    if (type === 'fleet_vehicle') {
      return protobufManager.encode('default_iot', 'iot.VehicleTelemetry', {
        vin: data.deviceId,
        timestamp: data.timestamp,
        speedKmh: data.speedKmh,
        fuelPct: data.fuelLevelPct,
        engineTemp: data.engineTempC,
        latitude: data.location?.latitude ?? 0,
        longitude: data.location?.longitude ?? 0,
        rpm: data.engineRpm
      });
    }

    if (type === 'smart_meter') {
      return protobufManager.encode('default_iot', 'iot.SmartMeter', {
        meterId: data.meterId,
        timestamp: data.timestamp,
        activePower: data.activePowerKw,
        reactivePower: data.reactivePowerKvar,
        voltage: data.voltageV,
        current: data.currentA,
        totalKwh: data.cumulativeEnergyKwh
      });
    }

    // Default to SensorTelemetry
    return protobufManager.encode('default_iot', 'iot.SensorTelemetry', {
      deviceId: data.stationId || data.deviceId || data.robotId || 'sensor',
      timestamp: data.timestamp || Date.now(),
      temperature: data.temperatureC || data.zoneTemperatureC || data.jointTemperatureC || 20,
      humidity: data.relativeHumidityPct || 50,
      pressure: data.barometricPressureHpa || 1013.25,
      batteryPct: data.batteryVoltage ? (data.batteryVoltage / 14.4) * 100 : 95,
      latitude: data.location?.latitude || 0,
      longitude: data.location?.longitude || 0
    });
  }
}
