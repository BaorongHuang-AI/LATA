/**
 * Statistical engine for Comparative Translation Analytics.
 * Computes lexical, alignment, terminology, comparative, and readability metrics
 * for both source and target texts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ss from "simple-statistics";
import type { AnalyticsMetrics, GroupStats, StatisticalOutput, StatisticalTest } from "../types/analytics";

// ==================== Text Metrics ====================

/** Tokenize text into words (Unicode-aware) */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .normalize("NFKD")
    .split(/[\s\p{P}]+/u)
    .filter((t) => t.length > 0);
}

/** Count syllables in an English word (best-effort heuristic) */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const matches = w.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  // Adjust for silent e
  if (w.endsWith("e") && count > 1) count--;
  return Math.max(1, count);
}

/** Compute all lexical metrics for a single text */
export function computeLexicalMetrics(text: string): Pick<
  AnalyticsMetrics,
  "token_count" | "type_count" | "ttr" | "hapax_ratio" | "dislegomena_ratio"
    | "guiraud_r" | "herdans_c" | "yules_k" | "simpson_d" | "brunet_w"
    | "honore_h" | "maas_a2" | "avg_word_length" | "avg_sentence_length"
    | "sentence_length_std"
> {
  const tokens = tokenize(text);
  const n = tokens.length;
  if (n === 0) {
    return {
      token_count: 0, type_count: 0, ttr: 0, hapax_ratio: 0, dislegomena_ratio: 0,
      guiraud_r: 0, herdans_c: 0, yules_k: 0, simpson_d: 0, brunet_w: 0,
      honore_h: 0, maas_a2: 0, avg_word_length: 0, avg_sentence_length: 0,
      sentence_length_std: 0,
    };
  }

  // Frequency distribution
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const types = freq.size;
  const freqs = Array.from(freq.values());

  // Hapax (appearing once) and dislegomena (twice)
  const hapax = freqs.filter((f) => f === 1).length;
  const dislegomena = freqs.filter((f) => f === 2).length;

  // Type-Token Ratio
  const ttr = types / n;

  // Guiraud's R = types / sqrt(tokens)
  const guiraudR = types / Math.sqrt(n);

  // Herdan's C = log(types) / log(tokens)
  const herdansC = n > 1 ? Math.log(types) / Math.log(n) : 0;

  // Yule's K (characteristic constant) = 10^4 * (Σ(f²) - n) / n²
  const sumFSq = freqs.reduce((s, f) => s + f * f, 0);
  const yulesK = n > 1 ? (10000 * (sumFSq - n)) / (n * n) : 0;

  // Simpson's D = Σ f(f-1) / (n(n-1))
  const sumFxFm1 = freqs.reduce((s, f) => s + f * (f - 1), 0);
  const simpsonD = n > 1 ? sumFxFm1 / (n * (n - 1)) : 0;

  // Brunet's W = n ^ (types ^ -0.165)
  const brunetW = types > 0 ? Math.pow(n, Math.pow(types, -0.165)) : 0;

  // Honoré's H = 100 * log(n) / (1 - hapax/types) when hapax < types
  const honoreH = types > 0 && hapax < types ? (100 * Math.log(n)) / (1 - hapax / types) : 0;

  // Maas's a² = (log(n) - log(types)) / log(n)²
  const maasA2 = n > 1 ? (Math.log(n) - Math.log(types)) / Math.pow(Math.log(n), 2) : 0;

  // Average word length (characters)
  const avgWordLen = tokens.reduce((s, t) => s + t.length, 0) / n;

  // Sentence metrics
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentLens = sentences.map((s) => tokenize(s).length);
  const avgSentLen = sentLens.length > 0 ? ss.mean(sentLens) : 0;
  const sentLenStd = sentLens.length > 1 ? ss.sampleStandardDeviation(sentLens) : 0;

  return {
    token_count: n, type_count: types, ttr, hapax_ratio: hapax / n, dislegomena_ratio: dislegomena / n,
    guiraud_r: guiraudR, herdans_c: herdansC, yules_k: yulesK, simpson_d: simpsonD,
    brunet_w: brunetW, honore_h: honoreH, maas_a2: maasA2,
    avg_word_length: avgWordLen, avg_sentence_length: avgSentLen, sentence_length_std: sentLenStd,
  };
}

