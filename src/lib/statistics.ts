// Statistical analysis utilities for OBD diagnostics

export function calculateStdDev(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

export function calculateVariance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
}

export function calculateCoeffVariation(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  return (calculateStdDev(values) / mean) * 100;
}

export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function countTransitions(values: number[], threshold: number): number {
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if (
      (values[i - 1] < threshold && values[i] >= threshold) ||
      (values[i - 1] >= threshold && values[i] < threshold)
    ) {
      count++;
    }
  }
  return count;
}

export function detectSpikes(
  values: number[],
  windowSize: number = 10,
  spikeThreshold: number = 1.5,
): number[] {
  const spikes: number[] = [];
  for (let i = windowSize; i < values.length - windowSize; i++) {
    const window = values.slice(i - windowSize, i + windowSize);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    if (values[i] > mean * spikeThreshold) {
      spikes.push(i);
    }
  }
  return spikes;
}

export function movingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(values.length, i + Math.ceil(windowSize / 2));
    const window = values.slice(start, end);
    result.push(window.reduce((a, b) => a + b, 0) / window.length);
  }
  return result;
}

export function findLocalMaxima(
  values: number[],
  minDistance: number = 5,
): number[] {
  const maxima: number[] = [];
  for (let i = minDistance; i < values.length - minDistance; i++) {
    let isMax = true;
    for (let j = i - minDistance; j <= i + minDistance; j++) {
      if (j !== i && values[j] >= values[i]) {
        isMax = false;
        break;
      }
    }
    if (isMax) maxima.push(i);
  }
  return maxima;
}

export function correlate(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

// Basic statistics functions
export function avg(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v != null && Number.isFinite(v));
  return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null;
}

export function max(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v != null && Number.isFinite(v));
  return filtered.length > 0 ? Math.max(...filtered) : null;
}

export function min(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v != null && Number.isFinite(v));
  return filtered.length > 0 ? Math.min(...filtered) : null;
}

export function median(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (filtered.length === 0) return null;
  const mid = Math.floor(filtered.length / 2);
  return filtered.length % 2 === 0 ? (filtered[mid - 1] + filtered[mid]) / 2 : filtered[mid];
}
