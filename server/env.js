/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { ALLOWED_ENV_KEYS, THREAD_CAP } = require("./config");

/**
 * Returns a sanitized environment object scoped to the workspace directory.
 * Prevents leaking backend server credentials or unintended host env variables.
 */
function getSanitizedEnv(workspaceDir) {
  const cleanEnv = {};
  for (const key of ALLOWED_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      cleanEnv[key] = process.env[key];
    }
  }

  cleanEnv.TERM = "xterm-256color";
  cleanEnv.COLORTERM = "truecolor";
  cleanEnv.WORKSPACE_DIR = workspaceDir;
  cleanEnv.PYTHONUNBUFFERED = "1";
  cleanEnv.MPLBACKEND = "Agg"; // Headless Matplotlib backend

  // Thread caps for NumPy, OpenBLAS, OpenMP, MKL, PyTorch, Scikit-learn
  cleanEnv.OMP_NUM_THREADS = THREAD_CAP;
  cleanEnv.OPENBLAS_NUM_THREADS = THREAD_CAP;
  cleanEnv.MKL_NUM_THREADS = THREAD_CAP;
  cleanEnv.NUMEXPR_NUM_THREADS = THREAD_CAP;
  cleanEnv.VECLIB_MAXIMUM_THREADS = THREAD_CAP;
  cleanEnv.BLIS_NUM_THREADS = THREAD_CAP;
  cleanEnv.LOKY_MAX_CPU_COUNT = THREAD_CAP;

  if (process.platform !== "win32") {
    cleanEnv.PWD = workspaceDir;
  }

  return cleanEnv;
}

/**
 * Detects the best available interactive shell for the platform.
 */
function detectShell() {
  if (process.platform === "win32") {
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

/**
 * Safely kills an entire process tree by PID across Windows and Unix.
 */
function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process may have already exited
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Process already terminated
      }
    }
  }
}

module.exports = {
  getSanitizedEnv,
  detectShell,
  killProcessTree,
};
