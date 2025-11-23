import { spawn } from "bun";

// 1. Start the process (Official Adapter)
// Make sure to use the correct command for your system
const process = spawn(["npx", "-y", "@zed-industries/claude-code-acp"], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "inherit",
});

console.log("🕵️ ACP Spy Client Started");

const decoder = new TextDecoder();
const reader = process.stdout.getReader();

// Helper to send JSON
function send(data: any) {
  const str = JSON.stringify(data) + "\n";
  process.stdin.write(new TextEncoder().encode(str));
  process.stdin.flush();
  console.log(`\n>>> SENT [${data.method}]:`, JSON.stringify(data));
}

// Helper to read the next JSON message
async function readNext() {
  const { value, done } = await reader.read();
  if (done) return null;
  const text = decoder.decode(value);
  // Simple parser for now (assumes one JSON per chunk for debugging)
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    console.log("--- RAW CHUNK ---");
    console.log(text);
    return null;
  }
}

async function runHandshake() {
  // STEP 1: INITIALIZE
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      clientInfo: { name: "BunDebug", version: "1.0" },
      protocolVersion: 20241105, // use numeric protocol version required by ACP
      capabilities: {}
    }
  });

  // Wait for Initialize Result
  const initResponse = await readNext();
  console.log("<<< RECEIVED INIT:", initResponse);

  if (!initResponse || initResponse.error) {
    console.error("❌ Init Failed");
    return;
  }

  // STEP 2: CREATE A SESSION
  // We need a session ID before we can chat
  // Provide required params: `cwd` and `mcpServers` (empty list if none)
  send({
    jsonrpc: "2.0",
    id: 2,
    method: "session/new",
    params: {
      cwd: ".",
      mcpServers: []
    }
  });

  const sessionResponse = await readNext();
  console.log("<<< RECEIVED SESSION:", sessionResponse);

  if (!sessionResponse || !sessionResponse.result || !sessionResponse.result.sessionId) {
    console.error("❌ Could not create session. Response:", sessionResponse);
    return;
  }

  const sessionId = sessionResponse.result.sessionId;
  console.log("✅ Session Created! ID:", sessionId);

  // If the adapter requires authentication, you can provide an API key
  // via the environment variable `CLAUDE_API_KEY`. If present, send
  // a `session/auth` request for this session before sending prompts.
  const apiKey = process.env.CLAUDE_API_KEY || process.env.CLAUDE_SESSION_TOKEN;
  if (apiKey) {
    console.log("ℹ️ Found CLAUDE_API_KEY in env — sending session/auth...");
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "session/auth",
      params: {
        sessionId,
        auth: { type: "apiKey", apiKey }
      }
    });

    const authResp = await readNext();
    console.log("<<< RECEIVED AUTH:", authResp);
    if (!authResp || authResp.error) {
      console.error("❌ Authentication failed:", authResp);
      return;
    }
    console.log("✅ Authentication succeeded.");
  } else {
    console.log("⚠️ No CLAUDE_API_KEY found in environment. If the adapter requires authentication, set the env var and re-run:");
    console.log("PowerShell example:");
    console.log("$env:CLAUDE_API_KEY = 'your_api_key_here'; bun run debug.ts");
    console.log("Or export CLAUDE_API_KEY in your shell and rerun.");
    // Continue anyway — some adapters accept unauthenticated prompts depending on config.
  }

  // STEP 3: SEND PROMPT (The actual "Hello")
  // Note the structure: prompt is an Array of content blocks
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "session/prompt",
    params: {
      sessionId: sessionId,
      prompt: [
        { type: "text", text: "Hello Claude, can you hear me?" }
      ]
    }
  });

  // Read the stream of responses (Agent will send 'session/update' notifications)
  while (true) {
    const resp = await readNext();
    if (resp) {
      console.log("<<< CLAUDE SAYS:", JSON.stringify(resp, null, 2));
    }
  }
}

runHandshake();
