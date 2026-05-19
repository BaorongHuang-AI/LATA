// src/types/alignment.ts
import {DocumentMetadata} from "../utils/AlignUtils";

export interface Line {
    id: string;
    lineNumber: string;
    text: string;
    comment?: string;
    isFavorite?: boolean;
}

export interface Link {
    id: string;
    source_sentence_keys?: string[];
    target_sentence_keys?: string[];
    sourceIds: string[];
    targetIds: string[];
    confidence: number;
    comment?: string;
    strategy?: string;
    isFavorite?: boolean;
}

export interface AlignmentMetadata {
    sourceTitle: string;
    targetTitle: string;
    sourceLang: string;
    targetLang: string;
    sourceAuthor?: string;
    translator?: string;
    strategyProfile?: string;
    sourceDoc: string;
    targetDoc: string;
}

export interface AppState {
    sourceLines?: Line[];
    targetLines?: Line[];
    links?: Link[];
    sourceMeta?: any,
    targetMeta?: any,
}

export interface FontSettings {
    sourceFontFamily: string;
    targetFontFamily: string;
    fontSize: number;
}

export type LinkingMode = 'manual' | 'click' | 'realign';

export interface PersistedAppState {
    sourceLines: Line[];
    targetLines: Line[];
    links: Link[];
    sourceMeta: DocumentMetadata | null;
    targetMeta: DocumentMetadata | null;
}

export interface ModelCredential {
    modelId: string;
    apiKey: string;
    baseUrl?: string; // OpenRouter / OpenAI / others
}

export interface LLMSettings {
    defaultModel: string;
    credentials: ModelCredential;
}

export interface ModelCredentialRow {
    model_id: string;
    api_key_enc: string;
    base_url: string;
}

// llmAlignmentTypes.ts

export type Sentence = {
    id: string;
    text: string;
};

export type Alignment = {
    sourceIds: string[];
    targetIds: string[];
    confidence: number;
    explanation?: string;
};

// export type AlignmentResult = {
//     sourceSentences: Sentence[];
//     targetSentences: Sentence[];
//     alignments: Alignment[];
//     strategy: "llm" | "gale-church";
// };
export interface SentenceRecord {
    id?: number;
    document_id: number;
    paragraph_id: number;
    side: 'source' | 'target';
    sentence_index: number;
    sentence_key: string;
    text: string;
    comment?: string;
    is_favorite?: number;
}


export interface SentenceRecord {
    id?: number;
    document_id: number;
    paragraph_id: number; // ID of the actual paragraph (source or target)
    side: 'source' | 'target';
    sentence_index: number;
    sentence_key: string;
    text: string;
    comment?: string;
    is_favorite?: number;
}

export interface AlignmentRecord {
    id?: number;
    document_id: number;
    source_paragraph_id: number;
    target_paragraph_id: number;
    source_sentence_keys: string; // JSON string
    target_sentence_keys: string; // JSON string
    confidence?: number;
    strategy: 'llm' | 'gale-church';
    comment?: string;
    is_favorite?: number;
}

export interface AlignmentPair {
    source: number[]; // indices in source sentences array
    target: number[]; // indices in target sentences array
    confidence?: number;
}

export interface AlignmentResult {
    sourceSentences: any [];
    targetSentences: any[];
    alignments: AlignmentPair[];
    strategy: 'llm' | 'gale-church';
}


export interface SentenceAlignmentStats {
    totalAlignments: number;
    oneToOne: number;
    oneToMany: number;
    manyToMany: number;
}
