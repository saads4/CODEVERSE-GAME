/* eslint-disable @typescript-eslint/no-require-imports */
const url = require("node:url");
const WebSocket = require("ws");
const pty = require("node-pty");
const {
  MAX_ACTIVE_SESSIONS,
  SESSION_RECONNECT_GRACE_MS,
  TERMINAL_AUTH_SECRET,
} = require("./config");
const { getSanitizedEnv, detectShell } = require("./env");
const { getWorkspaceDir, sanitizeProjectId } = require("./workspace");

const activeSessions = new Map();

/**
 * Creates a new PTY interactive terminal session.
 */
function createPtySession(sessionId, projectId, initialCols = 80, initialRows = 24) {
  if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
    // Evict oldest disconnected session if needed
    for (const [id, s] of activeSessions.entries()) {
      if (!s.ws) {
        destroySession(id);
        break;
      }
    }
    if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
      throw new Error("Server has reached maximum concurrent terminal sessions");
    }
  }

  const workspaceDir = getWorkspaceDir(projectId);
  const shellInfo = detectShell();
  const cleanEnv = getSanitizedEnv(workspaceDir);

  const cols = Math.max(10, Math.min(Number(initialCols) || 80, 300));
  const rows = Math.max(5, Math.min(Number(initialRows) || 24, 150));

  const ptyProcess = pty.spawn(shellInfo.shell, shellInfo.args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd: workspaceDir,
    env: cleanEnv,
    useConpty: process.platform === "win32",
  });

  const session = {
    id: sessionId,
    projectId,
    ptyProcess,
    workspaceDir,
    ws: null,
    disconnectTimer: null,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  ptyProcess.onData((data) => {
    session.lastActive = Date.now();
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(`\r\n[Process completed with exit code ${exitCode}]\r\n`);
    }
    destroySession(sessionId);
  });

  activeSessions.set(sessionId, session);
  return session;
}

/**
 * Destroys an active PTY session and releases resources.
 */
function destroySession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  if (session.disconnectTimer) {
    clearTimeout(session.disconnectTimer);
    session.disconnectTimer = null;
  }

  try {
    session.ptyProcess.kill();
  } catch {
    // Process already terminated
  }

  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }

  activeSessions.delete(sessionId);
}

/**
 * Shuts down all running terminal sessions cleanly.
 */
function shutdownTerminalSessions() {
  for (const id of Array.from(activeSessions.keys())) {
    destroySession(id);
  }
}

/**
 * Registers WebSocket handlers for the interactive terminal.
 */
function setupTerminalWebSocket(wss) {
  wss.on("connection", (ws, request) => {
    const parsedUrl = url.parse(request.url || "", true);
    const projectId = sanitizeProjectId(String(parsedUrl.query.projectId || "default"));
    const sessionId = String(
      parsedUrl.query.sessionId || `session_${projectId}_${Date.now()}`
    );
    const initialCols = Number(parsedUrl.query.cols || 80);
    const initialRows = Number(parsedUrl.query.rows || 24);

    let session = activeSessions.get(sessionId);

    if (session) {
      // Reconnection to existing session
      if (session.disconnectTimer) {
        clearTimeout(session.disconnectTimer);
        session.disconnectTimer = null;
      }
      if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      session.ws = ws;
      ws.send("\r\n[Reconnected to terminal session]\r\n");
    } else {
      // Create new session
      try {
        session = createPtySession(sessionId, projectId, initialCols, initialRows);
        session.ws = ws;
      } catch (err) {
        ws.send(`\r\nFailed to start terminal: ${err instanceof Error ? err.message : err}\r\n`);
        ws.close();
        return;
      }
    }

    ws.on("message", (rawMessage) => {
      if (!session || !session.ptyProcess) return;
      session.lastActive = Date.now();

      const strMsg = rawMessage.toString();

      // JSON control message check
      if (strMsg.startsWith("{") && strMsg.endsWith("}")) {
        try {
          const payload = JSON.parse(strMsg);
          if (payload.type === "resize") {
            const cols = Math.max(10, Math.min(Number(payload.cols) || 80, 300));
            const rows = Math.max(5, Math.min(Number(payload.rows) || 24, 150));
            session.ptyProcess.resize(cols, rows);
            return;
          }
          if (payload.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
        } catch {
          // Fall through to raw terminal input
        }
      }

      // Write raw input into PTY
      try {
        session.ptyProcess.write(strMsg);
      } catch (err) {
        console.error("PTY write error:", err);
      }
    });

    ws.on("close", () => {
      if (!session) return;
      session.ws = null;
      // Start grace period for reconnection
      session.disconnectTimer = setTimeout(() => {
        destroySession(sessionId);
      }, SESSION_RECONNECT_GRACE_MS);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error on session", sessionId, err);
    });
  });

  // Background cleanup of abandoned sessions (> 2 hours inactive)
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions.entries()) {
      if (now - session.lastActive > 2 * 60 * 60 * 1000) {
        destroySession(id);
      }
    }
  }, 60000);
}

module.exports = {
  createPtySession,
  destroySession,
  shutdownTerminalSessions,
  setupTerminalWebSocket,
  getActiveSessionsCount: () => activeSessions.size,
};