/** Compute readability scores (English only; returns null for non-English) */
export function computeReadability(text: string): Pick<AnalyticsMetrics, "flesch_reading_ease" | "automated_readability_index" | "gunning_fog"> {
  const tokens = tokenize(text);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (tokens.length === 0 || sentences.length === 0) return {};

  const words = tokens.length;
  const sents = sentences.length;
  const syllables = tokens.reduce((s, t) => s + countSyllables(t), 0);
  const chars = tokens.reduce((s, t) => s + t.length, 0);

  // Flesch Reading Ease = 206.835 - 1.015*(words/sents) - 84.6*(syllables/words)
  const flesch = 206.835 - 1.015 * (words / sents) - 84.6 * (syllables / words);

  // Automated Readability Index = 4.71*(chars/words) + 0.5*(words/sents) - 21.43
  const ari = 4.71 * (chars / words) + 0.5 * (words / sents) - 21.43;

  // Gunning Fog = 0.4 * ((words/sents) + 100 * (complex_words/words))
  // complex word = 3+ syllables (simplified)
  const complexWords = tokens.filter((t) => countSyllables(t) >= 3).length;
  const fog = 0.4 * ((words / sents) + 100 * (complexWords / words));

  return {
    flesch_reading_ease: Math.round(flesch * 100) / 100,
    automated_readability_index: Math.round(ari * 100) / 100,
    gunning_fog: Math.round(fog * 100) / 100,
  };
}

// ==================== Alignment Metrics ====================

export interface AlignmentInput {
  sourceCount: number;   // total source sentences
  alignments: Array<{
    sourceCount: number;
    targetCount: number;
    confidence?: number | null;
  }>;
}

export function computeAlignmentMetrics(input: AlignmentInput): Pick<
  AnalyticsMetrics,
  "alignment_count" | "alignment_density" | "one_to_one_ratio" | "one_to_many_ratio"
    | "many_to_one_ratio" | "many_to_many_ratio" | "avg_confidence" | "confidence_std"
> {
  const { sourceCount, alignments } = input;
  const total = alignments.length;
  if (total === 0) {
    return {
      alignment_count: 0, alignment_density: 0, one_to_one_ratio: 0,
      one_to_many_ratio: 0, many_to_one_ratio: 0, many_to_many_ratio: 0,
      avg_confidence: 0, confidence_std: 0,
    };
  }

  let o2o = 0, o2m = 0, m2o = 0, m2m = 0;
  for (const a of alignments) {
    if (a.sourceCount === 1 && a.targetCount === 1) o2o++;
    else if (a.sourceCount === 1 && a.targetCount > 1) o2m++;
    else if (a.sourceCount > 1 && a.targetCount === 1) m2o++;
    else m2m++;
  }

  const confidences = alignments
    .map((a) => a.confidence ?? null)
    .filter((c): c is number => c !== null);
  const avgConf = confidences.length > 0 ? ss.mean(confidences) : 0;
  const confStd = confidences.length > 1 ? ss.sampleStandardDeviation(confidences) : 0;

  return {
    alignment_count: total,
    alignment_density: sourceCount > 0 ? total / sourceCount : 0,
    one_to_one_ratio: o2o / total,
    one_to_many_ratio: o2m / total,
    many_to_one_ratio: m2o / total,
    many_to_many_ratio: m2m / total,
    avg_confidence: avgConf,
    confidence_std: confStd,
  };
}

// ==================== Terminology Metrics ====================

