import {RTL_LANGS} from "./Constants";
import {RawParagraph} from "../types/database";
import {AlignmentResult, Sentence} from "../types/alignment";
import {PromptEntity} from "../types/prompt";
// import {listPrompts} from "../db/promptService";

export interface DocumentMetadata {
    title?: string;
    source?: string;
    language: string;
    domain?: string;
    publishDate?: string;
    publisher?: string;
}

export function validateMetadata(meta: DocumentMetadata | undefined, name: string) {
    // console.log("validate", meta, name);
    const errors: string[] = [];

    if (!meta) {
        errors.push(`${name} metadata is missing`);
        return errors;
    }

    if (!meta.title || meta.title.trim() === "") {
        errors.push(`${name}: Title is required`);
    }

    if (!meta.source || meta.source.trim() === "") {
        errors.push(`${name}: Source is required`);
    }

    if (!meta.language || meta.language.trim() === "") {
        errors.push(`${name}: Language is required`);
    }

    if (!meta.domain || meta.domain.trim() === "") {
        errors.push(`${name}: Domain is required`);
    }

    return errors;
}

export const isRTL = (lang?: string) =>
    !!lang && RTL_LANGS.indexOf(lang) !== -1;

export function splitIntoParagraphs(text: string): RawParagraph[] {
    if (!text) return [];

    return text
        .replace(/\r\n/g, "\n")
        .split(/\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map((text, i) => ({
            id: `p${i + 1}`,
            index: i + 1,
            text,
        }));
}

export function buildSplitPrompt(
    paragraph: string,
    language: string
) {
    return {
        system: `
You are a professional text segmentation engine.
Split a paragraph into sentences.
Do not translate. Do not normalize.
Return ONLY valid JSON.
If unsure, return {}.
        `.trim(),

        user: `
Language: ${language}

Paragraph:
"""
${paragraph}
"""

Output JSON:
{
  "sentences": [
    { "id": "s1", "text": "..." }
  ]
}
        `.trim(),
    };
}

export async  function buildSplitPromptFromDB(
    paragraph: string,
    language: string,
    prompts: any[],
) {
    // 1️⃣ Query the DB for the sentence_segmentation prompt
    // const prompts: any[]  =  listPrompts();
    let  template = prompts.find(p => p.task_type === "sentence_segmentation");
    if(prompts.length == 1 || (prompts.length > 1 && !template)){
        template = prompts[0];
    }
    // Find the task_type template


    if (!template) {
        throw new Error(
            "No sentence_segmentation template found. Please create one in Prompt Manager."
        );
    }

    const userPrompt = template.user_prompt
        ? template.user_prompt
            .replace(/\{\{language\}\}/g, language)
            .replace(/\{\{paragraph\}\}/g, paragraph)
        : `
            Language: ${language}
            
            Paragraph:
            """
            ${paragraph}
            """
            
            Output JSON:
            {
              "sentences": [
                { "id": "s1", "text": "..." }
              ]
            }
        `;

    return {
        system: template.system_prompt,
        user: userPrompt,
    };
}

export function buildAlignmentPrompt(
    srcLang: string,
    tgtLang: string,
    source: Sentence[],
    target: Sentence[]
) {
    return {
        system: `
You are a professional bilingual sentence alignment engine.
Align sentences by meaning.
One-to-many and many-to-one are allowed.
Return ONLY valid JSON.
If unsure, return {}.
        `.trim(),

        user: `
Source language: ${srcLang}
Target language: ${tgtLang}

Source sentences:
${JSON.stringify(source, null, 2)}

Target sentences:
${JSON.stringify(target, null, 2)}

Output JSON:
{
  "alignments": [
    {
      "sourceIds": ["s1"],
      "targetIds": ["t1"],
      "confidence": 0.0,
      "explanation": "..."
    }
  ]
}
        `.trim(),
    };
}


function normalize(text: string) {
    return text?.trim().replace(/\s+/g, " ");
}

/**
 * Build alignment prompt (sentence OR paragraph)
 */
export async function buildAlignmentPromptFromDB(
    srcLang: string,
    tgtLang: string,
    source: any[],
    target: any[],
    prompts: any[],
    options?: {
        taskType?: "sentence_alignment" | "paragraph_alignment";
        maxGroupSize?: number;
    }
) {
    const taskType = options?.taskType || "sentence_alignment";
    const maxGroupSize = options?.maxGroupSize || 3;

    /* --------------------------------
       1️⃣ Find template
    --------------------------------- */
    let template = prompts.find(p => p.task_type === taskType);

    if (!template) {
        template = prompts.find(p => p.task_type === "default_alignment");
    }

    if (!template && prompts.length > 0) {
        template = prompts[0];
    }

    if (!template) {
        throw new Error(
            `No prompt template found for ${taskType}. Please configure Prompt Manager.`
        );
    }

    /* --------------------------------
       2️⃣ Normalize input (VERY IMPORTANT for cache)
    --------------------------------- */
    const normalizedSource = source.map((s, i) => ({
        id: s.id ?? i,
        text: normalize(s.text || s)
    }));

    const normalizedTarget = target.map((t, i) => ({
        id: t.id ?? i,
        text: normalize(t.text || t)
    }));

    /* --------------------------------
       3️⃣ Structured text (LLM-friendly)
    --------------------------------- */
    const sourceText = normalizedSource
        .map((s, i) => `[${i}] ${s.text}`)
        .join("\n");

    const targetText = normalizedTarget
        .map((t, i) => `[${i}] ${t.text}`)
        .join("\n");

    /* --------------------------------
       4️⃣ Build system prompt (fallback if missing)
    --------------------------------- */
    let systemPrompt = template.system_prompt;

    if (!systemPrompt) {
        systemPrompt = `
You are an expert bilingual alignment engine.

Task:
Align ${taskType.includes("sentence") ? "sentences" : "paragraphs"} between two texts.

Rules:
- Use semantic meaning, not position
- Prefer monotonic alignment (preserve order)
- Avoid crossing alignments
- Max ${maxGroupSize} segments per group

Coverage:
- Every source must be aligned
- Every target must be aligned

Output JSON ONLY:
{
  "alignments": [
    {
      "sourceIds": number[],
      "targetIds": number[],
      "confidence": number,
      "explanation": string
    }
  ]
}
        `.trim();
    }

    /* --------------------------------
       5️⃣ Build user prompt
    --------------------------------- */
    let userPrompt = template.user_prompt;

    if (userPrompt) {
        userPrompt = userPrompt
            .replace(/\{\{sourceLanguage\}\}/g, srcLang)
            .replace(/\{\{targetLanguage\}\}/g, tgtLang)
            .replace(/\{\{sourceSentences\}\}/g, JSON.stringify(normalizedSource, null, 2))
            .replace(/\{\{targetSentences\}\}/g, JSON.stringify(normalizedTarget, null, 2))
            .replace(/\{\{sourceParagraphs\}\}/g, sourceText)
            .replace(/\{\{targetParagraphs\}\}/g, targetText)
            .replace(/\{\{maxGroupSize\}\}/g, String(maxGroupSize));
    } else {
        userPrompt = `
Source (${srcLang}):
${sourceText}

Target (${tgtLang}):
${targetText}

Return JSON only.
        `.trim();
    }

    /* --------------------------------
       6️⃣ Deterministic hash (for caching/debug)
    --------------------------------- */
    const promptHash = "";
    // const promptHash = crypto
    //     .createHash("sha256")
    //     .update(systemPrompt + userPrompt)
    //     .digest("hex");

    return {
        system: systemPrompt,
        user: userPrompt,
        // meta: {
        //     taskType,
        //     promptHash,
        //     sourceCount: normalizedSource.length,
        //     targetCount: normalizedTarget.length
        // }
    };
}
//
// export async  function buildAlignmentPromptFromDB(
//     srcLang: string,
//     tgtLang: string,
//     source: Sentence[],
//     target: Sentence[],
//     prompts: any[],
// ) {
//     // 1️⃣ Query the DB for the parallel_alignment prompt template
//     // const prompts: any[] = listPrompts();
//     let template = prompts.find(p => p.task_type === "sentence_alignment");
//     if(prompts.length == 1 || (prompts.length > 1 && !template)){
//         template = prompts[0];
//     }
//     if (!template) {
//         throw new Error(
//             "No parallel_alignment template found. Please create one in Prompt Manager."
//         );
//     }
//
//     // 2️⃣ Fill in the user prompt template
//     let userPrompt = template.user_prompt;
//     if (userPrompt) {
//         userPrompt = userPrompt
//             .replace(/\{\{sourceLanguage\}\}/g, srcLang)
//             .replace(/\{\{targetLanguage\}\}/g, tgtLang)
//             .replace(/\{\{sourceSentences\}\}/g, JSON.stringify(source, null, 2))
//             .replace(/\{\{targetSentences\}\}/g, JSON.stringify(target, null, 2));
//     } else {
//         userPrompt = `
//             Source language: ${srcLang}
//             Target language: ${tgtLang}
//
//             Source sentences:
//             ${JSON.stringify(source, null, 2)}
//
//             Target sentences:
//             ${JSON.stringify(target, null, 2)}
//
//             Output JSON:
//             {
//               "alignments": [
//                 {
//                   "sourceIds": ["s1"],
//                   "targetIds": ["t1"],
//                   "confidence": 0.0,
//                   "explanation": "..."
//                 }
//               ]
//             }
//         `.trim();
//             }
//
//     return {
//         system: template.system_prompt,
//         user: userPrompt,
//     };
// }

export async function llmCallWithRetry<T>(
    fn: () => Promise<string>,
    maxRetries = 2
): Promise<any | null> {
    let lastApiError: string | null = null;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const raw = await fn();
            const parsed = JSON.parse(raw);
            if (parsed && Object.keys(parsed).length > 0) {
                return parsed as T;
            }
            console.warn(`llmCallWithRetry: empty JSON object on attempt ${i + 1}/${maxRetries + 1}`);
        } catch (e: any) {
            // Distinguish API errors (fn threw) from JSON parse errors (fn succeeded, parse failed)
            if (e?.message?.includes("[api]")) {
                lastApiError = e.message;
                console.warn(`llmCallWithRetry: API error on attempt ${i + 1}/${maxRetries + 1}: ${lastApiError}`);
            } else {
                console.warn(`llmCallWithRetry: JSON parse failed on attempt ${i + 1}/${maxRetries + 1}`, e?.message);
            }
        }
    }
    const errMsg = lastApiError
        ? `LLM API error: ${lastApiError}`
        : `all ${maxRetries + 1} attempts failed (JSON parse or empty response)`;
    console.error(`llmCallWithRetry: ${errMsg}`);
    return null;
}
