/**
 * Physics and Stochastic Simulation Engine
 * Generates continuous, realistic physical sensor telemetry using Ornstein-Uhlenbeck
 * mean-reverting processes, diurnal cycles, and Box-Muller Gaussian noise.
 */

export class PhysicsEngine {
  /**
   * Generates Gaussian (normally distributed) random noise with mean 0 and stdDev 1.
   * Uses Box-Muller transform.
   */
  public static gaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Ornstein-Uhlenbeck continuous mean-reverting process step.
   * dx = theta * (mean - x) * dt + sigma * dW
   *
   * @param current Current value
   * @param targetMean The equilibrium center
   * @param theta Reversion rate (higher = returns to mean faster)
   * @param sigma Volatility / random walk intensity
   * @param dt Time delta step
   */
  public static meanRevert(
    current: number,
    targetMean: number,
    theta = 0.15,
    sigma = 0.5,
    dt = 1.0
  ): number {
    const drift = theta * (targetMean - current) * dt;
    const diffusion = sigma * Math.sqrt(dt) * PhysicsEngine.gaussian();
    return current + drift + diffusion;
  }

  /**
   * Diurnal cycle offset (representing solar or daytime variation).
   * @param hourOfDay 0-24 floating point
   * @param amplitude Peak difference from mean
   */
  public static diurnal(hourOfDay: number, amplitude = 5.0): number {
    // Peak temperature around 14:00 (2 PM), minimum around 04:00 (4 AM)
    const radians = ((hourOfDay - 8) / 24) * 2 * Math.PI;
    return Math.sin(radians) * amplitude;
  }

  /**
   * Clamps a value between min and max bounds.
   */
  public static clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Simulates realistic vehicle navigation step (smooth turning & velocity).
   */
  public static stepGPS(
    lat: number,
    lon: number,
    speedKmh: number,
    headingDeg: number,
    dtSeconds: number
  ): { nextLat: number; nextLon: number; nextHeading: number } {
    // 1 km/h is ~0.27778 m/s
    const speedMs = speedKmh * 0.27778;
    const distanceMeters = speedMs * dtSeconds;

    // Heading slight random perturbation
    const headingWobble = PhysicsEngine.gaussian() * 2.0;
    const nextHeading = (headingDeg + headingWobble + 360) % 360;

    const headingRad = (nextHeading * Math.PI) / 180;
    // Rough approximation: 1 deg lat ~ 111,000m, 1 deg lon ~ 111,000m * cos(lat)
    const deltaLat = (distanceMeters * Math.cos(headingRad)) / 111000;
    const deltaLon = (distanceMeters * Math.sin(headingRad)) / (111000 * Math.cos((lat * Math.PI) / 180));

    return {
      nextLat: lat + deltaLat,
      nextLon: lon + deltaLon,
      nextHeading
    };
  }
}
