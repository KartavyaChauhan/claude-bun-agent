// Coding Agent - Communicates with Gemini CLI over ACP
import { spawn, ChildProcess } from "child_process";
import { confirm, intro, outro, spinner, text, isCancel } from "@clack/prompts";
import { loadSession, saveSession } from "./session-manager";
import { readFile } from "fs/promises";

const USE_SIMULATOR = process.env.USE_SIMULATOR === "true";

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.0-pro",
];

let currentModelIndex = 0;
let serverProcess: ChildProcess;
let stdin: NodeJS.WritableStream;

function getCurrentModel(): string {
  return CANDIDATE_MODELS[currentModelIndex] ?? "gemini-2.5-flash";
}

function getServerArgs(model: string): string[] {
  return [
    "--experimental-acp",
    "--output-format",
    "stream-json",
    "--approval-mode",
    "auto_edit",
    "--model",
    model,
  ];
}

function spawnServer(): void {
  const model = getCurrentModel();
  console.log(`🔄 Using model: ${model}`);
  
  let SERVER_COMMAND: string;
  let SERVER_ARGS: string[];

  if (USE_SIMULATOR) {
    SERVER_COMMAND = "npx";
    SERVER_ARGS = ["tsx", "gemini-simulator.ts"];
  } else {
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ Error: GEMINI_API_KEY missing. Set it in .env or pass via environment.");
      process.exit(1);
    }
    SERVER_COMMAND = "node_modules\\.bin\\gemini";
    SERVER_ARGS = getServerArgs(model);
  }

  serverProcess = spawn(SERVER_COMMAND, SERVER_ARGS, {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, NO_COLOR: "1" },
    shell: true,
  });

  stdin = serverProcess.stdin!;
}

function send(msg: any) {
  const json = JSON.stringify(msg);
  stdin.write(`${json}\n`);
}

let currentSessionId: string | null = null;
let currentSpinner: any = null;

function isQuotaError(msg: any): boolean {
  const s = JSON.stringify(msg).toLowerCase();
  return s.includes("quota") || s.includes("rate limit") || s.includes("resource_exhausted") || 
         s.includes("429") || s.includes("empty response") || s.includes("internal error");
}

async function tryNextModel(): Promise<boolean> {
  currentModelIndex++;
  if (currentModelIndex >= CANDIDATE_MODELS.length) {
    console.error("❌ All models exhausted. No quota available.");
    return false;
  }
  
  console.log(`\n⚠️ Quota exceeded! Switching to next model...`);
  isModelSwitching = true;
  serverProcess.kill();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spawnServer();
  currentSessionId = null;
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: 20241105,
      clientInfo: { name: "NodeAgent", version: "1" },
      clientCapabilities: {
        sampling: true,
        fs: {
          subscribe: true,
          listChanged: true,
          readTextFile: true,
          writeTextFile: true,
        },
      },
      capabilities: { sampling: {} },
    },
  });
  
  listenLoop(currentSpinner);
  return true;
}

async function main() {
  intro("🚀 Coding Agent (ACP)");
  currentSpinner = spinner();
  currentSpinner.start("Connecting...");
  spawnServer();
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: 20241105,
      clientInfo: { name: "NodeAgent", version: "1" },
      clientCapabilities: {
        sampling: true,
        fs: {
          subscribe: true,
          listChanged: true,
          readTextFile: true,
          writeTextFile: true,
        },
      },
      capabilities: { sampling: {} },
    },
  });

  listenLoop(currentSpinner);
}

let isModelSwitching = false;

async function listenLoop(s: any) {
  let buffer = "";
  
  serverProcess.stdout!.on("data", async (chunk: Buffer) => {
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";

    for (const line of parts) {
      if (!line.trim().startsWith("{")) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.method !== "session/update") console.log("[ACP]", msg.method || `id:${msg.id}`);
        if (msg.error) console.log("[ERROR]", JSON.stringify(msg.error));
        if (msg.id === 1 && msg.result) s.stop("Connected!");
        await handleMessage(msg);
      } catch {}
    }
  });

  serverProcess.on("close", (code: number) => {
    if (isModelSwitching) {
      isModelSwitching = false;
      return;
    }
    console.log(`\nAdapter exited with code ${code}`);
    process.exit(code || 0);
  });
}

