// gemini-simulator.ts
import { spawn } from "bun";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function send(data: any) {
  const json = JSON.stringify(data);
  const str = `Content-Length: ${json.length}\r\n\r\n${json}`;
  Bun.stdout.write(encoder.encode(str));
}

async function main() {
  console.error("🤖 Simulator Ready...");

  for await (const chunk of Bun.stdin.stream()) {
    const text = decoder.decode(chunk);
    const parts = text.split("\r\n\r\n");
    const body = (parts.length > 1 ? parts[1] : parts[0]) || "";
    const lines = body.split("\n").filter((l) => l.trim().startsWith("{"));

    for (const line of lines) {
      try {
        const req = JSON.parse(line);
        handleRequest(req);
      } catch (e) {}
    }
  }
}

// gemini-simulator.ts (Update the handleRequest function)

function handleRequest(req: any) {
  if (req.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        serverInfo: { name: "Gemini-Sim", version: "1.0" },
        capabilities: { sampling: {} },
      },
    });
  } else if (req.method === "session/new") {
    send({ jsonrpc: "2.0", id: req.id, result: { sessionId: "sim-session" } });
  } else if (req.method === "session/prompt") {
    const msg = (req.params.messages?.[0]?.content?.text || "").toLowerCase();

    // SCENARIO 1: List Files
    if (msg.includes("list") || msg.includes("files")) {
      sendToolCall(req.id, "terminal/execute", { command: "ls -la" });
    }
    // SCENARIO 2: Read File
    else if (msg.includes("read")) {
      sendToolCall(req.id, "fs/read_text_file", { path: "README.md" });
    }
    // NEW SCENARIO 3: Complex Command (Cat File)
    // Read a file via shell instead of running grep
    else if (msg.includes("search") || msg.includes("cat")) {
      sendToolCall(req.id, "terminal/execute", {
        // This command definitely has output!
        command: 'cat package.json'
      });
    }
    // Chat
    else {
      sendText(req.id, "Try asking me to 'Search for console.log'.");
    }
  }
}

// ... rest of the file stays the same ...

function sendToolCall(reqId: any, name: string, args: any) {
  send({
    jsonrpc: "2.0",
    method: "sampling/createMessage",
    params: {
      messages: [],
      content: [
        { type: "text", text: `I need to run ${name}` },
        { type: "tool_use", id: "call_" + Date.now(), name: name, input: args },
      ],
    },
  });
  // Finish turn after tool request
  setTimeout(
    () =>
      send({ jsonrpc: "2.0", id: reqId, result: { stopReason: "tool_use" } }),
    100
  );
}

function sendText(reqId: any, text: string) {
  send({
    jsonrpc: "2.0",
    id: reqId,
    result: {
      role: "assistant",
      content: [{ type: "text", text }],
      stopReason: "end_turn",
    },
  });
}

main();
