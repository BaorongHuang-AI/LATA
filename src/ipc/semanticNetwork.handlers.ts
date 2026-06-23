/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain } from "electron";
import semanticNetworkService from "../db/semanticNetworkService";
import corpusService from "../db/corpusService";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";
import type { ConceptMapping, ConceptNode, ConceptEdge, SemanticNetworkData } from "../types/semanticNetwork";

const SEMANTIC_FIELD_COLORS: Record<string, string> = {
  legal: "#3B82F6", medical: "#EF4444", emotional: "#F59E0B",
  spatial: "#10B981", temporal: "#8B5CF6", social: "#EC4899",
  cognitive: "#06B6D4", technical: "#6366F1", cultural: "#F97316",
  religious: "#7C3AED", commercial: "#14B8A6", general: "#9CA3AF",
};

function buildNetworkData(concepts: ConceptMapping[]): SemanticNetworkData {
  const nodeMap = new Map<string, ConceptNode>();
  const edgeMap = new Map<string, ConceptEdge>();
  const fieldCounts = new Map<string, number>();

  for (const c of concepts) {
    fieldCounts.set(c.semantic_field, (fieldCounts.get(c.semantic_field) || 0) + 1);

    // Source node
    const srcId = `src:${c.source_concept}`;
    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, {
        id: srcId, label: c.source_concept, language: 'source',
        frequency: 0, semanticField: c.semantic_field,
        group: c.semantic_field,
      });
    }
    const srcNode = nodeMap.get(srcId)!;
    srcNode.frequency += c.frequency;

    // Target nodes
    for (const tgtConcept of c.target_concepts) {
      const tgtId = `tgt:${tgtConcept}`;
      if (!nodeMap.has(tgtId)) {
        nodeMap.set(tgtId, {
          id: tgtId, label: tgtConcept, language: 'target',
          frequency: 0, semanticField: c.semantic_field,
          group: c.semantic_field,
        });
      }
      const tgtNode = nodeMap.get(tgtId)!;
      tgtNode.frequency += 1;

      // Edge
      const edgeId = `${srcId}->${tgtId}`;
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId, source: srcId, target: tgtId,
          label: `${c.source_concept} → ${tgtConcept}`,
          weight: 0, mappingType: c.mapping_type,
          dashed: c.mapping_type !== 'one_to_one',
        });
      }
      const edge = edgeMap.get(edgeId)!;
      edge.weight += 1;
    }
  }

  const totalMappings = concepts.reduce((s, c) => s + c.target_concepts.length, 0);
  const sourceConcepts = new Set(concepts.map(c => c.source_concept));
  const targetConcepts = new Set(concepts.flatMap(c => c.target_concepts));

  const mappingTypes = concepts.reduce((acc, c) => {
    acc[c.mapping_type] = (acc[c.mapping_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantFields = Array.from(fieldCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => ({ field, count }));

  return {
    nodes: Array.from(nodeMap.values()).map(n => ({
      ...n,
      color: SEMANTIC_FIELD_COLORS[n.semanticField] || "#9CA3AF",
    } as any)),
    edges: Array.from(edgeMap.values()).map(e => ({
      ...e,
      color: { color: e.dashed ? "#D1D5DB" : "#6B7280", opacity: e.dashed ? 0.6 : 1.0 },
    } as any)),
    summary: {
      total_concepts: nodeMap.size,
      total_mappings: edgeMap.size,
      source_unique_concepts: sourceConcepts.size,
      target_unique_concepts: targetConcepts.size,
      avg_mappings_per_concept: sourceConcepts.size > 0 ? totalMappings / sourceConcepts.size : 0,
      dominant_semantic_fields: dominantFields,
      one_to_one_ratio: (mappingTypes.one_to_one || 0) / concepts.length,
      one_to_many_ratio: (mappingTypes.one_to_many || 0) / concepts.length,
      many_to_one_ratio: (mappingTypes.many_to_one || 0) / concepts.length,
      many_to_many_ratio: (mappingTypes.many_to_many || 0) / concepts.length,
      ambiguity_index: totalMappings > 0 ? (totalMappings - sourceConcepts.size) / totalMappings : 0,
    },
  };
}

// ==================== IPC Handlers ====================

ipcMain.handle("semantic:getExtractions", async () => {
  return semanticNetworkService.getExtractions();
});

ipcMain.handle("semantic:getExtraction", async (_, id: number) => {
  return semanticNetworkService.getExtraction(id);
});

ipcMain.handle("semantic:deleteExtraction", async (_, id: number) => {
  semanticNetworkService.deleteExtraction(id);
});

ipcMain.handle("semantic:runExtraction", async (_, payload: { documentIds: number[] }) => {
  const { documentIds } = payload;

  const skills = corpusService.getCorpusSkills();
  const skill = skills.find(s => s.key === "Cross-Lingual Concept Mapping");
  if (!skill) throw new Error("Cross-Lingual Concept Mapping skill not found");

  const segments = corpusService.getAlignedSegments(documentIds);
  if (segments.length === 0) throw new Error("No aligned segments found in selected documents");

  const segmentsStr = segments.slice(0, 100)
    .map((seg, i) => `[${i + 1}] SRC: ${seg.source_text}\n[${i + 1}] TGT: ${seg.target_text}`)
    .join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: skill.system_prompt },
    { role: "user", content: skill.user_prompt_template.replace("{{segments}}", segmentsStr) },
  ];

  const response = await sendChatCompletion({
    messages, temperature: 0.3, maxTokens: 16384, responseFormat: "json_object",
  });

  let parsed: { concepts?: ConceptMapping[]; summary?: any };
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON. Raw: ${response.content.slice(0, 500)}`);
  }

  if (!parsed.concepts || !Array.isArray(parsed.concepts)) {
    throw new Error("LLM response did not contain a concepts array");
  }

  const concepts: ConceptMapping[] = parsed.concepts.map((c: any) => {
    // Accept multiple field name variants from the LLM
    const srcConcept = String(
      c.source_concept || c.sourceConcept || c.source_term || c.source || c.concept || ""
    ).trim();
    let tgtConcepts: string[] = [];
    const tgtRaw = c.target_concepts || c.targetConcepts || c.target_terms || c.target || c.targets;
    if (Array.isArray(tgtRaw)) {
      tgtConcepts = tgtRaw.map((t: any) => String(t?.concept || t?.target || t?.term || t || "").trim()).filter(Boolean);
    }
    return {
      source_concept: srcConcept,
      target_concepts: tgtConcepts,
      semantic_field: String(c.semantic_field || c.semanticField || c.domain || c.field || "general").trim(),
      frequency: Number(c.frequency || c.count || c.freq) || 1,
      examples: Array.isArray(c.examples) ? c.examples : [],
      mapping_type: (["one_to_one","one_to_many","many_to_one","many_to_many"].includes(c.mapping_type || c.mappingType)
        ? (c.mapping_type || c.mappingType) : "one_to_one") as ConceptMapping["mapping_type"],
    };
  }).filter((c: ConceptMapping) => c.source_concept && c.target_concepts.length > 0);

  const networkData = buildNetworkData(concepts);
  // Merge LLM summary if available, else use computed
  if (parsed.summary) networkData.summary = { ...networkData.summary, ...parsed.summary };

  const tokenUsage = response.usage ? JSON.stringify(response.usage) : null;
  const extractionId = semanticNetworkService.saveExtraction({
    document_ids: JSON.stringify(documentIds),
    model_name: response.model,
    token_usage: tokenUsage,
    network_data: JSON.stringify(networkData),
  });

  return {
    id: extractionId,
    network_data: networkData,
    model_name: response.model,
    segment_count: segments.length,
    truncated: segments.length > 100,
  };
});
