/* eslint-disable @typescript-eslint/no-require-imports */
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  WORKSPACES_ROOT,
  TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  LANGUAGES,
  EXTENSION_MAP,
} = require("./config");
const { getSanitizedEnv, killProcessTree } = require("./env");
const { getWorkspaceDir, copyChallengeDatasets } = require("./workspace");

/**
 * Generates the compilation and execution commands for the specified language.
 */
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
        runArgs: ["-u", sourceFilePath], // Unbuffered stdio for Python
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

/**
 * Executes source code non-interactively with sandboxed environment,
 * process limits, execution timeout, and output capping.
 */
async function executeCode({ language, source, stdin = "", projectId = null }) {
  if (!LANGUAGES.has(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }
  const extension = EXTENSION_MAP[language];
  if (!extension) {
    throw new Error(`Missing extension mapping for language: ${language}`);
  }

  const isTemp = !projectId;
  const workspaceDir = isTemp
    ? await fsp.mkdtemp(path.join(WORKSPACES_ROOT, "temp-exec-"))
    : getWorkspaceDir(projectId);

  // Ensure challenge datasets are available
  copyChallengeDatasets(workspaceDir);

  const sourcePath = path.join(workspaceDir, `main.${extension}`);
  await fsp.writeFile(sourcePath, source, "utf8");

  const plan = getExecutionPlan(language, sourcePath, workspaceDir);
  const cleanEnv = getSanitizedEnv(workspaceDir);

  // Compilation phase (C / C++)
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
      if (isTemp) {
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

  // Execution phase
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
      killProcessTree(child.pid);
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
    let resolved = false;
    let exitCode = null;
    let exitFallbackTimer = null;

    const finish = (res) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (exitFallbackTimer) clearTimeout(exitFallbackTimer);
      resolve(res);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
      setTimeout(() => {
        finish({ timedOut: true, code: 124 });
      }, 500);
    }, TIMEOUT_MS);

    child.on("error", (error) => {
      finish({ error, timedOut, code: null });
    });

    child.on("exit", (code) => {
      exitCode = code;
      // Stdio close fallback timer in case subprocess keeps pipe open
      exitFallbackTimer = setTimeout(() => {
        try { child.stdout?.destroy(); } catch {}
        try { child.stderr?.destroy(); } catch {}
        finish({ timedOut: false, code: exitCode ?? 0 });
      }, 250);
    });

    child.on("close", (code) => {
      finish({ timedOut, code: code ?? exitCode });
    });
  });

  // Cleanup temporary directory
  if (isTemp) {
    try {
      await fsp.rm(workspaceDir, { recursive: true, force: true });
    } catch {
      setTimeout(async () => {
        try {
          await fsp.rm(workspaceDir, { recursive: true, force: true });
        } catch {}
      }, 500);
    }
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

module.exports = {
  getExecutionPlan,
  executeCode,
};
