/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const url  = require("node:url");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const WebSocket = require("ws");
const pty = require("node-pty");

const PORT = Number(process.env.PORT || 4000);
const WORKSPACES_ROOT = path.resolve(
  process.env.WORKSPACES_ROOT || path.join(__dirname, "../workspaces")
);
const TERMINAL_AUTH_SECRET = process.env.TERMINAL_AUTH_SECRET || "";
const TIMEOUT_MS = Number(process.env.EXECUTION_TIMEOUT_MS || 60000);
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB
const MAX_ACTIVE_SESSIONS = 50;
const SESSION_RECONNECT_GRACE_MS = 45000;
const LANGUAGES = new Set(["python", "c", "cpp", "javascript", "jsx", "tsx"]);

// Ensure workspaces root directory exists
if (!fs.existsSync(WORKSPACES_ROOT)) {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

// Printing Press challenge datasets (answer_key.csv is NEVER copied to workspaces)
const PP_DATA_DIR = path.resolve(__dirname, "../challenges/printing-press/data");
const PP_TRAIN_SRC = path.join(PP_DATA_DIR, "train.csv");
const PP_TEST_SRC  = path.join(PP_DATA_DIR, "test.csv");
// PP_ANSWER_KEY stays server-side only — never referenced here for workspace copy

function copyPpDatasets(workspaceDir) {
  for (const [src, name] of [[PP_TRAIN_SRC, "train.csv"], [PP_TEST_SRC, "test.csv"]]) {
    if (!fs.existsSync(src)) continue;
    const dest = path.join(workspaceDir, name);
    if (!fs.existsSync(dest)) {
      try { fs.copyFileSync(src, dest); } catch { /* ignore */ }
    }
  }
}

// Pre-seed root workspace on startup
copyPpDatasets(WORKSPACES_ROOT);

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(JSON.stringify(body));
}

function sanitizeProjectId(rawId) {
  if (!rawId || typeof rawId !== "string") return "default";
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.slice(0, 64) || "default";
}

function getWorkspaceDir(projectId) {
  const safeId = sanitizeProjectId(projectId);
  const targetDir = path.resolve(WORKSPACES_ROOT, safeId);
  if (!targetDir.startsWith(WORKSPACES_ROOT)) {
    throw new Error("Invalid workspace path: directory traversal detected");
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy Printing Press datasets (train.csv + test.csv) into every workspace
  copyPpDatasets(targetDir);

  return targetDir;
}

function getSanitizedEnv(workspaceDir) {
  const allowedKeys = [
    "PATH",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMDRIVE",
    "TEMP",
    "TMP",
    "COMSPEC",
    "WINDIR",
    "USERPROFILE",
    "HOME",
    "HOMEPATH",
    "HOMEDRIVE",
    "LANG",
    "LC_ALL",
    "TERM",
    "COLORTERM",
    "NODE_ENV",
    "PSModulePath",
    "LOCALAPPDATA",
    "APPDATA",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "COMMONPROGRAMFILES",
  ];

  const cleanEnv = {};
  for (const key of allowedKeys) {
    if (process.env[key] !== undefined) {
      cleanEnv[key] = process.env[key];
    }
  }

  cleanEnv.TERM = "xterm-256color";
  cleanEnv.COLORTERM = "truecolor";
  cleanEnv.WORKSPACE_DIR = workspaceDir;
  if (process.platform !== "win32") {
    cleanEnv.PWD = workspaceDir;
  }

  return cleanEnv;
}

function detectShell() {
  if (process.platform === "win32") {
    // Prefer PowerShell on Windows, fallback to cmd.exe
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    const powershellPath = path.join(
      systemRoot,
      "System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    );
    if (fs.existsSync(powershellPath)) {
      return { shell: powershellPath, args: ["-NoLogo"] };
    }
    return { shell: process.env.COMSPEC || "cmd.exe", args: [] };
  }

  const defaultShell = process.env.SHELL || "/bin/bash";
  if (fs.existsSync(defaultShell)) {
    return { shell: defaultShell, args: ["-l"] };
  }
  return { shell: "/bin/sh", args: ["-l"] };
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) throw new Error("Request is too large");
  }
  return JSON.parse(body);
}

// ------------------------------------------------------------
// NON-INTERACTIVE CODE EXECUTION ENGINE
// ------------------------------------------------------------

