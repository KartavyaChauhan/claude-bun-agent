# 🤖 ACP Coding Agent

A TypeScript coding agent that communicates with **Gemini CLI** over the **Agent Client Protocol (ACP)**, featuring streaming responses, an interactive terminal UI, and resumable sessions.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Gemini](https://img.shields.io/badge/Gemini-CLI-orange?logo=google)

---

## ✨ Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Send Messages** | ✅ | Send prompts to Gemini via ACP `session/prompt` |
| **Receive Messages** | ✅ | Handle responses with streaming `session/update` events |
| **Tool Approval** | ✅ | Interactive confirm dialogs for tool execution |
| **Set Model** | ✅ | Configurable model with `--model` flag + auto-fallback |
| **Workspace Directory** | ✅ | Set via `session/new` with `cwd` parameter |
| **Create Files** | ✅ | Handle `fs/write_text_file`, `create_file`, `edit_file` |
| **Read Files** | ✅ | Handle `fs/read_text_file` tool calls |
| **Run Commands** | ✅ | Execute shell commands via `terminal/execute` |

### 🌟 Extra Credit

| Feature | Status | Description |
|---------|--------|-------------|
| **Streaming** | ✅ | Real-time character-by-character response display |
| **Terminal UI** | ✅ | Beautiful UI with `@clack/prompts` (spinners, icons, prompts) |
| **Resumable Sessions** | ✅ | Session persistence to `.claude-session.json` |
| **Model Fallback** | ✅ | Auto-switch through 5 models on quota errors |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or bun
- Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone https://github.com/KartavyaChauhan/claude-bun-agent.git
cd claude-bun-agent

# Install dependencies
npm install
```

### Running

```bash
# Set your API key and run
$env:GEMINI_API_KEY="your-api-key-here"; npm run start

# Or with bun
$env:GEMINI_API_KEY="your-api-key-here"; bun run index.ts
```

---

## 🏗️ Architecture

```
┌─────────────────┐     ACP/NDJSON      ┌──────────────────┐
│                 │ ◄─────────────────► │                  │
│   Agent (TS)    │     stdin/stdout    │   Gemini CLI     │
│                 │                     │                  │
└─────────────────┘                     └──────────────────┘
        │                                        │
        ▼                                        ▼
  ┌───────────┐                          ┌─────────────┐
  │ Terminal  │                          │  Gemini API │
  │    UI     │                          │             │
  └───────────┘                          └─────────────┘
```

### ACP Protocol Flow

```
1. initialize      →  Handshake with protocol version
2. authenticate    →  API key authentication  
3. session/new     →  Create session with workspace
4. session/prompt  →  Send user messages
5. session/update  ←  Receive streaming responses
```

---

## 📁 Project Structure

```
claude-bun-agent/
├── index.ts              # Main agent - ACP client implementation
├── session-manager.ts    # Session persistence for resume
├── gemini-simulator.ts   # Mock server for testing (optional)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── .env                  # Environment variables (gitignored)
```

---

## 🧪 Testing the Agent

Once running, try these commands:

| Command | Tests |
|---------|-------|
| `Hello` | Basic message send/receive |
| `List files in this folder` | File listing tool |
| `Read package.json` | File reading capability |
| `Create a file called test.txt with "hello"` | File creation |
| `Run: echo Hello World` | Shell command execution |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Your Gemini API key | Required |
| `USE_SIMULATOR` | Use mock server for testing | `false` |

### Model Fallback

The agent automatically tries these models in order on quota errors:

1. `gemini-2.5-flash`
2. `gemini-2.0-flash`
3. `gemini-1.5-flash`
4. `gemini-1.5-flash-8b`
5. `gemini-1.0-pro`

---

## 📝 Development Process

This project was developed iteratively with the following milestones:

1. **Project Setup** - Initial structure, session persistence layer
2. **Transport Layer** - JSON-RPC communication over stdin/stdout
3. **Protocol Research** - ACP handshake and message format exploration
4. **Mock Server** - Simulator for testing without API calls
5. **Gemini Integration** - Switch from mock to real Gemini CLI
6. **Streaming & UI** - Real-time responses with beautiful terminal UI
7. **Error Handling** - Quota detection and model fallback system

See [git log](https://github.com/KartavyaChauhan/claude-bun-agent/commits/main) for detailed commit history.

---

## 🔧 Technical Details

### ACP Message Format

Messages are sent as newline-delimited JSON (NDJSON):

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
{"jsonrpc":"2.0","id":2,"method":"authenticate","params":{...}}
{"jsonrpc":"2.0","id":3,"method":"session/new","params":{...}}
```

### Streaming Response Handling

The agent processes `session/update` messages with different update types:

- `agent_message_chunk` - AI response text (streamed)
- `agent_thought_chunk` - AI reasoning (displayed as 💭)
- `tool_call` - Tool execution status
- `tool_call_update` - Tool completion

---

## 🤝 AI Use Disclosure

In accordance with the assignment's AI Policy, this project was developed with extensive AI assistance. Full transparency is provided below:

### Tools Used

| AI Tool | Usage |
|---------|-------|
| **GitHub Copilot (Claude)** | Primary assistant for architecture design, debugging ACP protocol issues, implementing streaming handlers, and code refactoring |
| **Google Gemini** | Used to understand the undocumented `--experimental-acp` protocol details and debug JSON-RPC handshake errors |
| **VS Code Copilot** | Used for scaffolding TypeScript boilerplate, generating TUI logic with `@clack/prompts`, and refining stream buffering logic |

### AI-Assisted Components

- **ACP Protocol Implementation**: AI helped decode the correct message format for `initialize`, `authenticate`, and `session/new` as documentation was limited
- **Streaming Response Handling**: The `session/update` message parsing and real-time display logic
- **Model Fallback System**: Quota error detection and automatic model switching
- **Error Handling**: Identifying edge cases like "empty response" errors and handling them gracefully
- **Terminal UI**: Integration with `@clack/prompts` for spinners, text input, and confirm dialogs

### Transparency Note

This disclosure is provided to give reviewers a complete and honest view of the development process. AI tools significantly accelerated development, but the developer takes full responsibility for:
- Understanding how all code works
- Making architectural decisions
- Ensuring the final product meets requirements
- Any bugs or issues in the implementation

The use of AI was explicitly allowed per the assignment guidelines.

---

## 📄 License

MIT

---

