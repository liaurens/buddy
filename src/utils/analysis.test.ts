import { describe, it, expect } from 'vitest';
import {
    calculateCorrelation,
    interpretCorrelation,
    getCorrelationColor,
    calculateTLCC,
    findOptimalLag,
    calculatePValue,
    calculateConfidenceInterval,
    getDataQualityWarnings,
    interpretPValue,
} from './analysis';

describe('calculateCorrelation', () => {
    it('returns null for empty arrays', () => {
        expect(calculateCorrelation([], [])).toBeNull();
    });

    it('returns null for arrays with different lengths', () => {
        expect(calculateCorrelation([1, 2, 3], [1, 2])).toBeNull();
    });

    it('returns null for arrays with less than 3 elements', () => {
        expect(calculateCorrelation([1, 2], [1, 2])).toBeNull();
    });

    it('returns 1 for perfectly correlated data', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [2, 4, 6, 8, 10]; // y = 2x
        const result = calculateCorrelation(x, y);
        expect(result).toBeCloseTo(1, 5);
    });

    it('returns -1 for perfectly negatively correlated data', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [10, 8, 6, 4, 2]; // y = -2x + 12
        const result = calculateCorrelation(x, y);
        expect(result).toBeCloseTo(-1, 5);
    });

    it('returns 0 for uncorrelated data', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [3, 3, 3, 3, 3]; // constant - no variation
        const result = calculateCorrelation(x, y);
        expect(result).toBe(0);
    });

    it('returns moderate correlation for partially correlated data', () => {
        const x = [1, 2, 3, 4, 5];
        const y = [1, 3, 2, 5, 4]; // somewhat correlated
        const result = calculateCorrelation(x, y);
        expect(result).toBeGreaterThan(0.5);
        expect(result).toBeLessThan(1);
    });
});

describe('interpretCorrelation', () => {
    it('identifies strong positive correlation', () => {
        expect(interpretCorrelation(0.8)).toBe('Strong Positive Correlation');
    });

    it('identifies strong negative correlation', () => {
        expect(interpretCorrelation(-0.75)).toBe('Strong Negative Correlation');
    });

    it('identifies moderate correlation', () => {
        expect(interpretCorrelation(0.5)).toBe('Moderate Positive Correlation');
        expect(interpretCorrelation(-0.5)).toBe('Moderate Negative Correlation');
    });

    it('identifies weak correlation', () => {
        expect(interpretCorrelation(0.3)).toBe('Weak Positive Correlation');
        expect(interpretCorrelation(-0.25)).toBe('Weak Negative Correlation');
    });

    it('identifies no significant correlation', () => {
        expect(interpretCorrelation(0.1)).toBe('No Significant Correlation');
        expect(interpretCorrelation(-0.1)).toBe('No Significant Correlation');
        expect(interpretCorrelation(0)).toBe('No Significant Correlation');
    });
});

describe('getCorrelationColor', () => {
    it('returns green for strong positive correlation', () => {
        expect(getCorrelationColor(0.5)).toBe('#22c55e');
    });

    it('returns lime for moderate positive correlation', () => {
        expect(getCorrelationColor(0.3)).toBe('#84cc16');
    });

    it('returns gray for weak/no correlation', () => {
        expect(getCorrelationColor(0)).toBe('#9ca3af');
        expect(getCorrelationColor(0.1)).toBe('#9ca3af');
    });

    it('returns orange for moderate negative correlation', () => {
        expect(getCorrelationColor(-0.3)).toBe('#f97316');
    });

    it('returns red for strong negative correlation', () => {
        expect(getCorrelationColor(-0.5)).toBe('#ef4444');
    });
});

describe('calculateTLCC', () => {
    it('returns empty array when not enough data', () => {
        const x = [1, 2, 3];
        const y = [1, 2, 3];
        expect(calculateTLCC(x, y, 5)).toEqual([]);
    });

    it('calculates correlation at different lags', () => {
        // Create data where y follows x with a 2-period lag
        const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const y = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // shifted by 2

        const results = calculateTLCC(x, y, 5);
        expect(results.length).toBeGreaterThan(0);

        // Each result should have lag and correlation
        results.forEach((r) => {
            expect(r).toHaveProperty('lag');
            expect(r).toHaveProperty('correlation');
            expect(typeof r.lag).toBe('number');
            expect(typeof r.correlation).toBe('number');
        });
    });

    it('returns results for lag 0 through maxLag', () => {
        const x = Array.from({ length: 20 }, (_, i) => i);
        const y = Array.from({ length: 20 }, (_, i) => i * 2);

        const results = calculateTLCC(x, y, 5);
        const lags = results.map((r) => r.lag);

        expect(lags).toContain(0);
        expect(lags).toContain(5);
    });
});

