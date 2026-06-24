/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain } from "electron";
import stylometryService from "../db/stylometryService";
import corpusService from "../db/corpusService";
import { extractFeatures, computePCA, kMeans, featureDiscrimination, computeDomainComparison, DELTA_FEATURE_NAMES, ALL_FEATURE_NAMES } from "../utils/stylometry";
import type { StylometricMetadata } from "../types/stylometry";

ipcMain.handle("stylometry:getProfiles", async () => stylometryService.getProfiles());
ipcMain.handle("stylometry:deleteProfile", async (_, id: number) => stylometryService.deleteProfile(id));
ipcMain.handle("stylometry:deleteAllProfiles", async () => {
  for (const p of stylometryService.getProfiles()) stylometryService.deleteProfile(p.id!);
});

ipcMain.handle("stylometry:extractProfiles", async (_, payload: {
  documentIds: number[]; metadataList: StylometricMetadata[]; useDeltas?: boolean;
}) => {
  const { documentIds, metadataList, useDeltas = true } = payload;
  const meta = metadataList || [];
  const profiles: any[] = [];

  for (let i = 0; i < documentIds.length; i++) {
    const docId = documentIds[i];
    const segments = corpusService.getAlignedSegments([docId]);
    if (segments.length === 0) continue;
    const sourceText = segments.map(s => s.source_text).join("\n");
    const targetText = segments.map(s => s.target_text).join("\n");
    const features = extractFeatures({
      sourceText, targetText,
      alignmentData: { sourceCount: segments.length, alignments: segments.map(s => ({ sourceCount: (s as any).source_count ?? 1, targetCount: (s as any).target_count ?? 1, confidence: (s as any).confidence ?? null })) },
    });
    const profile = {
      document_id: docId, document_title: `Document ${docId}`,
      source_language: (segments[0] as any)?.source_language,
      target_language: (segments[0] as any)?.target_language,
      metadata: meta[i] || { translator: "unknown", domain: "unknown", translator_type: "human" },
      features,
    };
    const id = stylometryService.saveProfile(profile);
    profiles.push({ id, ...profile });
  }

  // PCA: use delta features by default (isolates translator effect from source)
  const featNames = useDeltas ? DELTA_FEATURE_NAMES : ALL_FEATURE_NAMES;
  const matrix = profiles.map(p => featNames.map(k => (p.features as any)[k] || 0));
  const pca = matrix.length >= 3 ? computePCA(matrix, 2) : null;
  const clusters = matrix.length >= 3 ? kMeans(matrix, Math.min(3, matrix.length)) : null;

  // Feature discrimination: human vs LLM
  const human = profiles.filter((p: any) => p.metadata.translator_type === 'human');
  const llm = profiles.filter((p: any) => p.metadata.translator_type === 'llm');
  const disc = (human.length >= 2 && llm.length >= 2)
    ? featureDiscrimination(human.map((p: any) => p.features), llm.map((p: any) => p.features), featNames) : [];

  // Domain comparison: for each domain, compute delta stats for top features
  const domainComp = computeDomainComparison(
    profiles.map((p: any) => ({ features: p.features, metadata: p.metadata })),
    "delta_ttr"
  );

  return { profiles, pca, clusters, discrimination: disc, domainComparison: domainComp, featureNames: featNames, useDeltas };
});

ipcMain.handle("stylometry:compareDomains", async (_, profileIds: number[], metric: string) => {
  const profiles = profileIds.map(id => stylometryService.getProfile(id)).filter(Boolean) as any[];
  return computeDomainComparison(
    profiles.map((p: any) => ({ features: p.features, metadata: p.metadata })),
    metric,
  );
});
