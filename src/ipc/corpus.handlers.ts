import { ipcMain } from "electron";
import corpusService from "../db/corpusService";
import { db } from "../db/db";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";
import type { CorpusSearchRequest, CorpusSearchResult } from "../types/corpus";

function serializeSegments(segments: Array<{ source_text: string; target_text: string }>, maxSegments = 200): string {
  const limited = segments.slice(0, maxSegments);
  return limited
    .map((seg, i) => `[${i + 1}] SRC: ${seg.source_text}\n[${i + 1}] TGT: ${seg.target_text}`)
    .join("\n\n");
}

ipcMain.handle("corpus:getAlignedDocuments", async () => {
  return corpusService.getAlignedDocuments();
});

ipcMain.handle("corpus:getSegments", async (_, documentIds: number[]) => {
  return corpusService.getAlignedSegments(documentIds);
});

ipcMain.handle("corpus:getSkills", async () => {
  return corpusService.getCorpusSkills();
});

ipcMain.handle("corpus:getAnalyses", async () => {
  return corpusService.getCorpusAnalyses();
});

ipcMain.handle("corpus:saveSkill", async (_, skill: { name: string; system_prompt: string; user_prompt_template: string }) => {
  return corpusService.saveCorpusSkill(skill);
});

ipcMain.handle("corpus:updateSkill", async (_, id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }) => {
  corpusService.updateCorpusSkill(id, skill);
});

ipcMain.handle("corpus:deleteSkill", async (_, id: number) => {
  corpusService.deleteCorpusSkill(id);
});

ipcMain.handle("corpus:runAnalysis", async (_, payload: {
  documentIds: number[];
  skillKey: string;
  customPrompt?: string;
}) => {
  const { documentIds, skillKey, customPrompt } = payload;

  const skills = corpusService.getCorpusSkills();
  const skill = skills.find((s) => s.key === skillKey);
  if (!skill) throw new Error(`Skill "${skillKey}" not found`);

  const segments = corpusService.getAlignedSegments(documentIds);
  if (segments.length === 0) throw new Error("No aligned segments found in the selected documents");

  const segmentsStr = serializeSegments(segments);

  const systemPrompt = skill.system_prompt;
  let userPrompt: string;
  if (skillKey === "Custom Analysis" && customPrompt) {
    userPrompt = skill.user_prompt_template
      .replace("{{custom_prompt}}", customPrompt)
      .replace("{{segments}}", segmentsStr);
  } else {
    userPrompt = skill.user_prompt_template.replace("{{segments}}", segmentsStr);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const response = await sendChatCompletion({
    messages,
    temperature: 0.3,
    maxTokens: 4096,
  });

  const docIdsJson = JSON.stringify(documentIds);
  const tokenUsage = response.usage
    ? JSON.stringify(response.usage)
    : null;

  corpusService.saveCorpusAnalysis({
    document_ids: docIdsJson,
    skill_key: skillKey,
    skill_label: skill.label,
    model_name: response.model,
    result: response.content,
    token_usage: tokenUsage,
  });

  return {
    skill_key: skillKey,
    skill_label: skill.label,
    model_name: response.model,
    result: response.content,
    segment_count: segments.length,
    truncated: segments.length > 200,
  };
});

// ==================== Corpus Search ====================

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function resolveSentenceTexts(keysJson: string): string[] {
  let keys: string[] = [];
  try {
    keys = JSON.parse(keysJson);
  } catch {
    return [];
  }
  const texts: string[] = [];
  for (const key of keys) {
    const row = db.prepare(
      "SELECT text FROM document_sentences WHERE sentence_key = ?"
    ).get(key) as { text: string } | undefined;
    if (row) texts.push(row.text);
  }
  return texts;
}

function matchesMetadataFilters(
  row: {
    source_language: string | null;
    target_language: string | null;
    source_domain: string | null;
    target_domain: string | null;
    source_authors: string | null;
    target_authors: string | null;
    source_keywords: string | null;
    target_keywords: string | null;
  },
  filters: CorpusSearchRequest["filters"]
): boolean {
  // Source language filter
  if (filters.sourceLanguages.length > 0) {
    if (!row.source_language || !filters.sourceLanguages.includes(row.source_language)) {
      return false;
    }
  }
  // Target language filter
  if (filters.targetLanguages.length > 0) {
    if (!row.target_language || !filters.targetLanguages.includes(row.target_language)) {
      return false;
    }
  }
  // Domain filter (matches either source or target domain)
  if (filters.domains.length > 0) {
    const hasDomain =
      (row.source_domain && filters.domains.includes(row.source_domain)) ||
      (row.target_domain && filters.domains.includes(row.target_domain));
    if (!hasDomain) return false;
  }
  // Author filter (matches any author in source or target)
  if (filters.authors.length > 0) {
    const srcAuthors = parseJsonArray(row.source_authors);
    const tgtAuthors = parseJsonArray(row.target_authors);
    const allAuthors = [...srcAuthors, ...tgtAuthors];
    const hasAuthor = filters.authors.some((a) => allAuthors.includes(a));
    if (!hasAuthor) return false;
  }
  // Keyword filter (matches any keyword in source or target)
  if (filters.keywords.length > 0) {
    const srcKeywords = parseJsonArray(row.source_keywords);
    const tgtKeywords = parseJsonArray(row.target_keywords);
    const allKeywords = [...srcKeywords, ...tgtKeywords];
    const hasKeyword = filters.keywords.some((k) => allKeywords.includes(k));
    if (!hasKeyword) return false;
  }
  return true;
}

ipcMain.handle("corpus:searchSegments", async (_, params: CorpusSearchRequest) => {
  const { documentIds, pattern, searchSource, searchTarget, filters } = params;

  if (documentIds.length === 0) return [];

  // Compile regex
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid regex pattern: ${message}`);
  }

  const rows = corpusService.getEnrichedAlignments(documentIds);

  const results: CorpusSearchResult[] = [];

  for (const row of rows) {
    // Apply metadata filters first (cheap, no sentence lookup needed)
    if (!matchesMetadataFilters(row, filters)) continue;

    const sourceTexts = resolveSentenceTexts(row.source_sentence_keys);
    const targetTexts = resolveSentenceTexts(row.target_sentence_keys);

    if (sourceTexts.length === 0 && targetTexts.length === 0) continue;

    const sourceText = sourceTexts.join(" ");
    const targetText = targetTexts.join(" ");

    // Apply regex
    const sourceMatch = searchSource && regex.test(sourceText);
    const targetMatch = searchTarget && regex.test(targetText);

    if (!sourceMatch && !targetMatch) continue;

    results.push({
      alignmentId: row.alignment_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      projectTitle: row.project_title || undefined,
      sourceText,
      targetText,
      sourceLanguage: row.source_language || undefined,
      targetLanguage: row.target_language || undefined,
      sourceDomain: row.source_domain || undefined,
      targetDomain: row.target_domain || undefined,
      sourceAuthors: parseJsonArray(row.source_authors),
      targetAuthors: parseJsonArray(row.target_authors),
      sourceKeywords: parseJsonArray(row.source_keywords),
      targetKeywords: parseJsonArray(row.target_keywords),
      confidence: row.confidence ?? undefined,
      strategy: row.strategy || undefined,
    });
  }

  return results;
});

ipcMain.handle("corpus:getMetadataOptions", async (_, documentIds: number[]) => {
  return corpusService.getMetadataOptions(documentIds);
});
