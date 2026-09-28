import { NextRequest, NextResponse } from "next/server";
import { executeCode } from "@/lib/executor";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

export const maxDuration = 300;

async function loadAnswerKey(): Promise<{ id: string; amount_printed: number }[]> {
  const localPath = path.resolve(
    process.cwd(),
    "challenges/printing-press/data/answer_key.csv"
  );
  const raw = await fs.readFile(localPath, "utf8");

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

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface ValidationFeedback {
  status: "passed" | "failed" | "error";
  title: string;
  message: string;
  points?: number;
  maxPoints?: number;
  errorPct?: number;
  hints: string[];
  checks: ValidationCheck[];
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

    // 1. Load answer key for post-execution validation
    let answerKey: { id: string; amount_printed: number }[];
    try {
      answerKey = await loadAnswerKey();
    } catch (e) {
      console.error("Failed to load answer_key.csv:", e);
      return NextResponse.json({ error: "Challenge answer key unavailable" }, { status: 500 });
    }
    const expectedCount = answerKey.length;

    // 2. Wrap user code to execute cleanly without validation interfering in terminal
    const wrappedSource = `
import sys
import os
import json

# Headless matplotlib configuration
try:
    import matplotlib
    matplotlib.use("Agg")
except Exception:
    pass

# Execute contestant code normally
_pp_user_code = ${JSON.stringify(content)}
_pp_runtime_error = None

try:
    _pp_compiled = compile(_pp_user_code, "main.py", "exec")
    exec(_pp_compiled, globals())
except SystemExit:
    pass
except Exception as _e:
    import traceback
    _pp_runtime_error = str(_e)
    # Output natural Python traceback to stderr for genuine terminal reporting
    sys.stderr.write(traceback.format_exc())

# Capture visualization if generated
_pp_img_b64 = None
try:
    import base64 as _pp_b64
    _pp_pngs = [f for f in os.listdir(".") if f.endswith(".png")]
    if _pp_pngs:
        _pp_target = "visualization.png" if "visualization.png" in _pp_pngs else _pp_pngs[0]
        with open(_pp_target, "rb") as _f:
            _pp_img_b64 = _pp_b64.b64encode(_f.read()).decode("ascii")
    if not _pp_img_b64 and "matplotlib.pyplot" in sys.modules:
        _plt = sys.modules["matplotlib.pyplot"]
        if _plt.get_fignums():
            import io as _pp_io
            _buf = _pp_io.BytesIO()
            _plt.savefig(_buf, format="png", dpi=120, bbox_inches="tight")
            _buf.seek(0)
            _pp_img_b64 = _pp_b64.b64encode(_buf.read()).decode("ascii")
            _plt.close("all")
except Exception:
    pass

# Post-execution validation payload (independent inspection)
_pp_val_payload = {
    "has_runtime_error": _pp_runtime_error is not None,
    "has_predictions_var": False,
    "is_unassigned": False,
    "is_numeric": False,
    "count": 0,
    "has_nan": False,
    "has_inf": False,
    "predictions": None,
}

if _pp_runtime_error is None:
    if "predictions" in globals():
        _pp_val_payload["has_predictions_var"] = True
        _pp_raw = globals()["predictions"]
        if _pp_raw is ... or _pp_raw is None:
            _pp_val_payload["is_unassigned"] = True
        else:
            try:
                import numpy as _pp_np
                import pandas as _pp_pd
                if isinstance(_pp_raw, (_pp_pd.Series, _pp_pd.DataFrame)):
                    _pp_arr = _pp_raw.to_numpy()
                else:
                    _pp_arr = _pp_np.asarray(_pp_raw)

                _pp_val_payload["count"] = int(_pp_arr.size)
                if _pp_np.issubdtype(_pp_arr.dtype, _pp_np.number):
                    _pp_val_payload["is_numeric"] = True
                    _pp_flat = _pp_arr.astype(float).reshape(-1)
                    _pp_val_payload["has_nan"] = bool(_pp_np.isnan(_pp_flat).any())
                    _pp_val_payload["has_inf"] = bool(_pp_np.isinf(_pp_flat).any())
                    if not _pp_val_payload["has_nan"] and not _pp_val_payload["has_inf"] and len(_pp_flat) == ${expectedCount}:
                        _pp_val_payload["predictions"] = [round(float(v), 6) for v in _pp_flat]
            except Exception:
                pass

if _pp_img_b64:
    print("\\n__PP_IMG__:" + _pp_img_b64)
print("\\n__PP_VAL__:" + json.dumps(_pp_val_payload))
`;

    // 3. Execute code via standard execution runner
    const rawResult = await executeCode("python", wrappedSource, "");

    // 4. Extract sentinels from stdout without polluting user's terminal output
    const IMG_SENTINEL = "__PP_IMG__:";
    const VAL_SENTINEL = "__PP_VAL__:";

    const rawLines = (rawResult.stdout ?? "").split("\n");
    let image: string | undefined;
    let valPayload: {
      has_runtime_error?: boolean;
      has_predictions_var?: boolean;
      is_unassigned?: boolean;
      is_numeric?: boolean;
      count?: number;
      has_nan?: boolean;
      has_inf?: boolean;
      predictions?: number[] | null;
    } | null = null;

    const cleanStdoutLines: string[] = [];
    for (const line of rawLines) {
      if (line.startsWith(IMG_SENTINEL)) {
        const b64 = line.slice(IMG_SENTINEL.length).trim();
        if (b64) image = `data:image/png;base64,${b64}`;
      } else if (line.startsWith(VAL_SENTINEL)) {
        try {
          valPayload = JSON.parse(line.slice(VAL_SENTINEL.length).trim());
        } catch {
          // Ignore JSON parse failure
        }
      } else {
        cleanStdoutLines.push(line);
      }
    }

    const cleanStdout = cleanStdoutLines.join("\n").trim();
    const cleanStderr = (rawResult.stderr ?? "").trim();
    const hasExecutionError = rawResult.exitCode !== 0 || cleanStderr.length > 0;

    // 5. Build independent Validation Feedback
    let validation: ValidationFeedback;

    if (hasExecutionError || valPayload?.has_runtime_error) {
      validation = {
        status: "error",
        title: "Execution Error Detected",
        message: "Your code failed to run to completion. Check the Console tab for the Python traceback.",
        hints: [
          "Resolve any syntax or runtime exceptions shown in the Console output.",
          "Check imported libraries and dataset variable references (train_df, test_df).",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: false, message: "Code terminated with errors" },
          { id: "var", label: "Variable 'predictions' Defined", passed: false },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (!valPayload) {
      validation = {
        status: "failed",
        title: "Validation Incomplete",
        message: "Unable to inspect model outputs. Ensure your code finishes executing successfully.",
        hints: ["Make sure the script runs and finishes without unhandled interruptions."],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: false },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (!valPayload.has_predictions_var) {
      validation = {
        status: "failed",
        title: "Missing 'predictions' Variable",
        message: "Your code ran cleanly (Exit 0), but did not define a 'predictions' variable.",
        hints: [
          "Train your ML model on train_df and predict on test_df.",
          "Assign your output array or Series directly to 'predictions' (e.g. predictions = model.predict(X_test)).",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: false, message: "Variable not found in global scope" },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (valPayload.is_unassigned) {
      validation = {
        status: "failed",
        title: "Unassigned 'predictions' Variable",
        message: "The 'predictions' variable is still set to None or placeholder '...'.",
        hints: [
          "Replace the placeholder with predictions from your trained regression model.",
          "Example: predictions = model.predict(X_test)",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: false, message: "Placeholder not replaced" },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (!valPayload.is_numeric) {
      validation = {
        status: "failed",
        title: "Non-Numeric Predictions",
        message: "The 'predictions' variable contains non-numeric data types.",
        hints: [
          "Ensure your model outputs numeric floating point or integer values for 'amount_printed'.",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: true },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: valPayload.count === expectedCount },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false, message: "Values must be numeric" },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (valPayload.count !== expectedCount) {
      const receivedCount = valPayload.count ?? 0;
      validation = {
        status: "failed",
        title: "Prediction Count Mismatch",
        message: `Expected ${expectedCount.toLocaleString()} predictions for test.csv, but received ${receivedCount.toLocaleString()}.`,
        hints: [
          `Ensure you generate exactly one prediction for each row in test.csv (${expectedCount} rows).`,
          "Avoid filtering or dropping rows from test_df before generating predictions.",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: true },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false, message: `Received ${receivedCount} items` },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: !valPayload.has_nan && !valPayload.has_inf },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (valPayload.has_nan || valPayload.has_inf) {
      validation = {
        status: "failed",
        title: "NaN or Infinite Values Detected",
        message: "Your predictions array contains NaN (missing) or infinite values.",
        hints: [
          "Impute missing values in test features (e.g. SimpleImputer or fillna) before running prediction.",
          "Check for division by zero or extreme scaling transformations.",
        ],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: true },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: true },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false, message: "Contains NaN or Inf" },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    } else if (Array.isArray(valPayload.predictions) && valPayload.predictions.length === expectedCount) {
      // ── Grade against server-side answer key ──────────────────────────────
      const trueValues = answerKey.map((r) => r.amount_printed);
      const sumActual = trueValues.reduce((a, b) => a + b, 0);
      const predValues = valPayload.predictions;

      const sumAbsError = predValues.reduce(
        (acc, pred, i) => acc + Math.abs(pred - trueValues[i]),
        0
      );
      const errorPct = sumActual > 0 ? (sumAbsError / sumActual) * 100 : 0;
      const points = calculatePoints(errorPct);

      const hints: string[] = [];
      if (points >= 950) {
        hints.push("🏆 Excellent accuracy! Your model achieves top tier benchmark ranking.");
        hints.push("Try fine-tuning learning rates or testing ensemble voting to push error even lower.");
      } else if (points >= 750) {
        hints.push("🎯 Solid model performance! Good generalization on unseen test data.");
        hints.push("Tip: Try tuning hyperparameters (e.g., max_iter, learning_rate) or tree depth in HistGradientBoostingRegressor / RandomForest.");
      } else {
        hints.push("📈 Model validated! To improve points: Ensure categorical columns (paper_type, shift, machine_type) are one-hot encoded.");
        hints.push("Tip: Standardize numeric features with StandardScaler and handle missing data with SimpleImputer.");
      }

      validation = {
        status: "passed",
        title: points >= 950 ? "Outstanding Accuracy!" : points >= 750 ? "Validation Passed!" : "Model Graded",
        message: `Evaluation complete: ${errorPct.toFixed(2)}% test validation error (${points} / 1000 pts).`,
        points,
        maxPoints: 1000,
        errorPct: parseFloat(errorPct.toFixed(2)),
        hints,
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: true },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: true },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: true },
          { id: "score", label: `Benchmark Scored: ${points} pts (${errorPct.toFixed(2)}% error)`, passed: true },
        ],
      };
    } else {
      validation = {
        status: "failed",
        title: "Validation Incomplete",
        message: "Unable to complete scoring evaluation on model outputs.",
        hints: ["Verify that test predictions are generated completely."],
        checks: [
          { id: "exec", label: "Python Execution (Exit 0)", passed: true },
          { id: "var", label: "Variable 'predictions' Defined", passed: true },
          { id: "len", label: `Output Length Match (${expectedCount.toLocaleString()} rows)`, passed: false },
          { id: "valid", label: "Numeric Values (No NaN / Inf)", passed: false },
          { id: "score", label: "Benchmark Evaluation", passed: false },
        ],
      };
    }

    // Return terminal outputs cleanly separated from validation feedback
    return NextResponse.json({
      stdout: cleanStdout,
      stderr: cleanStderr,
      exitCode: rawResult.exitCode,
      status: rawResult.status,
      time: rawResult.time,
      memory: rawResult.memory,
      image,
      validation,
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
