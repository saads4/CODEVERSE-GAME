/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

const PORT = Number(process.env.PORT || 4000);
const WORKSPACES_ROOT = path.resolve(
  process.env.WORKSPACES_ROOT || path.join(__dirname, "../workspaces")
);
const CHALLENGES_DATA_DIR = path.resolve(
  process.env.CHALLENGES_DATA_DIR || path.join(__dirname, "../challenges/printing-press/data")
);
const TERMINAL_AUTH_SECRET = process.env.TERMINAL_AUTH_SECRET || "";
const TIMEOUT_MS = Number(process.env.EXECUTION_TIMEOUT_MS || 300000); // 5 minutes max
const MAX_OUTPUT_BYTES = Number(process.env.MAX_OUTPUT_BYTES || 2 * 1024 * 1024); // 2MB
const MAX_REQUEST_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ACTIVE_SESSIONS = Number(process.env.MAX_ACTIVE_SESSIONS || 50);
const SESSION_RECONNECT_GRACE_MS = Number(process.env.SESSION_RECONNECT_GRACE_MS || 45000);
const THREAD_CAP = process.env.SANDBOX_THREAD_CAP || "4";

const LANGUAGES = new Set(["python", "c", "cpp", "javascript", "jsx", "tsx"]);

const EXTENSION_MAP = {
  python: "py",
  javascript: "js",
  jsx: "jsx",
  tsx: "tsx",
  c: "c",
  cpp: "cpp",
};

const ALLOWED_ENV_KEYS = [
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
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "PROCESSOR_LEVEL",
  "PROCESSOR_REVISION",
];

module.exports = {
  PORT,
  WORKSPACES_ROOT,
  CHALLENGES_DATA_DIR,
  TERMINAL_AUTH_SECRET,
  TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  MAX_REQUEST_BYTES,
  MAX_ACTIVE_SESSIONS,
  SESSION_RECONNECT_GRACE_MS,
  THREAD_CAP,
  LANGUAGES,
  EXTENSION_MAP,
  ALLOWED_ENV_KEYS,
};