async function handleMessage(msg: any) {
  if (msg.error && isQuotaError(msg)) {
    console.log(`\n⚠️ Quota error detected: ${JSON.stringify(msg.error).substring(0, 100)}`);
    const switched = await tryNextModel();
    if (!switched) {
      process.exit(1);
    }
    return;
  }

  if (msg.id === 1 && msg.result) {
    console.log(`✅ Handshake OK`);
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "authenticate",
      params: {
        methodId: "gemini-api-key",
        authMethod: {
          id: "gemini-api-key",
          name: "Use Gemini API key",
          description: "Authenticate with Gemini API key",
          credentials: process.env.GEMINI_API_KEY,
        },
      },
    });
    return;
  }

  if (msg.id === 2) {
    if (msg.error) {
      if (isQuotaError(msg)) {
        const switched = await tryNextModel();
        if (!switched) process.exit(1);
        return;
      }
      console.error("❌ Auth Failed:", JSON.stringify(msg.error));
      process.exit(1);
    }
    console.log(`✅ Authenticated! Creating Session...`);
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "session/new",
      params: { cwd: process.cwd(), mcpServers: [] },
    });
    return;
  }

  if (msg.id === 3) {
    if (msg.error) {
      if (isQuotaError(msg)) {
        const switched = await tryNextModel();
        if (!switched) process.exit(1);
        return;
      }
      console.error("❌ Session Creation Failed:", JSON.stringify(msg.error));
      process.exit(1);
    }
    const sessionId = msg.result?.sessionId || msg.result?.id || `session-${Date.now()}`;
    currentSessionId = sessionId;
    console.log(`✅ Session Active: ${currentSessionId} (Model: ${getCurrentModel()})`);
    await saveSession(currentSessionId!);
    const previousSession = await loadSession();
    if (previousSession && previousSession.sessionId !== currentSessionId) {
      console.log(`💾 Previous session found: ${previousSession.sessionId} (${previousSession.lastActive})`);
    }
    
    await askUser();
    return;
  }

  if (msg.method === "sampling/createMessage") {
    const content = msg.params?.content || [];
    const tool = content.find((c: any) => c.type === "tool_use");
    const textVal = content.find((c: any) => c.type === "text");

    if (textVal) console.log(`\n🤖 AI: ${textVal.text}`);
    if (tool) await handleToolExecution(tool);
    if (!tool) await askUser();
  }

  if (msg.method === "session/update") {
    const update = msg.params?.update;
    if (!update) return;
    if (update.sessionUpdate === "agent_message_chunk" && update.content?.text) process.stdout.write(update.content.text);
    if (update.sessionUpdate === "agent_thought_chunk" && update.content?.text) console.log(`\n💭 ${update.content.text}`);
    if (update.sessionUpdate === "tool_call") console.log(`\n🔧 ${update.toolCallId?.split("-")[0] || "tool"} [${update.status}]`);
    if (update.sessionUpdate === "tool_call_update" && update.status === "complete") console.log(`   ✅ Done`);
    return;
  }

  if (msg.result?.stopReason === "end_turn") {
    console.log("\n");
    await askUser();
    return;
  }

  if (msg.result?.content) {
    const textVal = msg.result.content.find((c: any) => c.type === "text");
    if (textVal) console.log(`\n🤖 AI: ${textVal.text}`);
    await askUser();
  }

  // Handle any other errors (like empty response)
  if (msg.error) {
    console.log(`\n❌ Error: ${msg.error.message || JSON.stringify(msg.error)}`);
    if (isQuotaError(msg)) {
      const switched = await tryNextModel();
      if (!switched) process.exit(1);
    } else {
      await askUser();
    }
  }
}

async function askUser() {
  console.log("");
  const userQuery = await text({
    message: "What would you like to do?",
    placeholder: "e.g. 'List files', 'Read README', or 'Hello'",
  });

  if (isCancel(userQuery)) {
    outro("Goodbye!");
    process.exit(0);
  }

  if (currentSessionId) {
    send({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "session/prompt",
      params: {
        sessionId: currentSessionId,
        prompt: [{ type: "text", text: userQuery }],
      },
    });
  }
}

async function handleToolExecution(tool: any) {
  const shouldRun = await confirm({
    message: `Allow tool execution: ${tool.name}?`,
    initialValue: false,
  });

  if (shouldRun) {
    if (tool.name === "terminal/execute") {
      const proc = spawn(tool.input.command, [], { shell: true, stdio: ["pipe", "pipe", "inherit"] });
      let output = "";
      proc.stdout?.on("data", (d: Buffer) => output += d.toString());
      proc.on("close", () => {
        console.log(`📄 OUTPUT:\n${output.trim()}`);
      });
    } else if (tool.name === "fs/read_text_file") {
      try {
        const content = await readFile(tool.input.path, "utf-8");
        console.log(`📄 FILE CONTENT:\n${content.substring(0, 500)}...`);
      } catch (e) {
        console.log("File not found");
      }
    } else if (tool.name === "fs/write_text_file" || tool.name === "edit_file" || tool.name === "create_file") {
      const { writeFile } = await import("fs/promises");
      try {
        await writeFile(tool.input.path, tool.input.content || tool.input.text || "", "utf-8");
        console.log(`📝 File written: ${tool.input.path}`);
      } catch (e) {
        console.log(`❌ Failed to write file: ${e}`);
      }
    }
    console.log("✅ Tool executed.");
  } else {
    console.log("❌ Rejected.");
  }
  await askUser();
}

main();