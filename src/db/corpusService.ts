import { db } from "./db";
import type { AlignedDocument, AlignedSegment, CorpusSkill, CorpusAnalysis } from "../types/corpus";

class CorpusService {
  getAlignedDocuments(): AlignedDocument[] {
    return db.prepare(`
      SELECT
        d.id,
        d.title,
        d.status,
        sm.language as source_language,
        tm.language as target_language,
        p.title as project_title,
        (SELECT COUNT(*) FROM sentence_alignments sa WHERE sa.document_id = d.id) as alignment_count
      FROM documents d
      LEFT JOIN document_metadata sm ON sm.document_id = d.id AND sm.metadata_type = 'source'
      LEFT JOIN document_metadata tm ON tm.document_id = d.id AND tm.metadata_type = 'target'
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE (SELECT COUNT(*) FROM sentence_alignments sa WHERE sa.document_id = d.id) > 0
      ORDER BY d.updated_at DESC
    `).all() as AlignedDocument[];
  }

  getAlignedSegments(documentIds: number[]): AlignedSegment[] {
    if (documentIds.length === 0) return [];

    const placeholders = documentIds.map(() => "?").join(",");

    const alignments = db.prepare(`
      SELECT
        sa.source_sentence_keys,
        sa.target_sentence_keys,
        sa.confidence,
        sa.strategy
      FROM sentence_alignments sa
      WHERE sa.document_id IN (${placeholders})
      ORDER BY sa.id
    `).all(...documentIds) as Array<{
      source_sentence_keys: string;
      target_sentence_keys: string;
      confidence: number | null;
      strategy: string | null;
    }>;

    const segments: AlignedSegment[] = [];

    for (const align of alignments) {
      let sourceKeys: string[] = [];
      let targetKeys: string[] = [];

      try {
        sourceKeys = JSON.parse(align.source_sentence_keys);
        targetKeys = JSON.parse(align.target_sentence_keys);
      } catch {
        continue;
      }

      const sourceTexts: string[] = [];
      for (const key of sourceKeys) {
        const row = db.prepare(
          "SELECT text FROM document_sentences WHERE sentence_key = ?"
        ).get(key) as { text: string } | undefined;
        if (row) sourceTexts.push(row.text);
      }

      const targetTexts: string[] = [];
      for (const key of targetKeys) {
        const row = db.prepare(
          "SELECT text FROM document_sentences WHERE sentence_key = ?"
        ).get(key) as { text: string } | undefined;
        if (row) targetTexts.push(row.text);
      }

      if (sourceTexts.length > 0 && targetTexts.length > 0) {
        segments.push({
          source_text: sourceTexts.join(" "),
          target_text: targetTexts.join(" "),
          source_sentence_key: sourceKeys.join(","),
          target_sentence_key: targetKeys.join(","),
          confidence: align.confidence ?? undefined,
          strategy: align.strategy ?? undefined,
        });
      }
    }

    return segments;
  }

  getCorpusSkills(): CorpusSkill[] {
    const rows = db.prepare(`
      SELECT
        name as key,
        name as label,
        system_prompt,
        user_prompt as user_prompt_template
      FROM llm_prompts
      WHERE task_type = 'corpus_analysis'
      ORDER BY
        CASE name
          WHEN 'Custom Analysis' THEN 1
          ELSE 0
        END, name
    `).all() as Array<{
      key: string;
      label: string;
      system_prompt: string;
      user_prompt_template: string;
    }>;

    return rows.map((r) => ({
      ...r,
      description: "",
      system_prompt: r.system_prompt || "",
    }));
  }

  saveCorpusAnalysis(analysis: Omit<CorpusAnalysis, "id" | "created_at">): number {
    const stmt = db.prepare(`
      INSERT INTO corpus_analyses (document_ids, skill_key, skill_label, model_name, result, token_usage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      analysis.document_ids,
      analysis.skill_key,
      analysis.skill_label,
      analysis.model_name || null,
      analysis.result,
      analysis.token_usage || null,
    );
    return result.lastInsertRowid as number;
  }

  getCorpusAnalyses(): CorpusAnalysis[] {
    return db.prepare(`
      SELECT * FROM corpus_analyses
      ORDER BY created_at DESC
    `).all() as CorpusAnalysis[];
  }
}

export default new CorpusService();
