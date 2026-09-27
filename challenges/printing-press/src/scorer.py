"""Printing Press ML — Competition Scoring System

This module provides the official scoring functionality for the Printing Press ML
competition. It evaluates participant submissions against the private answer key
using the overall percentage error metric and assigns points out of 1000.

Formula:
    overall_error_percentage = (SUM(abs(predicted_amount - actual_amount))
                                / SUM(actual_amount)) * 100

Points Scale:
    0–2%    (error <= 2.0)        -> 1000 points
    >2–5%   (2.0 < error <= 5.0)  -> 950 points
    >5–10%  (5.0 < error <= 10.0) -> 850 points
    >10–15% (10.0 < error <= 15.0)-> 750 points
    >15–20% (15.0 < error <= 20.0)-> 600 points
    >20–30% (20.0 < error <= 30.0)-> 400 points
    >30–50% (30.0 < error <= 50.0)-> 200 points
    >50%    (error > 50.0)        -> 0 points
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, Tuple, Union

import numpy as np
import pandas as pd


MAX_SCORE = 1000
DEFAULT_ANSWER_KEY_PATH = os.path.join("data", "answer_key.csv")
REQUIRED_SUBMISSION_COLUMNS = ["id", "predicted_amount"]
ACTUAL_TARGET_COLUMN = "amount_printed"


class SubmissionValidationError(ValueError):
    """Raised when a participant submission violates formatting rules."""
    pass


def calculate_points(overall_error_pct: float) -> int:
    """Map overall percentage error to competition points out of 1000.

    Exact Boundary Behavior:
    - error <= 2%         -> 1000
    - error > 2% and <= 5% -> 950
    - error > 5% and <= 10%-> 850
    - error > 10% and <= 15%-> 750
    - error > 15% and <= 20%-> 600
    - error > 20% and <= 30%-> 400
    - error > 30% and <= 50%-> 200
    - error > 50%         -> 0

    Parameters
    ----------
    overall_error_pct : float
        Overall percentage error across all test samples.

    Returns
    -------
    int
        Score from 0 to 1000.
    """
    if overall_error_pct < 0.0:
        raise ValueError(f"Error percentage cannot be negative: {overall_error_pct}")

    if overall_error_pct <= 2.0:
        return 1000
    elif overall_error_pct <= 5.0:
        return 950
    elif overall_error_pct <= 10.0:
        return 850
    elif overall_error_pct <= 15.0:
        return 750
    elif overall_error_pct <= 20.0:
        return 600
    elif overall_error_pct <= 30.0:
        return 400
    elif overall_error_pct <= 50.0:
        return 200
    else:
        return 0


def validate_submission(
    submission_df: pd.DataFrame,
    answer_key_df: pd.DataFrame
) -> Tuple[pd.Series, pd.Series]:
    """Validate submission schema, IDs, and prediction validity.

    Parameters
    ----------
    submission_df : pd.DataFrame
        Participant submission DataFrame.
    answer_key_df : pd.DataFrame
        Private ground-truth answer key DataFrame.

    Returns
    -------
    Tuple[pd.Series, pd.Series]
        (aligned_predictions, aligned_actuals) aligned by test IDs.

    Raises
    ------
    SubmissionValidationError
        If submission is missing required columns, has duplicate IDs,
        missing IDs, extra IDs, or non-numeric/null values.
    """
    # 1. Required column check
    for col in REQUIRED_SUBMISSION_COLUMNS:
        if col not in submission_df.columns:
            raise SubmissionValidationError(
                f"Missing required column '{col}'. Submission columns found: {list(submission_df.columns)}"
            )

    # 2. Check duplicate IDs
    if submission_df["id"].duplicated().any():
        num_dups = submission_df["id"].duplicated().sum()
        dup_samples = submission_df.loc[submission_df["id"].duplicated(), "id"].head(5).tolist()
        raise SubmissionValidationError(
            f"Submission contains {num_dups} duplicate IDs. Example duplicates: {dup_samples}"
        )

    # 3. Check ID set equivalence against answer key
    sub_ids = set(submission_df["id"].astype(str))
    key_ids = set(answer_key_df["id"].astype(str))

    missing_ids = key_ids - sub_ids
    if missing_ids:
        example_missing = sorted(list(missing_ids))[:5]
        raise SubmissionValidationError(
            f"Submission is missing {len(missing_ids)} required test IDs. "
            f"Expected {len(key_ids)} IDs, got {len(sub_ids)}. Examples: {example_missing}"
        )

    extra_ids = sub_ids - key_ids
    if extra_ids:
        example_extra = sorted(list(extra_ids))[:5]
        raise SubmissionValidationError(
            f"Submission contains {len(extra_ids)} unknown/extra IDs. Examples: {example_extra}"
        )

    # 4. Check prediction validity (numeric and not null/NaN/Inf)
    preds = submission_df["predicted_amount"]
    if not pd.api.types.is_numeric_dtype(preds):
        try:
            preds = pd.to_numeric(preds, errors="raise")
        except Exception as e:
            raise SubmissionValidationError(
                f"Non-numeric values found in 'predicted_amount': {e}"
            )

    null_count = preds.isna().sum()
    if null_count > 0:
        raise SubmissionValidationError(
            f"Submission contains {null_count} missing (NaN/null) predictions."
        )

    inf_count = np.isinf(preds).sum()
    if inf_count > 0:
        raise SubmissionValidationError(
            f"Submission contains {inf_count} infinite predictions."
        )

    # 5. Align predictions and actual values by ID
    sub_indexed = submission_df.set_index("id")["predicted_amount"].astype(float)
    key_indexed = answer_key_df.set_index("id")[ACTUAL_TARGET_COLUMN].astype(float)

    aligned_preds = sub_indexed.loc[key_indexed.index]
    aligned_actuals = key_indexed

    return aligned_preds, aligned_actuals


def calculate_overall_error(
    predicted_amount: Union[pd.Series, np.ndarray],
    actual_amount: Union[pd.Series, np.ndarray],
    round_decimals: int = 4
) -> float:
    """Calculate overall percentage error according to competition specifications.

    overall_error_percentage = (SUM(abs(predicted - actual)) / SUM(actual)) * 100

    Parameters
    ----------
    predicted_amount : array-like
        Predicted values.
    actual_amount : array-like
        Ground truth actual values.
    round_decimals : int
        Decimal places to round the percentage error (default 4) to avoid
        IEEE 754 floating point boundary drift.

    Returns
    -------
    float
        Overall error percentage.
    """
    preds = np.asarray(predicted_amount, dtype=float)
    actuals = np.asarray(actual_amount, dtype=float)

    sum_actuals = np.sum(actuals)
    if sum_actuals <= 0:
        raise ValueError(f"Sum of actual amounts must be positive, got {sum_actuals}")

    sum_abs_errors = np.sum(np.abs(preds - actuals))
    overall_error_pct = (sum_abs_errors / sum_actuals) * 100.0

    if round_decimals is not None:
        overall_error_pct = round(float(overall_error_pct), round_decimals)

    return float(overall_error_pct)


def score_submission(
    submission_path: str,
    answer_key_path: str = DEFAULT_ANSWER_KEY_PATH,
    verbose: bool = True
) -> Dict[str, Union[float, int, str]]:
    """Score a participant submission file against the ground-truth answer key.

    Parameters
    ----------
    submission_path : str
        Path to the participant submission CSV.
    answer_key_path : str
        Path to the private answer_key.csv (default: data/answer_key.csv).
    verbose : bool
        Whether to print the formatted score banner.

    Returns
    -------
    Dict[str, Union[float, int, str]]
        Dictionary with evaluation results:
        - 'submission_path': str
        - 'num_rows': int
        - 'overall_error_pct': float
        - 'score': int
        - 'max_score': int
    """
    if not os.path.exists(submission_path):
        raise FileNotFoundError(f"Submission file not found: {submission_path}")

    if not os.path.exists(answer_key_path):
        raise FileNotFoundError(
            f"Answer key not found at '{answer_key_path}'. "
            "Please ensure data/answer_key.csv exists on the scoring machine."
        )

    sub_df = pd.read_csv(submission_path)
    key_df = pd.read_csv(answer_key_path)

    aligned_preds, aligned_actuals = validate_submission(sub_df, key_df)

    overall_error_pct = calculate_overall_error(aligned_preds, aligned_actuals)
    score = calculate_points(overall_error_pct)

    results = {
        "submission_path": submission_path,
        "num_rows": len(aligned_preds),
        "overall_error_pct": round(overall_error_pct, 4),
        "score": score,
        "max_score": MAX_SCORE,
    }

    if verbose:
        print("\n===== Printing Press ML Score =====")
        print(f"Overall Error: {overall_error_pct:.2f}%")
        print(f"Score: {score}/{MAX_SCORE}")
        print("===================================\n")

    return results


def main() -> None:
    """CLI entry point for scoring submissions."""
    parser = argparse.ArgumentParser(
        description="Score a participant submission for the Printing Press ML challenge."
    )
    parser.add_argument(
        "submission",
        help="Path to participant submission CSV (must contain 'id' and 'predicted_amount')"
    )
    parser.add_argument(
        "--answer-key",
        default=DEFAULT_ANSWER_KEY_PATH,
        help=f"Path to private ground-truth answer key CSV (default: {DEFAULT_ANSWER_KEY_PATH})"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress banner output and print only numeric score"
    )

    args = parser.parse_args()

    try:
        results = score_submission(
            submission_path=args.submission,
            answer_key_path=args.answer_key,
            verbose=not args.quiet
        )
        if args.quiet:
            print(results["score"])
    except (SubmissionValidationError, FileNotFoundError, ValueError) as err:
        sys.stderr.write(f"Scoring Error: {err}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
