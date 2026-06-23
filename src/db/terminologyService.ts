import { db } from "./db";
import type { TerminologyExtraction, TerminologyTerm, TerminologySkill } from "../types/terminology";

class TerminologyService {
  // ==================== Extractions ====================

  getExtractions(): TerminologyExtraction[] {
    return db.prepare(`
      SELECT * FROM terminology_extractions
      ORDER BY created_at DESC
    `).all() as TerminologyExtraction[];
  }

  getExtraction(id: number): TerminologyExtraction | undefined {
    return db.prepare(`
      SELECT * FROM terminology_extractions WHERE id = ?
    `).get(id) as TerminologyExtraction | undefined;
  }

  saveExtraction(
    documentIds: number[],
    modelName: string,
    result: string,
    tokenUsage: string | null,
  ): number {
    const stmt = db.prepare(`
      INSERT INTO terminology_extractions (document_ids, model_name, token_usage, result)
      VALUES (?, ?, ?, ?)
    `);
    const res = stmt.run(
      JSON.stringify(documentIds),
      modelName,
      tokenUsage,
      result,
    );
    return res.lastInsertRowid as number;
  }

  // ==================== Terms ====================

  getTerms(extractionId: number): TerminologyTerm[] {
    return db.prepare(`
      SELECT * FROM terminology_terms
      WHERE extraction_id = ?
      ORDER BY domain, priority, id
    `).all(extractionId) as TerminologyTerm[];
  }

  addTerm(extractionId: number, term: {
    source_term: string;
    target_term: string;
    domain: string;
    priority: 'high' | 'medium' | 'low';
    context_source: string;
    context_target: string;
  }): number {
    const stmt = db.prepare(`
      INSERT INTO terminology_terms
        (extraction_id, source_term, target_term, domain, priority, context_source, context_target, is_llm_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const res = stmt.run(
      extractionId,
      term.source_term,
      term.target_term,
      term.domain,
      term.priority,
      term.context_source,
      term.context_target,
    );
    return res.lastInsertRowid as number;
  }

  addManualTerm(extractionId: number, term: {
    source_term: string;
    target_term: string;
    domain?: string;
    priority?: 'high' | 'medium' | 'low';
    context_source?: string;
    context_target?: string;
  }): number {
    const stmt = db.prepare(`
      INSERT INTO terminology_terms
        (extraction_id, source_term, target_term, domain, priority, context_source, context_target, is_llm_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `);
    const res = stmt.run(
      extractionId,
      term.source_term,
      term.target_term,
      term.domain || null,
      term.priority || null,
      term.context_source || null,
      term.context_target || null,
    );
    return res.lastInsertRowid as number;
  }

  updateTerm(id: number, data: Partial<Omit<TerminologyTerm, 'id' | 'extraction_id' | 'created_at'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.source_term !== undefined)    { fields.push("source_term = ?"); values.push(data.source_term); }
    if (data.target_term !== undefined)    { fields.push("target_term = ?"); values.push(data.target_term); }
    if (data.domain !== undefined)         { fields.push("domain = ?"); values.push(data.domain); }
    if (data.priority !== undefined)       { fields.push("priority = ?"); values.push(data.priority); }
    if (data.context_source !== undefined) { fields.push("context_source = ?"); values.push(data.context_source); }
    if (data.context_target !== undefined) { fields.push("context_target = ?"); values.push(data.context_target); }
    if (data.variant_group !== undefined)  { fields.push("variant_group = ?"); values.push(data.variant_group); }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE terminology_terms SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteTerm(id: number): void {
    db.prepare("DELETE FROM terminology_terms WHERE id = ?").run(id);
  }

  // ==================== Skills (llm_prompts) ====================

  getSkills(): TerminologySkill[] {
    const rows = db.prepare(`
      SELECT
        id,
        name as key,
        name as label,
        system_prompt,
        user_prompt as user_prompt_template
      FROM llm_prompts
      WHERE task_type = 'terminology_extraction'
      ORDER BY
        CASE name
          WHEN 'Custom Extraction' THEN 1
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

  saveSkill(skill: { name: string; system_prompt: string; user_prompt_template: string }): number {
    const result = db.prepare(`
      INSERT INTO llm_prompts (task_type, name, system_prompt, user_prompt, temperature, max_tokens)
      VALUES ('terminology_extraction', ?, ?, ?, 0.3, 4096)
      ON CONFLICT(task_type, name) DO UPDATE SET
        system_prompt = excluded.system_prompt,
        user_prompt = excluded.user_prompt,
        updated_at = CURRENT_TIMESTAMP
    `).run(skill.name, skill.system_prompt, skill.user_prompt_template);
    return result.lastInsertRowid as number;
  }

  updateSkill(id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }): void {
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

    db.prepare(`UPDATE llm_prompts SET ${fields.join(", ")} WHERE id = ? AND task_type = 'terminology_extraction'`)
      .run(...values);
  }

  deleteSkill(id: number): void {
    db.prepare("DELETE FROM llm_prompts WHERE id = ? AND task_type = 'terminology_extraction'").run(id);
  }
}

export default new TerminologyService();
