import OpenAI from "openai";
import {loadDefaultModel} from "../db/llmSettings";
import {ChatRequest, ChatResponse} from "../types/llminterfaces";
import { logLLMCall, logLLMResponse, logLLMError } from "./llmLogger";



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
    console.log("llm config", cred);

    let client = new OpenAI({
            apiKey: cred.apiKey,
            baseURL: cred.baseUrl,
        }
    )


    if(false) {
        client = new OpenAI({
            apiKey: cred.apiKey,
            baseURL: cred.baseUrl,
        });
    }

    try {
        const params: any = {
            model: cred.modelName as string,
            messages: messages as any,
            max_completion_tokens: maxTokens,
        };

        if (responseFormat === 'json_object') {
            params.response_format = { type: 'json_object' as const };
        }

        logLLMCall({
            model: cred.modelName as string,
            messages: messages as any[],
            maxTokens,
            responseFormat,
        });

        const result = await client.chat.completions.create(params);
        console.log("LLM result", JSON.stringify({
            model: result.model,
            id: result.id,
            finishReason: result.choices?.[0]?.finish_reason,
            usage: result.usage,
            completionTokensDetails: (result.choices?.[0] as any)?.completion_tokens_details,
        }, null, 2));

        const choice = result.choices[0];
        const finishReason = choice?.finish_reason;

        if (!choice?.message?.content) {
            // Build a detailed error message to help debug empty responses
            const details: string[] = [];
            if (finishReason) details.push(`finish_reason=${finishReason}`);
            if (result.usage) {
                details.push(
                    `prompt_tokens=${result.usage.prompt_tokens}`,
                    `completion_tokens=${result.usage.completion_tokens}`,
                    `total_tokens=${result.usage.total_tokens}`,
                );
            }
            // Check for reasoning tokens (some models split reasoning vs text tokens)
            const compDetails = (choice as any)?.completion_tokens_details;
            if (compDetails) {
                if (compDetails.reasoning_tokens != null) {
                    details.push(`reasoning_tokens=${compDetails.reasoning_tokens}`);
                }
                if (compDetails.text_tokens != null) {
                    details.push(`text_tokens=${compDetails.text_tokens}`);
                }
            }
            const detailStr = details.length > 0 ? ` (${details.join(', ')})` : '';
            throw new Error(
                `Empty response from model${detailStr}. ` +
                `The model may have run out of tokens before producing content. ` +
                `Total tokens requested: ${maxTokens}. ` +
                (compDetails?.reasoning_tokens
                    ? `Reasoning tokens consumed: ${compDetails.reasoning_tokens}. ` +
                      `Increase maxTokens above ${maxTokens} so there is room for text output after reasoning.`
                    : `Try increasing maxTokens (currently ${maxTokens}) or reducing prompt size.`)
            );
        }

        logLLMResponse({
            content: choice.message.content,
            model: result.model,
            usage: {
                promptTokens: result.usage?.prompt_tokens,
                completionTokens: result.usage?.completion_tokens,
                totalTokens: result.usage?.total_tokens,
            },
        });

        // Log reasoning token breakdown if available
        if ((choice as any)?.completion_tokens_details) {
            const det = (choice as any).completion_tokens_details;
            console.log("Token breakdown:", JSON.stringify(det));
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
        logLLMError(err, `model=${cred?.modelName}, baseURL=${cred?.baseUrl}`);
        throw new Error(`[api] ${normalizeChatError(err)}`);
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
