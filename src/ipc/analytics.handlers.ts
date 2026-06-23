/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain } from "electron";
import analyticsService from "../db/analyticsService";
import corpusService from "../db/corpusService";
import terminologyService from "../db/terminologyService";
import { computeAllMetrics, runStatisticalTest, computeLexicalMetrics, computeCulturalMetrics } from "../utils/stats";
import { sendChatCompletion } from "../utils/sendChatCompletion";
import type { ChatMessage } from "../types/llminterfaces";
import type { AnalyticsConfig, AnalyticsResult, StatisticalOutput } from "../types/analytics";

// ==================== Experiments CRUD ====================

ipcMain.handle("analytics:createExperiment", async (_, data: {
  title: string; research_question?: string; hypothesis?: string; configuration: string;
}) => {
  return analyticsService.createExperiment(data);
});

ipcMain.handle("analytics:updateExperiment", async (_, id: number, data: {
  title?: string; status?: 'draft' | 'running' | 'completed' | 'error'; configuration?: string;
}) => {
  analyticsService.updateExperiment(id, data);
});

ipcMain.handle("analytics:deleteExperiment", async (_, id: number) => {
  analyticsService.deleteExperiment(id);
});

ipcMain.handle("analytics:getExperiment", async (_, id: number) => {
  return analyticsService.getExperiment(id);
});

ipcMain.handle("analytics:getAllExperiments", async () => {
  return analyticsService.getAllExperiments();
});

// ==================== Run Experiment ====================

