/**
 * Google OAuth2 helper.
 * Credentials are read from environment variables so they are never hardcoded.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth2 client secret
 *   GOOGLE_REDIRECT_URI   — e.g. http://localhost:3000/oauth2callback  (local)
 *                           or   https://your-app.zeabur.app/oauth2callback  (production)
 *
 * Token storage:
 *   Local:      <project-root>/google_token.json  (file on disk)
 *   Production: GOOGLE_TOKEN env var (JSON string — set via Zeabur dashboard after first auth)
 */
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

// ── Credentials from env ───────────────────────────────────────────────────────
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  || "http://localhost:3000/oauth2callback";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = path.join(process.cwd(), "google_token.json");

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

// ── Token load/save — supports both file (local) and env var (production) ─────
export function loadToken(): any | null {
  // 1. Try env var first (Zeabur production)
  if (process.env.GOOGLE_TOKEN) {
    try { return JSON.parse(process.env.GOOGLE_TOKEN); } catch {}
  }
  // 2. Fall back to file (local dev)
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    }
  } catch {}
  return null;
}

export function saveToken(token: any) {
  // Always write to file; on Zeabur you copy the file content into the env var
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function revokeToken() {
  try { fs.unlinkSync(TOKEN_PATH); } catch {}
}

export function isAuthenticated(): boolean {
  return loadToken() !== null;
}

/** Returns an authorized OAuth2 client, or null if not authenticated. */
export function getAuthorizedClient() {
  const token = loadToken();
  if (!token) return null;
  const client = createOAuth2Client();
  client.setCredentials(token);
  client.on("tokens", (newTokens) => {
    saveToken({ ...token, ...newTokens });
  });
  return client;
}

/** Exchange an authorization code for tokens and save them. */
export async function exchangeCode(code: string): Promise<void> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  saveToken(tokens);
}
