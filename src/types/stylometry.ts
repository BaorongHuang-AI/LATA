export interface StylometricFeatureVector {
  // Lexical (source)
  token_count: number; type_count: number; ttr: number; hapax_ratio: number;
  guiraud_r: number; herdans_c: number; yules_k: number; honore_h: number;
  simpson_d: number; brunet_w: number; maas_a2: number;
  avg_word_length: number; word_length_std: number;
  avg_sentence_length: number; sentence_length_std: number;
  punctuation_density: number; loan_word_ratio: number;

  // Lexical (target)
  target_token_count: number; target_ttr: number; target_hapax_ratio: number;
  target_guiraud_r: number; target_herdans_c: number; target_yules_k: number;
  target_honore_h: number; target_simpson_d: number; target_brunet_w: number;
  target_maas_a2: number; target_avg_word_length: number;
  target_avg_sentence_length: number; target_sentence_length_std: number;
  target_punctuation_density: number;

  // Lexical deltas (target - source) — isolates translator effect from source characteristics
  delta_ttr: number; delta_guiraud_r: number; delta_herdans_c: number;
  delta_yules_k: number; delta_honore_h: number; delta_simpson_d: number;
  delta_brunet_w: number; delta_maas_a2: number;
  delta_avg_word_length: number; delta_avg_sentence_length: number;
  delta_sentence_length_std: number; delta_punctuation_density: number;
  delta_adverb_density: number; delta_conjunction_density: number;
  delta_quote_density: number; delta_bigram_ttr: number;
  delta_sentence_length_skewness: number;

  // Distribution shape
  sentence_length_skewness: number; sentence_length_kurtosis: number;
  word_length_skewness: number;

  // N-gram diversity
  bigram_ttr: number; trigram_ttr: number;

  // Stylistic markers (source)
  adverb_density: number; conjunction_density: number;
  definite_article_ratio: number; contraction_ratio: number;
  quote_density: number; question_density: number;
  exclamation_density: number; number_density: number;
  transition_density: number; abbreviation_density: number;
  unique_starters_ratio: number; repetition_index: number;

  // Target-side
  target_sentence_length_skewness: number;
  target_bigram_ttr: number; target_adverb_density: number;
  target_conjunction_density: number; target_quote_density: number;
  target_number_density: number;

  // Alignment
  alignment_density: number; one_to_one_ratio: number; one_to_many_ratio: number;
  many_to_one_ratio: number; many_to_many_ratio: number;
  avg_confidence: number; confidence_std: number;
  expansion_ratio: number; sentence_length_ratio: number;

  // Syntactic (source)
  noun_ratio: number; verb_ratio: number; adj_ratio: number;
  passive_density: number; preposition_density: number;
  pronoun_density: number; subordination_index: number;

  // Syntactic (target)
  target_noun_ratio: number; target_verb_ratio: number; target_adj_ratio: number;
  target_passive_density: number; target_preposition_density: number;
  target_pronoun_density: number;

  // Syntactic deltas (target - source)
  delta_noun_ratio: number; delta_verb_ratio: number; delta_adj_ratio: number;
  delta_passive_density: number; delta_preposition_density: number;
  delta_pronoun_density: number;

  // Stylistic
  formality_score: number; emotional_valence: number;
  concreteness_score: number; hedging_frequency: number;
  first_person_ratio: number;

  // Readability
  flesch_reading_ease: number; automated_readability_index: number; gunning_fog: number;

  // Cultural
  cultural_preservation_ratio: number; cultural_substitution_ratio: number;
  cultural_addition_count: number; cultural_avg_politeness_shift: number;
  cultural_avg_distance_score: number;
}

/** Domain comparison result: per-domain stats for a given metric */
export interface DomainComparison {
  domain: string;
  metric: string;
  n: number;
  source_mean: number;
  target_mean: number;
  delta_mean: number;
  delta_std: number;
  cohens_d_vs_zero: number; // effect size of delta ≠ 0
}

export interface StylometricProfile {
  id?: number;
  document_id: number;
  document_title: string;
  source_language?: string;
  target_language?: string;
  metadata: StylometricMetadata;
  features: StylometricFeatureVector;
  created_at?: string;
}

export interface StylometricMetadata {
  translator?: string;
  era?: string;
  domain?: string;
  translator_type?: 'human' | 'llm';
  llm_model?: string;
  notes?: string;
}

export interface PCAResult {
  components: number[][];       // each row = a PC, each col = feature weight
  explainedVariance: number[];  // percentage per component
  projected: number[][];        // each row = a document, each col = PC score
  totalVariance: number;
}

export interface ClusterResult {
  labels: number[];
  centroids: number[][];
  silhouetteScore: number;
}

export interface StylometricExperiment {
  id?: number;
  title: string;
  profile_ids: number[];
  pca?: PCAResult;
  clusters?: ClusterResult;
  created_at?: string;
}

export interface ProProfilerPageProps {
  profiles: StylometricProfile[];
  pca: PCAResult | null;
  clusters: ClusterResult | null;
  colorBy: string;
}
