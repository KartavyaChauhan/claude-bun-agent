// index.ts
import { spawn } from "bun";
import { confirm, intro, outro, spinner } from "@clack/prompts"; // Nice UI library

// --- CONFIGURATION ---
// Connect to your Gemini Simulator
const SERVER_COMMAND = ["bun", "run", "gemini-simulator.ts"];

console.log("🔌 Client: Connecting to Gemini Simulator...");
const serverProcess = spawn(SERVER_COMMAND, {
  stdin: "pipe", stdout: "pipe", stderr: "inherit",
});

const stdin = serverProcess.stdin;
const reader = serverProcess.stdout.getReader();
const decoder = new TextDecoder();

// Helper: Send ACP Message
function send(msg: any) {
  const json = JSON.stringify(msg);
  const str = `Content-Length: ${json.length}\r\n\r\n${json}`;
  stdin.write(str);
  stdin.flush();
}

async function main() {
  intro("🚀 Bun Coding Agent (ACP)"); // Start the UI

  // 1. HANDSHAKE
  const s = spinner();
  s.start("Connecting to Server...");
  
  send({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { clientInfo: { name: "BunClient", version: "1.0" }, capabilities: { sampling: {} } }
  });

  // 2. LISTEN LOOP
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    
    // Parse LSP Headers
    const parts = text.split("\r\n\r\n");
    const body = (parts.length > 1 ? parts[1] : parts[0]) || "";
    const lines = body.split("\n").filter(l => l.trim().startsWith("{"));

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        // If we connected, stop spinner
        if (msg.result?.serverInfo) s.stop("Connected!");
        
        await handleMessage(msg);
      } catch (e) {}
    }
  }
}

async function handleMessage(msg: any) {
  // A. Handshake Success -> Create Session
  if (msg.result?.serverInfo) {
    send({ jsonrpc: "2.0", id: 2, method: "session/new", params: {} });
  }

  // B. Session Active -> Trigger Test Prompt
  if (msg.result?.sessionId) {
    const sessionId = msg.result.sessionId;
    console.log(`\n✅ Session Active: ${sessionId}`);
    
    // We automatically trigger a test to prove it works
    console.log("🤖 Auto-sending prompt: 'Check files in this folder'");
    
    send({
        jsonrpc: "2.0", id: 3, method: "session/prompt",
        params: {
            sessionId: sessionId,
            messages: [{ role: "user", content: { type: "text", text: "Check files in this folder." } }]
        }
    });
  }

  // C. HANDLE TOOL CALL (The Requirement)
  if (msg.method === "sampling/createMessage") {
     const content = msg.params.content || [];
     const tool = content.find((c: any) => c.type === "tool_use");

     if (tool) {
         await handleToolExecution(tool);
     }
  }
}

// --- THE CORE LOGIC ---
async function handleToolExecution(tool: any) {
    console.log(`\n🛑 SERVER REQUESTS TOOL EXECUTION`);
    
    // 1. Ask User for Permission (Requirement #3)
    const shouldRun = await confirm({
        message: `Allow server to run: ${tool.name}?`,
        initialValue: false
    });

    if (!shouldRun) {
        console.log("❌ User rejected the request.");
        outro("Demo Finished");
        process.exit(0);
    }

    // 2. Execute the Tool (Requirements #5 & #6)
    if (tool.name === "terminal/execute") {
        const cmd = tool.input.command;
        console.log(`> Executing: ${cmd}`);
        
        // Run real shell command
        const proc = spawn(["sh", "-c", cmd], { stdout: "pipe" });
        const output = await new Response(proc.stdout).text();
        
        console.log("📄 OUTPUT:\n" + output.trim());
    } 
    else if (tool.name === "fs/read_text_file") {
        const path = tool.input.path;
        console.log(`> Reading: ${path}`);
        
        // Read real file
        try {
            const file = Bun.file(path);
            const content = await file.text();
            console.log(`📄 CONTENT (${content.length} chars):\n` + content.substring(0, 50) + "...");
        } catch (e) {
            console.error("Failed to read file:", e);
        }
    }

    outro("✅ Tool Execution Successful!");
    process.exit(0); // Exit demo
}

main();