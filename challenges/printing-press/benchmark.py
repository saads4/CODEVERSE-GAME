"""Printing Press ML — Difficulty Benchmark

Evaluates challenge difficulty across four standard machine learning approaches:
1. Mean Baseline
2. Ridge Regression
3. Random Forest Regressor
4. Gradient Boosting Regressor

Validation metrics (RMSE, MAE, R²) are computed on a 20% validation split
derived solely from train.csv. The private answer_key.csv is used strictly
for post-hoc evaluation of test set predictions using the official scoring metric.
"""

from __future__ import annotations

import os
import sys
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import Ridge
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# Import official scoring module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))
try:
    import scorer
except ImportError:
    from src import scorer

# Paths
DATA_DIR = "data"
TRAIN_PATH = os.path.join(DATA_DIR, "train.csv")
TEST_PATH = os.path.join(DATA_DIR, "test.csv")
ANSWER_KEY_PATH = os.path.join(DATA_DIR, "answer_key.csv")


def load_datasets():
    """Load train, test, and private answer key datasets."""
    train_df = pd.read_csv(TRAIN_PATH)
    test_df = pd.read_csv(TEST_PATH)
    answer_key_df = pd.read_csv(ANSWER_KEY_PATH)
    return train_df, test_df, answer_key_df


def build_preprocessors(num_cols, cat_cols):
    """Build standard scikit-learn preprocessing pipelines."""
    num_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    cat_transformer = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_transformer, num_cols),
            ("cat", cat_transformer, cat_cols),
        ]
    )
    return preprocessor


def main():
    print("Loading competition datasets...")
    train_df, test_df, answer_key_df = load_datasets()

    target_col = "amount_printed"
    id_col = "id"

    # Separate features and target from train
    X = train_df.drop(columns=[id_col, target_col])
    y = train_df[target_col]

    # Test features without id
    X_test = test_df.drop(columns=[id_col])
    actual_test_targets = answer_key_df.set_index(id_col)[target_col].loc[test_df[id_col]].to_numpy()

    # Identify numerical and categorical columns
    num_cols = [
        "printing_speed", "machine_age", "operating_hours",
        "temperature", "humidity", "power_stability",
        "setup_time", "last_calibration_day"
    ]
    cat_cols = [
        "paper_type", "shift", "maintenance_status",
        "machine_type", "paper_quality", "operator_id", "ink_batch_id"
    ]

    # Split train.csv ONLY (80% train / 20% validation)
    X_tr, X_val, y_tr, y_val = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    preprocessor = build_preprocessors(num_cols, cat_cols)

    # Models to benchmark
    models = {
        "Mean Baseline": DummyRegressor(strategy="mean"),
        "Ridge Regression": Ridge(alpha=10.0),
        "Random Forest": RandomForestRegressor(
            n_estimators=150,
            max_depth=16,
            min_samples_leaf=3,
            random_state=42,
            n_jobs=-1
        ),
        "Gradient Boosting": HistGradientBoostingRegressor(
            max_iter=200,
            max_depth=8,
            learning_rate=0.08,
            random_state=42
        ),
    }

    results = []

    for name, model in models.items():
        pipe = Pipeline([
            ("prep", preprocessor),
            ("reg", model)
        ])

        # 1. Fit on training split
        pipe.fit(X_tr, y_tr)

        # 2. Evaluate on validation split (derived strictly from train)
        val_preds = pipe.predict(X_val)
        val_rmse = np.sqrt(mean_squared_error(y_val, val_preds))
        val_mae = mean_absolute_error(y_val, val_preds)
        val_r2 = r2_score(y_val, val_preds)

        # 3. Refit on FULL train.csv to generate test predictions
        pipe.fit(X, y)
        test_preds = np.maximum(0.0, pipe.predict(X_test))

        # 4. Evaluate test predictions against answer_key.csv using official metric
        test_err_pct = scorer.calculate_overall_error(test_preds, actual_test_targets)
        test_points = scorer.calculate_points(test_err_pct)

        results.append({
            "Model": name,
            "Val RMSE": val_rmse,
            "Val MAE": val_mae,
            "Val R²": val_r2,
            "Test Error %": test_err_pct,
            "Points": test_points,
        })

    # Print results
    print("\n" + "=" * 60)
    print("PRINTING PRESS ML — DIFFICULTY BENCHMARK")
    print("=" * 60)
    header = f"{'Model':<25}{'Validation R²':<17}{'Test Error %':<16}{'Points'}"
    print(header)
    print("-" * 64)
    for r in results:
        print(f"{r['Model']:<25}{r['Val R²']:<17.4f}{r['Test Error %']:<16.2f}{r['Points']}/1000")
    print("=" * 60 + "\n")

    # Additional diagnostic details
    print("Detailed Metrics on Validation & Test:")
    print("-" * 64)
    for r in results:
        print(f"{r['Model']}:")
        print(f"  Val RMSE: {r['Val RMSE']:,.2f} | Val MAE: {r['Val MAE']:,.2f} | Val R²: {r['Val R²']:.4f}")
        print(f"  Test Overall Error: {r['Test Error %']:.2f}% -> Official Points: {r['Points']}/1000")

    # Min / max error summary
    errors = [r["Test Error %"] for r in results]
    min_err_model = min(results, key=lambda x: x["Test Error %"])
    max_err_model = max(results, key=lambda x: x["Test Error %"])
    print("\nBenchmark Range:")
    print(f"  Lowest Test Error : {min_err_model['Test Error %']:.2f}% ({min_err_model['Model']})")
    print(f"  Highest Test Error: {max_err_model['Test Error %']:.2f}% ({max_err_model['Model']})")


if __name__ == "__main__":
    main()
