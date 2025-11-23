import WebSocket from "ws";

export class ACPClient {
  private ws: WebSocket;
  private nextId = 1;
  private handlers = new Map<number, (msg: any) => void>();

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.ws.on("message", (data: WebSocket.Data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.handlers.has(msg.id)) {
        this.handlers.get(msg.id)!(msg);
      } else {
        this.onNotification?.(msg);
      }
    });
  }

  onNotification?: (msg: any) => void;
  onOpen(callback: () => void) {
    this.ws.on("open", callback);
  }

  send(method: string, params: any = {}) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    this.ws.send(JSON.stringify(payload));
    return id;
  }

  request(method: string, params: any) {
    return new Promise<any>((res) => {
      const id = this.send(method, params);
      this.handlers.set(id, (resp: any) => {
        this.handlers.delete(id);
        res(resp);
      });
    });
  }
}
