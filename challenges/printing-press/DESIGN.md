# Printing Press ML — Dataset Design

## 1. Dataset

- Training rows: 7,000
- Test rows: 1,500
- Total features: 15
- Target: `amount_printed`
- Meaningful features: 12
- Noise features: 3
- Same generation logic for train and test
- Fixed final dataset for the competition

---

## 2. Target Generation

`amount_printed` is generated from the following 12 meaningful features:

| Feature | Role in Target |
|---|---|
| `printing_speed` | Strong positive effect up to an optimum, then efficiency decreases |
| `machine_age` | Older machines reduce efficiency |
| `operating_hours` | More operating time increases production with diminishing returns |
| `temperature` | Optimal range; extreme temperatures reduce efficiency |
| `humidity` | Optimal range; extreme humidity reduce efficiency |
| `power_stability` | Higher stability increases production; instability causes downtime |
| `setup_time` | Longer setup reduces available production time |
| `paper_type` | Different paper types have different base efficiencies |
| `shift` | Small production/efficiency difference between shifts |
| `maintenance_status` | Strong effect on machine efficiency and failures |
| `machine_type` | Different machines have different baseline efficiencies |
| `paper_quality` | Higher quality reduces failed prints and improves efficiency |

### Base structure

The target should approximately follow:

```text
amount_printed =
base_production
+ individual_feature_effects
+ nonlinear_effects
+ interaction_effects
- production_losses
+ random_noise
```

The 12 meaningful features should not simply be combined as independent efficiency multipliers.

The example efficiency values and ranges below are design guidance. They should be translated into a combined production model rather than implemented as 12 separate multipliers.

The final value must be non-negative.

---

## 3. Nonlinear Conditions

### 3.1 Printing Speed

Range: **30–180 prints/min**

- `< 60` → low production efficiency
- `60–120` → efficiency increases with speed
- `120–150` → near-optimal range
- `> 150` → efficiency starts decreasing
- `> 170` → significant error/failure penalty

Example efficiency behavior:

- 30–60 → 0.70–0.85
- 60–120 → 0.85–1.00
- 120–150 → 1.00–1.05
- 150–170 → 0.90–1.00
- 170–180 → 0.75–0.90

These values are design guidance and should not necessarily be implemented as literal independent multipliers.

---

### 3.2 Machine Age

Range: **0–15 years**

- `0–3 years` → very high efficiency
- `4–7 years` → small efficiency reduction
- `8–11 years` → noticeable reduction
- `12–15 years` → strong reduction

Additional age penalty becomes stronger when:

`machine_age > 8 AND maintenance_status = Poor`

---

### 3.3 Operating Hours

Range: **1–24 hours**

- `1–8 h` → normal production increase
- `9–16 h` → continued increase but with diminishing returns
- `17–20 h` → noticeable fatigue/efficiency loss
- `21–24 h` → strong fatigue penalty

---

### 3.4 Temperature

Range: **15–40°C**

Optimal range:

`20–28°C`

Penalties:

- `< 18°C` → moderate penalty
- `18–<20°C` → small penalty
- `20–28°C` → optimal
- `>28–32°C` → small penalty
- `>32–36°C` → moderate penalty
- `>36°C` → strong penalty

---

### 3.5 Humidity

Range: **20–90%**

Optimal range:

`40–60%`

Penalties:

- `< 30%` → moderate penalty
- `30–<40%` → small penalty
- `40–60%` → optimal
- `>60–70%` → small penalty
- `>70–80%` → moderate penalty
- `>80%` → strong penalty

---

### 3.6 Power Stability

Range: **0–100**

- `90–100` → highly stable
- `75–89` → normal
- `50–74` → noticeable interruptions
- `25–49` → significant production loss
- `0–24` → severe downtime

---

### 3.7 Setup Time

Range: **10–120 minutes**

- `10–30 min` → minimal production loss
- `31–60 min` → moderate loss
- `61–90 min` → significant loss
- `91–120 min` → high loss

Setup time directly reduces the effective production time.

---

### 3.8 Paper Type

Example categories:

- `Standard`
- `Glossy`
- `Matte`
- `Cardstock`

Each type receives a different base production effect.

Example:

- Standard → `1.00`
- Matte → `0.97`
- Glossy → `0.95`
- Cardstock → `0.90`

