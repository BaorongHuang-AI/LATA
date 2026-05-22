import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Button, Input, Tag, message, Spin, Tooltip } from "antd";
import { Copy, Play, Save, RotateCcw, Terminal, Zap } from "lucide-react";

const { TextArea } = Input;

// ── Default test values (matched by variable name extracted from the expression) ──
const DEFAULT_VAR_VALUES: Record<string, string> = {
    // mustache-style
    language: "English",
    sourceLanguage: "en",
    targetLanguage: "zh",
    paragraph: "This is a sample paragraph for testing prompt templates.",
    sourceSentences: '["This is the first sample sentence.", "This is the second sample sentence."]',
    targetSentences: '["这是第一个示例句子。", "这是第二个示例句子。"]',
    sourceParagraphs:
        "[0] This is a sample source paragraph.\n[1] This is another one.",
    targetParagraphs:
        "[0] 这是一个示例目标段落。\n[1] 这是另一个。",
    maxGroupSize: "3",
    sourceSentence: "This is a sample sentence for word alignment.",
    targetSentence: "这是一个用于词对齐的示例句子。",
    // template-literal style
    srcLang: "en",
    tgtLang: "zh",
    sourceParas:
        "[0] This is the first source paragraph.\n[1] This is the second source paragraph.",
    targetParas:
        "[0] 这是第一个目标段落。\n[1] 这是第二个目标段落。",
};

const TASK_TYPE_LABELS: Record<string, string> = {
    sentence_segmentation: "Sentence Segmentation",
    sentence_alignment: "Sentence Alignment",
    word_segmentation_alignment: "Word Segmentation & Alignment",
    parallel_alignment: "Parallel Alignment",
    paragraph_alignment: "Paragraph Alignment",
};

// ── Placeholder detection ────────────────────────────────────────────

interface PlaceholderInfo {
    raw: string; // the full match, e.g. "${srcLang}" or "{{sourceLanguage}}"
    inner: string; // content between the delimiters
    varName: string; // extracted variable name for the test field label
}

function detectPlaceholders(text: string): PlaceholderInfo[] {
    if (!text) return [];
    const seen = new Set<string>();
    const results: PlaceholderInfo[] = [];

    // 1) Mustache style  {{varName}}
    for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
        if (!seen.has(m[1])) {
            seen.add(m[1]);
            results.push({ raw: m[0], inner: m[1], varName: m[1] });
        }
    }

    // 2) Template-literal style  ${expression}
    //    Walk character-by-character to handle nested braces & backtick strings.
    let i = 0;
    while (i < text.length) {
        if (text[i] === "$" && text[i + 1] === "{") {
            let depth = 1;
            let j = i + 2;
            let inBacktick = false;
            while (j < text.length && depth > 0) {
                if (text[j] === "`") inBacktick = !inBacktick;
                if (!inBacktick) {
                    if (text[j] === "{") depth++;
                    if (text[j] === "}") depth--;
                }
                j++;
            }
            if (depth === 0) {
                const raw = text.substring(i, j);
                const inner = text.substring(i + 2, j - 1).trim();
                // Use the first identifier in the expression as the variable name
                const idMatch = inner.match(/^(\w+)/);
                const varName = idMatch ? idMatch[1] : "expr";
                if (!seen.has(varName)) {
                    seen.add(varName);
                    results.push({ raw, inner, varName });
                }
            }
            i = j;
        } else {
            i++;
        }
    }

    return results;
}

// ── Prompt filling (substitution) ────────────────────────────────────

function fillPrompt(
    text: string,
    placeholders: PlaceholderInfo[],
    vars: Record<string, string>
): string {
    if (!text) return "";
    let result = text;
    for (const ph of placeholders) {
        const val = vars[ph.varName] ?? "";
        // escape special regex chars in raw match, then replaceAll
        const escaped = ph.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), val);
    }
    return result;
}

// ── Highlight helper for TextArea preview (inline) ───────────────────

