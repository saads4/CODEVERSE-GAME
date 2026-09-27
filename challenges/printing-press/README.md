# Printing Press ML Challenge

Participants receive historical printing press session data and must predict the **number of pages produced** (`amount_printed`) for a set of unseen test conditions.

---

## Problem Statement

Given the operating conditions of an industrial printing press, predict the total pages/prints produced during the session.

- **Training data**: 7,000 sessions with all features and the target `amount_printed`
- **Test data**: 1,500 sessions with all features but **no target**
- **Goal**: Predict `amount_printed` for each test session as accurately as possible

---

## Dataset

| File | Rows | Columns | Target |
|---|---|---|---|
| `data/train.csv` | 7,000 | 17 (id + 15 features + target) | included |
| `data/test.csv` | 1,500 | 16 (id + 15 features) | **withheld** |

### Features

| # | Feature | Type | Range / Categories |
|---|---|---|---|
| 1 | `printing_speed` | Numerical | 30–180 prints/min |
| 2 | `machine_age` | Numerical | 0–15 years |
| 3 | `operating_hours` | Numerical | 1–24 hours |
| 4 | `temperature` | Numerical | 15–40 °C |
| 5 | `humidity` | Numerical | 20–90 % |
| 6 | `power_stability` | Numerical | 0–100 |
| 7 | `setup_time` | Numerical | 10–120 minutes |
| 8 | `paper_type` | Categorical | Standard, Glossy, Matte, Cardstock |
| 9 | `shift` | Categorical | Morning, Afternoon, Night |
| 10 | `maintenance_status` | Categorical | Good, Average, Poor |
| 11 | `machine_type` | Categorical | Type_A, Type_B, Type_C, Type_D |
| 12 | `paper_quality` | Categorical | Low, Medium, High |
| 13 | `last_calibration_day` | Numerical | 1–365 days |
| 14 | `operator_id` | Categorical | Op01–Op10 |
| 15 | `ink_batch_id` | Categorical | B01–B20 |

> **Note:** `temperature`, `humidity`, and `power_stability` contain a small percentage of missing values. All other features are complete.

### Target

`amount_printed` — total pages/prints produced during the session (non-negative integer/float).

---

## Submission Format

Submit a CSV file with exactly two columns:

| id | predicted_amount |
|---|---|
| PP007001 | 58000.0 |
| PP007002 | 43200.5 |
| ... | ... |

- Every test ID (`PP007001` to `PP008500`) must appear exactly once.
- No extra or missing IDs.
- `predicted_amount` must be numeric and non-null.

---

## Scoring

Submissions are evaluated using the **overall percentage error** across all 1,500 test rows:

```
overall_error_percentage =
    (SUM(abs(predicted_amount - actual_amount))
     / SUM(actual_amount)) × 100
```

Points are awarded based on:

| Overall Error | Points |
|---|---:|
| ≤ 2% | 1000 |
| > 2% and ≤ 5% | 950 |
| > 5% and ≤ 10% | 850 |
| > 10% and ≤ 15% | 750 |
| > 15% and ≤ 20% | 600 |
| > 20% and ≤ 30% | 400 |
| > 30% and ≤ 50% | 200 |
| > 50% | 0 |

The actual test targets are kept private and used only for official scoring.

---

## Repository Structure

```
Printing_Press_ML/
├── data/
│   ├── train.csv         # Training data (public)
│   └── test.csv          # Test conditions (public, no target)
├── tests/
│   └── test_scorer.py    # Scorer unit tests
├── generator.py          # Dataset generation script (organizer use)
├── scorer.py             # Official scoring script (organizer use)
├── benchmark.py          # Difficulty benchmark script
├── DESIGN.md             # Dataset design specification
├── BENCHMARK.md          # Official difficulty benchmark results
├── requirements.txt      # Python dependencies
└── .gitignore
```

## Setup

```bash
pip install -r requirements.txt
```

## Running Tests

```bash
python -m unittest tests/test_scorer.py
```
