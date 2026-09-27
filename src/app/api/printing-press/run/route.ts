import { NextRequest, NextResponse } from "next/server";
import { executeCode } from "@/lib/executor";

const VALIDATION_RATIO = 0.2;
const RANDOM_SEED = 42;

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Python code is required" },
        { status: 400 }
      );
    }

    if (content.length > 500_000) {
      return NextResponse.json(
        { error: "Code is too large" },
        { status: 400 }
      );
    }

    const wrappedSource = `
import pandas as pd
import numpy as np

# ============================================================
# PRINTING PRESS CONTEST ENVIRONMENT
# ============================================================

_pp_df = pd.read_csv("/workspace/train.csv")

# Reproducible validation split
_pp_rng = np.random.RandomState(${RANDOM_SEED})
_pp_indices = _pp_rng.permutation(len(_pp_df))

_pp_split = int(len(_pp_df) * (1 - ${VALIDATION_RATIO}))

_pp_train_indices = _pp_indices[:_pp_split]
_pp_val_indices = _pp_indices[_pp_split:]

_pp_train = _pp_df.iloc[_pp_train_indices].copy()
_pp_val = _pp_df.iloc[_pp_val_indices].copy()

# Variables available to the contestant
train_df = _pp_train.copy()
val_df = _pp_val.drop(columns=["amount_printed"]).copy()

# ============================================================
# CONTESTANT CODE
# ============================================================

try:
    exec(
        compile(${JSON.stringify(content)}, "contestant.py", "exec"),
        globals()
    )
except SystemExit:
    pass

# ============================================================
# PLATFORM VALIDATION
# ============================================================

if "predictions" not in globals():
    print("\\n[PLATFORM ERROR]")
    print("Your code must create a variable named 'predictions'.")
else:
    try:
        _pp_predictions = np.asarray(predictions, dtype=float).reshape(-1)
        _pp_true = _pp_df.iloc[_pp_val_indices]["amount_printed"].to_numpy()

        if len(_pp_predictions) != len(_pp_true):
            print("\\n[PLATFORM ERROR]")
            print(
                f"Expected {len(_pp_true)} predictions, "
                f"but received {len(_pp_predictions)}."
            )

        elif not np.all(np.isfinite(_pp_predictions)):
            print("\\n[PLATFORM ERROR]")
            print("Predictions contain NaN or infinite values.")

        else:
            _pp_error = _pp_predictions - _pp_true

            _pp_mae = np.mean(np.abs(_pp_error))
            _pp_rmse = np.sqrt(np.mean(_pp_error ** 2))

            _pp_ss_res = np.sum(_pp_error ** 2)
            _pp_ss_tot = np.sum(
                (_pp_true - np.mean(_pp_true)) ** 2
            )

            _pp_r2 = 1 - (_pp_ss_res / _pp_ss_tot)

            _pp_error_percent = (
                np.sum(np.abs(_pp_error))
                / np.sum(np.abs(_pp_true))
                * 100
            )

            print("\\n" + "=" * 45)
            print("PRINTING PRESS — VALIDATION RESULTS")
            print("=" * 45)
            print(f"Validation rows : {len(_pp_true)}")
            print(f"MAE             : {_pp_mae:.2f}")
            print(f"RMSE            : {_pp_rmse:.2f}")
            print(f"R² Score        : {_pp_r2:.4f}")
            print(f"Error %         : {_pp_error_percent:.2f}%")
            print("=" * 45)

    except Exception as error:
        print("\\n[PLATFORM ERROR]")
        print(f"Could not evaluate predictions: {error}")
`;

    const result = await executeCode("python", wrappedSource, "");

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Printing Press execution failed",
      },
      { status: 500 }
    );
  }
}