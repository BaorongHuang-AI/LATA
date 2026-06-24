/**
 * Translation Stylometric Profiler — PCA, clustering, feature extraction.
 * Includes delta metrics (target - source) to isolate translator effect.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ss from "simple-statistics";
import { computeLexicalMetrics, computeAlignmentMetrics, computeReadability, computeCulturalMetrics } from "./stats";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { StylometricFeatureVector, PCAResult, ClusterResult, DomainComparison } from "../types/stylometry";

// ==================== Helpers ====================

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s\p{P}]+/u).filter(t => t.length > 0);
}
function setRatio(words: string[], s: Set<string>): number {
  return words.length > 0 ? words.filter(w => s.has(w)).length / words.length : 0;
}
function punctDensity(text: string): number {
  if (!text || text.length === 0) return 0;
  return ((text.match(/[.,;:!?—"''()]/g) || []).length) / text.length;
}

// ==================== Feature Extraction ====================

export interface ExtractionInput {
  sourceText: string;
  targetText: string;
  alignmentData: { sourceCount: number; alignments: Array<{ sourceCount: number; targetCount: number; confidence?: number | null }> };
  culturalLLMResponse?: string;
}

export function extractFeatures(input: ExtractionInput): StylometricFeatureVector {
  const srcLex = computeLexicalMetrics(input.sourceText);
  const tgtLex = computeLexicalMetrics(input.targetText);
  const align = computeAlignmentMetrics(input.alignmentData);
  const read = computeReadability(input.sourceText);
  const cult = input.culturalLLMResponse ? computeCulturalMetrics(input.culturalLLMResponse) : ({} as any);

  const sw = input.sourceText ? tokenize(input.sourceText) : [];
  const tw = input.targetText ? tokenize(input.targetText) : [];

  const src = { noun: setRatio(sw, COMMON_NOUNS), verb: setRatio(sw, COMMON_VERBS), adj: setRatio(sw, COMMON_ADJECTIVES), prep: setRatio(sw, COMMON_PREPOSITIONS), pron: setRatio(sw, COMMON_PRONOUNS), pass: setRatio(sw, PASSIVE_INDICATORS), first: setRatio(sw, FIRST_PERSON), hedge: setRatio(sw, HEDGING_WORDS) };
  const tgt = { noun: setRatio(tw, COMMON_NOUNS), verb: setRatio(tw, COMMON_VERBS), adj: setRatio(tw, COMMON_ADJECTIVES), prep: setRatio(tw, COMMON_PREPOSITIONS), pron: setRatio(tw, COMMON_PRONOUNS), pass: setRatio(tw, PASSIVE_INDICATORS) };

  const srcPunct = punctDensity(input.sourceText);
  const tgtPunct = punctDensity(input.targetText);
  // eslint-disable-next-line no-control-regex
  const loanRatio = sw.length > 0 ? sw.filter(w => /[^\x00-\x7F]/.test(w)).length / sw.length : 0;
  const formality = Math.min(1, (srcLex.avg_word_length / 8) * 0.3 + (1 - src.pron * 5) * 0.3 + (src.pass * 5) * 0.2 + (1 - src.first * 5) * 0.2);
  const posC = sw.filter(w => POSITIVE_WORDS.has(w)).length;
  const negC = sw.filter(w => NEGATIVE_WORDS.has(w)).length;
  const valence = sw.length > 0 ? (posC - negC) / sw.length : 0;
  const absC = sw.filter(w => ABSTRACT_WORDS.has(w)).length;
  const conc = sw.length > 0 ? 1 - absC / sw.length : 0;

  return {
    token_count: srcLex.token_count, type_count: srcLex.type_count,
    ttr: srcLex.ttr, hapax_ratio: srcLex.hapax_ratio,
    guiraud_r: srcLex.guiraud_r, herdans_c: srcLex.herdans_c,
    yules_k: srcLex.yules_k, honore_h: srcLex.honore_h,
    simpson_d: srcLex.simpson_d, brunet_w: srcLex.brunet_w,
    maas_a2: srcLex.maas_a2, avg_word_length: srcLex.avg_word_length,
    word_length_std: 0, avg_sentence_length: srcLex.avg_sentence_length,
    sentence_length_std: srcLex.sentence_length_std,
    punctuation_density: srcPunct, loan_word_ratio: loanRatio,
    target_token_count: tgtLex.token_count, target_ttr: tgtLex.ttr,
    target_hapax_ratio: tgtLex.hapax_ratio, target_guiraud_r: tgtLex.guiraud_r,
    target_herdans_c: tgtLex.herdans_c, target_yules_k: tgtLex.yules_k,
    target_honore_h: tgtLex.honore_h, target_simpson_d: tgtLex.simpson_d,
    target_brunet_w: tgtLex.brunet_w, target_maas_a2: tgtLex.maas_a2,
    target_avg_word_length: tgtLex.avg_word_length,
    target_avg_sentence_length: tgtLex.avg_sentence_length,
    target_sentence_length_std: tgtLex.sentence_length_std,
    target_punctuation_density: tgtPunct,
    delta_ttr: tgtLex.ttr - srcLex.ttr, delta_guiraud_r: tgtLex.guiraud_r - srcLex.guiraud_r,
    delta_herdans_c: tgtLex.herdans_c - srcLex.herdans_c, delta_yules_k: tgtLex.yules_k - srcLex.yules_k,
    delta_honore_h: tgtLex.honore_h - srcLex.honore_h, delta_simpson_d: tgtLex.simpson_d - srcLex.simpson_d,
    delta_brunet_w: tgtLex.brunet_w - srcLex.brunet_w, delta_maas_a2: tgtLex.maas_a2 - srcLex.maas_a2,
    delta_avg_word_length: tgtLex.avg_word_length - srcLex.avg_word_length,
    delta_avg_sentence_length: tgtLex.avg_sentence_length - srcLex.avg_sentence_length,
    delta_sentence_length_std: tgtLex.sentence_length_std - srcLex.sentence_length_std,
    delta_punctuation_density: tgtPunct - srcPunct,
    alignment_density: align.alignment_density, one_to_one_ratio: align.one_to_one_ratio,
    one_to_many_ratio: align.one_to_many_ratio, many_to_one_ratio: align.many_to_one_ratio,
    many_to_many_ratio: align.many_to_many_ratio,
    avg_confidence: align.avg_confidence, confidence_std: align.confidence_std,
    expansion_ratio: srcLex.token_count > 0 ? tgtLex.token_count / srcLex.token_count : 0,
    sentence_length_ratio: srcLex.avg_sentence_length > 0 ? tgtLex.avg_sentence_length / srcLex.avg_sentence_length : 0,
    noun_ratio: src.noun, verb_ratio: src.verb, adj_ratio: src.adj,
    passive_density: src.pass, preposition_density: src.prep,
    pronoun_density: src.pron, subordination_index: 0,
    target_noun_ratio: tgt.noun, target_verb_ratio: tgt.verb, target_adj_ratio: tgt.adj,
    target_passive_density: tgt.pass, target_preposition_density: tgt.prep,
    target_pronoun_density: tgt.pron,
    delta_noun_ratio: tgt.noun - src.noun, delta_verb_ratio: tgt.verb - src.verb,
    delta_adj_ratio: tgt.adj - src.adj, delta_passive_density: tgt.pass - src.pass,
    delta_preposition_density: tgt.prep - src.prep, delta_pronoun_density: tgt.pron - src.pron,
    formality_score: formality, emotional_valence: valence,
    concreteness_score: conc, hedging_frequency: src.hedge,
    first_person_ratio: src.first,
    flesch_reading_ease: read.flesch_reading_ease || 0,
    automated_readability_index: read.automated_readability_index || 0,
    gunning_fog: read.gunning_fog || 0,
    cultural_preservation_ratio: cult.cultural_preservation_ratio || 0,
    cultural_substitution_ratio: cult.cultural_substitution_ratio || 0,
    cultural_addition_count: cult.cultural_addition_count || 0,
    cultural_avg_politeness_shift: cult.cultural_avg_politeness_shift || 0,
    cultural_avg_distance_score: cult.cultural_avg_distance_score || 0,
    // New metrics
    sentence_length_skewness: sentLenStats(input.sourceText).skew,
    sentence_length_kurtosis: sentLenStats(input.sourceText).kurt,
    word_length_skewness: skewness(sw.map(w => w.length)),
    bigram_ttr: ngramTTR(sw, 2),
    trigram_ttr: ngramTTR(sw, 3),
    adverb_density: setRatio(sw, ADVERBS),
    conjunction_density: setRatio(sw, CONJUNCTIONS),
    definite_article_ratio: (setRatio(sw, DEFINITE_ARTICLES) + 0.0001) / (setRatio(sw, INDEFINITE_ARTICLES) + 0.0001),
    contraction_ratio: contractions(input.sourceText) / Math.max(1, sw.length),
    quote_density: quoteDensityFt(input.sourceText),
    question_density: (input.sourceText.match(/\?/g) || []).length / Math.max(1, sw.length),
    exclamation_density: (input.sourceText.match(/!/g) || []).length / Math.max(1, sw.length),
    number_density: numberDensityFt(sw),
    transition_density: setRatio(sw, TRANSITIONS),
    abbreviation_density: setRatio(sw, ABBREVIATIONS),
    unique_starters_ratio: uniqueStarters(input.sourceText),
    repetition_index: repetitionIndexFt(sw),
    target_sentence_length_skewness: sentLenStats(input.targetText).skew,
    target_bigram_ttr: ngramTTR(tw, 2),
    target_adverb_density: setRatio(tw, ADVERBS),
    target_conjunction_density: setRatio(tw, CONJUNCTIONS),
    target_quote_density: quoteDensityFt(input.targetText),
    target_number_density: numberDensityFt(tw),
    delta_adverb_density: setRatio(tw, ADVERBS) - setRatio(sw, ADVERBS),
    delta_conjunction_density: setRatio(tw, CONJUNCTIONS) - setRatio(sw, CONJUNCTIONS),
    delta_quote_density: quoteDensityFt(input.targetText) - quoteDensityFt(input.sourceText),
    delta_bigram_ttr: ngramTTR(tw, 2) - ngramTTR(sw, 2),
    delta_sentence_length_skewness: sentLenStats(input.targetText).skew - sentLenStats(input.sourceText).skew,
  };
}

function sentLenStats(text: string): { skew: number; kurt: number } {
  const sents = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lens = sents.map(s => tokenize(s).length);
  return { skew: skewness(lens), kurt: kurtosis(lens) };
}

// ==================== Delta Feature Names (for PCA) ====================

// ==================== New Lexical Helpers ====================

function ngrams(words: string[], n: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= words.length - n; i++) result.push(words.slice(i, i + n).join("_"));
  return result;
}
function ngramTTR(words: string[], n: number): number {
  if (words.length < n) return 0;
  const grams = ngrams(words, n);
  return new Set(grams).size / grams.length;
}
function skewness(values: number[]): number {
  if (values.length < 3) return 0;
  const m = ss.mean(values);
  const sd = ss.sampleStandardDeviation(values) || 1;
  return values.reduce((s, v) => s + Math.pow((v - m) / sd, 3), 0) * values.length / ((values.length - 1) * (values.length - 2));
}
function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const m = ss.mean(values);
  const sd = ss.sampleStandardDeviation(values) || 1;
  const n = values.length;
  const s2 = values.reduce((s, v) => s + Math.pow((v - m) / sd, 4), 0);
  return (n * (n + 1) * s2 - 3 * (n - 1) * (n - 1)) / ((n - 1) * (n - 2) * (n - 3));
}

// ==================== Additional Word Lists ====================

const ADVERBS = new Set(["very","quite","rather","too","extremely","highly","completely","totally","absolutely","utterly","almost","barely","hardly","scarcely","nearly","just","only","merely","simply","really","actually","indeed","certainly","surely","probably","possibly","perhaps","maybe","always","never","often","sometimes","usually","rarely","seldom","frequently","occasionally","generally","already","yet","still","again","ever","once","twice","soon","later","eventually","finally","suddenly","gradually","immediately","instantly","now","then","here","there","everywhere","nowhere","somewhere","well","badly","easily","carefully","quickly","slowly","quietly","loudly","clearly","obviously","apparently","fortunately","unfortunately","surprisingly","interestingly","importantly","especially","particularly","specifically","typically","normally","usually","commonly"]);
const CONJUNCTIONS = new Set(["and","but","or","nor","for","so","yet","although","though","because","since","while","whereas","if","when","unless","until","after","before","once","as","than","that","whether","either","neither","both","not","only","also","however","therefore","thus","hence","consequently","accordingly","furthermore","moreover","nevertheless","nonetheless","otherwise","instead","meanwhile","subsequently","indeed","namely","specifically","for example","such as","in addition","on the other hand","in contrast","in fact","as a result"]);
const TRANSITIONS = new Set(["however","therefore","thus","hence","consequently","accordingly","furthermore","moreover","nevertheless","nonetheless","otherwise","instead","meanwhile","subsequently","indeed","namely","specifically","in addition","on the other hand","in contrast","in fact","as a result","for example","for instance","that is","in other words","in particular","above all","in conclusion","to summarize","first","second","third","finally","lastly","next","then","additionally","similarly","likewise","conversely","regardless","notwithstanding","in any case","at any rate","after all","of course","to be sure"]);
const ABBREVIATIONS = new Set(["mr","mrs","ms","dr","prof","st","ave","blvd","rd","dept","dept","assn","corp","inc","ltd","co","etc","ie","eg","vs","et al","ibid","op cit","ca","cf","viz","no","nos","vol","p","pp","ch","sec","art","para","app","fig","eq","e.g","i.e","a.m","p.m","ad","bc","ce","bce","un","eu","nato","usa","uk","fbi","cia","nsa"]);
const DEFINITE_ARTICLES = new Set(["the"]);
const INDEFINITE_ARTICLES = new Set(["a","an"]);

// ==================== Extended Word Lists for Source Language ====================

function contractions(text: string): number {
  if (!text || text.length === 0) return 0;
  const matches = text.match(/\b\w+'\w+\b/g) || [];
  return matches.length;
}
function quoteDensityFt(text: string): number {
  if (!text) return 0;
  const quoteChars = (text.match(/["“”‘’]/g) || []).length;
  return quoteChars / Math.max(1, text.length);
}
function numberDensityFt(words: string[]): number {
  if (words.length === 0) return 0;
  return words.filter(w => /^\d+(\.\d+)?$/.test(w)).length / words.length;
}
function uniqueStarters(text: string): number {
  const sents = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sents.length === 0) return 0;
  const starters = sents.map(s => tokenize(s.trim())[0]?.toLowerCase()).filter(Boolean);
  return new Set(starters).size / sents.length;
}
function repetitionIndexFt(words: string[]): number {
  if (words.length < 2) return 0;
  const contentWords = words.filter(w => !COMMON_PREPOSITIONS.has(w) && !COMMON_PRONOUNS.has(w) && w.length > 2);
  if (contentWords.length < 2) return 0;
  let totalDist = 0; let pairs = 0;
  for (let i = 0; i < contentWords.length - 1; i++) {
    for (let j = i + 1; j < contentWords.length; j++) {
      if (contentWords[i] === contentWords[j]) { totalDist += j - i; pairs++; break; }
    }
  }
  return pairs > 0 ? totalDist / (pairs * words.length) : 0; // normalized
}

// ==================== Feature Name Arrays ====================

export const DELTA_FEATURE_NAMES = [
  "delta_ttr","delta_guiraud_r","delta_herdans_c","delta_yules_k","delta_honore_h",
  "delta_simpson_d","delta_brunet_w","delta_maas_a2","delta_avg_word_length",
  "delta_avg_sentence_length","delta_sentence_length_std","delta_punctuation_density",
  "delta_noun_ratio","delta_verb_ratio","delta_adj_ratio",
  "delta_passive_density","delta_preposition_density","delta_pronoun_density",
  "delta_adverb_density","delta_conjunction_density",
  "delta_quote_density","delta_bigram_ttr","delta_sentence_length_skewness",
];

export const ALL_FEATURE_NAMES = [
  ...DELTA_FEATURE_NAMES,
  "expansion_ratio","sentence_length_ratio","alignment_density",
  "one_to_one_ratio","formality_score","emotional_valence",
  "hedging_frequency","first_person_ratio","gunning_fog",
  "cultural_preservation_ratio","cultural_substitution_ratio","cultural_avg_distance_score",
  "bigram_ttr","trigram_ttr","adverb_density","conjunction_density",
  "quote_density","question_density","number_density",
  "transition_density","sentence_length_skewness","kurtosis",
];

// ==================== Domain Comparison ====================

export function computeDomainComparison(
  profiles: Array<{ features: StylometricFeatureVector; metadata: { domain?: string } }>,
  metric: string,
): DomainComparison[] {
  const byDomain = new Map<string, number[]>();
  const byDomainSrc = new Map<string, number[]>();
  for (const p of profiles) {
    const d = p.metadata.domain || "unknown";
    if (!byDomain.has(d)) { byDomain.set(d, []); byDomainSrc.set(d, []); }
    const val = (p.features as any)[metric];
    const srcVal = metric.startsWith("delta_")
      ? (p.features as any)[metric.replace("delta_", "")]
      : (p.features as any)[`target_${metric}`];
    if (typeof val === "number") byDomain.get(d)!.push(val);
    if (typeof srcVal === "number") byDomainSrc.get(d)!.push(srcVal);
  }

  return Array.from(byDomain.entries()).map(([domain, deltas]) => {
    const srcs = byDomainSrc.get(domain) || [];
    return {
      domain, metric,
      n: deltas.length,
      source_mean: srcs.length > 0 ? ss.mean(srcs) : 0,
      target_mean: srcs.length > 0 ? ss.mean(deltas.map((d, i) => (srcs[i] || 0) + d)) : 0,
      delta_mean: ss.mean(deltas),
      delta_std: deltas.length > 1 ? ss.sampleStandardDeviation(deltas) : 0,
      cohens_d_vs_zero: deltas.length > 1
        ? Math.abs(ss.mean(deltas)) / (ss.sampleStandardDeviation(deltas) || 1) : 0,
    };
  }).sort((a, b) => b.n - a.n);
}

// ==================== PCA ====================

function standardize(data: number[][]): number[][] {
  const n = data.length; if (n === 0) return [];
  const m = data[0].length;
  const means = Array.from({ length: m }, (_, j) => ss.mean(data.map(r => r[j])));
  const stds = Array.from({ length: m }, (_, j) => ss.sampleStandardDeviation(data.map(r => r[j])) || 1);
  return data.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

export function computePCA(data: number[][], k: number = 2): PCAResult {
  const std = standardize(data);
  const n = std.length; if (n === 0) return { components: [], explainedVariance: [], projected: [], totalVariance: 0 };
  const m = std[0].length; const actualK = Math.min(k, m, n);
  const cov: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let j = i; j < m; j++) {
    let s = 0; for (let r = 0; r < n; r++) s += std[r][i] * std[r][j];
    cov[i][j] = cov[j][i] = s / (n - 1);
  }
  const eigenvalues: number[] = []; const eigenvectors: number[][] = [];
  const residual = cov.map(r => [...r]);
  for (let comp = 0; comp < actualK; comp++) {
    let v = Array.from({ length: m }, () => Math.random());
    for (let iter = 0; iter < 100; iter++) {
      const next = Array(m).fill(0);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) next[i] += residual[i][j] * v[j];
      const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)); if (norm < 1e-10) break;
      v = next.map(x => x / norm);
    }
    let lambda = 0; const temp = Array(m).fill(0);
    for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) temp[i] += residual[i][j] * v[j]; lambda += v[i] * temp[i]; }
    eigenvalues.push(lambda); eigenvectors.push(v);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) residual[i][j] -= lambda * v[i] * v[j];
  }
  const totalVar = eigenvalues.reduce((s, e) => s + Math.abs(e), 0) || 1;
  const explainedVariance = eigenvalues.map(e => Math.abs(e) / totalVar);
  const projected = std.map(row => eigenvectors.map(vec => row.reduce((s, v, i) => s + v * vec[i], 0)));
  return { components: eigenvectors, explainedVariance, projected, totalVariance: totalVar };
}

// ==================== K-Means ====================

export function kMeans(data: number[][], k: number = 3, maxIter: number = 50): ClusterResult {
  const n = data.length; if (n === 0) return { labels: [], centroids: [], silhouetteScore: 0 };
  const dim = data[0].length;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  let centroids = idx.slice(0, k).map(i => [...data[i]]);
  const labels = Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestD = Infinity; let bestL = 0;
      for (let c = 0; c < k; c++) { let d = 0; for (let j = 0; j < dim; j++) d += (data[i][j] - centroids[c][j]) ** 2; if ((d = Math.sqrt(d)) < bestD) { bestD = d; bestL = c; } }
      if (labels[i] !== bestL) { changed = true; labels[i] = bestL; }
    }
    if (!changed) break;
    centroids = Array.from({ length: k }, () => Array(dim).fill(0));
    const cnt = Array(k).fill(0);
    for (let i = 0; i < n; i++) { cnt[labels[i]]++; for (let j = 0; j < dim; j++) centroids[labels[i]][j] += data[i][j]; }
    for (let c = 0; c < k; c++) if (cnt[c] > 0) centroids[c] = centroids[c].map(v => v / cnt[c]);
  }
  return { labels, centroids, silhouetteScore: silhouette(data, labels, k) };
}

function silhouette(data: number[][], labels: number[], k: number): number {
  const n = data.length; if (n === 0) return 0; let total = 0;
  for (let i = 0; i < n; i++) {
    let a = 0; let aC = 0;
    const bPer: number[] = Array(k).fill(0); const bC: number[] = Array(k).fill(0);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      let d = 0; for (let t = 0; t < data[i].length; t++) d += (data[i][t] - data[j][t]) ** 2; d = Math.sqrt(d);
      if (labels[j] === labels[i]) { a += d; aC++; } else { bPer[labels[j]] += d; bC[labels[j]]++; }
    }
    a = aC > 0 ? a / aC : 0;
    let b = Infinity; for (let c = 0; c < k; c++) if (c !== labels[i] && bC[c] > 0) b = Math.min(b, bPer[c] / bC[c]);
    if (b === Infinity) b = 0;
    const maxAB = Math.max(a, b);
    total += maxAB > 0 ? (b - a) / maxAB : 0;
  }
  return total / n;
}

// ==================== Feature Discrimination ====================

export function featureDiscrimination(
  groupA: StylometricFeatureVector[], groupB: StylometricFeatureVector[],
  featureNames: string[],
): Array<{ name: string; score: number }> {
  return featureNames.map(name => {
    const aV = groupA.map(f => (f as any)[name] || 0);
    const bV = groupB.map(f => (f as any)[name] || 0);
    const ma = ss.mean(aV), mb = ss.mean(bV);
    const sa = ss.sampleStandardDeviation(aV) || 1, sb = ss.sampleStandardDeviation(bV) || 1;
    const pooled = Math.sqrt((sa * sa + sb * sb) / 2);
    return { name, score: pooled > 0 ? Math.abs(ma - mb) / pooled : 0 };
  }).sort((a, b) => b.score - a.score);
}

// ==================== Word Lists ====================

const COMMON_NOUNS = new Set(["time","year","people","way","day","man","woman","child","world","life","hand","part","place","case","week","company","system","program","question","government","number","night","point","home","water","room","mother","father","area","money","story","fact","month","lot","right","study","book","eye","job","word","business"]);
const COMMON_VERBS = new Set(["be","have","do","say","get","make","go","know","take","see","come","think","look","want","give","use","find","tell","ask","work","seem","feel","try","leave","call","mean","put","keep","let","begin","help","turn","show","hear","play","run","move","like","live","believe","hold","bring","happen","write","provide","sit","stand","lose","pay","meet","include","continue","set","learn","change","lead","understand","watch","follow","stop","create","speak","read","allow","add","spend","grow","open","walk","win","offer","remember","consider","appear","buy","serve","die","send","build","stay","fall","cut","reach","kill","raise"]);
const COMMON_ADJECTIVES = new Set(["good","new","first","last","long","great","little","own","other","old","right","big","high","different","small","large","next","early","young","important","few","public","bad","same","able","possible","likely","clear","late","strong","free","true","full","special","easy","nice","certain","hard","real","white","black","whole","human","better","best","local","economic","political","social","national","international"]);
const COMMON_PREPOSITIONS = new Set(["of","in","to","for","with","on","at","from","by","about","into","through","during","before","after","above","below","between","under","without","within","along","across","behind","beyond","toward","upon","among"]);
const COMMON_PRONOUNS = new Set(["i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","its","our","their","mine","yours","hers","ours","theirs","myself","yourself","himself","herself","itself","ourselves","themselves"]);
const PASSIVE_INDICATORS = new Set(["been","being","was","were","are","is","am","get","got","gotten"]);
const FIRST_PERSON = new Set(["i","me","my","mine","myself","we","us","our","ours","ourselves"]);
const HEDGING_WORDS = new Set(["perhaps","maybe","possibly","probably","likely","unlikely","apparently","seemingly","somewhat","rather","quite","almost","nearly","approximately","suggests","indicates","appears","might","may","could","would","seems"]);
const POSITIVE_WORDS = new Set(["good","great","excellent","wonderful","beautiful","happy","love","joy","peace","hope","success","positive","best","better","fantastic","amazing","brilliant","delightful","favorable","pleased","proud","confident","optimistic"]);
const NEGATIVE_WORDS = new Set(["bad","terrible","awful","horrible","sad","hate","fear","war","death","failure","negative","worst","worse","poor","ugly","angry","disappointed","worried","pessimistic","dangerous","harmful","damage","suffer","pain"]);
const ABSTRACT_WORDS = new Set(["freedom","justice","love","hate","truth","beauty","wisdom","knowledge","power","peace","war","democracy","equality","liberty","honor","duty","faith","hope","charity","virtue","sin","soul","spirit","mind","thought","idea","concept","theory","philosophy","principle","value","belief","ideology","doctrine","dogma"]);
