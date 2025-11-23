// transport.ts
import { spawn } from "bun";

// This class manages the "Pipe" between your code and the Claude process
export class ACPClient {
  private process: any;
  private buffer = ""; // A holding area for incoming data chunks
  private pendingRequests = new Map<number, (response: any) => void>();
  private idCounter = 0;

  constructor(command: string, args: string[]) {
    // 1. "Spawn" starts the external program (claude-code-acp)
    this.process = spawn([command, ...args], {
      stdin: "pipe",  // We write to its mouth
      stdout: "pipe", // We listen to its output
      stderr: "inherit", // Errors show up on your screen
    });

    // Start the listening loop immediately
    this.listen();
  }

  // 2. This function sits and waits for data from Claude
  private async listen() {
    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();

    while (true) {
      // Read a chunk of data (it might be half a message, or 3 messages at once)
      const { value, done } = await reader.read();
      if (done) break;

      // Add the chunk to our buffer
      this.buffer += decoder.decode(value);

      // 3. Try to find complete messages (Split by new line)
      // The protocol sends one JSON object per line
      let newlineIndex;
      while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1); // Remove processed line

        if (line) {
          try {
            const json = JSON.parse(line);
            this.handleMessage(json);
          } catch (e) {
            console.error("Error parsing JSON:", e);
          }
        }
      }
    }
  }

  // 4. Decide what to do with a message
  private handleMessage(message: any) {
    // If it's a response to a question we asked (it has an ID we know)
    if (message.id && this.pendingRequests.has(message.id)) {
      const resolve = this.pendingRequests.get(message.id);
      if (resolve) resolve(message);
      this.pendingRequests.delete(message.id);
    } else {
      // If it's a new request FROM Claude (like "I want to run a tool")
      // We will handle this in Phase 3. For now, just log it.
      console.log("Received Notification/Tool Call:", message);
    }
  }

  // 5. The method to send messages OUT
  public sendRequest(method: string, params: any = {}) {
    const id = ++this.idCounter;
    const request = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve) => {
      // Store the "resolve" function so we can call it when the answer comes back
      this.pendingRequests.set(id, resolve);

      // Send the JSON string + a newline character
      const str = JSON.stringify(request) + "\n";
      this.process.stdin.write(new TextEncoder().encode(str));
      this.process.stdin.flush();
    });
  }

  // 6. Send a notification (no id, fire-and-forget)
  public sendNotification(method: string, params: any = {}): void {
    const notification = { jsonrpc: "2.0", method, params };
    const str = JSON.stringify(notification) + "\n";
    this.process.stdin.write(new TextEncoder().encode(str));
    this.process.stdin.flush();
  }
}
