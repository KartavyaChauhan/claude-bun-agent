import { ACPClient } from "./acpClient";
import * as fs from "fs/promises";
import { exec } from "child_process";

export class Agent {
  private model = "claude-3.5-sonnet";
  private workspace = process.cwd();

  constructor(private acp: ACPClient) {
    acp.onNotification = this.handleNotification.bind(this);
  }

  async init() {
    await this.acp.request("initialize", {
      clientInfo: { name: "BunACPAgent", version: "1.0" },
      protocolVersion: 20241105,
      capabilities: {}
    });
  }

  sendMessage(prompt: string) {
    return this.acp.request("completion", {
      prompt,
      model: this.model
    });
  }

  setModel(name: string) {
    this.model = name;
  }

  setWorkspace(dir: string) {
    this.workspace = dir;
  }

  private async handleNotification(msg: any) {
    if (msg.method === "completionOutput") {
      process.stdout.write(msg.params.text);
    }

    if (msg.method === "completionOutputChunk") {
      process.stdout.write(msg.params.delta);
    }

    if (msg.method === "toolCall") {
      this.handleToolCall(msg.id, msg.params);
    }
  }

  private async handleToolCall(id: number, params: any) {
    const { tool, args } = params;

    try {
      let result: any;

      if (tool === "fs.write") {
        await fs.writeFile(`${this.workspace}/${args.path}`, args.content);
        result = "OK";
      }

      if (tool === "fs.read") {
        result = await fs.readFile(`${this.workspace}/${args.path}`, "utf-8");
      }

      if (tool === "shell") {
        result = await new Promise((res) => {
          exec(args.command, (err, out) => res(err ? err.message : out));
        });
      }

      await this.acp.request("toolResult", { id, result });
    } catch (err: any) {
      await this.acp.request("toolResult", {
        id,
        error: err.message
      });
    }
  }
}
