import { EventEmitter } from 'events';

/**
 * Simple application-level event bus.
 * Used to bridge domain events (e.g. new inquiry created) to SSE connections.
 */
class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // support many concurrent admin SSE connections
  }

  /** Broadcast a typed event to all SSE listeners */
  broadcast(event: string, data?: unknown) {
    this.emit('sse', { event, data, timestamp: new Date().toISOString() });
  }
}

export const eventBus = new AppEventBus();
