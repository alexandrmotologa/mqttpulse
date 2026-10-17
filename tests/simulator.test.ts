import { describe, it, expect } from 'vitest';
import { PhysicsEngine } from '../src/simulator/physics.js';
import { ChaosEngine } from '../src/simulator/chaos.js';
import { DEVICE_PROFILES } from '../src/simulator/device_profile.js';
import { FleetSimulatorManager } from '../src/simulator/fleet_manager.js';

describe('IoT Fleet Simulator & Chaos Engine', () => {
  it('computes Ornstein-Uhlenbeck mean-reverting physics steps', () => {
    let val = 100;
    const targetMean = 20;
    // Step forward 30 times
    for (let i = 0; i < 30; i++) {
      val = PhysicsEngine.meanRevert(val, targetMean, 0.2, 0.1, 1.0);
    }
    // Value should have converged close to 20
    expect(val).toBeLessThan(35);
    expect(val).toBeGreaterThan(15);
  });

  it('generates realistic GPS navigation steps', () => {
    const lat = 47.0245;
    const lon = 28.8322;
    const nav = PhysicsEngine.stepGPS(lat, lon, 60, 90, 5); // 60 km/h heading east for 5s
    expect(nav.nextLat).toBeCloseTo(lat, 3);
    expect(nav.nextLon).toBeGreaterThan(lon); // moved east
  });

  it('instantiates all 5 device profiles and updates their state', () => {
    const profiles = Object.keys(DEVICE_PROFILES) as (keyof typeof DEVICE_PROFILES)[];
    expect(profiles.length).toBe(5);

    for (const p of profiles) {
      const def = DEVICE_PROFILES[p];
      const state = def.createState('test_node', 0);
      expect(state.deviceId).toBe('test_node');
      expect(state.topic).toBeDefined();

      const data = def.updateState(state, 1.0);
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
    }
  });

  it('executes chaos drop and jitter correctly', () => {
    const chaos = new ChaosEngine({
      dropRatePct: 100, // always drop
      jitterMinMs: 50,
      jitterMaxMs: 150
    });

    expect(chaos.shouldDrop()).toBe(true);

    const jitter = chaos.getJitterDelay();
    expect(jitter).toBeGreaterThanOrEqual(50);
    expect(jitter).toBeLessThanOrEqual(150);

    // Corruption
    const originalBuf = Buffer.from('UNMODIFIED_TEST_DATA');
    const corrupted = chaos.corruptBuffer(originalBuf);
    expect(corrupted.equals(originalBuf)).toBe(false);
  });

  it('manages fleet sizing from 10 up to 1000 nodes', () => {
    const fleet = new FleetSimulatorManager({
      fleetSize: 250,
      profile: 'smart_meter'
    });

    const stats = fleet.getStats();
    expect(stats.fleetSize).toBe(250);
    expect(stats.profile).toBe('smart_meter');

    fleet.updateConfig({ fleetSize: 1000 });
    expect(fleet.getStats().fleetSize).toBe(1000);
  });
});
