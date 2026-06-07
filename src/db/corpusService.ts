import { db } from "./db";
import type { AlignedDocument, AlignedSegment, CorpusSkill, CorpusAnalysis, EnrichedAlignmentRow, CorpusMetadataOptions } from "../types/corpus";

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
        id,
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
      id: number;
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

  saveCorpusSkill(skill: { name: string; system_prompt: string; user_prompt_template: string }): number {
    const result = db.prepare(`
      INSERT INTO llm_prompts (task_type, name, system_prompt, user_prompt, temperature, max_tokens)
      VALUES ('corpus_analysis', ?, ?, ?, 0.3, 4096)
      ON CONFLICT(task_type, name) DO UPDATE SET
        system_prompt = excluded.system_prompt,
        user_prompt = excluded.user_prompt,
        updated_at = CURRENT_TIMESTAMP
    `).run(skill.name, skill.system_prompt, skill.user_prompt_template);
    return result.lastInsertRowid as number;
  }

  updateCorpusSkill(id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (skill.name !== undefined) {
      fields.push("name = ?");
      values.push(skill.name);
    }
    if (skill.system_prompt !== undefined) {
      fields.push("system_prompt = ?");
      values.push(skill.system_prompt);
    }
    if (skill.user_prompt_template !== undefined) {
      fields.push("user_prompt = ?");
      values.push(skill.user_prompt_template);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE llm_prompts SET ${fields.join(", ")} WHERE id = ? AND task_type = 'corpus_analysis'`)
      .run(...values);
  }

  deleteCorpusSkill(id: number): void {
    db.prepare("DELETE FROM llm_prompts WHERE id = ? AND task_type = 'corpus_analysis'").run(id);
  }

  getEnrichedAlignments(documentIds: number[]): EnrichedAlignmentRow[] {
    if (documentIds.length === 0) return [];

    const placeholders = documentIds.map(() => "?").join(",");

    return db.prepare(`
      SELECT
        sa.id AS alignment_id,
        sa.document_id,
        d.title AS document_title,
        p.title AS project_title,
        sa.source_sentence_keys,
        sa.target_sentence_keys,
        sa.confidence,
        sa.strategy,
        sm.language AS source_language,
        tm.language AS target_language,
        sm.domain AS source_domain,
        tm.domain AS target_domain,
        sm.authors AS source_authors,
        tm.authors AS target_authors,
        sm.keywords AS source_keywords,
        tm.keywords AS target_keywords
      FROM sentence_alignments sa
      JOIN documents d ON d.id = sa.document_id
      LEFT JOIN projects p ON p.id = d.project_id
      LEFT JOIN document_metadata sm ON sm.document_id = sa.document_id AND sm.metadata_type = 'source'
      LEFT JOIN document_metadata tm ON tm.document_id = sa.document_id AND tm.metadata_type = 'target'
      WHERE sa.document_id IN (${placeholders})
      ORDER BY sa.document_id, sa.id
    `).all(...documentIds) as EnrichedAlignmentRow[];
  }

  getMetadataOptions(documentIds: number[]): CorpusMetadataOptions {
    if (documentIds.length === 0) {
      return { sourceLanguages: [], targetLanguages: [], domains: [], authors: [], keywords: [] };
    }

    const placeholders = documentIds.map(() => "?").join(",");

    const rows = db.prepare(`
      SELECT DISTINCT
        sm.language AS source_language,
        tm.language AS target_language,
        sm.domain AS source_domain,
        tm.domain AS target_domain,
        sm.authors AS source_authors,
        tm.authors AS target_authors,
        sm.keywords AS source_keywords,
        tm.keywords AS target_keywords
      FROM document_metadata sm
      LEFT JOIN document_metadata tm ON tm.document_id = sm.document_id AND tm.metadata_type = 'target'
      WHERE sm.metadata_type = 'source'
        AND sm.document_id IN (${placeholders})
    `).all(...documentIds) as Array<{
      source_language: string | null;
      target_language: string | null;
      source_domain: string | null;
      target_domain: string | null;
      source_authors: string | null;
      target_authors: string | null;
      source_keywords: string | null;
      target_keywords: string | null;
    }>;

    const sourceLanguages = new Set<string>();
    const targetLanguages = new Set<string>();
    const domains = new Set<string>();
    const authors = new Set<string>();
    const keywords = new Set<string>();

    const parseJsonArray = (val: string | null): string[] => {
      if (!val) return [];
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };

    for (const row of rows) {
      if (row.source_language) sourceLanguages.add(row.source_language);
      if (row.target_language) targetLanguages.add(row.target_language);
      if (row.source_domain) domains.add(row.source_domain);
      if (row.target_domain) domains.add(row.target_domain);
      parseJsonArray(row.source_authors).forEach((a) => authors.add(a));
      parseJsonArray(row.target_authors).forEach((a) => authors.add(a));
      parseJsonArray(row.source_keywords).forEach((k) => keywords.add(k));
      parseJsonArray(row.target_keywords).forEach((k) => keywords.add(k));
    }

    return {
      sourceLanguages: Array.from(sourceLanguages).sort(),
      targetLanguages: Array.from(targetLanguages).sort(),
      domains: Array.from(domains).sort(),
      authors: Array.from(authors).sort(),
      keywords: Array.from(keywords).sort(),
    };
  }
}

export default new CorpusService();
