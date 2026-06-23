export interface AnalyticsExperiment {
  id?: number;
  title: string;
  research_question?: string;
  hypothesis?: string;
  configuration: string;  // JSON: AnalyticsConfig
  status: 'draft' | 'running' | 'completed' | 'error';
  created_at?: string;
}

export interface AnalyticsConfig {
  groups: ExperimentGroup[];
  metrics: string[];       // keys from AnalyticsMetrics
  testType: StatisticalTest;
  testOptions?: Record<string, unknown>;
}

export interface ExperimentGroup {
  name: string;
  label: string;
  documentIds: number[];
  metadata?: Record<string, string>;  // e.g. { translator: "human", domain: "legal" }
}

export type StatisticalTest =
  | 'ttest_independent'
  | 'ttest_paired'
  | 'mannwhitney'
  | 'anova_oneway'
  | 'anova_twoway'
  | 'kruskalwallis'
  | 'chisquare'
  | 'pearson_correlation'
  | 'spearman_correlation'
  | 'kolmogorov_smirnov'
  | 'cohens_kappa';

export interface AnalyticsMetrics {
  // --- Lexical (per text) ---
  token_count: number;
  type_count: number;
  ttr: number;                    // Type-Token Ratio
  hapax_ratio: number;            // hapax legomena / tokens
  dislegomena_ratio: number;      // words appearing twice / tokens
  guiraud_r: number;              // types / sqrt(tokens)
  herdans_c: number;              // log(types) / log(tokens)
  yules_k: number;                // characteristic constant (repetition)
  simpson_d: number;              // lexical diversity index
  brunet_w: number;               // length-independent
  honore_h: number;               // 100 * log(tokens) / (1 - hapax_ratio)
  maas_a2: number;                // log(tokens)-log(types) / log(tokens)²
  avg_word_length: number;
  avg_sentence_length: number;
  sentence_length_std: number;

  // --- Alignment ---
  alignment_count: number;
  alignment_density: number;      // aligned pairs / source sentences
  one_to_one_ratio: number;
  one_to_many_ratio: number;
  many_to_one_ratio: number;
  many_to_many_ratio: number;
  avg_confidence: number;
  confidence_std: number;

  // --- Terminology ---
  term_count: number;
  term_density: number;           // terms per 1000 tokens
  term_consistency: number;       // avg unique target terms per source term (lower = more consistent)

  // --- Comparative (source vs target) ---
  expansion_ratio: number;        // target_tokens / source_tokens
  lexical_delta: number;          // ttr_target - ttr_source
  sentence_length_ratio: number;  // avg_sent_len_target / avg_sent_len_source
  word_length_ratio: number;

  // --- Readability (language-specific, best-effort) ---
  flesch_reading_ease?: number;
  automated_readability_index?: number;
  gunning_fog?: number;

  // --- Cultural Adaptation ---
  cultural_preservation_ratio?: number;
  cultural_substitution_ratio?: number;
  cultural_explicitation_ratio?: number;
  cultural_omission_ratio?: number;
  cultural_generalization_ratio?: number;
  cultural_addition_count?: number;
  cultural_avg_politeness_shift?: number;
  cultural_avg_distance_score?: number;
  cultural_total_references?: number;
  cultural_dominant_strategy?: string;
}

export interface AnalyticsResult {
  id?: number;
  experiment_id: number;
  document_id: number;
  group_name: string;
  document_title?: string;
  source_language?: string;
  target_language?: string;
  metrics: AnalyticsMetrics;
}

export interface ExperimentResult {
  experiment: AnalyticsExperiment;
  results: AnalyticsResult[];
  testOutput?: StatisticalOutput;
}

export interface StatisticalOutput {
  testName: string;
  testStatistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  effectSize?: number;
  effectSizeLabel?: string;
  confidenceInterval?: [number, number];
  groupStats: GroupStats[];
  significant: boolean;
}

export interface GroupStats {
  groupName: string;
  n: number;
  mean: number;
  stdDev: number;
  median: number;
  min: number;
  max: number;
}

export interface AnalyticsReport {
  id?: number;
  experiment_id: number;
  format: 'markdown' | 'latex' | 'html';
  content: string;
  created_at?: string;
}
