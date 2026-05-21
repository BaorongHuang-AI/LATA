import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

function logFilePath(): string {
    const dir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, "llm.log");
}

function timestamp(): string {
    return new Date().toISOString();
}

function safeStringify(obj: any): string {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

export function logLLMCall(params: {
    model: string;
    messages: any[];
    maxTokens: number;
    responseFormat?: string;
}): void {
    const entry = [
        `\n══════════ LLM REQUEST ${timestamp()} ══════════`,
        `Model: ${params.model}`,
        `MaxTokens: ${params.maxTokens}`,
        `ResponseFormat: ${params.responseFormat || "text"}`,
        `Messages (${params.messages.length}):`,
        ...params.messages.map((m, i) => `  [${i}] ${m.role}:\n${m.content}`),
        `═══════════════════════════════════════════════\n`,
    ].join("\n");

    fs.appendFileSync(logFilePath(), entry, "utf-8");
}

export function logLLMResponse(response: {
    content: string;
    model: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}): void {
    const entry = [
        `\n── LLM RESPONSE ${timestamp()} ──`,
        `Model: ${response.model}`,
        `Tokens — prompt: ${response.usage?.promptTokens ?? "?"}, completion: ${response.usage?.completionTokens ?? "?"}, total: ${response.usage?.totalTokens ?? "?"}`,
        `Content:`,
        response.content,
        `─────────────────────────────────────────────\n`,
    ].join("\n");

    fs.appendFileSync(logFilePath(), entry, "utf-8");
}

export function logLLMError(error: any, context?: string): void {
    const entry = [
        `\n!! LLM ERROR ${timestamp()} !!`,
        `Context: ${context || "none"}`,
        `Error: ${error?.message || error?.error?.message || String(error)}`,
        error?.stack ? `Stack: ${error.stack}` : "",
        error?.status ? `Status: ${error.status}` : "",
        error?.response ? `Response body: ${safeStringify(error.response)}` : "",
        `!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`,
    ].filter(Boolean).join("\n");

    fs.appendFileSync(logFilePath(), entry, "utf-8");
}
