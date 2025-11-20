// session-manager.ts
import { file, write } from "bun";

const SESSION_FILE = ".claude-session.json";

interface SessionData {
  sessionId: string;
  lastActive: string;
}

export async function loadSession(): Promise<SessionData | null> {
  const f = file(SESSION_FILE);
  if (await f.exists()) {
    try {
      const data = await f.json();
      return data as SessionData;
    } catch (e) {
      return null; // File might be corrupt, start fresh
    }
  }
  return null;
}

export async function saveSession(sessionId: string) {
  const data: SessionData = {
    sessionId,
    lastActive: new Date().toISOString(),
  };
  await write(SESSION_FILE, JSON.stringify(data, null, 2));
}