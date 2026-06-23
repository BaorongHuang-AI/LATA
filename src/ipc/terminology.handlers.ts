import { ipcMain } from "electron";
import terminologyService from "../db/terminologyService";
import corpusService from "../db/corpusService";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";
import type { TermEntry, TerminologyTerm } from "../types/terminology";

function serializeSegments(segments: Array<{ source_text: string; target_text: string }>, maxSegments = 200): string {
  const limited = segments.slice(0, maxSegments);
  return limited
    .map((seg, i) => `[${i + 1}] SRC: ${seg.source_text}\n[${i + 1}] TGT: ${seg.target_text}`)
    .join("\n\n");
}

/**
 * Try to extract a JSON object/array from a string that may be wrapped in
 * markdown code fences, have extra text before/after, or contain trailing commas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(raw: string): any {
  // 1. Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Direct parse failed — try extraction methods below
  }

  // 2. Try to find JSON inside ```json ... ``` code fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // JSON in fence was malformed — try next method
    }
  }

  // 3. Try to find the outermost { ... } or [ ... ]
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // Object extraction failed — try array next
    }
  }

  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      // Array extraction failed — try last resort
    }
  }

  // 4. Last resort: try removing trailing commas and parse
  try {
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    const objM = cleaned.match(/\{[\s\S]*\}/);
    if (objM) return JSON.parse(objM[0]);
  } catch {
    // All extraction methods failed
  }

  throw new Error("Could not extract valid JSON from LLM response");
}

// ==================== Skills ====================

ipcMain.handle("terminology:getSkills", async () => {
  return terminologyService.getSkills();
});

ipcMain.handle("terminology:saveSkill", async (_, skill: { name: string; system_prompt: string; user_prompt_template: string }) => {
  return terminologyService.saveSkill(skill);
});

ipcMain.handle("terminology:updateSkill", async (_, id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }) => {
  terminologyService.updateSkill(id, skill);
});

ipcMain.handle("terminology:deleteSkill", async (_, id: number) => {
  terminologyService.deleteSkill(id);
});

// ==================== Extractions ====================

ipcMain.handle("terminology:getExtractions", async () => {
  return terminologyService.getExtractions();
});

ipcMain.handle("terminology:getTerms", async (_, extractionId: number) => {
  return terminologyService.getTerms(extractionId);
});

ipcMain.handle("terminology:addTerm", async (_, extractionId: number, term: {
  source_term: string;
  target_term: string;
  domain?: string;
  priority?: 'high' | 'medium' | 'low';
  context_source?: string;
  context_target?: string;
}) => {
  return terminologyService.addManualTerm(extractionId, term);
});

ipcMain.handle("terminology:updateTerm", async (_, id: number, data: Partial<TerminologyTerm>) => {
  terminologyService.updateTerm(id, data);
});

ipcMain.handle("terminology:deleteTerm", async (_, id: number) => {
  terminologyService.deleteTerm(id);
});

// ==================== Run Extraction ====================

ipcMain.handle("terminology:runExtraction", async (_, payload: {
  documentIds: number[];
  skillKey?: string;
  customPrompt?: string;
}) => {
  const { documentIds, skillKey, customPrompt } = payload;

  // Collect debug info throughout the handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debug: Record<string, any> = {
    timestamp: new Date().toISOString(),
    documentIds,
    skillKey,
    phases: {},
  };

  // ---- Phase 1: Load skills ----
  let skill: ReturnType<typeof terminologyService.getSkills>[0];
  try {
    const skills = terminologyService.getSkills();
    debug.phases.loadSkills = { skillCount: skills.length, skillNames: skills.map(s => s.key) };

    if (skills.length === 0) {
      throw new Error("No terminology extraction skills found. Please create one first.");
    }

    if (skillKey) {
      const found = skills.find((s) => s.key === skillKey);
      if (!found) {
        // If the requested skill doesn't exist, fall back to the first one
        skill = skills[0];
        debug.phases.loadSkills.warning = `Skill "${skillKey}" not found, using default: "${skill.key}"`;
      } else {
        skill = found;
      }
    } else {
      skill = skills[0];
    }
    debug.phases.loadSkills.selectedSkill = skill.key;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.message?.includes("No terminology extraction")) throw e;
    debug.phases.loadSkills.error = e.message;
    throw new Error(`Failed to load skills: ${e.message}`);
  }

  // ---- Phase 2: Get aligned segments ----
  let segments: ReturnType<typeof corpusService.getAlignedSegments>;
  try {
    segments = corpusService.getAlignedSegments(documentIds);
    debug.phases.getSegments = {
      documentCount: documentIds.length,
      segmentCount: segments.length,
    };
    if (segments.length === 0) {
      throw new Error("No aligned segments found in the selected documents");
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    debug.phases.getSegments = { error: e.message };
    throw e;
  }

  // ---- Phase 3: Build prompts ----
  const segmentsStr = serializeSegments(segments);
  const truncated = segments.length > 200;

  const systemPrompt = skill.system_prompt;
  let userPrompt: string;
  if (skill.key === "Custom Extraction" && customPrompt) {
    userPrompt = skill.user_prompt_template
      .replace("{{custom_prompt}}", customPrompt)
      .replace("{{segments}}", segmentsStr);
  } else {
    userPrompt = skill.user_prompt_template.replace("{{segments}}", segmentsStr);
  }

  // Estimate token count (rough: ~4 chars per token for English, ~2 for CJK)
  const promptCharCount = systemPrompt.length + userPrompt.length;
  const estimatedPromptTokens = Math.ceil(promptCharCount / 3);

  debug.phases.buildPrompt = {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    estimatedPromptTokens,
    truncated,
    segmentCountSent: Math.min(segments.length, 200),
  };

  // ---- Phase 4: LLM call ----
  // Use 16384 maxTokens to leave room for reasoning models (qwen3, deepseek-r1, etc.)
  // that consume tokens for internal reasoning before producing text output.
  const MAX_TOKENS = 16384;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let response: Awaited<ReturnType<typeof sendChatCompletion>>;
  try {
    response = await sendChatCompletion({
      messages,
      temperature: 0.3,
      maxTokens: MAX_TOKENS,
      responseFormat: 'json_object',
    });
    debug.phases.llmCall = {
      model: response.model,
      usage: response.usage,
      contentLength: response.content?.length || 0,
      contentPreview: response.content?.slice(0, 500) || "(empty)",
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    debug.phases.llmCall = {
      error: e.message,
      model: "(failed before response)",
    };
    // Re-throw with debug context appended
    const debugSummary = JSON.stringify(debug, null, 2);
    throw new Error(`${e.message}\n\n[DEBUG INFO]\n${debugSummary}`);
  }

  // ---- Phase 5: Parse LLM response ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = extractJSON(response.content);
    debug.phases.parseJSON = {
      method: "success",
      topLevelKeys: Object.keys(parsed),
      hasTermsArray: !!(parsed.terms && Array.isArray(parsed.terms)),
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (parseErr: any) {
    debug.phases.parseJSON = {
      error: parseErr.message,
      rawResponsePreview: response.content.slice(0, 1000),
      rawResponseLength: response.content.length,
    };
    // Save the raw response so the user can inspect it
    const extractionId = terminologyService.saveExtraction(
      documentIds,
      response.model,
      response.content,
      response.usage ? JSON.stringify(response.usage) : null,
    );
    debug.extractionSavedWithRawResponse = { extractionId };
    const debugSummary = JSON.stringify({ debug, rawResponse: response.content }, null, 2);
    throw new Error(
      `Failed to parse LLM response as JSON. The extraction was saved with the raw response (ID: ${extractionId}) so you can inspect it.\n\n` +
      `Parse error: ${parseErr.message}\n\n` +
      `Raw response (first 500 chars):\n${response.content.slice(0, 500)}\n\n` +
      `[FULL DEBUG]\n${debugSummary}`
    );
  }

  // ---- Phase 6: Extract and validate terms ----
  let terms: TermEntry[] = [];

  // The LLM might return { terms: [...] } or a flat array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawTerms: any[];
  if (parsed.terms && Array.isArray(parsed.terms)) {
    rawTerms = parsed.terms;
  } else if (Array.isArray(parsed)) {
    rawTerms = parsed;
  } else {
    // Try to find any array in the parsed object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrays = Object.values(parsed).filter((v: any) => Array.isArray(v));
    if (arrays.length > 0) {
      rawTerms = arrays[0] as any[];
    } else {
      debug.phases.extractTerms = {
        error: "No array found in parsed response",
        parsedKeys: Object.keys(parsed),
        parsedPreview: JSON.stringify(parsed).slice(0, 500),
      };
      const debugSummary = JSON.stringify(debug, null, 2);
      throw new Error(
        `LLM response did not contain a "terms" array. Found keys: ${Object.keys(parsed).join(", ")}.\n\n` +
        `[DEBUG]\n${debugSummary}\n\n` +
        `Raw response:\n${response.content.slice(0, 1000)}`
      );
    }
  }

  for (const t of rawTerms) {
    if (!t || typeof t !== "object") continue;
    const sourceTerm = String(t.source_term || t.sourceTerm || t.source || "").trim();
    const targetTerm = String(t.target_term || t.targetTerm || t.target || "").trim();
    if (!sourceTerm || !targetTerm) continue; // skip entries missing essential fields
    terms.push({
      source_term: sourceTerm,
      target_term: targetTerm,
      domain: String(t.domain || "general").trim(),
      priority: (["high", "medium", "low"].includes(t.priority) ? t.priority : "medium") as 'high' | 'medium' | 'low',
      context_source: String(t.context_source || t.contextSource || "").trim(),
      context_target: String(t.context_target || t.contextTarget || "").trim(),
    });
  }

  debug.phases.extractTerms = {
    rawTermCount: rawTerms.length,
    validTermCount: terms.length,
    skippedCount: rawTerms.length - terms.length,
    sampleTerms: terms.slice(0, 3).map(t => `${t.source_term} → ${t.target_term}`),
  };

  if (terms.length === 0) {
    const debugSummary = JSON.stringify(debug, null, 2);
    throw new Error(
      `LLM did not return any valid terms (got ${rawTerms.length} raw entries, but none had both source_term and target_term).\n\n` +
      `[DEBUG]\n${debugSummary}\n\n` +
      `Raw response:\n${response.content.slice(0, 1500)}`
    );
  }

  // ---- Phase 7: Save to database ----
  const tokenUsage = response.usage
    ? JSON.stringify(response.usage)
    : null;

  const extractionId = terminologyService.saveExtraction(
    documentIds,
    response.model,
    response.content,
    tokenUsage,
  );

  const savedTerms: TerminologyTerm[] = [];
  for (const term of terms) {
    const termId = terminologyService.addTerm(extractionId, term);
    savedTerms.push({
      id: termId,
      extraction_id: extractionId,
      source_term: term.source_term,
      target_term: term.target_term,
      domain: term.domain,
      priority: term.priority,
      context_source: term.context_source,
      context_target: term.context_target,
      is_llm_generated: 1,
    });
  }

  const extraction = terminologyService.getExtraction(extractionId);

  debug.phases.save = {
    extractionId,
    savedTermCount: savedTerms.length,
  };

  return {
    extraction,
    terms: savedTerms,
    segment_count: segments.length,
    truncated,
    debug: {
      model: response.model,
      promptTokens: response.usage?.promptTokens,
      completionTokens: response.usage?.completionTokens,
      totalTokens: response.usage?.totalTokens,
      estimatedPromptTokens,
      rawResponseLength: response.content.length,
      truncated,
    },
  };
});
