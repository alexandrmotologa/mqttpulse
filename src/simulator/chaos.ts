/**
 * Chaos and Network Fault Injection Engine
 * Simulates real-world network anomalies: jitter delays, packet drops, socket disconnects, and payload corruption.
 */

export interface ChaosConfig {
  jitterMinMs: number;
  jitterMaxMs: number;
  dropRatePct: number;        // 0 - 100%
  disconnectRatePct: number;  // 0 - 100%
  corruptRatePct: number;     // 0 - 100%
}

export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  jitterMinMs: 0,
  jitterMaxMs: 0,
  dropRatePct: 0,
  disconnectRatePct: 0,
  corruptRatePct: 0
};

export class ChaosEngine {
  private config: ChaosConfig;

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = { ...DEFAULT_CHAOS_CONFIG, ...config };
  }

  public updateConfig(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ChaosConfig {
    return { ...this.config };
  }

  public shouldDrop(): boolean {
    if (this.config.dropRatePct <= 0) return false;
    return Math.random() * 100 < this.config.dropRatePct;
  }

  public shouldDisconnect(): boolean {
    if (this.config.disconnectRatePct <= 0) return false;
    return Math.random() * 100 < this.config.disconnectRatePct;
  }

  public shouldCorrupt(): boolean {
    if (this.config.corruptRatePct <= 0) return false;
    return Math.random() * 100 < this.config.corruptRatePct;
  }

  public getJitterDelay(): number {
    if (this.config.jitterMaxMs <= 0 || this.config.jitterMaxMs <= this.config.jitterMinMs) {
      return this.config.jitterMinMs;
    }
    const range = this.config.jitterMaxMs - this.config.jitterMinMs;
    return Math.round(this.config.jitterMinMs + Math.random() * range);
  }

  /**
   * Intentionally corrupts payload bytes (bit flip or truncated slice) to test subscriber robustness.
   */
  public corruptBuffer(buffer: Buffer): Buffer {
    if (buffer.length === 0) return buffer;
    const copy = Buffer.from(buffer);
    const flipIndex = Math.floor(Math.random() * copy.length);
    copy[flipIndex] = copy[flipIndex] ^ 0xff; // flip bits
    return copy;
  }
}
