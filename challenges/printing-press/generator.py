"""Printing Press ML — Dataset Generator
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Configuration & Constants
# ---------------------------------------------------------------------------

PAPER_TYPES = ["Standard", "Glossy", "Matte", "Cardstock"]
PAPER_TYPE_WEIGHTS = [0.40, 0.22, 0.23, 0.15]

SHIFTS = ["Morning", "Afternoon", "Night"]
SHIFT_WEIGHTS = [0.35, 0.35, 0.30]

MAINTENANCE_STATUSES = ["Good", "Average", "Poor"]
MAINTENANCE_WEIGHTS = [0.45, 0.40, 0.15]

MACHINE_TYPES = ["Type_A", "Type_B", "Type_C", "Type_D"]
MACHINE_TYPE_WEIGHTS = [0.30, 0.28, 0.24, 0.18]

PAPER_QUALITIES = ["Low", "Medium", "High"]
PAPER_QUALITY_WEIGHTS = [0.20, 0.52, 0.28]

OPERATORS = [f"Op{i:02d}" for i in range(1, 11)]
INK_BATCHES = [f"B{i:02d}" for i in range(1, 21)]

SENSOR_FEATURES = ["temperature", "humidity", "power_stability"]


@dataclass(frozen=True)
class GeneratorConfig:
    """Configuration for data generation."""
    train_size: int = 7000
    test_size: int = 1500
    random_seed: int = 2026
    # Sensor missingness rates
    normal_missing_rate: float = 0.04
    extreme_missing_rate: float = 0.10
    # Process noise standard deviation (relative to nominal output)
    noise_relative_std: float = 0.02


# ---------------------------------------------------------------------------
# Feature Generation
# ---------------------------------------------------------------------------

def generate_features(n_samples: int, rng: np.random.Generator) -> pd.DataFrame:
    """Generate the 15 input features (12 meaningful + 3 noise) for n_samples.

    Parameters
    ----------
    n_samples : int
        Number of rows to generate.
    rng : np.random.Generator
        Initialized NumPy random number generator.

    Returns
    -------
    pd.DataFrame
        DataFrame with all 15 raw features before target calculation
        and before missing-value injection.
    """
    # 1. Printing Speed (30 - 180 prints/min)
    # Mixture of operational speeds centered around 110-140 with full range coverage
    speed_raw = rng.normal(loc=115.0, scale=32.0, size=n_samples)
    printing_speed = np.clip(np.round(speed_raw, 1), 30.0, 180.0)

    # 2. Machine Age (0 - 15 years)
    # Realistic shop floor distribution: more young/mid-age machines, fewer old
    machine_age_raw = rng.exponential(scale=5.0, size=n_samples)
    machine_age = np.clip(np.round(machine_age_raw, 1), 0.0, 15.0)

    # 3. Operating Hours (1 - 24 hours)
    # Bimodal shift clusters around 8h and 12h shifts, with extended runs up to 24h
    shift_choice = rng.choice([8.0, 12.0, 16.0, 20.0], size=n_samples, p=[0.45, 0.35, 0.12, 0.08])
    hours_raw = shift_choice + rng.normal(loc=0.0, scale=1.5, size=n_samples)
    operating_hours = np.clip(np.round(hours_raw, 1), 1.0, 24.0)

    # 4. Temperature (15 - 40 °C)
    # Pressroom climate centered near optimal 23-26°C with seasonal/overheating swings
    temp_raw = rng.normal(loc=24.5, scale=4.5, size=n_samples)
    temperature = np.clip(np.round(temp_raw, 1), 15.0, 40.0)

    # 5. Humidity (20 - 90 %)
    # Centered around 50% with swings into dry (<30%) and wet (>70%)
    humid_raw = rng.normal(loc=52.0, scale=12.0, size=n_samples)
    humidity = np.clip(np.round(humid_raw, 1), 20.0, 90.0)

    # 6. Power Stability (0 - 100)
    # High base stability with sporadic grid brownouts and fluctuations
    base_power = rng.beta(a=8.0, b=1.5, size=n_samples) * 100.0
    # Sporadic severe drops on ~5% of runs
    dip_mask = rng.random(size=n_samples) < 0.05
    dip_values = rng.uniform(5.0, 45.0, size=n_samples)
    base_power[dip_mask] = dip_values[dip_mask]
    power_stability = np.clip(np.round(base_power, 1), 0.0, 100.0)

    # 7. Setup Time (10 - 120 minutes)
    # Log-normal distribution centered around 30-40 minutes
    setup_raw = rng.lognormal(mean=3.5, sigma=0.45, size=n_samples)
    setup_time = np.clip(np.round(setup_raw, 1), 10.0, 120.0)

    # 8. Paper Type (Categorical)
    paper_type = rng.choice(PAPER_TYPES, size=n_samples, p=PAPER_TYPE_WEIGHTS)

    # 9. Shift (Categorical)
    shift = rng.choice(SHIFTS, size=n_samples, p=SHIFT_WEIGHTS)

    # 10. Maintenance Status (Categorical, correlated with age)
    # Older machines have higher probability of Poor maintenance
    maint_status = []
    for age in machine_age:
        if age < 4.0:
            probs = [0.70, 0.25, 0.05]
        elif age < 9.0:
            probs = [0.45, 0.42, 0.13]
        else:
            probs = [0.20, 0.45, 0.35]
        maint_status.append(rng.choice(MAINTENANCE_STATUSES, p=probs))
    maintenance_status = np.array(maint_status)

    # 11. Machine Type (Categorical)
    machine_type = rng.choice(MACHINE_TYPES, size=n_samples, p=MACHINE_TYPE_WEIGHTS)

    # 12. Paper Quality (Categorical)
    paper_quality = rng.choice(PAPER_QUALITIES, size=n_samples, p=PAPER_QUALITY_WEIGHTS)

    # 13. Last Calibration Day (Noise, 1 - 365)
    last_calibration_day = rng.integers(1, 366, size=n_samples)

    # 14. Operator ID (Noise)
    operator_id = rng.choice(OPERATORS, size=n_samples)

    # 15. Ink Batch ID (Noise)
    ink_batch_id = rng.choice(INK_BATCHES, size=n_samples)

    df = pd.DataFrame({
        "printing_speed": printing_speed,
        "machine_age": machine_age,
        "operating_hours": operating_hours,
        "temperature": temperature,
        "humidity": humidity,
        "power_stability": power_stability,
        "setup_time": setup_time,
        "paper_type": paper_type,
        "shift": shift,
        "maintenance_status": maintenance_status,
        "machine_type": machine_type,
        "paper_quality": paper_quality,
        "last_calibration_day": last_calibration_day,
        "operator_id": operator_id,
        "ink_batch_id": ink_batch_id,
    })

    return df


# ---------------------------------------------------------------------------
# Nonlinear Efficiency Curves & Response Functions
# ---------------------------------------------------------------------------

def calculate_speed_efficiency(speed: np.ndarray) -> np.ndarray:
    """Calculate speed efficiency multiplier according to DESIGN.md Section 3.1.

    Speed Ranges:
    - < 60: 0.70 - 0.85
    - 60 - 120: 0.85 - 1.00
    - 120 - 150: 1.00 - 1.05 (near optimal)
    - > 150: starts decreasing (0.90 - 1.00)
    - > 170: sharp error/failure penalty (0.75 - 0.90)
    """
    eff = np.zeros_like(speed, dtype=float)

    mask_under_60 = speed < 60.0
    eff[mask_under_60] = 0.70 + (speed[mask_under_60] - 30.0) / 30.0 * 0.15

    mask_60_120 = (speed >= 60.0) & (speed < 120.0)
    eff[mask_60_120] = 0.85 + (speed[mask_60_120] - 60.0) / 60.0 * 0.15

    mask_120_150 = (speed >= 120.0) & (speed <= 150.0)
    eff[mask_120_150] = 1.00 + (speed[mask_120_150] - 120.0) / 30.0 * 0.05

    mask_150_170 = (speed > 150.0) & (speed <= 170.0)
    eff[mask_150_170] = 1.00 - (speed[mask_150_170] - 150.0) / 20.0 * 0.10

    mask_over_170 = speed > 170.0
    eff[mask_over_170] = 0.90 - (speed[mask_over_170] - 170.0) / 10.0 * 0.15

    return eff


def calculate_age_penalty(age: np.ndarray) -> np.ndarray:
    """Calculate machine age penalty according to DESIGN.md Section 3.2.

    Age ranges:
    - 0-3 yrs: very high efficiency (0 penalty)
    - 4-7 yrs: small reduction (0.01 - 0.04)
    - 8-11 yrs: noticeable reduction (0.05 - 0.11)
    - 12-15 yrs: strong reduction (0.12 - 0.22)
    """
    penalty = np.zeros_like(age, dtype=float)

    mask_4_7 = (age >= 4.0) & (age < 8.0)
    penalty[mask_4_7] = 0.01 + (age[mask_4_7] - 4.0) / 4.0 * 0.03

    mask_8_11 = (age >= 8.0) & (age < 12.0)
    penalty[mask_8_11] = 0.05 + (age[mask_8_11] - 8.0) / 4.0 * 0.06

    mask_12_15 = age >= 12.0
    penalty[mask_12_15] = 0.12 + (age[mask_12_15] - 12.0) / 3.0 * 0.10

    return penalty


def calculate_fatigue_penalty(hours: np.ndarray) -> np.ndarray:
    """Calculate operating hours fatigue penalty according to DESIGN.md Section 3.3.

    - 1-8 h: normal production increase (0 penalty)
    - 9-16 h: diminishing returns (0.01 - 0.05)
    - 17-20 h: noticeable fatigue loss (0.06 - 0.12)
    - 21-24 h: strong fatigue penalty (0.13 - 0.22)
    """
    penalty = np.zeros_like(hours, dtype=float)

    mask_9_16 = (hours >= 9.0) & (hours < 17.0)
    penalty[mask_9_16] = 0.01 + (hours[mask_9_16] - 9.0) / 8.0 * 0.04

    mask_17_20 = (hours >= 17.0) & (hours < 21.0)
    penalty[mask_17_20] = 0.06 + (hours[mask_17_20] - 17.0) / 4.0 * 0.06

    mask_21_24 = hours >= 21.0
    penalty[mask_21_24] = 0.13 + (hours[mask_21_24] - 21.0) / 3.0 * 0.09

    return penalty


def calculate_temperature_penalty(temp: np.ndarray) -> np.ndarray:
    """Calculate temperature penalty according to DESIGN.md Section 3.4.

    Optimal range: 20-28°C
    - < 18°C: moderate penalty (0.05 - 0.10)
    - 18 - <20°C: small penalty (0.01 - 0.03)
    - 20 - 28°C: optimal (0.0)
    - >28 - 32°C: small penalty (0.01 - 0.03)
    - >32 - 36°C: moderate penalty (0.04 - 0.08)
    - >36°C: strong penalty (0.09 - 0.18)
    """
    penalty = np.zeros_like(temp, dtype=float)

    mask_cold_mod = temp < 18.0
    penalty[mask_cold_mod] = 0.05 + (18.0 - temp[mask_cold_mod]) / 3.0 * 0.05

    mask_cold_sml = (temp >= 18.0) & (temp < 20.0)
    penalty[mask_cold_sml] = 0.01 + (20.0 - temp[mask_cold_sml]) / 2.0 * 0.02

    mask_hot_sml = (temp > 28.0) & (temp <= 32.0)
    penalty[mask_hot_sml] = 0.01 + (temp[mask_hot_sml] - 28.0) / 4.0 * 0.02

    mask_hot_mod = (temp > 32.0) & (temp <= 36.0)
    penalty[mask_hot_mod] = 0.04 + (temp[mask_hot_mod] - 32.0) / 4.0 * 0.04

    mask_hot_str = temp > 36.0
    penalty[mask_hot_str] = 0.09 + (temp[mask_hot_str] - 36.0) / 4.0 * 0.09

    return penalty


def calculate_humidity_penalty(humidity: np.ndarray) -> np.ndarray:
    """Calculate humidity penalty according to DESIGN.md Section 3.5.

    Optimal range: 40-60%
    - < 30%: moderate penalty (0.04 - 0.08)
    - 30 - <40%: small penalty (0.01 - 0.03)
    - 40 - 60%: optimal (0.0)
    - >60 - 70%: small penalty (0.01 - 0.03)
    - >70 - 80%: moderate penalty (0.04 - 0.08)
    - >80%: strong penalty (0.09 - 0.18)
    """
    penalty = np.zeros_like(humidity, dtype=float)

    mask_dry_mod = humidity < 30.0
    penalty[mask_dry_mod] = 0.04 + (30.0 - humidity[mask_dry_mod]) / 10.0 * 0.04

    mask_dry_sml = (humidity >= 30.0) & (humidity < 40.0)
    penalty[mask_dry_sml] = 0.01 + (40.0 - humidity[mask_dry_sml]) / 10.0 * 0.02

    mask_wet_sml = (humidity > 60.0) & (humidity <= 70.0)
    penalty[mask_wet_sml] = 0.01 + (humidity[mask_wet_sml] - 60.0) / 10.0 * 0.02

    mask_wet_mod = (humidity > 70.0) & (humidity <= 80.0)
    penalty[mask_wet_mod] = 0.04 + (humidity[mask_wet_mod] - 70.0) / 10.0 * 0.04

    mask_wet_str = humidity > 80.0
    penalty[mask_wet_str] = 0.09 + (humidity[mask_wet_str] - 80.0) / 10.0 * 0.09

    return penalty


def calculate_power_penalty(power: np.ndarray) -> np.ndarray:
    """Calculate power stability penalty according to DESIGN.md Section 3.6.

    - 90-100: highly stable (0.0 penalty)
    - 75-89: normal (0.01 - 0.03)
    - 50-74: noticeable interruptions (0.04 - 0.10)
    - 25-49: significant production loss (0.12 - 0.28)
    - 0-24: severe downtime (0.35 - 0.60)
    """
    penalty = np.zeros_like(power, dtype=float)

    mask_75_89 = (power >= 75.0) & (power < 90.0)
    penalty[mask_75_89] = 0.01 + (90.0 - power[mask_75_89]) / 15.0 * 0.02

    mask_50_74 = (power >= 50.0) & (power < 75.0)
    penalty[mask_50_74] = 0.04 + (75.0 - power[mask_50_74]) / 25.0 * 0.06

    mask_25_49 = (power >= 25.0) & (power < 50.0)
    penalty[mask_25_49] = 0.12 + (50.0 - power[mask_25_49]) / 25.0 * 0.16

    mask_under_25 = power < 25.0
    penalty[mask_under_25] = 0.35 + (25.0 - power[mask_under_25]) / 25.0 * 0.25

    return penalty


# ---------------------------------------------------------------------------
# Interaction Effects Calculation
# ---------------------------------------------------------------------------

def calculate_interaction_penalties(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    """Calculate the 8 specified feature interactions from DESIGN.md Section 4.

    Returns
    -------
    Tuple[np.ndarray, np.ndarray]
        (efficiency_interaction_penalty, direct_production_loss_fraction)
    """
    n = len(df)
    eff_penalty = np.zeros(n, dtype=float)
    loss_fraction = np.zeros(n, dtype=float)

    speed = df["printing_speed"].to_numpy()
    humidity = df["humidity"].to_numpy()
    paper_quality = df["paper_quality"].to_numpy()
    age = df["machine_age"].to_numpy()
    maint = df["maintenance_status"].to_numpy()
    hours = df["operating_hours"].to_numpy()
    power = df["power_stability"].to_numpy()
    shift = df["shift"].to_numpy()
    temp = df["temperature"].to_numpy()

    # 4.1 High Speed x High Humidity
    # speed > 150 AND humidity > 70 -> penalty; speed > 170 AND humidity > 80 -> strong penalty
    mask_4_1_mod = (speed > 150.0) & (humidity > 70.0)
    mask_4_1_str = (speed > 170.0) & (humidity > 80.0)
    eff_penalty[mask_4_1_mod] += 0.05
    eff_penalty[mask_4_1_str] += 0.07  # total 0.12

    # 4.2 High Speed x Poor Paper Quality
    # speed > 150 AND quality == Low -> failed prints; speed > 170 AND quality == Low -> major loss
    mask_4_2_mod = (speed > 150.0) & (paper_quality == "Low")
    mask_4_2_str = (speed > 170.0) & (paper_quality == "Low")
    eff_penalty[mask_4_2_mod] += 0.06
    loss_fraction[mask_4_2_mod] += 0.04
    eff_penalty[mask_4_2_str] += 0.08
    loss_fraction[mask_4_2_str] += 0.10

    # 4.3 Old Machine x Poor Maintenance
    # age > 8 AND maint == Poor -> penalty; age > 12 AND maint == Poor -> strong penalty
    mask_4_3_mod = (age > 8.0) & (maint == "Poor")
    mask_4_3_str = (age > 12.0) & (maint == "Poor")
    eff_penalty[mask_4_3_mod] += 0.06
    eff_penalty[mask_4_3_str] += 0.08

    # 4.4 Old Machine x Long Operating Hours
    # age > 8 AND hours > 16 -> fatigue penalty; age > 12 AND hours > 20 -> strong penalty
    mask_4_4_mod = (age > 8.0) & (hours > 16.0)
    mask_4_4_str = (age > 12.0) & (hours > 20.0)
    eff_penalty[mask_4_4_mod] += 0.05
    eff_penalty[mask_4_4_str] += 0.07

    # 4.5 High Speed x Unstable Power
    # speed > 150 AND power < 60 -> interruptions; speed > 170 AND power < 40 -> severe loss
    mask_4_5_mod = (speed > 150.0) & (power < 60.0)
    mask_4_5_str = (speed > 170.0) & (power < 40.0)
    eff_penalty[mask_4_5_mod] += 0.06
    loss_fraction[mask_4_5_mod] += 0.05
    eff_penalty[mask_4_5_str] += 0.10
    loss_fraction[mask_4_5_str] += 0.15

    # 4.6 Night Shift x Unstable Power (Weak interaction)
    # shift == Night AND power < 50 -> slight interruption
    mask_4_6 = (shift == "Night") & (power < 50.0)
    eff_penalty[mask_4_6] += 0.03

    # 4.7 Temperature x Humidity
    # temp > 32 AND humidity > 70 -> penalty; temp > 36 AND humidity > 80 -> strong penalty
    mask_4_7_mod = (temp > 32.0) & (humidity > 70.0)
    mask_4_7_str = (temp > 36.0) & (humidity > 80.0)
    eff_penalty[mask_4_7_mod] += 0.05
    eff_penalty[mask_4_7_str] += 0.07

    # 4.8 Maintenance x Machine Age offset
    # Good maintenance offsets age penalty; Poor maintenance already amplified above
    mask_4_8_good = (age > 8.0) & (maint == "Good")
    eff_penalty[mask_4_8_good] -= 0.04  # Mitigates age penalty

    return eff_penalty, loss_fraction


# ---------------------------------------------------------------------------
# Target Generation: amount_printed
# ---------------------------------------------------------------------------

def calculate_amount_printed(
    df: pd.DataFrame,
    rng: np.random.Generator,
    noise_relative_std: float = 0.02
) -> np.ndarray:
    """Generate the target variable `amount_printed` from features.

    Follows the design formula:
    amount_printed = base_production + individual_effects + nonlinear_effects
                     + interaction_effects - production_losses + random_noise

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing complete feature set.
    rng : np.random.Generator
        NumPy random generator for noise.
    noise_relative_std : float
        Standard deviation of Gaussian process noise relative to base production.

    Returns
    -------
    np.ndarray
        Non-negative float array of prints produced.
    """
    # 1. Effective Available Production Time
    # Setup time directly reduces effective production hours (DESIGN.md Section 3.7)
    setup_hours = df["setup_time"].to_numpy() / 60.0
    effective_hours = np.maximum(0.0, df["operating_hours"].to_numpy() - setup_hours)

    # Setup overhead penalty for extremely long setups (>60 min: 0.02, >90 min: 0.04)
    setup_min = df["setup_time"].to_numpy()
    setup_overhead = np.zeros_like(setup_min, dtype=float)
    setup_overhead[setup_min > 60.0] += 0.02
    setup_overhead[setup_min > 90.0] += 0.03

    # 2. Theoretical Base Capacity (Prints)
    # printing_speed is in prints/min -> prints/hour = speed * 60
    base_capacity = df["printing_speed"].to_numpy() * 60.0 * effective_hours

    # 3. Categorical baseline adjustments (DESIGN.md Sections 3.8 - 3.12)
    paper_type_deltas = {"Standard": 0.00, "Matte": -0.03, "Glossy": -0.05, "Cardstock": -0.10}
    shift_deltas = {"Morning": 0.02, "Afternoon": 0.00, "Night": -0.03}
    maint_deltas = {"Good": 0.05, "Average": 0.00, "Poor": -0.12}
    machine_deltas = {"Type_A": 0.02, "Type_B": 0.01, "Type_C": -0.01, "Type_D": -0.02}
    quality_deltas = {"High": 0.03, "Medium": 0.00, "Low": -0.08}

    cat_delta = (
        df["paper_type"].map(paper_type_deltas).to_numpy()
        + df["shift"].map(shift_deltas).to_numpy()
        + df["maintenance_status"].map(maint_deltas).to_numpy()
        + df["machine_type"].map(machine_deltas).to_numpy()
        + df["paper_quality"].map(quality_deltas).to_numpy()
    )

    # 4. Nonlinear single-feature effects
    speed_eff = calculate_speed_efficiency(df["printing_speed"].to_numpy())
    age_pen = calculate_age_penalty(df["machine_age"].to_numpy())
    fatigue_pen = calculate_fatigue_penalty(df["operating_hours"].to_numpy())
    temp_pen = calculate_temperature_penalty(df["temperature"].to_numpy())
    humid_pen = calculate_humidity_penalty(df["humidity"].to_numpy())
    power_pen = calculate_power_penalty(df["power_stability"].to_numpy())

    # 5. Compound interactions and losses
    interaction_pen, direct_loss = calculate_interaction_penalties(df)

    # 6. Combined Operational Efficiency
    # Base efficiency centered at nominal 0.95 modulated by all terms
    net_efficiency = (
        speed_eff
        + cat_delta
        - age_pen
        - fatigue_pen
        - temp_pen
        - humid_pen
        - power_pen
        - setup_overhead
        - interaction_pen
    )

    # Ensure net efficiency cannot be artificially negative before physical losses
    net_efficiency = np.maximum(0.05, net_efficiency)

    # 7. Apply losses and compute raw production
    production = base_capacity * net_efficiency * (1.0 - direct_loss)

    # 8. Random Process Noise (zero-mean Gaussian scaled to session size)
    # Uncorrelated shop-floor variations
    noise_sigma = np.maximum(50.0, production * noise_relative_std)
    noise = rng.normal(loc=0.0, scale=noise_sigma)

    amount_printed = production + noise

    # Final requirement: Target must be non-negative
    amount_printed = np.maximum(0.0, amount_printed)

    return np.round(amount_printed, 1)


# ---------------------------------------------------------------------------
# Missing Value Injection
# ---------------------------------------------------------------------------

def inject_missing_values(
    df: pd.DataFrame,
    rng: np.random.Generator,
    normal_rate: float = 0.04,
    extreme_rate: float = 0.10
) -> pd.DataFrame:
    """Inject realistic, condition-dependent missing values into sensor features.

    Missingness applies ONLY to sensor features:
    - `temperature`
    - `humidity`
    - `power_stability`

    Missing probability:
    - Normal conditions: ~3-5%
    - Extreme conditions: ~8-12%
    - Conditioned strictly on environmental states, never on target.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with complete feature values.
    rng : np.random.Generator
        NumPy random number generator.
    normal_rate : float
        Missing rate under normal conditions (~4%).
    extreme_rate : float
        Missing rate under extreme conditions (~10%).

    Returns
    -------
    pd.DataFrame
        DataFrame with NaNs injected into sensor columns.
    """
    df_missing = df.copy()
    n = len(df)

    # Condition checks for sensor stress:
    temp_extreme = (df["temperature"] < 18.0) | (df["temperature"] > 35.0)
    humid_extreme = (df["humidity"] < 30.0) | (df["humidity"] > 75.0)
    power_extreme = df["power_stability"] < 50.0

    # Temperature sensor dropout
    p_temp = np.where(temp_extreme, extreme_rate, normal_rate)
    mask_temp = rng.random(size=n) < p_temp
    df_missing.loc[mask_temp, "temperature"] = np.nan

    # Humidity sensor dropout
    p_humid = np.where(humid_extreme, extreme_rate, normal_rate)
    mask_humid = rng.random(size=n) < p_humid
    df_missing.loc[mask_humid, "humidity"] = np.nan

    # Power stability meter dropout
    p_power = np.where(power_extreme, extreme_rate, normal_rate)
    mask_power = rng.random(size=n) < p_power
    df_missing.loc[mask_power, "power_stability"] = np.nan

    return df_missing


# ---------------------------------------------------------------------------
# Dataset Generation Pipeline
# ---------------------------------------------------------------------------

def generate_dataset(
    train_size: int = 7000,
    test_size: int = 1500,
    seed: int = 2026,
    config: Optional[GeneratorConfig] = None
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generate complete train, test, and hidden test-ground-truth datasets.

    Parameters
    ----------
    train_size : int
        Number of training rows (default 7,000).
    test_size : int
        Number of test rows (default 1,500).
    seed : int
        Random seed for reproducibility.
    config : Optional[GeneratorConfig]
        Optional configuration instance.

    Returns
    -------
    Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]
        - train_df: id + 15 features with missing values + target `amount_printed`
        - test_df: id + 15 features with missing values (WITHOUT `amount_printed`)
        - test_actual_df: id + 15 features with missing values + target `amount_printed`
    """
    cfg = config or GeneratorConfig(train_size=train_size, test_size=test_size, random_seed=seed)
    rng = np.random.default_rng(seed)

    # 1. Generate full train feature matrix
    train_features = generate_features(cfg.train_size, rng)
    # Compute ground truth target BEFORE missing-value injection
    train_target = calculate_amount_printed(train_features, rng, cfg.noise_relative_std)
    # Inject condition-dependent sensor missingness
    train_features_missing = inject_missing_values(
        train_features, rng, cfg.normal_missing_rate, cfg.extreme_missing_rate
    )
    # Add unique ID (PP000001 to PP007000)
    train_ids = [f"PP{i:06d}" for i in range(1, cfg.train_size + 1)]
    train_df = train_features_missing.copy()
    train_df.insert(0, "id", train_ids)
    train_df["amount_printed"] = train_target

    # 2. Generate full test feature matrix (using identical physics)
    test_features = generate_features(cfg.test_size, rng)
    # Compute ground truth target BEFORE missing-value injection
    test_target = calculate_amount_printed(test_features, rng, cfg.noise_relative_std)
    # Inject condition-dependent sensor missingness
    test_features_missing = inject_missing_values(
        test_features, rng, cfg.normal_missing_rate, cfg.extreme_missing_rate
    )
    # Add unique ID continuing from train (PP007001 to PP008500)
    test_ids = [f"PP{i:06d}" for i in range(cfg.train_size + 1, cfg.train_size + cfg.test_size + 1)]

    # test_actual_df contains ground truth target for scoring
    test_actual_df = test_features_missing.copy()
    test_actual_df.insert(0, "id", test_ids)
    test_actual_df["amount_printed"] = test_target

    # test_df is the public test file provided to participants (NO TARGET)
    test_df = test_features_missing.copy()
    test_df.insert(0, "id", test_ids)

    return train_df, test_df, test_actual_df


