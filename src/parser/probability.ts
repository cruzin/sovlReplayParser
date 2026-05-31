import { clamp, sum } from "./utils";

export function classifyLuck(pValue, z) {
  const direction = z >= 0 ? "hot" : "cold";
  if (pValue < 0.001) return `Extreme ${direction}`;
  if (pValue < 0.01) return `Very unusual ${direction}`;
  if (pValue < 0.05) return `Unusual ${direction}`;
  return "Within normal noise";
}

export function twoTailedNormalP(z) {
  return clamp(2 * (1 - normalCdf(Math.abs(z))), 0, 1);
}

export function chiSquareUniformD6(faceCounts) {
  const total = sum(faceCounts);
  if (!total) return 0;
  const expected = total / 6;
  return sum(faceCounts.map((count) => ((count - expected) ** 2) / expected));
}

export function chiSquareDf5UpperTail(x) {
  if (x <= 0) return 1;
  return regularizedGammaQ(2.5, x / 2);
}

export function probabilityForD6Target(target) {
  const numeric = Number(target);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0.5;
  return clamp((7 - numeric) / 6, 0, 1);
}

export function probability2d6AtMost(target) {
  let wins = 0;
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      if (a + b <= target) wins += 1;
    }
  }
  return wins / 36;
}

export function binomialDistribution(n, p) {
  const dist = [];
  for (let k = 0; k <= n; k += 1) {
    dist.push(combination(n, k) * p ** k * (1 - p) ** (n - k));
  }
  return dist;
}

export function compareDistributions(a, b) {
  let win = 0;
  let tie = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const chance = a[i] * b[j];
      if (i > j) win += chance;
      if (i === j) tie += chance;
    }
  }
  return win + tie / 2;
}

function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-abs * abs));
  return sign * y;
}

function regularizedGammaQ(a, x) {
  if (x < 0 || a <= 0) return Number.NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaPSeries(a, x);
  return regularizedGammaQContinuedFraction(a, x);
}

function regularizedGammaPSeries(a, x) {
  let sumTerm = 1 / a;
  let sumValue = sumTerm;
  for (let n = 1; n < 100; n += 1) {
    sumTerm *= x / (a + n);
    sumValue += sumTerm;
    if (Math.abs(sumTerm) < Math.abs(sumValue) * 1e-12) break;
  }
  return sumValue * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

function regularizedGammaQContinuedFraction(a, x) {
  const epsilon = 1e-12;
  const fpMin = 1e-30;
  let b = x + 1 - a;
  let c = 1 / fpMin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 100; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = b + an / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const adjusted = z - 1;
  for (let i = 0; i < coefficients.length; i += 1) {
    x += coefficients[i] / (adjusted + i + 1);
  }
  const t = adjusted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(x);
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}
