export interface ConceptNode {
  id: string;
  label: string;
  language: 'source' | 'target';
  frequency: number;
  semanticField: string;
  group: string; // for coloring
}

export interface ConceptEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  label: string;
  weight: number;
  mappingType: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  dashed: boolean; // true for indirect/inferred mappings
}

export interface ConceptMapping {
  source_concept: string;
  target_concepts: string[];
  semantic_field: string;
  frequency: number;
  examples: Array<{
    source_sentence: string;
    target_sentence: string;
  }>;
  mapping_type: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
}

export interface SemanticNetworkData {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  summary: {
    total_concepts: number;
    total_mappings: number;
    source_unique_concepts: number;
    target_unique_concepts: number;
    avg_mappings_per_concept: number;
    dominant_semantic_fields: Array<{ field: string; count: number }>;
    one_to_one_ratio: number;
    one_to_many_ratio: number;
    many_to_one_ratio: number;
    many_to_many_ratio: number;
    ambiguity_index: number; // higher = more divergent mappings
  };
}

export interface SemanticNetworkExtraction {
  id?: number;
  document_ids: string;
  model_name: string;
  token_usage?: string;
  network_data: string; // JSON: SemanticNetworkData
  created_at?: string;
}
