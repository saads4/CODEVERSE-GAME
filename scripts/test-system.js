/* eslint-disable @typescript-eslint/no-require-imports */
const WebSocket = require("ws");

async function runTests() {
  console.log("=== Running IDE System Verification Tests ===");

  const EXECUTOR_URL = process.env.EXECUTOR_URL || "http://localhost:4000";
  const TERMINAL_WS_URL = process.env.NEXT_PUBLIC_TERMINAL_WS_URL || "ws://localhost:4000/terminal";

  // 1. Health Check
  console.log("\n[1/4] Testing GET /health ...");
  const healthRes = await fetch(`${EXECUTOR_URL}/health`);
  if (!healthRes.ok) throw new Error(`Health check failed with HTTP ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log("✓ Server healthy:", healthData);

  // 2. Python ML Execution
  console.log("\n[2/4] Testing Python ML Execution (NumPy, Pandas, Scikit-learn, Matplotlib) ...");
  const pySource = `
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
import matplotlib
import matplotlib.pyplot as plt

print("NumPy Version:", np.__version__)
print("Pandas Version:", pd.__version__)

X = np.array([[1], [2], [3], [4]])
y = np.array([2, 4, 6, 8])
model = LinearRegression().fit(X, y)
print("Prediction for 5:", model.predict([[5]])[0])
`;

  const execRes = await fetch(`${EXECUTOR_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "python", source: pySource }),
  });
  if (!execRes.ok) throw new Error(`Execution failed with HTTP ${execRes.status}`);
  const execData = await execRes.json();
  if (execData.exitCode !== 0) throw new Error(`Execution returned non-zero code: ${execData.exitCode}`);
  console.log("✓ Python ML Execution Successful:\n" + execData.stdout.trim());

  // 3. WebSocket Terminal Connection
  console.log("\n[3/4] Testing WebSocket xterm/node-pty Terminal ...");
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${TERMINAL_WS_URL}?projectId=verify_test`);
    let output = "";
    const timer = setTimeout(() => {
      ws.close();
      if (output.length > 0) resolve();
      else reject(new Error("Terminal connection timeout"));
    }, 4000);

    ws.on("open", () => {
      ws.send("echo 'PTY Terminal Active'\r");
    });

    ws.on("message", (data) => {
      output += data.toString();
      if (output.includes("PTY Terminal Active") || output.length > 20) {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  console.log("✓ Interactive Terminal WebSocket Connected and Responded");

  // 4. Workspace Sync
  console.log("\n[4/4] Testing Workspace File Sync ...");
  const syncRes = await fetch(`${EXECUTOR_URL}/sync-workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: "verify_test",
      files: [{ path: "app.py", type: "file", content: "print('sync ok')" }],
    }),
  });
  if (!syncRes.ok) throw new Error(`Sync failed with HTTP ${syncRes.status}`);
  const syncData = await syncRes.json();
  console.log("✓ Workspace Synced:", syncData);

  console.log("\n==============================================");
  console.log(">>> ALL SYSTEM VERIFICATION CHECKS PASSED! <<<");
  console.log("==============================================");
}

runTests().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
