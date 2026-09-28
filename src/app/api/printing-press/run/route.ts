import { NextRequest, NextResponse } from "next/server";
import { executeCode } from "@/lib/executor";
import fs from "fs";
import path from "path";

// ── Server-side answer key (NEVER exposed to contestant) ────────────────────
const ANSWER_KEY_PATH = path.resolve(
  process.cwd(),
  "challenges/printing-press/data/answer_key.csv"
);

function loadAnswerKey(): { id: string; amount_printed: number }[] {
  const raw = fs.readFileSync(ANSWER_KEY_PATH, "utf8");
  const lines = raw.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  const idIdx = headers.indexOf("id");
  const amtIdx = headers.indexOf("amount_printed");
  if (idIdx === -1 || amtIdx === -1) {
    throw new Error("answer_key.csv missing required columns");
  }
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    return { id: cols[idIdx].trim(), amount_printed: parseFloat(cols[amtIdx]) };
  });
}

function calculatePoints(errPct: number): number {
  if (errPct <= 2.0)  return 1000;
  if (errPct <= 5.0)  return 950;
  if (errPct <= 10.0) return 850;
  if (errPct <= 15.0) return 750;
  if (errPct <= 20.0) return 600;
  if (errPct <= 30.0) return 400;
  if (errPct <= 50.0) return 200;
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Python code is required" }, { status: 400 });
    }
    if (content.length > 500_000) {
      return NextResponse.json({ error: "Code is too large" }, { status: 400 });
    }

    // Load answer key on the server before execution
    let answerKey: { id: string; amount_printed: number }[];
    try {
      answerKey = loadAnswerKey();
    } catch (e) {
      console.error("Failed to load answer_key.csv:", e);
      return NextResponse.json({ error: "Challenge data unavailable" }, { status: 500 });
    }
    const expectedCount = answerKey.length;

    // ── Wrapped Python code sent to the executor ────────────────────────────
    // Contestant code runs as-is; they must load their own CSVs and produce
    // a `predictions` variable aligned with test.csv row order.
    const wrappedSource = `
import sys
import os
import numpy as np

# ============================================================
# PRINTING PRESS CONTEST ENVIRONMENT
# ============================================================
# Working directory contains: train.csv, test.csv, main.py
# Load them with pd.read_csv("train.csv") etc.

# ============================================================
# CONTESTANT CODE
# ============================================================

try:
    exec(
        compile(${JSON.stringify(content)}, "main.py", "exec"),
        globals()
    )
except SystemExit:
    pass

# ============================================================
# PLATFORM VALIDATION
# ============================================================

if "predictions" not in globals():
    sys.stderr.write("Validation Error: 'predictions' variable is not defined.\\n"
                     "Your code must create a variable named 'predictions'.\\n")
    sys.exit(1)

_pp_raw_preds = globals()["predictions"]
if _pp_raw_preds is ... or _pp_raw_preds is None:
    sys.stderr.write("Validation Error: 'predictions' was not set.\\n"
                     "Please train a model and assign your predictions to 'predictions'.\\n")
    sys.exit(1)

try:
    import pandas as _pp_pd
    if isinstance(_pp_raw_preds, (_pp_pd.Series, _pp_pd.DataFrame)):
        _pp_preds_arr = _pp_raw_preds.to_numpy()
    else:
        _pp_preds_arr = np.asarray(_pp_raw_preds)

    if not np.issubdtype(_pp_preds_arr.dtype, np.number):
        sys.stderr.write("Validation Error: 'predictions' must contain numeric values.\\n")
        sys.exit(1)

    _pp_predictions = _pp_preds_arr.astype(float).reshape(-1)
except Exception as _pp_err:
    sys.stderr.write(f"Validation Error: Could not convert 'predictions' to numeric array: {_pp_err}\\n")
    sys.exit(1)

_pp_expected_count = ${expectedCount}
if len(_pp_predictions) != _pp_expected_count:
    sys.stderr.write(
        f"Validation Error: Expected {_pp_expected_count} predictions (one per row in test.csv), "
        f"but received {len(_pp_predictions)}.\\n"
    )
    sys.exit(1)

if np.isnan(_pp_predictions).any():
    sys.stderr.write("Validation Error: Predictions contain NaN (missing) values.\\n")
    sys.exit(1)

if np.isinf(_pp_predictions).any():
    sys.stderr.write("Validation Error: Predictions contain infinite values.\\n")
    sys.exit(1)

# Emit predictions as a compact CSV line so the server can score them
print("__PP_PREDS__:" + ",".join(f"{v:.6f}" for v in _pp_predictions))
`;

    const result = await executeCode("python", wrappedSource, "");

    // ── Extract the predictions sentinel from stdout ─────────────────────────
    const SENTINEL = "__PP_PREDS__:";
    const stdoutLines = (result.stdout ?? "").split("\n");
    const predLine = stdoutLines.find((l) => l.startsWith(SENTINEL));

    if (!predLine) {
      // Execution failed or predictions weren't produced – return as-is
      return NextResponse.json({
        ...result,
        stdout: stdoutLines.filter((l) => !l.startsWith(SENTINEL)).join("\n"),
      });
    }

    // Parse predictions
    const predValues = predLine
      .slice(SENTINEL.length)
      .split(",")
      .map((v) => parseFloat(v));

    // ── Score against server-side answer key (NEVER returned to client) ──────
    const trueValues = answerKey.map((r) => r.amount_printed);
    const sumActual = trueValues.reduce((a, b) => a + b, 0);
    if (sumActual <= 0) {
      return NextResponse.json({ error: "Answer key has non-positive sum" }, { status: 500 });
    }

    const sumAbsError = predValues.reduce(
      (acc, pred, i) => acc + Math.abs(pred - trueValues[i]),
      0
    );
    const errorPct = (sumAbsError / sumActual) * 100;
    const points = calculatePoints(errorPct);

    // Build clean output for the contestant
    const publicStdout = [
      ...stdoutLines.filter((l) => !l.startsWith(SENTINEL)),
      `Validation Error: ${errorPct.toFixed(2)}%`,
      `Points: ${points}`,
    ]
      .join("\n")
      .trim();

    return NextResponse.json({
      ...result,
      stdout: publicStdout,
      stderr: result.stderr ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Printing Press execution failed",
      },
      { status: 500 }
    );
  }
}