ipcMain.handle("analytics:runExperiment", async (_, experimentId: number) => {
  const experiment = analyticsService.getExperiment(experimentId);
  if (!experiment) throw new Error("Experiment not found");

  // Mark as running
  analyticsService.updateExperiment(experimentId, { status: "running" });

  try {
    const config: AnalyticsConfig = JSON.parse(experiment.configuration);
    const metricKey = config.metrics[0] || "ttr";

    // Collect per-document metrics for each group
    const allResults: Omit<AnalyticsResult, 'id'>[] = [];

    for (const group of config.groups) {
      for (const docId of group.documentIds) {
        // Get aligned segments
        const segments = corpusService.getAlignedSegments([docId]);
        if (segments.length === 0) continue;

        // Build full source and target text
        const sourceText = segments.map((s) => s.source_text).join("\n");
        const targetText = segments.map((s) => s.target_text).join("\n");

        // Get alignment data
        const alignData = {
          sourceCount: segments.length,
          alignments: segments.map((s) => ({
            sourceCount: (s as any).source_count ?? 1,
            targetCount: (s as any).target_count ?? 1,
            confidence: (s as any).confidence ?? null,
          })),
        };

        // Get terms (if any terminology project exists — try by document group)
        let terms: Array<{ source_term: string; target_term: string }> = [];
        try {
          // Try to get terms from the most recent terminology extraction for these docs
          const allTerms = terminologyService.getAllProjectTerms?.(
            // We need to find which project this doc belongs to — skip for now, use empty
            0
          ) ?? [];
          terms = allTerms.filter(() => false); // Simplified: terms require project context
        } catch { /* terms optional */ }

        const metrics = computeAllMetrics({ sourceText, targetText, alignmentData: alignData, terms });

        // Also compute target-side lexical metrics for comparison
        const tgtLex = computeLexicalMetrics(targetText);
        const metricMap: Record<string, number | string> = {
          ...metrics,
          target_token_count: tgtLex.token_count,
          target_ttr: tgtLex.ttr,
          target_guiraud_r: tgtLex.guiraud_r,
          target_herdans_c: tgtLex.herdans_c,
          target_yules_k: tgtLex.yules_k,
          target_avg_word_length: tgtLex.avg_word_length,
          target_avg_sentence_length: tgtLex.avg_sentence_length,
        };

        allResults.push({
          experiment_id: experimentId,
          document_id: docId,
          group_name: group.name,
          document_title: `Document ${docId}`,
          metrics: metricMap as any,
        });
      }
    }

    // ---- Cultural Analysis (if cultural metrics selected) ----
    const culturalMetrics = [
      "cultural_preservation_ratio", "cultural_substitution_ratio",
      "cultural_explicitation_ratio", "cultural_omission_ratio",
      "cultural_generalization_ratio", "cultural_addition_count",
      "cultural_avg_politeness_shift", "cultural_avg_distance_score",
    ];
    const needsCulturalAnalysis = config.metrics.some((m) => culturalMetrics.includes(m));

    if (needsCulturalAnalysis) {
      // Load the Cultural Adaptation Analysis skill
      const skills = corpusService.getCorpusSkills();
      const culturalSkill = skills.find((s) => s.key === "Cultural Adaptation Analysis");
      if (culturalSkill) {
        for (const group of config.groups) {
          const groupSegments = corpusService.getAlignedSegments(group.documentIds);
          if (groupSegments.length === 0) continue;

          const segmentsStr = groupSegments
            .slice(0, 100) // limit to 100 segments to avoid token overflow
            .map((seg, i) => `[${i + 1}] SRC: ${seg.source_text}\n[${i + 1}] TGT: ${seg.target_text}`)
            .join("\n\n");

          const messages: ChatMessage[] = [
            { role: "system", content: culturalSkill.system_prompt },
            { role: "user", content: culturalSkill.user_prompt_template.replace("{{segments}}", segmentsStr) },
          ];

          try {
            const response = await sendChatCompletion({
              messages,
              temperature: 0.3,
              maxTokens: 16384,
              responseFormat: "json_object",
            });

            const culturalMetricsResult = computeCulturalMetrics(response.content);
            // Distribute cultural metrics to each document's result in this group
            for (const r of allResults) {
              if (r.group_name === group.name) {
                (r.metrics as any).cultural_preservation_ratio = culturalMetricsResult.cultural_preservation_ratio;
                (r.metrics as any).cultural_substitution_ratio = culturalMetricsResult.cultural_substitution_ratio;
                (r.metrics as any).cultural_explicitation_ratio = culturalMetricsResult.cultural_explicitation_ratio;
                (r.metrics as any).cultural_omission_ratio = culturalMetricsResult.cultural_omission_ratio;
                (r.metrics as any).cultural_generalization_ratio = culturalMetricsResult.cultural_generalization_ratio;
                (r.metrics as any).cultural_addition_count = culturalMetricsResult.cultural_addition_count;
                (r.metrics as any).cultural_avg_politeness_shift = culturalMetricsResult.cultural_avg_politeness_shift;
                (r.metrics as any).cultural_avg_distance_score = culturalMetricsResult.cultural_avg_distance_score;
                (r.metrics as any).cultural_total_references = culturalMetricsResult.cultural_total_references;
                (r.metrics as any).cultural_dominant_strategy = culturalMetricsResult.cultural_dominant_strategy;
              }
            }
          } catch (e) {
            console.error(`Cultural analysis failed for group ${group.name}:`, e);
            // Continue — cultural metrics are optional
          }
        }
      }
    }

    if (allResults.length === 0) {
      analyticsService.updateExperiment(experimentId, { status: "error" });
      throw new Error("No metrics could be computed. Check that the selected documents have aligned segments.");
    }

    // Save results
    analyticsService.deleteResults(experimentId);
    analyticsService.saveResults(allResults);

    // Run statistical test if we have multiple groups
    let testOutput: StatisticalOutput | undefined;
    const groupsWithData = config.groups.filter((g) =>
      allResults.some((r) => r.group_name === g.name)
    );
    if (groupsWithData.length >= 2 && config.testType) {
      const groupValues = groupsWithData.map((g) => ({
        groupName: g.label || g.name,
        values: allResults
          .filter((r) => r.group_name === g.name)
          .map((r) => (r.metrics as any)[metricKey] ?? 0),
      }));
      if (groupValues.every((g) => g.values.length > 0)) {
        testOutput = runStatisticalTest(config.testType, groupValues);
      }
    }

    analyticsService.updateExperiment(experimentId, { status: "completed" });

    return {
      experiment: { ...experiment, status: "completed" },
      results: allResults,
      testOutput,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    analyticsService.updateExperiment(experimentId, { status: "error" });
    throw e;
  }
});

// ==================== Results & Reports ====================

ipcMain.handle("analytics:getResults", async (_, experimentId: number) => {
  return analyticsService.getResults(experimentId);
});

ipcMain.handle("analytics:saveReport", async (_, experimentId: number, format: string, content: string) => {
  return analyticsService.saveReport(experimentId, format, content);
});

ipcMain.handle("analytics:getReport", async (_, experimentId: number) => {
  return analyticsService.getReport(experimentId);
});
