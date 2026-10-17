/**
 * Rolling Metrics & Throughput Estimator
 * Computes rolling message rates and throughput over sliding time windows.
 */

export interface RollingStats {
  count: number;
  bytes: number;
  messagesPerSec: number;
  bytesPerSec: number;
}

export class SlidingRateCalculator {
  private timestamps: number[] = [];
  private byteSizes: number[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 10000) {
    this.windowMs = windowMs;
  }

  /**
   * Records an event with its payload size in bytes.
   */
  public record(bytes = 0, now = Date.now()): void {
    this.timestamps.push(now);
    this.byteSizes.push(bytes);
    this.prune(now);
  }

  /**
   * Drops records older than the window.
   */
  public prune(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    let removeCount = 0;
    while (removeCount < this.timestamps.length && this.timestamps[removeCount] < cutoff) {
      removeCount++;
    }

    if (removeCount > 0) {
      this.timestamps.splice(0, removeCount);
      this.byteSizes.splice(0, removeCount);
    }
  }

  /**
   * Returns estimated rates per second.
   */
  public getRates(now = Date.now()): { messagesPerSec: number; bytesPerSec: number } {
    this.prune(now);
    const count = this.timestamps.length;
    if (count === 0) {
      return { messagesPerSec: 0, bytesPerSec: 0 };
    }

    const windowSeconds = this.windowMs / 1000;
    const totalBytes = this.byteSizes.reduce((acc, val) => acc + val, 0);

    return {
      messagesPerSec: Number((count / windowSeconds).toFixed(2)),
      bytesPerSec: Number((totalBytes / windowSeconds).toFixed(2))
    };
  }

  public get countInWindow(): number {
    return this.timestamps.length;
  }
}
