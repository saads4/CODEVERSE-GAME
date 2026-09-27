# Printing Press ML — Difficulty Benchmark

## Official Scoring Metric

```
overall_error_percentage =
    (SUM(abs(predicted_amount - actual_amount)) / SUM(actual_amount)) × 100
```

## Points Scale

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

---

## Benchmark Results

Evaluated on the official 1,500-row test set.
Validation R² is measured on a held-out 20% split of `train.csv` only.
The private `answer_key.csv` was used solely for final test evaluation.

| Model | Validation R² | Test Error % | Points |
|---|---:|---:|---:|
| Mean Baseline | −0.0000 | 39.81% | 200/1000 |
| Ridge Regression | 0.8262 | 15.54% | 600/1000 |
| Random Forest | 0.9410 | 8.68% | 850/1000 |
| Gradient Boosting | 0.9790 | 4.76% | 950/1000 |

---

## Notes

- All models used default or conservative hyperparameters with no extensive tuning.
- Categorical features were one-hot encoded; numerical missing values imputed with the median.
- The `1000`-point bracket (≤ 2% error) was not achieved by any of the baselines above.
- Dataset: 7,000 training rows, 1,500 test rows, 15 features, seed 2026.
