#!/usr/bin/env bun
import { ACPClient } from "./src/acpClient";
import { Agent } from "./src/agent";

import fs from "fs";

const adapterPathZed = `${process.env.HOME || process.env.USERPROFILE}/.config/Zed/claude/adapter_info.json`;
const adapterPathCursor = `${process.env.HOME || process.env.USERPROFILE}/.cursor/mcp/agent/bridge.json`;

let url: string | undefined;

if (fs.existsSync(adapterPathZed)) {
  const { host, port, path } = JSON.parse(fs.readFileSync(adapterPathZed, "utf8"));
  url = `ws://${host}:${port}${path}`;
} else if (fs.existsSync(adapterPathCursor)) {
  const data = JSON.parse(fs.readFileSync(adapterPathCursor, "utf8"));
  url = data.url;
} else {
  throw new Error("❌ Claude Code adapter not found. Open Zed or Cursor first.");
}

const acp = new ACPClient(url!);
const agent = new Agent(acp);

acp.onOpen(async () => {
  console.log("↔ Handshaking...");
  await agent.init();
  console.log("✓ Ready!");

  const input = process.argv.slice(2).join(" ");
  agent.sendMessage(input || "Say hello");
});
