/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain } from "electron";
import narrativeService from "../db/narrativeService";
import corpusService from "../db/corpusService";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";
import type { NarrativeData } from "../types/narrative";

ipcMain.handle("narrative:getAll", async () => narrativeService.getAll());
ipcMain.handle("narrative:get", async (_, id: number) => narrativeService.get(id));
ipcMain.handle("narrative:delete", async (_, id: number) => narrativeService.delete(id));

ipcMain.handle("narrative:analyze", async (_, payload: { documentId: number }) => {
  const { documentId } = payload;
  const skills = corpusService.getCorpusSkills();
  const skill = skills.find(s => s.key === "Literary Narrative Analysis");
  if (!skill) throw new Error("Literary Narrative Analysis skill not found");

  const segments = corpusService.getAlignedSegments([documentId]);
  if (segments.length === 0) throw new Error("No aligned segments found");

  // Use more segments for literary analysis (better granularity)
  const maxSegs = 150;
  const segsStr = segments.slice(0, maxSegs)
    .map((seg, i) => `[${i + 1}] SRC: ${seg.source_text}\n[${i + 1}] TGT: ${seg.target_text}`)
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: skill.system_prompt },
    { role: "user", content: skill.user_prompt_template.replace("{{segments}}", segsStr) },
  ];

  const response = await sendChatCompletion({ messages, temperature: 0.3, maxTokens: 16384, responseFormat: "json_object" });

  let parsed: any;
  try { parsed = JSON.parse(response.content); } catch {
    throw new Error(`Failed to parse narrative analysis as JSON. Raw: ${response.content.slice(0, 500)}`);
  }

  // Build NarrativeData from parsed JSON, with sensible defaults
  const data: NarrativeData = {
    emotional_arc: Array.isArray(parsed.emotional_arc) ? parsed.emotional_arc : [],
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    character_interactions: Array.isArray(parsed.character_interactions) ? parsed.character_interactions : [],
    structure: Array.isArray(parsed.structure) ? parsed.structure : [],
    voice: parsed.voice || { point_of_view: "unknown", narrator_intrusion_source: 0, narrator_intrusion_target: 0, free_indirect_discourse_source: 0, free_indirect_discourse_target: 0 },
    temporal: parsed.temporal || { is_linear: true, flashback_count_source: 0, flashback_count_target: 0, time_compression_ratio: 1 },
    summary: parsed.summary || { total_segments: 10, character_count: 0, dialogue_ratio_source: 0, dialogue_ratio_target: 0, emotional_range_source: 0, emotional_range_target: 0, emotional_correlation: 0, narrative_pace_source: "moderate", narrative_pace_target: "moderate" },
  };

  const id = narrativeService.save({
    document_id: documentId,
    document_title: `Literary Analysis ${documentId}`,
    model_name: response.model,
    source_language: (segments[0] as any)?.source_language,
    target_language: (segments[0] as any)?.target_language,
    data,
  });

  return { id, data, model_name: response.model, segment_count: segments.length, truncated: segments.length > maxSegs };
});