function highlightPrompt(text: string): React.ReactNode[] {
    if (!text) return [];
    // Split on either mustache or template-literal boundaries
    const re = /(\{\{\w+\}\}|\$\{[^}]*\})/g;
    const parts = text.split(re);
    return parts.map((part, i) => {
        if (part.match(/^\{\{/) || part.match(/^\$\{/)) {
            return (
                <span
                    key={i}
                    className="bg-amber-100 text-amber-800 px-1 rounded font-mono text-xs border border-amber-300 whitespace-nowrap"
                >
                    {part}
                </span>
            );
        }
        return (
            <span key={i} className="whitespace-pre-wrap">
                {part}
            </span>
        );
    });
}

// ── Component ────────────────────────────────────────────────────────

export default function PromptTuner() {
    const [prompts, setPrompts] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [systemPrompt, setSystemPrompt] = useState("");
    const [userPrompt, setUserPrompt] = useState("");
    const [promptName, setPromptName] = useState("");
    const [taskType, setTaskType] = useState("");
    const [testVariables, setTestVariables] = useState<
        Record<string, string>
    >({});
    const [llmResponse, setLlmResponse] = useState("");
    const [llmUsage, setLlmUsage] = useState<{
        promptTokens?: number;
        completionTokens?: number;
    } | null>(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        const data = await window.api.listPrompts();
        setPrompts(data);
    }

    const selectedPrompt = useMemo(
        () => prompts.find((p) => p.id === selectedId) || null,
        [prompts, selectedId]
    );

    const placeholders = useMemo(
        () => detectPlaceholders(userPrompt),
        [userPrompt]
    );

    const selectPrompt = useCallback((p: any) => {
        setSelectedId(p.id);
        setPromptName(p.name || "");
        setTaskType(p.task_type || "");
        setSystemPrompt(p.system_prompt || "");
        setUserPrompt(p.user_prompt || "");

        const raw = p.user_prompt || "";
        const phs = detectPlaceholders(raw);
        const vars: Record<string, string> = {};
        phs.forEach((ph) => {
            vars[ph.varName] = DEFAULT_VAR_VALUES[ph.varName] || "";
        });
        setTestVariables(vars);
        setLlmResponse("");
        setLlmUsage(null);
    }, []);

    function updateVariable(name: string, value: string) {
        setTestVariables((prev) => ({ ...prev, [name]: value }));
    }

    async function handleTest() {
        const system = systemPrompt;
        const user = fillPrompt(userPrompt, placeholders, testVariables);

        if (!user.trim()) {
            message.warning("User prompt is empty after filling variables.");
            return;
        }

        setTesting(true);
        setLlmResponse("");
        setLlmUsage(null);

        const messages: any[] = [];
        if (system.trim()) {
            messages.push({ role: "system", content: system });
        }
        messages.push({ role: "user", content: user });

        try {
            const res = await window.api.chatWithLLM({
                messages,
                temperature: 0.2,
                maxTokens: 4096,
                responseFormat: "json_object",
            });
            setLlmResponse(res.content);
            if (res.usage) {
                setLlmUsage({
                    promptTokens: res.usage.promptTokens,
                    completionTokens: res.usage.completionTokens,
                });
            }
        } catch (err: any) {
            const msg = (err?.message || String(err)).replace(/^\[api\] /, '');
            setLlmResponse(`Error: ${msg}`);
        } finally {
            setTesting(false);
        }
    }

    async function handleSave() {
        if (!selectedPrompt) return;
        setSaving(true);
        try {
            await window.api.updatePrompt(selectedPrompt.id, {
                systemPrompt,
                userPrompt,
            });
            message.success("Prompt saved to database.");
            await load();
        } catch (err: any) {
            message.error(`Save failed: ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    }

    function handleReset() {
        if (!selectedPrompt) return;
        setSystemPrompt(selectedPrompt.system_prompt || "");
        setUserPrompt(selectedPrompt.user_prompt || "");
        const raw = selectedPrompt.user_prompt || "";
        const phs = detectPlaceholders(raw);
        const vars: Record<string, string> = {};
        phs.forEach((ph) => {
            vars[ph.varName] = DEFAULT_VAR_VALUES[ph.varName] || "";
        });
        setTestVariables(vars);
        message.info("Reset to saved version.");
    }

    const grouped = useMemo(() => {
        const map: Record<string, any[]> = {};
        prompts.forEach((p) => {
            const key = p.task_type || "other";
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return map;
    }, [prompts]);

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Top bar */}
            <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
                <Zap size={20} className="text-amber-500" />
                <h1 className="text-lg font-bold text-gray-800">
                    Prompt Tuner
                </h1>
                <span className="text-xs text-gray-400 ml-2">
                    Test and iterate on LLM prompt templates
                </span>
            </div>

            {/* Three-panel body */}
            <div className="flex-1 flex min-h-0">
                {/* ============ LEFT: Prompt Selector ============ */}
                <div className="w-64 bg-white border-r overflow-y-auto shrink-0">
                    <div className="p-3 border-b bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Prompt Templates
                        </p>
                    </div>
                    {Object.entries(grouped).map(([type, items]) => (
                        <div key={type}>
                            <div className="px-3 py-1.5 bg-gray-100 text-xs text-gray-500 font-medium">
                                {TASK_TYPE_LABELS[type] || type}
                            </div>
                            {items.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => selectPrompt(p)}
                                    className={`w-full text-left px-4 py-2.5 border-b border-gray-100 hover:bg-blue-50 transition ${
                                        selectedId === p.id
                                            ? "bg-blue-50 border-l-2 border-l-blue-500"
                                            : ""
                                    }`}
                                >
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                        {p.name || "Unnamed"}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {p.id && `ID: ${p.id}`}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ))}
                    {prompts.length === 0 && (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            No prompts found
                        </div>
                    )}
                </div>

                {/* ============ CENTER: Editor + Variables ============ */}
                <div className="flex-1 flex flex-col min-w-0 border-r overflow-y-auto">
                    {!selectedPrompt ? (
                        <div className="flex items-center justify-center flex-1 text-gray-400">
                            <div className="text-center">
                                <Terminal
                                    size={48}
                                    className="mx-auto mb-3 opacity-30"
                                />
                                <p>Select a prompt template from the left panel</p>
                                <p className="text-sm mt-1">
                                    to start tuning and testing
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* Header info */}
                            <div className="flex items-center gap-3">
                                <Tag color="blue">
                                    {TASK_TYPE_LABELS[taskType] || taskType}
                                </Tag>
                                <span className="font-semibold text-gray-700">
                                    {promptName}
                                </span>
                                <div className="ml-auto flex gap-2">
                                    <Tooltip title="Reset to saved version">
                                        <Button
                                            size="small"
                                            icon={<RotateCcw size={14} />}
                                            onClick={handleReset}
                                        >
                                            Reset
                                        </Button>
                                    </Tooltip>
                                    <Button
                                        size="small"
                                        icon={<Save size={14} />}
                                        onClick={handleSave}
                                        loading={saving}
                                        style={{
                                            backgroundColor: "#1677ff",
                                            borderColor: "#1677ff",
                                            color: "#fff",
                                        }}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        System Prompt
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        (sent as-is)
                                    </span>
                                </div>
                                <TextArea
                                    rows={4}
                                    value={systemPrompt}
                                    onChange={(e) =>
                                        setSystemPrompt(e.target.value)
                                    }
                                    className="font-mono text-sm"
                                    style={{
                                        fontFamily: "ui-monospace, monospace",
                                    }}
                                />
                            </div>

                            {/* User Prompt */}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        User Prompt
                                    </span>
                                    {placeholders.length > 0 && (
                                        <span className="text-xs text-gray-400">
                                            {placeholders.length} placeholder
                                            {placeholders.length !== 1
                                                ? "s"
                                                : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    {/* Highlighted overlay for readability */}
                                    <div
                                        className="absolute inset-0 pointer-events-none p-3 overflow-hidden text-sm leading-relaxed z-10"
                                        style={{
                                            fontFamily:
                                                "ui-monospace, monospace",
                                            color: "transparent",
                                        }}
                                    >
                                        {highlightPrompt(userPrompt)}
                                    </div>
                                    <TextArea
                                        rows={10}
                                        value={userPrompt}
                                        onChange={(e) =>
                                            setUserPrompt(e.target.value)
                                        }
                                        className="font-mono text-sm relative z-0"
                                        style={{
                                            fontFamily: "ui-monospace, monospace",
                                            color: "#374151",
                                            caretColor: "#000",
                                            background: "transparent",
                                        }}
                                    />
                                </div>
                                {/* Detected placeholders as tags */}
                                {placeholders.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                                        <span className="text-xs text-gray-400 mr-1">
                                            Detected:
                                        </span>
                                        {placeholders.map((ph) => (
                                            <Tag
                                                key={ph.varName}
                                                color="gold"
                                                className="text-xs"
                                            >
                                                {ph.raw.length > 40
                                                    ? ph.raw.substring(0, 38) +
                                                      "…}"
                                                    : ph.raw}
                                            </Tag>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Test Variables */}
                            {placeholders.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Test Variables
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            (fill values to substitute into the
                                            prompt)
                                        </span>
                                    </div>
                                    <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
                                        {placeholders.map((ph) => (
                                            <div
                                                key={ph.varName}
                                                className="flex items-start gap-2"
                                            >
                                                <div className="shrink-0 mt-1 min-w-[120px]">
                                                    <Tag
                                                        color="gold"
                                                        className="text-xs"
                                                    >
                                                        {ph.raw.length > 30
                                                            ? ph.raw.substring(
                                                                  0,
                                                                  28
                                                              ) + "…}"
                                                            : ph.raw}
                                                    </Tag>
                                                </div>
                                                <TextArea
                                                    rows={
                                                        ph.varName.includes(
                                                            "Sent"
                                                        ) ||
                                                        ph.varName.includes(
                                                            "Para"
                                                        ) ||
                                                        ph.varName.includes(
                                                            "sourceParas"
                                                        ) ||
                                                        ph.varName.includes(
                                                            "targetParas"
                                                        )
                                                            ? 4
                                                            : 1
                                                    }
                                                    value={
                                                        testVariables[
                                                            ph.varName
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        updateVariable(
                                                            ph.varName,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="flex-1 font-mono text-sm"
                                                    style={{
                                                        fontFamily:
                                                            "ui-monospace, monospace",
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Test button */}
                            <Button
                                type="primary"
                                icon={<Play size={16} />}
                                onClick={handleTest}
                                loading={testing}
                                size="large"
                                block
                                style={{
                                    backgroundColor: "#1677ff",
                                    borderColor: "#1677ff",
                                    color: "#fff",
                                }}
                            >
                                {testing ? "Calling LLM..." : "Test Prompt"}
                            </Button>

                            {/* Prompt preview */}
                            {placeholders.length > 0 && (
                                <details className="bg-gray-50 rounded border p-3">
                                    <summary className="text-xs text-gray-500 cursor-pointer font-medium">
                                        Preview filled prompt
                                    </summary>
                                    <pre className="mt-2 text-xs font-mono whitespace-pre-wrap text-gray-700 max-h-64 overflow-y-auto">
                                        {fillPrompt(
                                            userPrompt,
                                            placeholders,
                                            testVariables
                                        )}
                                    </pre>
                                </details>
                            )}
                        </div>
                    )}
                </div>

                {/* ============ RIGHT: Response ============ */}
                <div className="w-96 bg-white flex flex-col shrink-0">
                    <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
                        <Terminal size={14} className="text-gray-500" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            LLM Response
                        </span>
                        {llmResponse && (
                            <Tooltip title="Copy to clipboard">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            llmResponse
                                        );
                                        message.success("Copied");
                                    }}
                                    className="ml-auto p-1 hover:bg-gray-200 rounded"
                                >
                                    <Copy
                                        size={14}
                                        className="text-gray-400"
                                    />
                                </button>
                            </Tooltip>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {testing ? (
                            <div className="flex items-center justify-center h-full">
                                <Spin tip="Waiting for LLM response..." />
                            </div>
                        ) : llmResponse ? (
                            <div>
                                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    {llmResponse}
                                </pre>
                                {llmUsage && (
                                    <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-gray-500">
                                        <span>
                                            Prompt:{" "}
                                            <strong>
                                                {llmUsage.promptTokens ?? "?"}
                                            </strong>{" "}
                                            tokens
                                        </span>
                                        <span>
                                            Completion:{" "}
                                            <strong>
                                                {llmUsage.completionTokens ??
                                                    "?"}
                                            </strong>{" "}
                                            tokens
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : selectedPrompt ? (
                            <div className="flex items-center justify-center h-full text-gray-400 text-center">
                                <div>
                                    <Play
                                        size={32}
                                        className="mx-auto mb-2 opacity-30"
                                    />
                                    <p className="text-sm">
                                        Click "Test Prompt" to send
                                    </p>
                                    <p className="text-xs mt-1">
                                        to the LLM and see the response here
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-300 text-center text-sm">
                                Select a prompt to get started
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
