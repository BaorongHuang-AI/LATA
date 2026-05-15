// src/types/database.ts

export interface Document {
    id?: number;
    created_at?: string;
    updated_at?: string;
    title: string;
    document_type?: string;
    version?: string;
    source_content?: string;
    target_content?: string;
    status?: 'draft' | 'in_progress' | 'completed' | 'archived';
    project_id?: number | null;
}

export interface DocumentMetadata {
    id?: number;
    document_id: number;
    metadata_type: 'source' | 'target';

    // Publication Info
    title?: string;
    source?: string;
    publisher?: string;
    publish_date?: string;

    // Language & Domain
    language?: string;
    original_language?: string;
    domain?: string;

    // People (will be JSON stringified)
    authors?: string[];
    translators?: string[];
    editors?: string[];
    contributors?: string[];

    // Academic/Publication
    doi?: string;
    isbn?: string;
    volume?: string;
    issue?: string;
    page_range?: string;
    edition?: string;

    // Source & Links
    url?: string;
    country?: string;

    // Rights & Legal
    copyright_holder?: string;
    license?: string;
    access_level?: string;

    // Other
    keywords?: string[];
    notes?: string;

    created_at?: string;
    updated_at?: string;
}

export interface DocumentFile {
    id?: number;
    document_id: number;
    file_name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    created_at?: string;
}

export interface DocumentWithMetadata extends Document {
    source_metadata?: DocumentMetadata;
    target_metadata?: DocumentMetadata;
    files?: DocumentFile[];
}

export interface DocumentWithMeta {
    document: {
        id: number;
        source_content: string;
        target_content: string;
    };
    sourceMeta: DocumentMetadata | null;
    targetMeta: DocumentMetadata | null;
}

export interface DocumentMeta {
    title: string;
    source: string;
    publishDate?: string;
    publisher?: string;
    language: string;
    domain: string;
    [key: string]: any;
}

export interface SourcePara {
    id: string;              // p1, p2...
    paraNumber: string;      // p1
    text: string;
    isFavorite: boolean;
}

export interface TargetPara {
    id: string;              // tp1, tp2...
    paraNumber: string;      // p1 (mapped)
    text: string;
    isFavorite: boolean;
}

export interface ParaLink {
    id: string;
    sourceParaIds: string[]; // many-to-one supported
    targetParaIds: string[];
    confidence: number;
    strategy?: string;
    status: "pending" | "aligned" | "review";
    isFavorite: boolean;
}
export interface Sentence {
    id: string;        // s1, s2...
    paraId: string;    // parent paragraph
    text: string;
}

export interface SentenceLink {
    id: string;
    sourceSentenceIds: string[];
    targetSentenceIds: string[];
    confidence: number;
    strategy?: string;
}

export interface RawParagraph {
    id: string;        // p1, p2...
    index: number;     // 1-based
    text: string;
}

export interface ParaLinkInput {
    sourceParaIds: string[];
    targetParaIds: string[];
    confidence: number;
    strategy?: string;
    status?: "pending" | "aligned" | "review";
}
export interface ParaAlignment {
    id: number;
    sourceParaIds: number[];
    targetParaIds: number[];
    confidence: number;
    strategy?: string;
    status: "pending" | "aligned" | "review";
}


export interface AlignedTextItem {
    id: string;
    lineNumber: string;
    text: string;
    isFavorite: boolean;
}

export interface AlignmentLink {
    id: string;
    sourceIds: string[];
    targetIds: string[];
    confidence: number;
    strategy?: string;
    isFavorite: boolean;
}


export interface AppState {
    sourceParas: AlignedTextItem[];
    targetParas: AlignedTextItem[];
    links: AlignmentLink[];
}