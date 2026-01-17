# Correlate Tracker: Logic & Math

## What It Does

The tracker helps answer: **"How does X affect Y, and when?"**

You track inputs (caffeine, sleep, exercise) and outputs (mood, energy, focus). The app finds patterns between them using statistical analysis.

---

## Current Mathematical Logic

### 1. Pearson Correlation (r)

Measures linear relationship between two variables.

**Formula:**
```
r = Σ[(xi - x̄)(yi - ȳ)] / √[Σ(xi - x̄)² × Σ(yi - ȳ)²]
```

**Interpretation:**
| r Value | Meaning |
|---------|---------|
| +0.7 to +1.0 | Strong positive (X↑ = Y↑) |
| +0.4 to +0.7 | Moderate positive |
| -0.3 to +0.3 | No significant relationship |
| -0.7 to -0.4 | Moderate negative |
| -1.0 to -0.7 | Strong negative (X↑ = Y↓) |

---

### 2. Time-Lagged Cross-Correlation (TLCC)

**Problem:** Effects often aren't immediate. Caffeine at 2pm affects sleep at 10pm.

**Solution:** Shift one time series and recalculate correlation at each lag.

```
For lag = 0, 1, 2, ... N days:
    r(lag) = correlation(X[0:n-lag], Y[lag:n])
    
Optimal lag = argmax(|r(lag)|)
```

**Example:**
| Lag (days) | Correlation |
|------------|-------------|
| 0 | +0.12 |
| 1 | +0.45 ← optimal |
| 2 | +0.28 |

This tells you: "Caffeine today correlates with mood *tomorrow*."

---

### 3. Statistical Significance (p-value)

**Problem:** Small samples produce random correlations.

**Solution:** Calculate probability this correlation occurred by chance.

```
t = r × √[(n-2) / (1-r²)]
p = P(T > |t|) with df = n-2
```

**Interpretation:**
- p < 0.05 → Statistically significant
- p < 0.01 → Highly significant
- p > 0.05 → Could be random noise

---

### 4. Confidence Intervals (95% CI)

**Problem:** Point estimates don't show uncertainty.

**Solution:** Fisher's z-transformation gives bounds.

```
z = 0.5 × ln[(1+r)/(1-r)]
SE = 1/√(n-3)
CI = [tanh(z - 1.96×SE), tanh(z + 1.96×SE)]
```

**Example:** r = 0.52, n = 30 → 95% CI: [0.21, 0.73]

---

## Future Mathematical Extensions

### Multiple Regression
Model outcome with multiple inputs simultaneously:
```
Mood = β₀ + β₁(Sleep) + β₂(Caffeine) + β₃(Exercise) + ε
```

### Moving Averages
Smooth noisy data to reveal trends:
```
MA(7) = (x₁ + x₂ + ... + x₇) / 7
```

### Granger Causality
Test if X *actually predicts* Y (not just correlates):
```
Y(t) = Σ α(i)×Y(t-i) + Σ β(i)×X(t-i) + ε
Test: β coefficients ≠ 0?
```

### Effect Size (Cohen's d)
Quantify *practical* significance, not just statistical:
```
d = (μ₁ - μ₂) / σ_pooled
```

### Bayesian Updates
Accumulate evidence over time:
```
P(hypothesis|data) ∝ P(data|hypothesis) × P(hypothesis)
```

---

## Key Limitations

1. **Correlation ≠ Causation** — Both X and Y might be caused by Z
2. **Minimum data needed** — At least 7-14 days for reliable patterns
3. **Self-tracking bias** — Awareness changes behavior
4. **Individual variation** — What works for you may not generalize