describe('findOptimalLag', () => {
    it('returns null when not enough data', () => {
        expect(findOptimalLag([1, 2], [1, 2], 5)).toBeNull();
    });

    it('finds the lag with strongest correlation', () => {
        // Create perfectly correlated data with no lag
        const x = Array.from({ length: 20 }, (_, i) => i);
        const y = Array.from({ length: 20 }, (_, i) => i * 2);

        const result = findOptimalLag(x, y, 5);
        expect(result).not.toBeNull();
        expect(result!.correlation).toBeCloseTo(1, 1);
    });
});

describe('calculatePValue', () => {
    it('returns null for less than 3 samples', () => {
        expect(calculatePValue(0.5, 2)).toBeNull();
    });

    it('returns low p-value for strong correlation with many samples', () => {
        const pValue = calculatePValue(0.9, 100);
        expect(pValue).not.toBeNull();
        expect(pValue!).toBeLessThan(0.05);
    });

    it('returns high p-value for weak correlation', () => {
        const pValue = calculatePValue(0.1, 10);
        expect(pValue).not.toBeNull();
        expect(pValue!).toBeGreaterThan(0.1);
    });

    it('returns value between 0 and 1', () => {
        const pValue = calculatePValue(0.5, 20);
        expect(pValue).not.toBeNull();
        expect(pValue!).toBeGreaterThanOrEqual(0);
        expect(pValue!).toBeLessThanOrEqual(1);
    });
});

describe('calculateConfidenceInterval', () => {
    it('returns null for less than 4 samples', () => {
        expect(calculateConfidenceInterval(0.5, 3)).toBeNull();
    });

    it('returns interval containing the correlation', () => {
        const r = 0.5;
        const ci = calculateConfidenceInterval(r, 50);

        expect(ci).not.toBeNull();
        expect(ci!.low).toBeLessThan(r);
        expect(ci!.high).toBeGreaterThan(r);
    });

    it('returns narrower interval for larger samples', () => {
        const r = 0.5;
        const smallSample = calculateConfidenceInterval(r, 10);
        const largeSample = calculateConfidenceInterval(r, 100);

        expect(smallSample).not.toBeNull();
        expect(largeSample).not.toBeNull();

        const smallWidth = smallSample!.high - smallSample!.low;
        const largeWidth = largeSample!.high - largeSample!.low;

        expect(largeWidth).toBeLessThan(smallWidth);
    });
});

describe('getDataQualityWarnings', () => {
    it('returns error for less than 3 samples', () => {
        const warnings = getDataQualityWarnings(2);
        expect(warnings.some((w) => w.includes('Not enough'))).toBe(true);
    });

    it('returns warning for less than 7 samples', () => {
        const warnings = getDataQualityWarnings(5);
        expect(warnings.some((w) => w.includes('Minimum 7 days'))).toBe(true);
    });

    it('suggests more data for 7-13 samples', () => {
        const warnings = getDataQualityWarnings(10);
        expect(warnings.some((w) => w.includes('14+ days'))).toBe(true);
    });

    it('returns empty for sufficient data', () => {
        const warnings = getDataQualityWarnings(20);
        expect(warnings.length).toBe(0);
    });
});

describe('interpretPValue', () => {
    it('handles null p-value', () => {
        const result = interpretPValue(null);
        expect(result.text).toBe('Cannot calculate');
        expect(result.significant).toBe(false);
    });

    it('identifies highly significant results', () => {
        const result = interpretPValue(0.005);
        expect(result.text).toContain('Highly significant');
        expect(result.significant).toBe(true);
    });

    it('identifies significant results', () => {
        const result = interpretPValue(0.03);
        expect(result.text).toContain('Significant');
        expect(result.significant).toBe(true);
    });

    it('identifies marginally significant results', () => {
        const result = interpretPValue(0.08);
        expect(result.text).toContain('Marginally');
        expect(result.significant).toBe(false);
    });

    it('identifies non-significant results', () => {
        const result = interpretPValue(0.5);
        expect(result.text).toBe('Not significant');
        expect(result.significant).toBe(false);
    });
});
