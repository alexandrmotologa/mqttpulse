import { PhysicsEngine } from './physics.js';

export type DeviceProfileType = 'fleet_vehicle' | 'hvac_industrial' | 'smart_meter' | 'weather_station' | 'robotics_actuator';

export interface DeviceTelemetryState {
  deviceId: string;
  type: DeviceProfileType;
  topic: string;
  data: Record<string, unknown>;
  internalState: Record<string, number>;
}

export interface DeviceProfileDefinition {
  type: DeviceProfileType;
  name: string;
  defaultTopicPattern: string;
  createState: (deviceId: string, index: number) => DeviceTelemetryState;
  updateState: (state: DeviceTelemetryState, dtSeconds: number) => Record<string, unknown>;
}

export const DEVICE_PROFILES: Record<DeviceProfileType, DeviceProfileDefinition> = {
  fleet_vehicle: {
    type: 'fleet_vehicle',
    name: 'Connected Fleet Vehicle',
    defaultTopicPattern: 'fleet/{id}/telemetry',
    createState: (deviceId, index) => {
      // Base around major metro coordinates with slight offset
      const baseLat = 47.0245 + (index % 10) * 0.01;
      const baseLon = 28.8322 + ((index / 10) % 10) * 0.01;
      return {
        deviceId,
        type: 'fleet_vehicle',
        topic: `fleet/${deviceId}/telemetry`,
        data: {},
        internalState: {
          lat: baseLat,
          lon: baseLon,
          speedKmh: 45 + Math.random() * 20,
          heading: Math.random() * 360,
          fuelPct: 80 - Math.random() * 30,
          engineTemp: 90,
          rpm: 2100,
          batteryV: 13.8,
          odometerKm: 12000 + index * 150
        }
      };
    },
    updateState: (state, dtSeconds) => {
      const s = state.internalState;
      // Step GPS
      const targetSpeed = 50 + PhysicsEngine.diurnal((Date.now() / 3600000) % 24, 15);
      s.speedKmh = PhysicsEngine.clamp(
        PhysicsEngine.meanRevert(s.speedKmh, targetSpeed, 0.2, 3.0, dtSeconds),
        0,
        140
      );

      const nav = PhysicsEngine.stepGPS(s.lat, s.lon, s.speedKmh, s.heading, dtSeconds);
      s.lat = nav.nextLat;
      s.lon = nav.nextLon;
      s.heading = nav.nextHeading;

      // Fuel burn
      s.fuelPct = Math.max(0, s.fuelPct - (s.speedKmh / 100) * 0.005 * dtSeconds);
      if (s.fuelPct <= 2) s.fuelPct = 100; // auto-refuel

      // Engine parameters
      s.rpm = Math.round(s.speedKmh > 5 ? 1200 + s.speedKmh * 35 + PhysicsEngine.gaussian() * 50 : 800);
      s.engineTemp = Number(
        PhysicsEngine.clamp(
          PhysicsEngine.meanRevert(s.engineTemp, 92 + (s.speedKmh / 140) * 10, 0.1, 0.3, dtSeconds),
          80,
          115
        ).toFixed(1)
      );
      s.batteryV = Number(
        PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.batteryV, 13.8, 0.1, 0.05, dtSeconds), 11.8, 14.4).toFixed(2)
      );
      s.odometerKm += (s.speedKmh / 3600) * dtSeconds;

      return {
        deviceId: state.deviceId,
        timestamp: Date.now(),
        location: {
          latitude: Number(s.lat.toFixed(6)),
          longitude: Number(s.lon.toFixed(6)),
          heading: Math.round(s.heading)
        },
        speedKmh: Math.round(s.speedKmh),
        engineRpm: s.rpm,
        engineTempC: s.engineTemp,
        fuelLevelPct: Number(s.fuelPct.toFixed(1)),
        batteryVoltage: s.batteryV,
        odometerKm: Number(s.odometerKm.toFixed(2))
      };
    }
  },

  hvac_industrial: {
    type: 'hvac_industrial',
    name: 'Industrial HVAC Unit',
    defaultTopicPattern: 'hvac/{id}/telemetry',
    createState: (deviceId) => ({
      deviceId,
      type: 'hvac_industrial',
      topic: `hvac/${deviceId}/telemetry`,
      data: {},
      internalState: {
        zoneTemp: 22.5,
        setpoint: 21.0,
        compressorOn: 1,
        powerKw: 12.4,
        airflowCfm: 1850,
        filterDeltaPa: 120
      }
    }),
    updateState: (state, dtSeconds) => {
      const s = state.internalState;
      // Cycle compressor
      if (s.zoneTemp > s.setpoint + 1.2) s.compressorOn = 1;
      if (s.zoneTemp < s.setpoint - 0.5) s.compressorOn = 0;

      const targetTemp = s.compressorOn ? s.setpoint - 0.5 : s.setpoint + 2.5;
      s.zoneTemp = Number(PhysicsEngine.meanRevert(s.zoneTemp, targetTemp, 0.05, 0.1, dtSeconds).toFixed(2));
      s.powerKw = Number(
        PhysicsEngine.clamp(s.compressorOn ? 14 + PhysicsEngine.gaussian() * 0.8 : 0.8 + PhysicsEngine.gaussian() * 0.1, 0.5, 20).toFixed(2)
      );
      s.airflowCfm = Math.round(s.compressorOn ? 2100 + PhysicsEngine.gaussian() * 40 : 400 + PhysicsEngine.gaussian() * 15);
      s.filterDeltaPa = Number(PhysicsEngine.meanRevert(s.filterDeltaPa, 125, 0.02, 0.5, dtSeconds).toFixed(1));

      return {
        deviceId: state.deviceId,
        timestamp: Date.now(),
        zoneTemperatureC: s.zoneTemp,
        setpointC: s.setpoint,
        compressorActive: s.compressorOn === 1,
        powerConsumptionKw: s.powerKw,
        airflowCfm: s.airflowCfm,
        filterPressureDropPa: s.filterDeltaPa,
        status: s.filterDeltaPa > 160 ? 'FILTER_WARNING' : 'NORMAL'
      };
    }
  },

  smart_meter: {
    type: 'smart_meter',
    name: 'Three-Phase Smart Energy Meter',
    defaultTopicPattern: 'meters/{id}/grid',
    createState: (deviceId, index) => ({
      deviceId,
      type: 'smart_meter',
      topic: `meters/${deviceId}/grid`,
      data: {},
      internalState: {
        voltage: 230,
        current: 12.5,
        powerFactor: 0.94,
        frequency: 50.0,
        totalKwh: 3500 + index * 200
      }
    }),
    updateState: (state, dtSeconds) => {
      const s = state.internalState;
      const hour = (Date.now() / 3600000) % 24;
      // Daily peak load around 19:00 - 22:00
      const loadMultiplier = 1.0 + Math.max(0, Math.sin(((hour - 14) / 12) * Math.PI)) * 0.8;

      s.voltage = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.voltage, 230.5, 0.2, 0.8, dtSeconds), 215, 245).toFixed(2));
      s.current = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.current, 14 * loadMultiplier, 0.1, 1.2, dtSeconds), 1.0, 45.0).toFixed(2));
      s.powerFactor = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.powerFactor, 0.95, 0.1, 0.02, dtSeconds), 0.85, 0.99).toFixed(3));
      s.frequency = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.frequency, 50.0, 0.5, 0.03, dtSeconds), 49.85, 50.15).toFixed(3));

      const activePowerKw = (s.voltage * s.current * s.powerFactor) / 1000;
      const reactivePowerKvar = (s.voltage * s.current * Math.sqrt(1 - s.powerFactor * s.powerFactor)) / 1000;
      s.totalKwh += (activePowerKw / 3600) * dtSeconds;

      return {
        meterId: state.deviceId,
        timestamp: Date.now(),
        voltageV: s.voltage,
        currentA: s.current,
        activePowerKw: Number(activePowerKw.toFixed(3)),
        reactivePowerKvar: Number(reactivePowerKvar.toFixed(3)),
        powerFactor: s.powerFactor,
        gridFrequencyHz: s.frequency,
        cumulativeEnergyKwh: Number(s.totalKwh.toFixed(4))
      };
    }
  },

  weather_station: {
    type: 'weather_station',
    name: 'Environmental Weather Station',
    defaultTopicPattern: 'weather/{id}/readings',
    createState: (deviceId) => ({
      deviceId,
      type: 'weather_station',
      topic: `weather/${deviceId}/readings`,
      data: {},
      internalState: {
        temp: 18.0,
        humidity: 62.0,
        pressure: 1013.25,
        windSpeed: 4.5,
        windDir: 220,
        pm25: 14.0
      }
    }),
    updateState: (state, dtSeconds) => {
      const s = state.internalState;
      const hour = (Date.now() / 3600000) % 24;
      const solarTemp = 18.0 + PhysicsEngine.diurnal(hour, 6.0);

      s.temp = Number(PhysicsEngine.meanRevert(s.temp, solarTemp, 0.05, 0.2, dtSeconds).toFixed(1));
      s.humidity = Number(
        PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.humidity, 75 - (s.temp - 15) * 1.5, 0.05, 0.4, dtSeconds), 20, 99).toFixed(1)
      );
      s.pressure = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.pressure, 1014.0, 0.02, 0.3, dtSeconds), 980, 1045).toFixed(2));
      s.windSpeed = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.windSpeed, 5.0, 0.1, 1.2, dtSeconds), 0, 35).toFixed(1));
      s.windDir = Math.round((s.windDir + PhysicsEngine.gaussian() * 5 + 360) % 360);
      s.pm25 = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.pm25, 12.0, 0.05, 0.8, dtSeconds), 2, 120).toFixed(1));

      return {
        stationId: state.deviceId,
        timestamp: Date.now(),
        temperatureC: s.temp,
        relativeHumidityPct: s.humidity,
        barometricPressureHpa: s.pressure,
        windSpeedMs: s.windSpeed,
        windDirectionDeg: s.windDir,
        airQualityPm25: s.pm25,
        uvIndex: Math.max(0, Math.round(PhysicsEngine.diurnal(hour, 5.5)))
      };
    }
  },

  robotics_actuator: {
    type: 'robotics_actuator',
    name: 'Industrial Robotic Arm Joint',
    defaultTopicPattern: 'factory/robots/{id}/joint_state',
    createState: (deviceId) => ({
      deviceId,
      type: 'robotics_actuator',
      topic: `factory/robots/${deviceId}/joint_state`,
      data: {},
      internalState: {
        angle1: 0,
        angle2: 45,
        angle3: -30,
        torqueNm: 24.5,
        vibrationHz: 48.0,
        jointTemp: 42.0,
        cycleCount: 15400
      }
    }),
    updateState: (state, dtSeconds) => {
      const s = state.internalState;
      // Joint oscillation
      const phase = (Date.now() / 1500) % (2 * Math.PI);
      s.angle1 = Number((Math.sin(phase) * 60 + PhysicsEngine.gaussian() * 0.2).toFixed(2));
      s.angle2 = Number((Math.cos(phase) * 45 + 30 + PhysicsEngine.gaussian() * 0.2).toFixed(2));
      s.angle3 = Number((Math.sin(phase * 1.5) * 40 - 20).toFixed(2));

      s.torqueNm = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.torqueNm, 30 + Math.abs(s.angle1) * 0.2, 0.3, 1.5, dtSeconds), 5, 80).toFixed(2));
      s.vibrationHz = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.vibrationHz, 50.0, 0.2, 2.5, dtSeconds), 10, 120).toFixed(1));
      s.jointTemp = Number(PhysicsEngine.clamp(PhysicsEngine.meanRevert(s.jointTemp, 45.0, 0.05, 0.2, dtSeconds), 30, 85).toFixed(1));
      s.cycleCount += dtSeconds > 0 ? 1 : 0;

      return {
        robotId: state.deviceId,
        timestamp: Date.now(),
        jointsDeg: {
          j1_base: s.angle1,
          j2_shoulder: s.angle2,
          j3_elbow: s.angle3
        },
        motorTorqueNm: s.torqueNm,
        vibrationFrequencyHz: s.vibrationHz,
        jointTemperatureC: s.jointTemp,
        operationalCycles: s.cycleCount,
        status: s.jointTemp > 75 ? 'OVERHEAT_WARNING' : 'HEALTHY'
      };
    }
  }
};
