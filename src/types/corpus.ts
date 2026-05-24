export interface AlignedDocument {
  id: number;
  title: string;
  source_language?: string;
  target_language?: string;
  project_title?: string;
  alignment_count: number;
  status: string;
}

export interface AlignedSegment {
  source_text: string;
  target_text: string;
  source_sentence_key: string;
  target_sentence_key: string;
  confidence?: number;
  strategy?: string;
}

export interface CorpusSkill {
  key: string;
  label: string;
  description: string;
  system_prompt: string;
  user_prompt_template: string;
}

export interface CorpusAnalysis {
  id?: number;
  document_ids: string;
  skill_key: string;
  skill_label: string;
  model_name: string;
  result: string;
  token_usage?: string;
  created_at?: string;
}