export function computeTerminologyMetrics(
  terms: Array<{ source_term: string; target_term: string }>,
  sourceTokens: number,
): Pick<AnalyticsMetrics, "term_count" | "term_density" | "term_consistency"> {
  if (terms.length === 0) return { term_count: 0, term_density: 0, term_consistency: 0 };

  // Term density = terms per 1000 source tokens
  const density = sourceTokens > 0 ? (terms.length / sourceTokens) * 1000 : 0;

  // Term consistency: how many unique target terms per source term (lower = more consistent)
  const srcMap = new Map<string, Set<string>>();
  for (const t of terms) {
    const key = t.source_term.toLowerCase();
    if (!srcMap.has(key)) srcMap.set(key, new Set());
    srcMap.get(key)!.add(t.target_term.toLowerCase());
  }
  const avgVariants = Array.from(srcMap.values()).reduce((s, v) => s + v.size, 0) / srcMap.size;
  // Invert: 1 = perfectly consistent (1 target per source), lower = more variation
  const consistency = 1 / Math.max(1, avgVariants);

  return { term_count: terms.length, term_density: density, term_consistency: consistency };
}

// ==================== Cultural Metrics ====================

export interface CulturalAnalysisResult {
  segments: Array<{
    segment_number: number;
    cultural_references_source: string[];
    adaptations: Array<{
      reference: string;
      strategy: string; // PRESERVED | SUBSTITUTED | EXPLAINED | OMITTED | GENERALIZED
      target_form: string;
      explanation: string;
    }>;
    cultural_additions_target: string[];
    politeness_shift: number; // -1, 0, +1
    ideological_shifts: string[];
    cultural_distance_score: number; // 1-5
  }>;
  summary: {
    total_segments: number;
    total_references: number;
    preservation_ratio: number;
    substitution_ratio: number;
    explicitation_ratio: number;
    omission_ratio: number;
    generalization_ratio: number;
    cultural_addition_count: number;
    avg_politeness_shift: number;
    avg_cultural_distance: number;
    dominant_strategy: string;
    key_findings: string;
  };
}

export function computeCulturalMetrics(
  rawLLMResponse: string,
): Pick<AnalyticsMetrics, "expansion_ratio"> & {
  cultural_preservation_ratio: number;
  cultural_substitution_ratio: number;
  cultural_explicitation_ratio: number;
  cultural_omission_ratio: number;
  cultural_generalization_ratio: number;
  cultural_addition_count: number;
  cultural_avg_politeness_shift: number;
  cultural_avg_distance_score: number;
  cultural_total_references: number;
  cultural_dominant_strategy: string;
} {
  // Default zero values
  const defaults = {
    cultural_preservation_ratio: 0,
    cultural_substitution_ratio: 0,
    cultural_explicitation_ratio: 0,
    cultural_omission_ratio: 0,
    cultural_generalization_ratio: 0,
    cultural_addition_count: 0,
    cultural_avg_politeness_shift: 0,
    cultural_avg_distance_score: 0,
    cultural_total_references: 0,
    cultural_dominant_strategy: "",
    expansion_ratio: 0,
  };

  try {
    const parsed: CulturalAnalysisResult = JSON.parse(rawLLMResponse);
    if (!parsed.summary) return defaults;

    const s = parsed.summary;
    return {
      cultural_preservation_ratio: s.preservation_ratio || 0,
      cultural_substitution_ratio: s.substitution_ratio || 0,
      cultural_explicitation_ratio: s.explicitation_ratio || 0,
      cultural_omission_ratio: s.omission_ratio || 0,
      cultural_generalization_ratio: s.generalization_ratio || 0,
      cultural_addition_count: s.cultural_addition_count || 0,
      cultural_avg_politeness_shift: s.avg_politeness_shift || 0,
      cultural_avg_distance_score: s.avg_cultural_distance || 0,
      cultural_total_references: s.total_references || 0,
      cultural_dominant_strategy: s.dominant_strategy || "",
      expansion_ratio: 0, // filled by caller
    };
  } catch {
    return defaults;
  }
}

// ==================== Full Metric Computation ====================

export interface DocumentData {
  sourceText: string;
  targetText: string;
  alignmentData: AlignmentInput;
  terms: Array<{ source_term: string; target_term: string }>;
}

