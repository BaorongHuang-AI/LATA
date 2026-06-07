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
  id: number;
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

// ==================== Corpus Search ====================

export interface EnrichedAlignmentRow {
  alignment_id: number;
  document_id: number;
  document_title: string;
  project_title: string | null;
  source_sentence_keys: string;
  target_sentence_keys: string;
  confidence: number | null;
  strategy: string | null;
  source_language: string | null;
  target_language: string | null;
  source_domain: string | null;
  target_domain: string | null;
  source_authors: string | null;
  target_authors: string | null;
  source_keywords: string | null;
  target_keywords: string | null;
}

export interface CorpusSearchResult {
  alignmentId: number;
  documentId: number;
  documentTitle: string;
  projectTitle?: string;
  sourceText: string;
  targetText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  sourceDomain?: string;
  targetDomain?: string;
  sourceAuthors: string[];
  targetAuthors: string[];
  sourceKeywords: string[];
  targetKeywords: string[];
  confidence?: number;
  strategy?: string;
}

export interface CorpusSearchRequest {
  documentIds: number[];
  pattern: string;
  searchSource: boolean;
  searchTarget: boolean;
  filters: CorpusSearchFilters;
}

export interface CorpusSearchFilters {
  sourceLanguages: string[];
  targetLanguages: string[];
  domains: string[];
  authors: string[];
  keywords: string[];
}

export interface CorpusMetadataOptions {
  sourceLanguages: string[];
  targetLanguages: string[];
  domains: string[];
  authors: string[];
  keywords: string[];
}
