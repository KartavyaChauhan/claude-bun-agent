// mock-server.ts
import { spawn } from "bun";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// Helper: Send JSON-RPC message to stdout
function send(data: any) {
  const str = JSON.stringify(data) + "\n";
  Bun.stdout.write(encoder.encode(str));
}

async function main() {
  // Log to stderr so it doesn't interfere with the JSON output stream
  console.error("🤖 Mock Claude Server Started...");

  for await (const chunk of Bun.stdin.stream()) {
    const text = decoder.decode(chunk);
    const lines = text.split("\n").filter(l => l.trim() !== "");

    for (const line of lines) {
      try {
        const req = JSON.parse(line);
        handleRequest(req);
      } catch (e) {
        console.error("Invalid JSON:", e);
      }
    }
  }
}

function handleRequest(req: any) {
  // 1. Handshake (Initialize)
  if (req.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        serverInfo: { name: "MockClaude", version: "1.0.0" },
        capabilities: { sampling: {} }
      }
    });
    return;
  }

  // 2. Create Session
  if (req.method === "session/new") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: { sessionId: "mock-session-123" }
    });
    return;
  }

  // 3. Handle User Prompt
  if (req.method === "session/prompt") {
    const msg = (req.params.messages?.[0]?.content?.text || "").toLowerCase();
    
    if (msg.includes("read")) {
      // SCENARIO: Ask Client to read a file
      triggerToolCall(req.id, "fs/read_text_file", { path: "README.md" });
    } else if (msg.includes("run") || msg.includes("list")) {
      // SCENARIO: Ask Client to run a shell command
      triggerToolCall(req.id, "terminal/execute", { command: "ls -la" });
    } else {
      // SCENARIO: Simple Chat
      sendTextResponse(req.id, "I am the Mock Server. Ask me to 'read a file' or 'run a command'.");
    }
  }
}

function triggerToolCall(reqId: any, toolName: string, args: any) {
  // In ACP, the Server initiates tool use by sending a 'sampling/createMessage' request
  send({
    jsonrpc: "2.0",
    method: "sampling/createMessage",
    params: {
      messages: [{ role: "assistant", content: "I need to use a tool." }],
      systemPrompt: "mock-system",
      content: [
        { type: "text", text: `I need to run: ${toolName}` },
        {
          type: "tool_use",
          id: "call_" + Math.random().toString(36).substr(2, 9),
          name: toolName,
          input: args
        }
      ]
    }
  });

  // Simulate the turn ending shortly after
  setTimeout(() => {
    send({ jsonrpc: "2.0", id: reqId, result: { stopReason: "tool_use" } });
  }, 100);
}

function sendTextResponse(reqId: any, text: string) {
  send({
    jsonrpc: "2.0",
    id: reqId,
    result: {
      role: "assistant",
      content: [{ type: "text", text }],
      stopReason: "end_turn"
    }
  });
}

main();