export function computeAllMetrics(data: DocumentData): AnalyticsMetrics {
  const srcLex = computeLexicalMetrics(data.sourceText);
  const tgtLex = computeLexicalMetrics(data.targetText);
  const align = computeAlignmentMetrics(data.alignmentData);
  const term = computeTerminologyMetrics(data.terms, srcLex.token_count);
  const readSrc = computeReadability(data.sourceText);

  return {
    ...srcLex, // token_count etc refer to source by convention; target stored in ratios
    // Override with source-specific values — caller can also compute for target
    alignment_count: align.alignment_count,
    alignment_density: align.alignment_density,
    one_to_one_ratio: align.one_to_one_ratio,
    one_to_many_ratio: align.one_to_many_ratio,
    many_to_one_ratio: align.many_to_one_ratio,
    many_to_many_ratio: align.many_to_many_ratio,
    avg_confidence: align.avg_confidence,
    confidence_std: align.confidence_std,
    term_count: term.term_count,
    term_density: term.term_density,
    term_consistency: term.term_consistency,
    expansion_ratio: srcLex.token_count > 0 ? tgtLex.token_count / srcLex.token_count : 0,
    lexical_delta: tgtLex.ttr - srcLex.ttr,
    sentence_length_ratio: srcLex.avg_sentence_length > 0
      ? tgtLex.avg_sentence_length / srcLex.avg_sentence_length : 0,
    word_length_ratio: srcLex.avg_word_length > 0
      ? tgtLex.avg_word_length / srcLex.avg_word_length : 0,
    ...readSrc,
  };
}

// ==================== Statistical Tests ====================

