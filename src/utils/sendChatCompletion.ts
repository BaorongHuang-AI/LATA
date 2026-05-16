import OpenAI from "openai";
import {loadCredential, loadDefaultModel} from "../db/llmSettings";
import {ChatRequest, ChatResponse} from "../types/llminterfaces";


export async function sendChatCompletion(
    req: ChatRequest
): Promise<ChatResponse> {
    const {
        messages,
        temperature = 0.3,
        maxTokens = 20000,
        responseFormat,
    } = req;

    const cred = loadDefaultModel();
    console.log(cred);
    const client = new OpenAI({
        apiKey: cred.apiKey,
        baseURL: cred.baseUrl,
    });

    try {
        const params: any = {
            model: cred.modelName as string,
            messages: messages as any,
            temperature: temperature,
            max_tokens: maxTokens,
        };

        if (responseFormat === 'json_object') {
            params.response_format = { type: 'json_object' as const };
        }

        const result = await client.chat.completions.create(params);
        console.log(result);

        const choice = result.choices[0];

        if (!choice?.message?.content) {
            throw new Error("Empty response from model");
        }

        return {
            content: choice.message.content,
            model: result.model,
            usage: {
                promptTokens: result.usage?.prompt_tokens,
                completionTokens: result.usage?.completion_tokens,
                totalTokens: result.usage?.total_tokens,
            },
        };
    } catch (err: any) {
        throw new Error(normalizeChatError(err));
    }
}

function normalizeChatError(err: any): string {
    const msg =
        err?.error?.message ||
        err?.message ||
        "Unknown error";

    if (msg.includes("401")) {
        return "Invalid API key";
    }
    if (msg.includes("quota") || msg.includes("billing")) {
        return "API quota exceeded";
    }
    if (msg.includes("model") && msg.includes("not found")) {
        return "Model not available";
    }
    if (msg.includes("timeout")) {
        return "Request timed out";
    }

    return msg;
}
