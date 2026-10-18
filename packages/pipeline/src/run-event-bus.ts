import { EventEmitter } from "node:events";
import type { RunEvent } from "./run-schema";

/** Delivers a run's events to live subscribers (SSE). The store keeps the durable copy. */
export interface RunEventBus {
  publish(event: RunEvent): void;
  subscribe(runId: string, listener: (event: RunEvent) => void): () => void;
}

/** In-process delivery: the publisher and the subscribers share this process. */
export class LocalRunEventBus implements RunEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: RunEvent): void {
    this.emitter.emit(`run:${event.runId}`, event);
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }
}
