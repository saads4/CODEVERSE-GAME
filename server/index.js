/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const url = require("node:url");
const WebSocket = require("ws");
const {
  PORT,
  WORKSPACES_ROOT,
  TERMINAL_AUTH_SECRET,
  MAX_REQUEST_BYTES,
  LANGUAGES,
} = require("./config");
const { executeCode } = require("./runner");
const { syncFilesToWorkspace, listWorkspaceFiles, sanitizeProjectId } = require("./workspace");
const {
  setupTerminalWebSocket,
  shutdownTerminalSessions,
  getActiveSessionsCount,
} = require("./terminal");

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_REQUEST_BYTES) throw new Error("Request body too large");
  }
  return JSON.parse(body);
}

const server = http.createServer(async (request, response) => {
  const parsedUrl = url.parse(request.url || "", true);
  const pathname = parsedUrl.pathname || "";

  // CORS preflight handling
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return response.end();
  }

  // Health check endpoint
  if (request.method === "GET" && pathname === "/health") {
    return json(response, 200, {
      ok: true,
      nodePty: true,
      platform: process.platform,
      activeSessions: getActiveSessionsCount(),
      workspacesRoot: WORKSPACES_ROOT,
      uptime: process.uptime(),
    });
  }

  // Workspace file synchronization endpoint
  if (request.method === "POST" && pathname === "/sync-workspace") {
    try {
      const { projectId, files } = await readJson(request);
      const result = await syncFilesToWorkspace(projectId, files);
      return json(response, 200, { ok: true, ...result });
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Failed to sync workspace",
      });
    }
  }

  // Workspace files listing endpoint
  if (request.method === "GET" && pathname === "/workspace-files") {
    try {
      const projectId = sanitizeProjectId(String(parsedUrl.query.projectId || "default"));
      const result = await listWorkspaceFiles(projectId);
      return json(response, 200, { ok: true, ...result });
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Failed to list workspace files",
      });
    }
  }

  // Non-interactive code execution endpoint
  if (request.method === "POST" && pathname === "/execute") {
    try {
      const { language, source, stdin = "", projectId = null } = await readJson(request);
      if (!LANGUAGES.has(language) || typeof source !== "string" || typeof stdin !== "string") {
        return json(response, 400, { error: "language, source, and stdin are invalid" });
      }

      const result = await executeCode({ language, source, stdin, projectId });
      return json(response, 200, result);
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Execution failed",
      });
    }
  }

  return json(response, 404, { error: "Not found" });
});

// Setup WebSocket Server for terminal streaming
const wss = new WebSocket.Server({ noServer: true });
setupTerminalWebSocket(wss);

server.on("upgrade", (request, socket, head) => {
  const parsedUrl = url.parse(request.url || "", true);
  const pathname = parsedUrl.pathname || "";

  if (pathname === "/terminal" || pathname === "/terminal/") {
    if (TERMINAL_AUTH_SECRET) {
      const token = parsedUrl.query.token || request.headers["x-terminal-token"];
      if (token !== TERMINAL_AUTH_SECRET) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  }
});

function shutdown() {
  console.log("\nShutting down terminal & executor service...");
  shutdownTerminalSessions();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Online IDE] Terminal & Executor backend listening on port ${PORT}`);
  console.log(`[Online IDE] Workspaces root: ${WORKSPACES_ROOT}`);
});

module.exports = { server, wss };