export function runStatisticalTest(
  testType: StatisticalTest,
  groupValues: Array<{ groupName: string; values: number[] }>,
): StatisticalOutput {
  // Compute per-group stats
  const groupStats: GroupStats[] = groupValues.map((g) => {
    const v = g.values;
    return {
      groupName: g.groupName,
      n: v.length,
      mean: ss.mean(v),
      stdDev: v.length > 1 ? ss.sampleStandardDeviation(v) : 0,
      median: ss.median(v),
      min: Math.min(...v),
      max: Math.max(...v),
    };
  });

  let output: Pick<StatisticalOutput, "testStatistic" | "pValue" | "degreesOfFreedom" | "effectSize" | "effectSizeLabel">;

  try {
    switch (testType) {
      case "ttest_independent": {
        const a = groupValues[0].values;
        const b = groupValues[1].values;
        const result = ss.tTestTwoSample(a, b);
        const d = cohensD(a, b);
        output = {
          testStatistic: result ?? 0,
          pValue: result != null ? tTestPValue(result, a.length + b.length - 2) : 1,
          degreesOfFreedom: a.length + b.length - 2,
          effectSize: d,
          effectSizeLabel: effectLabel(d),
        };
        break;
      }
      case "ttest_paired": {
        const a = groupValues[0].values;
        const b = groupValues[1].values;
        // Paired: compute differences
        const diffs = a.map((v, i) => v - (b[i] ?? 0));
        const meanDiff = ss.mean(diffs);
        const sdDiff = ss.sampleStandardDeviation(diffs);
        const t = meanDiff / (sdDiff / Math.sqrt(diffs.length));
        const d = cohensD(a, b);
        output = {
          testStatistic: t,
          pValue: tTestPValue(Math.abs(t), diffs.length - 1),
          degreesOfFreedom: diffs.length - 1,
          effectSize: d,
          effectSizeLabel: effectLabel(d),
        };
        break;
      }
      case "mannwhitney": {
        // Mann-Whitney U approximated by z-score from rank-sum
        const a = groupValues[0].values;
        const b = groupValues[1].values;
        const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))];
        all.sort((x, y) => x.v - y.v);
        let rank = 1;
        for (let i = 0; i < all.length; i++) {
          if (i > 0 && all[i].v !== all[i - 1].v) rank = i + 1;
          (all[i] as any).rank = rank;
        }
        const r1 = all.filter((x) => x.g === 0).reduce((s, x) => s + (x as any).rank, 0);
        const n1 = a.length, n2 = b.length;
        const u1 = r1 - (n1 * (n1 + 1)) / 2;
        const mu = (n1 * n2) / 2;
        const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
        const z = (u1 - mu) / sigma;
        const p = 2 * (1 - normalCDF(Math.abs(z)));
        output = {
          testStatistic: u1,
          pValue: p,
          degreesOfFreedom: undefined,
          effectSize: Math.abs(z) / Math.sqrt(n1 + n2),
          effectSizeLabel: "r (rank-biserial approx)",
        };
        break;
      }
      case "anova_oneway": {
        // F-statistic from between/within group variance
        const allVals = groupValues.flatMap((g) => g.values);
        const grandMean = ss.mean(allVals);
        const k = groupValues.length;
        const N = allVals.length;
        const ssBetween = groupValues.reduce((s, g) => s + g.values.length * Math.pow(ss.mean(g.values) - grandMean, 2), 0);
        const ssWithin = groupValues.reduce((s, g) => {
          const m = ss.mean(g.values);
          return s + g.values.reduce((s2, v) => s2 + Math.pow(v - m, 2), 0);
        }, 0);
        const dfBetween = k - 1;
        const dfWithin = N - k;
        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const F = msBetween / msWithin;
        // Approximate p from F-distribution
        const p = 1 - fCDF(F, dfBetween, dfWithin);
        const eta2 = ssBetween / (ssBetween + ssWithin);
        output = {
          testStatistic: F,
          pValue: p,
          degreesOfFreedom: undefined,
          effectSize: eta2,
          effectSizeLabel: "η² (eta-squared)",
        };
        break;
      }
      case "kruskalwallis": {
        // Kruskal-Wallis H statistic (chi-square approximation)
        const all: Array<{ v: number; g: number }> = [];
        groupValues.forEach((g, gi) => g.values.forEach((v) => all.push({ v, g: gi })));
        all.sort((a, b) => a.v - b.v);
        // Assign ranks with tie correction
        let i = 0;
        while (i < all.length) {
          let j = i;
          while (j < all.length && all[j].v === all[i].v) j++;
          const avgRank = (i + j + 1) / 2;
          for (let k = i; k < j; k++) (all[k] as any).rank = avgRank;
          i = j;
        }
        const N = all.length;
        const rankSums = groupValues.map((g, gi) =>
          all.filter((x) => x.g === gi).reduce((s, x) => s + (x as any).rank, 0)
        );
        const H = (12 / (N * (N + 1)))
          * rankSums.reduce((s, r, idx) => s + (r * r) / groupValues[idx].values.length, 0)
          - 3 * (N + 1);
        const p = 1 - chi2CDF(H, groupValues.length - 1);
        output = {
          testStatistic: H,
          pValue: p,
          degreesOfFreedom: groupValues.length - 1,
          effectSize: H / (N - 1),
          effectSizeLabel: "η²_H (H/(N-1))",
        };
        break;
      }
      case "chisquare": {
        // Chi-square test of independence (2xK contingency)
        // Input: group 0 = observed counts, group 1 = expected proportions or second observed
        const obs = groupValues[0].values;
        const exp = groupValues[1]?.values ?? obs.map(() => obs.reduce((s, v) => s + v, 0) / obs.length);
        const total = obs.reduce((s, v) => s + v, 0);
        const expTotal = exp.reduce((s, v) => s + v, 0);
        const expected = exp.map((e) => total * (e / expTotal));
        let chi2 = 0;
        for (let i = 0; i < obs.length; i++) {
          if (expected[i] > 0) chi2 += Math.pow(obs[i] - expected[i], 2) / expected[i];
        }
        const p = 1 - chi2CDF(chi2, obs.length - 1);
        output = {
          testStatistic: chi2,
          pValue: p,
          degreesOfFreedom: obs.length - 1,
          effectSize: Math.sqrt(chi2 / total),
          effectSizeLabel: "Cramér's V (approx)",
        };
        break;
      }
      case "kolmogorov_smirnov": {
        const a = groupValues[0].values.slice().sort((x, y) => x - y);
        const b = groupValues[1].values.slice().sort((x, y) => x - y);
        let maxDiff = 0;
        let i = 0, j = 0;
        while (i < a.length && j < b.length) {
          const diff = Math.abs((i / a.length) - (j / b.length));
          maxDiff = Math.max(maxDiff, diff);
          if (a[i] <= b[j]) i++; else j++;
        }
        maxDiff = Math.max(maxDiff, Math.abs(1 - (j / b.length)));
        // Approximate p-value
        const lambda = maxDiff * Math.sqrt((a.length * b.length) / (a.length + b.length));
        const p = 2 * Math.exp(-2 * lambda * lambda);
        output = {
          testStatistic: maxDiff,
          pValue: Math.min(1, p),
          degreesOfFreedom: undefined,
          effectSize: maxDiff,
          effectSizeLabel: "D (max distance)",
        };
        break;
      }
      default:
        output = { testStatistic: 0, pValue: 1, degreesOfFreedom: undefined, effectSize: 0, effectSizeLabel: "" };
    }
  } catch {
    output = { testStatistic: 0, pValue: 1, degreesOfFreedom: undefined, effectSize: 0, effectSizeLabel: "" };
  }

  return {
    testName: testType,
    testStatistic: output.testStatistic,
    pValue: output.pValue,
    degreesOfFreedom: output.degreesOfFreedom,
    effectSize: output.effectSize,
    effectSizeLabel: output.effectSizeLabel,
    groupStats,
    significant: output.pValue < 0.05,
    confidenceInterval: undefined,
  };
}

