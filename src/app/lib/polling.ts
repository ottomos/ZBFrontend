const DEVELOPMENT_POLL_INTERVAL_MULTIPLIER = 1;

export function kafkaPollInterval(productionIntervalMs: number): number {
  return process.env.NODE_ENV === 'development'
    ? productionIntervalMs * DEVELOPMENT_POLL_INTERVAL_MULTIPLIER
    : productionIntervalMs;
}