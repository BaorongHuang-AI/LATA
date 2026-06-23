export interface TerminologyExtraction {
  id?: number;
  document_ids: string;           // JSON string of number[]
  model_name: string;
  token_usage?: string;           // JSON string
  result?: string;                // raw LLM JSON response
  created_at?: string;
}

export interface TerminologyTerm {
  id?: number;
  extraction_id: number;
  source_term: string;
  target_term: string;
  domain?: string;
  priority?: 'high' | 'medium' | 'low';
  context_source?: string;
  context_target?: string;
  variant_group?: string;
  is_llm_generated: number;        // 1 = from LLM, 0 = manually added
  created_at?: string;
  updated_at?: string;
}

export interface TerminologySkill {
  id: number;
  key: string;
  label: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
}

export interface TermEntry {
  source_term: string;
  target_term: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  context_source: string;
  context_target: string;
}