// ==================== Effect Size ====================

function cohensD(a: number[], b: number[]): number {
  const ma = ss.mean(a);
  const mb = ss.mean(b);
  const sa = ss.sampleStandardDeviation(a);
  const sb = ss.sampleStandardDeviation(b);
  const pooled = Math.sqrt((sa * sa + sb * sb) / 2);
  return pooled > 0 ? Math.abs(ma - mb) / pooled : 0;
}

function effectLabel(d: number): string {
  if (d < 0.2) return "negligible";
  if (d < 0.5) return "small";
  if (d < 0.8) return "medium";
  return "large";
}

// ==================== Distribution Approximations ====================

function normalCDF(x: number): number {
  // Abramowitz & Stegun approximation
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function tTestPValue(t: number, df: number): number {
  // Approximate two-tailed p-value from t-distribution
  const x = (df / (df + t * t));
  const p = 1 - incompleteBeta(df / 2, 0.5, x);
  return Math.min(1, 2 * p);
}

/** Incomplete beta function (regularized) via continued fraction */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  // Use symmetry
  if (x > 0.5) return 1 - incompleteBeta(b, a, 1 - x);
  const lnBeta = logBeta(a, b);
  let front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i < 200; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }
    d = 1 + numerator * d;
    if (d === 0) d = 1e-30;
    c = 1 + numerator / c;
    if (c === 0) c = 1e-30;
    d = 1 / d;
    f *= c * d;
    front *= f;
  }
  return front;
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x: number): number {
  // Stirling's approximation
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  const c = [0.999999999999997, 57.1562356658629, -59.5979603554755,
    14.1360979747417, -0.49191381609762, 0.339946499848119e-4,
    0.465236289270486e-4, -0.983744753048796e-4, 0.158088703224912e-3,
    -0.210264441724105e-3, 0.217439618115213e-3, -0.164318106536764e-3,
    0.844182239838528e-4, -0.261908384015816e-4, 0.368991826595318e-5];
  let s = c[0];
  for (let i = 1; i < c.length; i++) s += c[i] / (x + i);
  const t = x + c.length - 1.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + Math.log(s) + (x + 0.5) * Math.log(t) - t;
}

function chi2CDF(x: number, df: number): number {
  if (x <= 0) return 0;
  return incompleteBeta(df / 2, 0.5, Math.min(1, x / (x + df)));
}

function fCDF(x: number, df1: number, df2: number): number {
  if (x <= 0) return 0;
  const z = (df1 * x) / (df1 * x + df2);
  return incompleteBeta(df1 / 2, df2 / 2, z);
}
