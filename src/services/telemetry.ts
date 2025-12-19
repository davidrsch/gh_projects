import logger from '../lib/logger';

export function sendEvent(name: string, props?: Record<string, any>) {
  try {
    logger.info(`Telemetry: ${name}`, props || {});
  } catch (e) {
    // swallow - telemetry is best-effort
  }
}

export default { sendEvent };
