import "dotenv/config"; // load .env file before anything else
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { randomBytes, timingSafeEqual } from "crypto";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Auth ──────────────────────────────────────────────────────────────────────
// In-memory session store: token → expiry timestamp
const sessions = new Map<string, number>();
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Auth routes — must be registered BEFORE the auth guard middleware
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const expected = process.env.APP_PASSWORD || "changeme";
  // Timing-safe comparison
  let match = false;
  try {
    const a = Buffer.from(password ?? "");
    const b = Buffer.from(expected);
    match = a.length === b.length && timingSafeEqual(a, b);
  } catch { match = false; }
  if (!match) {
    return res.status(401).json({ error: "Invalid password" });
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_MS);
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MS,
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const token = (req as any).cookies?.auth_token;
  if (token) sessions.delete(token);
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

app.get("/api/auth/check", (req: Request, res: Response) => {
  const token = (req as any).cookies?.auth_token;
  res.json({ authenticated: isValidSession(token) });
});

// Auth guard — protect all other /api/* routes
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  // Allow auth routes through without a session
  if (req.path.startsWith("/auth/")) return next();
  const token = (req as any).cookies?.auth_token;
  if (!isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  // production → 0.0.0.0 (Zeabur needs this)
  // LOCAL_NETWORK=true → 0.0.0.0 (access from iPhone / other LAN devices)
  // default dev → 127.0.0.1 (localhost only)
  const host =
    process.env.NODE_ENV === "production" || process.env.LOCAL_NETWORK === "true"
      ? "0.0.0.0"
      : "127.0.0.1";
  httpServer.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
