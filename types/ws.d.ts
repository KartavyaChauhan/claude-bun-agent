// Minimal declaration to satisfy TypeScript when '@types/ws' is not installed
declare module "ws" {
  import type { EventEmitter } from "events";

  // Very small surface area required for this project
  export default class WebSocket extends EventEmitter {
    constructor(url: string, protocols?: string | string[]);
    send(data: string | Buffer | ArrayBuffer | SharedArrayBuffer | Uint8Array): void;
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
