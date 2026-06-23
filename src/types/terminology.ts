export interface TerminologyProject {
  id?: number;
  title: string;
  description?: string;
  source?: string;
  extractor?: string;
  reviewer?: string;
  status: 'draft' | 'extracted' | 'reviewed' | 'completed';
  document_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TerminologyProjectDocument {
  id?: number;
  project_id: number;
  document_id: number;
}

export interface TerminologyExtraction {
  id?: number;
  project_id?: number;
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
  verification_status?: 'unverified' | 'verified' | 'rejected';
  verified_by?: string;
  verified_at?: string;
  reviewer_notes?: string;
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

/** Document info returned for project document listing */
export interface ProjectDocumentInfo {
  id: number;
  title: string;
  source_language?: string;
  target_language?: string;
  status: string;
  project_title?: string;
  alignment_count?: number;
}
