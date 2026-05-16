import OpenAI from "openai";

export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export interface ChatRequest {
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object' | 'text';
}

export interface ChatResponse {
    content: string;
    model: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

export type LLMRow = {
    id: string;
    base_url: string;
    model_name: string;
    api_key: string;
    is_default: number;
}
