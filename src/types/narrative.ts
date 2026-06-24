export interface NarrativeAnalysis {
  id?: number;
  document_id: number;
  document_title: string;
  model_name: string;
  source_language?: string;
  target_language?: string;
  // Core narrative data (stored as JSON)
  data: NarrativeData;
  created_at?: string;
}

export interface NarrativeData {
  // Emotional arc: sentiment scores over narrative segments
  emotional_arc: Array<{
    segment: number;          // 1-10 (equal narrative divisions)
    label: string;            // e.g., "Ch.1 Opening"
    source_sentiment: number; // -1 to +1
    target_sentiment: number; // -1 to +1
  }>;

  // Character network
  characters: Array<{
    name: string;
    role: string;             // protagonist, antagonist, supporting, minor
    mentions_source: number;
    mentions_target: number;
  }>;
  character_interactions: Array<{
    source: string;           // character name
    target: string;           // character name
    weight: number;           // interaction frequency
    relationship: string;     // allies, adversaries, family, romantic, neutral
  }>;

  // Narrative structure (timeline)
  structure: Array<{
    segment: number;
    mode: string;             // dialogue, description, action, reflection, exposition
    source_density: number;   // % of segment in this mode (source)
    target_density: number;   // % of segment in this mode (target)
  }>;

  // Narrative voice metrics
  voice: {
    point_of_view: string;           // first_person, third_person_limited, third_person_omniscient
    narrator_intrusion_source: number; // narrator commentary density (source)
    narrator_intrusion_target: number;
    free_indirect_discourse_source: number;
    free_indirect_discourse_target: number;
  };

  // Temporal structure
  temporal: {
    is_linear: boolean;
    flashback_count_source: number;
    flashback_count_target: number;
    time_compression_ratio: number;  // narrative time / story time
  };

  // Summary
  summary: {
    total_segments: number;
    character_count: number;
    dialogue_ratio_source: number;
    dialogue_ratio_target: number;
    emotional_range_source: number;   // max - min sentiment
    emotional_range_target: number;
    emotional_correlation: number;    // Pearson r between source and target arcs
    narrative_pace_source: string;    // fast / moderate / slow
    narrative_pace_target: string;
  };
}

export interface NarrativeComparison {
  source_id: number;
  target_id: number;
  comparison_id?: number;
  emotional_correlation: number;
  character_preservation: number;     // % characters preserved
  structure_similarity: number;       // cosine similarity of mode distributions
  voice_shifts: string[];            // notable shifts in narrative voice
  key_divergences: string[];         // significant differences
}