These values are design guidance rather than mandatory independent multipliers.

---

### 3.9 Shift

Categories:

- `Morning`
- `Afternoon`
- `Night`

Small effect only.

Example:

- Morning → `1.02`
- Afternoon → `1.00`
- Night → `0.97`

Night shift can additionally have a slightly higher interruption probability.

---

### 3.10 Maintenance Status

Categories:

- `Good`
- `Average`
- `Poor`

Example efficiency:

- Good → `1.05`
- Average → `1.00`
- Poor → `0.88`

Poor maintenance has a stronger negative effect on older machines.

These values are design guidance rather than mandatory independent multipliers.

---

### 3.11 Machine Type

Example categories:

- `Type_A`
- `Type_B`
- `Type_C`
- `Type_D`

Each has a small baseline production difference.

The effect should remain weaker than printing speed, power stability, machine age and maintenance.

---

### 3.12 Paper Quality

Range/categories:

- `Low`
- `Medium`
- `High`

Example production effect:

- High → `1.03`
- Medium → `1.00`
- Low → `0.92`

Low paper quality becomes significantly worse at high printing speeds.

These values are design guidance rather than mandatory independent multipliers.

---

## 4. Feature Interactions

These interactions should create nonlinear patterns that simple linear models cannot capture easily.

### 4.1 High Speed × High Humidity

Condition:

`printing_speed > 150 AND humidity > 70`

→ additional efficiency penalty.

If:

`printing_speed > 170 AND humidity > 80`

→ strong penalty.

---

### 4.2 High Speed × Poor Paper Quality

Condition:

`printing_speed > 150 AND paper_quality = Low`

→ increased failed-print probability.

If:

`printing_speed > 170 AND paper_quality = Low`

→ major production loss.

---

### 4.3 Old Machine × Poor Maintenance

Condition:

`machine_age > 8 AND maintenance_status = Poor`

→ additional efficiency penalty.

If:

`machine_age > 12 AND maintenance_status = Poor`

→ strong penalty.

---

### 4.4 Old Machine × Long Operating Hours

Condition:

`machine_age > 8 AND operating_hours > 16`

→ additional fatigue penalty.

If:

`machine_age > 12 AND operating_hours > 20`

→ strong additional penalty.

---

### 4.5 High Speed × Unstable Power

Condition:

`printing_speed > 150 AND power_stability < 60`

→ increased interruption probability.

If:

`printing_speed > 170 AND power_stability < 40`

→ severe production loss.

---

### 4.6 Night Shift × Unstable Power

Condition:

`shift = Night AND power_stability < 50`

→ slightly increased interruption probability.

This should be a weak interaction and should not dominate the target.

---

### 4.7 Temperature × Humidity

Condition:

`temperature > 32 AND humidity > 70`

→ additional environmental efficiency penalty.

Extreme combination:

`temperature > 36 AND humidity > 80`

→ strong penalty.

---

### 4.8 Maintenance × Machine Age

Good maintenance partially offsets machine-age effects.

For example:

`machine_age > 8 AND maintenance_status = Good`

→ age penalty is reduced.

Whereas:

`machine_age > 8 AND maintenance_status = Poor`

→ age penalty is amplified.

---

## 5. Missing Values

- Moderate missingness.
- Missingness is patterned rather than completely random.
- Sensor-related features such as:
  - `temperature`
  - `humidity`
  - `power_stability`

  can have condition-dependent missing probabilities.

Example:

- Normal conditions → ~3–5% missing
- Extreme conditions → ~8–12% missing

Missingness must **not directly reveal `amount_printed`**.

---

## 6. Outliers

Outliers should originate from realistic combinations.

Examples:

- Very high speed + poor paper
- Old machine + poor maintenance
- Extremely unstable power
- Long operating session
- Very favorable conditions producing unusually high output

No arbitrary impossible values should be introduced.

---

## 7. Noise Features

These features have **no intentional relationship with the target**:

- `last_calibration_day`
- `operator_id`
- `ink_batch_id`

They should still look realistic and plausible.

---

## 8. Randomness

- Use fixed random seeds.
- Generate 2–3 candidate datasets.
- Evaluate difficulty using a mean-prediction baseline and multiple ML models.
- Select one final dataset.
- Freeze the final CSVs.
- Hidden test targets remain private.
