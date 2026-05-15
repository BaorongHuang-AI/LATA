// Project types and interfaces

export interface Project {
    id?: number;
    created_at?: string;
    updated_at?: string;
    title: string;
    description?: string;
    status?: 'active' | 'archived' | 'completed';
}

export interface ProjectMetadata {
    id?: number;
    project_id: number;

    // Publication Info
    source?: string;
    publisher?: string;
    publish_date?: string;

    // Language & Domain
    source_language?: string;
    target_language?: string;
    domain?: string;
    document_type?: string;

    // People (JSON arrays)
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

export interface ProjectWithMetadata extends Project {
    metadata?: ProjectMetadata;
    document_count?: number;
}

export interface ProjectDocument {
    id: number;
    title: string;
    source_language?: string;
    target_language?: string;
    status: string;
    one_to_one?: number;
    one_to_many?: number;
    many_to_one?: number;
    many_to_many?: number;
    updated_at?: string;
}