function getExecutionPlan(language, sourceFilePath, workspaceDir) {
  const isWin = process.platform === "win32";
  const pythonCmd = isWin ? "python" : "python3";
  const binaryName = isWin ? "program.exe" : "program.bin";
  const binaryPath = path.join(workspaceDir, binaryName);

  switch (language) {
    case "python":
      return {
        compileCmd: null,
        runCmd: pythonCmd,
        runArgs: ["-u", sourceFilePath],
      };
    case "javascript":
      return {
        compileCmd: null,
        runCmd: "node",
        runArgs: [sourceFilePath],
      };
    case "jsx":
    case "tsx":
      return {
        compileCmd: null,
        runCmd: "node",
        runArgs: [
          "-e",
          `global.React={createElement:(type,props,...children)=>({type,props:props||{},children})}; require(${JSON.stringify(sourceFilePath)})`,
        ],
      };
    case "c":
      return {
        compileCmd: "gcc",
        compileArgs: ["-O2", "-std=c17", sourceFilePath, "-o", binaryPath],
        runCmd: binaryPath,
        runArgs: [],
      };
    case "cpp":
      return {
        compileCmd: "g++",
        compileArgs: ["-O2", "-std=c++17", sourceFilePath, "-o", binaryPath],
        runCmd: binaryPath,
        runArgs: [],
      };
    default:
      throw new Error(`Unsupported execution language: ${language}`);
  }
}

async function execute(language, source, stdin = "", projectId = null) {
  const extensionMap = {
    python: "py",
    javascript: "js",
    jsx: "jsx",
    tsx: "tsx",
    c: "c",
    cpp: "cpp",
  };
  const extension = extensionMap[language];
  if (!extension) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const workspaceDir = projectId
    ? getWorkspaceDir(projectId)
    : await fsp.mkdtemp(path.join(WORKSPACES_ROOT, "temp-exec-"));

  // Seed Printing Press datasets into every workspace (temp or permanent)
  copyPpDatasets(workspaceDir);

  const sourcePath = path.join(workspaceDir, `main.${extension}`);
  await fsp.writeFile(sourcePath, source, "utf8");

  const plan = getExecutionPlan(language, sourcePath, workspaceDir);
  const cleanEnv = getSanitizedEnv(workspaceDir);

  // If compilation is required (C / C++)
  let compileStderr = "";
  if (plan.compileCmd) {
    const compileResult = await new Promise((resolve) => {
      const child = spawn(plan.compileCmd, plan.compileArgs, {
        cwd: workspaceDir,
        env: cleanEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let errText = "";
      child.stderr.on("data", (chunk) => {
        errText += chunk.toString();
      });
      child.on("close", (code) => {
        resolve({ code, errText });
      });
      child.on("error", (err) => {
        resolve({ code: 1, errText: err.message });
      });
    });

    if (compileResult.code !== 0) {
      if (!projectId) {
        await fsp.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      }
      return {
        stdout: "",
        stderr: compileResult.errText,
        exitCode: compileResult.code ?? 1,
        compileStderr: compileResult.errText,
        status: "compilation_error",
        time: "0.000",
        memory: null,
      };
    }
  }

  // Execute the program
  const started = process.hrtime.bigint();
  const child = spawn(plan.runCmd, plan.runArgs, {
    cwd: workspaceDir,
    env: cleanEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let outputLimitReached = false;

  const collect = (target) => (chunk) => {
    if (stdout.length + stderr.length + chunk.length > MAX_OUTPUT_BYTES) {
      outputLimitReached = true;
      child.kill("SIGKILL");
      return;
    }
    if (target === "stdout") stdout += chunk.toString();
    else stderr += chunk.toString();
  };

  child.stdout.on("data", collect("stdout"));
  child.stderr.on("data", collect("stderr"));

  if (stdin) {
    child.stdin.write(stdin);
  }
  child.stdin.end();

  const result = await new Promise((resolve) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ error, timedOut, code: null });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ timedOut, code });
    });
  });

  if (!projectId) {
    await fsp.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }

  const elapsedSeconds = Number(process.hrtime.bigint() - started) / 1e9;
  const exitCode = result.timedOut ? 124 : (result.code ?? 1);
  const status = result.error
    ? "executor_error"
    : result.timedOut
      ? "timeout"
      : outputLimitReached
        ? "output_limit"
        : exitCode === 0
          ? "accepted"
          : "runtime_error";

  return {
    stdout,
    stderr: result.error ? result.error.message : stderr,
    exitCode,
    compileStderr: compileStderr || undefined,
    status,
    time: elapsedSeconds.toFixed(3),
    memory: null,
  };
}

