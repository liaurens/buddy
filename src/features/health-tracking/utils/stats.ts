/**
 * Two-sample statistical helpers for N-of-1 experiments and segment comparisons.
 *
 * Builds on the correlation utilities in src/utils/analysis.ts (re-exported here
 * for a single health-tracking import surface). Adds Welch's t-test, Cohen's d,
 * and mean-difference confidence intervals.
 */

export {
    calculateCorrelation,
    calculatePValue as calculateCorrelationPValue,
    calculateConfidenceInterval as calculateCorrelationCI,
    interpretCorrelation,
    interpretPValue,
    getCorrelationColor,
    calculateTLCC,
    findOptimalLag,
    getDataQualityWarnings,
} from '../../../utils/analysis';

const mean = (xs: number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;

const sampleVariance = (xs: number[]): number => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
};

export const std = (xs: number[]): number => Math.sqrt(sampleVariance(xs));

// ─── Standard Normal CDF (Abramowitz & Stegun 7.1.26 approximation) ─────────
const normalCDF = (x: number): number => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + p * absX);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * y);
};

/**
 * Two-sided p-value for a t-statistic with `df` degrees of freedom.
 * Uses the Normal approximation derived from the t-distribution CDF —
 * good enough for N-of-1 scale sizes where df ≥ ~6, and consistent with the
 * correlation p-value path already used in Analysis.tsx.
 */
export const tPValueTwoSided = (t: number, df: number): number => {
    if (df <= 0 || !Number.isFinite(t)) return 1;
    const absT = Math.abs(t);
    const x = absT / Math.sqrt(1 + (absT * absT) / df);
    const p = 2 * (1 - normalCDF(x * Math.sqrt(df)));
    return Math.min(1, Math.max(0, p));
};

export interface WelchResult {
    t: number;
    df: number;
    pTwoSided: number;
    meanA: number;
    meanB: number;
    nA: number;
    nB: number;
}

/**
 * Welch's unequal-variance t-test. Returns null when either sample has fewer
 * than 2 observations or both samples are degenerate.
 */
export const welchTTest = (a: number[], b: number[]): WelchResult | null => {
    if (a.length < 2 || b.length < 2) return null;
    const mA = mean(a);
    const mB = mean(b);
    const vA = sampleVariance(a);
    const vB = sampleVariance(b);
    const nA = a.length;
    const nB = b.length;

    const seDiffSq = vA / nA + vB / nB;
    if (seDiffSq === 0) return null;
    const seDiff = Math.sqrt(seDiffSq);
    const t = (mB - mA) / seDiff;

    const dfNum = seDiffSq ** 2;
    const dfDen = (vA / nA) ** 2 / (nA - 1) + (vB / nB) ** 2 / (nB - 1);
    const df = dfDen === 0 ? nA + nB - 2 : dfNum / dfDen;

    return {
        t,
        df,
        pTwoSided: tPValueTwoSided(t, df),
        meanA: mA,
        meanB: mB,
        nA,
        nB,
    };
};

export type EffectInterpretation = 'negligible' | 'small' | 'medium' | 'large';

export interface CohensDResult {
    d: number;
    interpretation: EffectInterpretation;
}

/**
 * Cohen's d with pooled SD. Positive values mean sample B > sample A (so
 * "intervention > baseline" when called as cohensD(baseline, intervention)).
 * Uses conventional thresholds (|d| < 0.2 negligible, <0.5 small, <0.8 medium).
 */
export const cohensD = (a: number[], b: number[]): CohensDResult | null => {
    if (a.length < 2 || b.length < 2) return null;
    const vA = sampleVariance(a);
    const vB = sampleVariance(b);
    const pooledSd = Math.sqrt(
        ((a.length - 1) * vA + (b.length - 1) * vB) / (a.length + b.length - 2),
    );
    if (pooledSd === 0) return null;
    const d = (mean(b) - mean(a)) / pooledSd;
    const abs = Math.abs(d);
    let interpretation: EffectInterpretation = 'negligible';
    if (abs >= 0.8) interpretation = 'large';
    else if (abs >= 0.5) interpretation = 'medium';
    else if (abs >= 0.2) interpretation = 'small';
    return { d, interpretation };
};

export interface MeanDiffCI {
    diff: number;
    low: number;
    high: number;
    confidence: number;
}

/**
 * Confidence interval for the difference of means (B − A), using Welch's SE
 * and a 1.96 Normal quantile (sufficient at N-of-1 scale given the t→Normal
 * approximation used elsewhere). Pass a different z-quantile for other
 * confidence levels.
 */
export const meanDiffCI = (a: number[], b: number[], confidence = 0.95): MeanDiffCI | null => {
    if (a.length < 2 || b.length < 2) return null;
    const seDiffSq = sampleVariance(a) / a.length + sampleVariance(b) / b.length;
    if (seDiffSq === 0) return null;
    const seDiff = Math.sqrt(seDiffSq);
    const diff = mean(b) - mean(a);
    // Only 90/95/99 are wired; default stays at 95.
    const z = confidence >= 0.99 ? 2.576 : confidence >= 0.95 ? 1.96 : 1.645;
    return {
        diff,
        low: diff - z * seDiff,
        high: diff + z * seDiff,
        confidence,
    };
};

export const meanStd = (xs: number[]): { mean: number; std: number; n: number } => ({
    mean: mean(xs),
    std: std(xs),
    n: xs.length,
});
