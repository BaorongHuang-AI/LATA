import { db } from "./db";

export interface MultimodalModelCredential {
    modelName: string;
    apiKey: string;
    baseUrl: string;
}

export function loadDefaultMultimodalModel(): MultimodalModelCredential {
    const models = db
        .prepare(`
            SELECT id, model_name, base_url, api_key, is_default
            FROM multimodal_llm_settings
            ORDER BY updated_at DESC
        `)
        .all() as any[];

    if (models.length === 0) {
        throw new Error("No multimodal LLM model configured. Go to Settings > LLMs > Multimodal LLMs tab.");
    }

    const defaultModel = models.find((m: any) => m.is_default === 1);
    if (!defaultModel) {
        throw new Error("No default multimodal LLM model set. Go to Settings > LLMs > Multimodal LLMs tab and set one as default.");
    }

    return {
        apiKey: defaultModel.api_key,
        baseUrl: defaultModel.base_url,
        modelName: defaultModel.model_name,
    };
}
