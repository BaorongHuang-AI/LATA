import { ipcMain } from "electron";
import corpusService from "../db/corpusService";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";

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