# ---------------------------------------------------------------------------
# Verification & Self-Test Routine
# ---------------------------------------------------------------------------

def run_verification(seed: int = 2026) -> Dict[str, any]:
    """Run diagnostics to verify that generation conforms to DESIGN.md."""
    print(f"Running generator self-test (seed={seed})...")
    train_df, test_df, test_actual_df = generate_dataset(
        train_size=7000, test_size=1500, seed=seed
    )

    # Verification checks
    assert len(train_df) == 7000, f"Expected 7000 train rows, got {len(train_df)}"
    assert len(test_df) == 1500, f"Expected 1500 test rows, got {len(test_df)}"
    assert len(test_actual_df) == 1500, f"Expected 1500 test actual rows, got {len(test_actual_df)}"

    # ID checks
    assert "id" in train_df.columns and "id" in test_df.columns and "id" in test_actual_df.columns
    assert train_df["id"].nunique() == 7000, "Train IDs not unique!"
    assert test_df["id"].nunique() == 1500, "Test IDs not unique!"
    assert len(set(train_df["id"]).intersection(set(test_df["id"]))) == 0, "ID collision between train and test!"
    assert (test_df["id"] == test_actual_df["id"]).all(), "Test and test_actual IDs do not match!"

    # Feature counts
    assert "amount_printed" in train_df.columns, "Target missing in train_df"
    assert "amount_printed" not in test_df.columns, "Target leaked in test_df!"
    assert "amount_printed" in test_actual_df.columns, "Target missing in test_actual_df"

    feature_cols = [c for c in train_df.columns if c not in ("id", "amount_printed")]
    assert len(feature_cols) == 15, f"Expected 15 features, got {len(feature_cols)}: {feature_cols}"

    # Non-negative target check
    assert (train_df["amount_printed"] >= 0).all(), "Negative target values found in train!"
    assert (test_actual_df["amount_printed"] >= 0).all(), "Negative target values found in test!"

    # Sensor missingness check
    for col in SENSOR_FEATURES:
        train_nulls = train_df[col].isna().mean()
        test_nulls = test_df[col].isna().mean()
        assert 0.02 <= train_nulls <= 0.15, f"Unexpected missing rate in train {col}: {train_nulls:.3f}"
        assert 0.02 <= test_nulls <= 0.15, f"Unexpected missing rate in test {col}: {test_nulls:.3f}"

    # Non-sensor features must have 0 missingness
    non_sensor_cols = [c for c in feature_cols if c not in SENSOR_FEATURES]
    for col in non_sensor_cols:
        assert train_df[col].isna().sum() == 0, f"Found unexpected missing values in train {col}"
        assert test_df[col].isna().sum() == 0, f"Found unexpected missing values in test {col}"

    # Target statistics
    y_train = train_df["amount_printed"]
    summary = {
        "train_rows": len(train_df),
        "test_rows": len(test_df),
        "target_mean": float(y_train.mean()),
        "target_std": float(y_train.std()),
        "target_min": float(y_train.min()),
        "target_max": float(y_train.max()),
        "temperature_missing_pct": float(train_df["temperature"].isna().mean() * 100),
        "humidity_missing_pct": float(train_df["humidity"].isna().mean() * 100),
        "power_stability_missing_pct": float(train_df["power_stability"].isna().mean() * 100),
    }

    print("Generator verification passed successfully!")
    print(f"Summary metrics: {summary}")
    return summary


# ---------------------------------------------------------------------------
# Dataset Saving Function
# ---------------------------------------------------------------------------

def save_datasets(
    output_dir: str = "data",
    seed: int = 2026,
    train_size: int = 7000,
    test_size: int = 1500
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generate and save the official competition CSV datasets."""
    import os
    os.makedirs(output_dir, exist_ok=True)

    train_df, test_df, test_actual_df = generate_dataset(
        train_size=train_size, test_size=test_size, seed=seed
    )

    train_path = os.path.join(output_dir, "train.csv")
    test_path = os.path.join(output_dir, "test.csv")
    answer_key_path = os.path.join(output_dir, "answer_key.csv")

    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)
    test_actual_df.to_csv(answer_key_path, index=False)

    print(f"Saved: {train_path} ({len(train_df)} rows, {train_df.shape[1]} cols)")
    print(f"Saved: {test_path} ({len(test_df)} rows, {test_df.shape[1]} cols)")
    print(f"Saved: {answer_key_path} ({len(test_actual_df)} rows, {test_actual_df.shape[1]} cols)")

    return train_df, test_df, test_actual_df


if __name__ == "__main__":
    run_verification(seed=2026)
    save_datasets(output_dir="data", seed=2026)