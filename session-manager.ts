// Session persistence for resumable sessions
import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";

const SESSION_FILE = ".claude-session.json";

interface SessionData { sessionId: string; lastActive: string; }

export async function loadSession(): Promise<SessionData | null> {
  try {
    await access(SESSION_FILE, constants.F_OK);
    return JSON.parse(await readFile(SESSION_FILE, "utf-8"));
  } catch { return null; }
}

export async function saveSession(sessionId: string) {
  await writeFile(SESSION_FILE, JSON.stringify({ sessionId, lastActive: new Date().toISOString() }, null, 2));
}