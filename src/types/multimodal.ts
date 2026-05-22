export interface MultimodalPair {
    id?: number;
    title: string;
    description?: string;
    source_image_path: string;
    source_image_name?: string;
    source_language?: string;
    source_description?: string;
    source_text_content?: string;
    target_image_path: string;
    target_image_name?: string;
    target_language?: string;
    target_description?: string;
    target_text_content?: string;
    domain?: string;
    context_notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface MultimodalAnalysis {
    id?: number;
    pair_id: number;
    analysis_type: 'description' | 'text_extraction' | 'comparison' | 'discourse_analysis' | 'custom';
    model_name?: string;
    prompt?: string;
    result?: string;
    created_at?: string;
}

export interface MultimodalLLMRow {
    id: string;
    model_name: string;
    base_url: string;
    api_key: string;
    is_default: number;
}
