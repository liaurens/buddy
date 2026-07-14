import type { TLCCResult } from '../features/health-tracking/types';

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export const calculateCorrelation = (x: number[], y: number[]): number | null => {
    const n = x.length;
    if (n !== y.length || n === 0) return null;
    if (n < 3) return null; // Need at least 3 points for meaningful correlation

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0; // No variation
    return numerator / denominator;
};

/**
 * Interpret correlation strength as human-readable string
 */
export const interpretCorrelation = (score: number): string => {
    const abs = Math.abs(score);
    const direction = score >= 0 ? 'Positive' : 'Negative';

    if (abs > 0.7) return `Strong ${direction} Correlation`;
    if (abs > 0.4) return `Moderate ${direction} Correlation`;
    if (abs > 0.2) return `Weak ${direction} Correlation`;
    return 'No Significant Correlation';
};

/**
 * Calculate correlation color for visualization
 */
export const getCorrelationColor = (score: number): string => {
    if (score > 0.4) return '#22c55e'; // green
    if (score > 0.2) return '#84cc16'; // lime
    if (score > -0.2) return '#9ca3af'; // gray
    if (score > -0.4) return '#f97316'; // orange
    return '#ef4444'; // red
};

/**
 * Time-Lagged Cross-Correlation (TLCC)
 * Calculates correlation at different time lags to find optimal delay
 *
 * @param x Input time series (cause)
 * @param y Output time series (effect)
 * @param maxLag Maximum lag to test (in data points)
 * @returns Array of { lag, correlation } results
 */
export const calculateTLCC = (x: number[], y: number[], maxLag: number = 10): TLCCResult[] => {
    const results: TLCCResult[] = [];
    const n = Math.min(x.length, y.length);

    if (n < maxLag + 3) {
        // Not enough data points
        return [];
    }

    for (let lag = 0; lag <= maxLag; lag++) {
        // Shift y forward by lag (x affects y after `lag` periods)
        const xSlice = x.slice(0, n - lag);
        const ySlice = y.slice(lag);

        const correlation = calculateCorrelation(xSlice, ySlice);
        if (correlation !== null) {
            results.push({ lag, correlation });
        }
    }

    return results;
};

/**
 * Find the optimal lag with the strongest correlation
 */
export const findOptimalLag = (
    x: number[],
    y: number[],
    maxLag: number = 10,
): TLCCResult | null => {
    const tlccResults = calculateTLCC(x, y, maxLag);

    if (tlccResults.length === 0) return null;

    // Find lag with maximum absolute correlation
    return tlccResults.reduce((best, current) =>
        Math.abs(current.correlation) > Math.abs(best.correlation) ? current : best,
    );
};

/**
 * Calculate p-value for Pearson correlation
 * Uses t-distribution approximation
 */
export const calculatePValue = (r: number, n: number): number | null => {
    if (n < 3) return null;

    // t-statistic
    const t = r * Math.sqrt((n - 2) / (1 - r * r));

    // Degrees of freedom
    const df = n - 2;

    // Approximation of two-tailed p-value using Normal approximation for large df
    // For small samples, this is an approximation
    const absT = Math.abs(t);

    // Simple approximation using error function
    // p ≈ 2 * (1 - Φ(|t| * sqrt(df/(df-2))))
    const x = absT / Math.sqrt(1 + (absT * absT) / df);
    const p = 2 * (1 - normalCDF(x * Math.sqrt(df)));

    return Math.min(1, Math.max(0, p));
};

/**
 * Standard normal cumulative distribution function
 */
const normalCDF = (x: number): number => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
};

/**
 * Calculate 95% confidence interval for correlation
 * Uses Fisher's z-transformation
 */
export const calculateConfidenceInterval = (
    r: number,
    n: number,
): { low: number; high: number } | null => {
    if (n < 4) return null;

    // Fisher's z-transformation
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);

    // 95% CI in z-space
    const zLow = z - 1.96 * se;
    const zHigh = z + 1.96 * se;

    // Transform back to r-space
    const low = (Math.exp(2 * zLow) - 1) / (Math.exp(2 * zLow) + 1);
    const high = (Math.exp(2 * zHigh) - 1) / (Math.exp(2 * zHigh) + 1);

    return { low, high };
};

/**
 * Check if we have enough data for reliable analysis
 */
export const getDataQualityWarnings = (sampleSize: number): string[] => {
    const warnings: string[] = [];

    if (sampleSize < 7) {
        warnings.push('⚠️ Minimum 7 days of data recommended for reliable correlations');
    } else if (sampleSize < 14) {
        warnings.push('📊 More data (14+ days) will improve accuracy');
    }

    if (sampleSize < 3) {
        warnings.push('❌ Not enough data points for correlation');
    }

    return warnings;
};

/**
 * Interpret p-value for significance
 */
export const interpretPValue = (pValue: number | null): { text: string; significant: boolean } => {
    if (pValue === null) {
        return { text: 'Cannot calculate', significant: false };
    }
    if (pValue < 0.01) {
        return { text: 'Highly significant (p < 0.01)', significant: true };
    }
    if (pValue < 0.05) {
        return { text: 'Significant (p < 0.05)', significant: true };
    }
    if (pValue < 0.1) {
        return { text: 'Marginally significant (p < 0.1)', significant: false };
    }
    return { text: 'Not significant', significant: false };
};
