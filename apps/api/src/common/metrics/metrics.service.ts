import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly requestDurations: number[] = [];

  increment(counter: string, by = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + by);
  }

  observeRequest(durationMs: number): void {
    this.requestDurations.push(durationMs);

    if (this.requestDurations.length > 500) {
      this.requestDurations.shift();
    }
  }

  snapshot(): Record<string, unknown> {
    const total = this.requestDurations.length;
    const avgDurationMs =
      total === 0
        ? 0
        : this.requestDurations.reduce((sum, value) => sum + value, 0) / total;

    return {
      counters: Object.fromEntries(this.counters.entries()),
      requests: {
        sampled: total,
        avgDurationMs: Number(avgDurationMs.toFixed(2)),
      },
    };
  }
}
