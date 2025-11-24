// gemini-simulator.ts
import { spawn } from "bun";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// Helper to write JSON-RPC messages with LSP Headers (ACP Standard)
function send(data: any) {
  const json = JSON.stringify(data);
  const str = `Content-Length: ${json.length}\r\n\r\n${json}`;
  Bun.stdout.write(encoder.encode(str));
}

async function main() {
  console.error("🤖 Gemini Simulator Started (Ready for ACP)...");

  for await (const chunk of Bun.stdin.stream()) {
    const text = decoder.decode(chunk);
    
    // Handle LSP Headers (Content-Length)
    // ACP messages often look like: "Content-Length: 123\r\n\r\n{...}"
    const parts = text.split("\r\n\r\n");
    const body = (parts.length > 1 ? parts[1] : parts[0]) || "";
    const lines = body.split("\n").filter(l => l.trim().startsWith("{"));

    for (const line of lines) {
      try {
        const req = JSON.parse(line);
        handleRequest(req);
      } catch (e) {
        // ignore partial chunks
      }
    }
  }
}

function handleRequest(req: any) {
  // 1. Handshake
  if (req.method === "initialize") {
    send({
      jsonrpc: "2.0", id: req.id,
      result: { 
          serverInfo: { name: "Gemini-2.5-Pro-Sim", version: "1.0" }, 
          capabilities: { sampling: {} } 
      }
    });
  }
  // 2. Session Creation
  else if (req.method === "session/new") {
    send({ jsonrpc: "2.0", id: req.id, result: { sessionId: "sess_sim_1" } });
  }
  // 3. User Prompt Handling
  else if (req.method === "session/prompt") {
    const msg = (req.params.messages?.[0]?.content?.text || "").toLowerCase();
    
    // SCENARIO: User asks to check files
    if (msg.includes("check") || msg.includes("list") || msg.includes("files")) {
      // Simulate Gemini asking to run 'ls'
      sendToolCall(req.id, "terminal/execute", { command: "ls -la" });
    }
    // SCENARIO: User asks to read a file
    else if (msg.includes("read")) {
      sendToolCall(req.id, "fs/read_text_file", { path: "README.md" });
    }
    else {
      sendText(req.id, "I am ready. Ask me to 'check files' or 'read file'.");
    }
  }
}

function sendToolCall(reqId: any, name: string, args: any) {
  // 1. Send the Tool Request (ACP format)
  send({
    jsonrpc: "2.0",
    method: "sampling/createMessage",
    params: {
      messages: [{ role: "assistant", content: "I need to check the system." }],
      content: [
        { type: "text", text: "I will run a command to check files." },
        { 
          type: "tool_use", 
          id: "call_001", 
          name: name, 
          input: args 
        }
      ]
    }
  });

  // 2. Close the turn shortly after (Simulating server thinking)
  setTimeout(() => {
      send({ jsonrpc: "2.0", id: reqId, result: { stopReason: "tool_use" } });
  }, 100);
}

function sendText(reqId: any, text: string) {
  send({
    jsonrpc: "2.0", id: reqId,
    result: {
      role: "assistant",
      content: [{ type: "text", text }],
      stopReason: "end_turn"
    }
  });
}

main();