// ------------------------------------------------------------
// INTERACTIVE PTY & WEBSOCKET TERMINAL MANAGER
// ------------------------------------------------------------

const activeSessions = new Map();

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

  const ptyProcess = pty.spawn(shellInfo.shell, shellInfo.args, {
    name: "xterm-256color",
    cols: Math.max(10, Math.min(initialCols || 80, 300)),
    rows: Math.max(5, Math.min(initialRows || 24, 150)),
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
    // Process already killed
  }

  if (session.ws && session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }

  activeSessions.delete(sessionId);
}

// ------------------------------------------------------------
// HTTP & WEBSOCKET SERVER INITIALIZATION
// ------------------------------------------------------------

const server = http.createServer(async (request, response) => {
  const parsedUrl = url.parse(request.url || "", true);
  const pathname = parsedUrl.pathname || "";

  // Handle CORS preflight
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
      activeSessions: activeSessions.size,
      workspacesRoot: WORKSPACES_ROOT,
      uptime: process.uptime(),
    });
  }

  // Sync workspace files endpoint (Editor -> Workspace sync)
  if (request.method === "POST" && pathname === "/sync-workspace") {
    try {
      const { projectId, files } = await readJson(request);
      if (!projectId || !Array.isArray(files)) {
        return json(response, 400, { error: "projectId and files array are required" });
      }

      const workspaceDir = getWorkspaceDir(projectId);
      let syncedCount = 0;

      for (const item of files) {
        if (!item || typeof item.path !== "string") continue;
        const relativePath = item.path.replace(/^[/\\]+/, "");
        const targetPath = path.resolve(workspaceDir, relativePath);

        // Prevent path traversal outside the workspace
        if (!targetPath.startsWith(workspaceDir)) continue;

        if (item.type === "folder") {
          await fsp.mkdir(targetPath, { recursive: true });
        } else if (item.content !== undefined) {
          await fsp.mkdir(path.dirname(targetPath), { recursive: true });
          await fsp.writeFile(targetPath, String(item.content), "utf8");
          syncedCount++;
        }
      }

      return json(response, 200, { ok: true, syncedCount, workspaceDir });
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Failed to sync workspace",
      });
    }
  }

  // List workspace files endpoint (Workspace -> Editor sync check)
  if (request.method === "GET" && pathname === "/workspace-files") {
    try {
      const projectId = sanitizeProjectId(String(parsedUrl.query.projectId || "default"));
      const workspaceDir = getWorkspaceDir(projectId);

      async function listDir(dir, baseRel = "") {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        const items = [];
        for (const entry of entries) {
          const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            items.push({ name: entry.name, path: rel, type: "folder" });
            const subItems = await listDir(path.join(dir, entry.name), rel);
            items.push(...subItems);
          } else {
            const stats = await fsp.stat(path.join(dir, entry.name));
            items.push({
              name: entry.name,
              path: rel,
              type: "file",
              size: stats.size,
            });
          }
        }
        return items;
      }

      const files = await listDir(workspaceDir);
      return json(response, 200, { ok: true, projectId, files });
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

      const result = await execute(language, source, stdin, projectId);
      return json(response, 200, result);
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : "Execution failed",
      });
    }
  }

  return json(response, 404, { error: "Not found" });
});

// Setup WebSocket Server for interactive terminal
const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const parsedUrl = url.parse(request.url || "", true);
  const pathname = parsedUrl.pathname || "";

  if (pathname === "/terminal" || pathname === "/terminal/") {
    // Optional Authentication Check
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

wss.on("connection", (ws, request) => {
  const parsedUrl = url.parse(request.url || "", true);
  const projectId = sanitizeProjectId(String(parsedUrl.query.projectId || "default"));
  const sessionId = String(parsedUrl.query.sessionId || `session_${projectId}_${Date.now()}`);
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

    // Check if client sent a JSON control command (e.g. resize)
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
        // Fallthrough to raw write if not valid JSON control
      }
    }

    // Write input directly to PTY
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

// Periodic cleanup of abandoned sessions older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastActive > 2 * 60 * 60 * 1000) {
      destroySession(id);
    }
  }
}, 60000);

// Graceful process termination on signals
function shutdown() {
  console.log("\nShutting down terminal & executor service...");
  for (const id of activeSessions.keys()) {
    destroySession(id);
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Online IDE Terminal & Executor service listening on port ${PORT}`);
  console.log(`Workspaces root: ${WORKSPACES_ROOT}`);
});