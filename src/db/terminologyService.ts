import { db } from "./db";
import type {
  TerminologyExtraction,
  TerminologyTerm,
  TerminologySkill,
  TerminologyProject,
  ProjectDocumentInfo,
} from "../types/terminology";

class TerminologyService {
  // ==================== Projects ====================

  createProject(data: {
    title: string;
    description?: string;
    source?: string;
    extractor?: string;
    reviewer?: string;
    status?: string;
  }): number {
    const result = db.prepare(`
      INSERT INTO terminology_projects (title, description, source, extractor, reviewer, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.title,
      data.description || null,
      data.source || null,
      data.extractor || null,
      data.reviewer || null,
      data.status || 'draft',
    );
    return result.lastInsertRowid as number;
  }

  updateProject(id: number, data: Partial<Omit<TerminologyProject, 'id' | 'created_at' | 'document_count'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined)       { fields.push("title = ?"); values.push(data.title); }
    if (data.description !== undefined)  { fields.push("description = ?"); values.push(data.description); }
    if (data.source !== undefined)       { fields.push("source = ?"); values.push(data.source); }
    if (data.extractor !== undefined)    { fields.push("extractor = ?"); values.push(data.extractor); }
    if (data.reviewer !== undefined)     { fields.push("reviewer = ?"); values.push(data.reviewer); }
    if (data.status !== undefined)       { fields.push("status = ?"); values.push(data.status); }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE terminology_projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteProject(id: number): void {
    db.prepare("DELETE FROM terminology_projects WHERE id = ?").run(id);
  }

  getProject(id: number): TerminologyProject & { document_count: number } {
    const row = db.prepare(`
      SELECT
        tp.*,
        (SELECT COUNT(*) FROM terminology_project_documents tpd WHERE tpd.project_id = tp.id) as document_count
      FROM terminology_projects tp
      WHERE tp.id = ?
    `).get(id) as (TerminologyProject & { document_count: number }) | undefined;
    if (!row) throw new Error(`Terminology project ${id} not found`);
    return row;
  }

  getAllProjects(): (TerminologyProject & { document_count: number })[] {
    return db.prepare(`
      SELECT
        tp.*,
        (SELECT COUNT(*) FROM terminology_project_documents tpd WHERE tpd.project_id = tp.id) as document_count
      FROM terminology_projects tp
      ORDER BY tp.updated_at DESC
    `).all() as (TerminologyProject & { document_count: number })[];
  }

  // ==================== Project-Document Links ====================

  addProjectDocument(projectId: number, documentId: number): void {
    db.prepare(`
      INSERT OR IGNORE INTO terminology_project_documents (project_id, document_id)
      VALUES (?, ?)
    `).run(projectId, documentId);
  }

  removeProjectDocument(projectId: number, documentId: number): void {
    db.prepare(`
      DELETE FROM terminology_project_documents WHERE project_id = ? AND document_id = ?
    `).run(projectId, documentId);
  }

  setProjectDocuments(projectId: number, documentIds: number[]): void {
    const removeAll = db.prepare("DELETE FROM terminology_project_documents WHERE project_id = ?");
    const insert = db.prepare("INSERT OR IGNORE INTO terminology_project_documents (project_id, document_id) VALUES (?, ?)");

    const runInTransaction = db.transaction(() => {
      removeAll.run(projectId);
      for (const docId of documentIds) {
        insert.run(projectId, docId);
      }
    });
    runInTransaction();
  }

  getProjectDocuments(projectId: number): ProjectDocumentInfo[] {
    return db.prepare(`
      SELECT
        d.id,
        d.title,
        sm.language as source_language,
        tm.language as target_language,
        d.status,
        p.title as project_title,
        (SELECT COUNT(*) FROM sentence_alignments sa WHERE sa.document_id = d.id) as alignment_count
      FROM terminology_project_documents tpd
      JOIN documents d ON d.id = tpd.document_id
      LEFT JOIN document_metadata sm ON sm.document_id = d.id AND sm.metadata_type = 'source'
      LEFT JOIN document_metadata tm ON tm.document_id = d.id AND tm.metadata_type = 'target'
      LEFT JOIN projects p ON p.id = d.project_id
      WHERE tpd.project_id = ?
      ORDER BY d.title
    `).all(projectId) as ProjectDocumentInfo[];
  }

  // ==================== Extractions ====================

  getExtractions(): TerminologyExtraction[] {
    return db.prepare(`
      SELECT * FROM terminology_extractions
      ORDER BY created_at DESC
    `).all() as TerminologyExtraction[];
  }

  getExtractionsByProject(projectId: number): TerminologyExtraction[] {
    return db.prepare(`
      SELECT * FROM terminology_extractions
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId) as TerminologyExtraction[];
  }

  getExtraction(id: number): TerminologyExtraction | undefined {
    return db.prepare(`
      SELECT * FROM terminology_extractions WHERE id = ?
    `).get(id) as TerminologyExtraction | undefined;
  }

  saveExtraction(
    projectId: number | null,
    documentIds: number[],
    modelName: string,
    result: string,
    tokenUsage: string | null,
  ): number {
    const stmt = db.prepare(`
      INSERT INTO terminology_extractions (project_id, document_ids, model_name, token_usage, result)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      projectId,
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

  getTermsByProject(projectId: number): TerminologyTerm[] {
    return db.prepare(`
      SELECT tt.* FROM terminology_terms tt
      JOIN terminology_extractions te ON te.id = tt.extraction_id
      WHERE te.project_id = ?
      ORDER BY tt.domain, tt.priority, tt.id
    `).all(projectId) as TerminologyTerm[];
  }

  /** Get all terms for a project with de-duplication (latest extraction wins, manual terms preserved) */
  getAllProjectTerms(projectId: number): TerminologyTerm[] {
    // Get terms from all extractions in this project, ordered by extraction date DESC
    // For duplicate (source_term, target_term) pairs, keep the one from the most recent extraction
    const rows = db.prepare(`
      SELECT tt.* FROM terminology_terms tt
      JOIN terminology_extractions te ON te.id = tt.extraction_id
      WHERE te.project_id = ?
      ORDER BY te.created_at DESC, tt.id
    `).all(projectId) as TerminologyTerm[];

    // Deduplicate by (source_term, target_term) — keep first (most recent extraction)
    const seen = new Set<string>();
    const deduped: TerminologyTerm[] = [];
    for (const t of rows) {
      const key = `${t.source_term.toLowerCase()}|||${t.target_term.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(t);
      }
    }
    return deduped;
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

    if (data.source_term !== undefined)         { fields.push("source_term = ?"); values.push(data.source_term); }
    if (data.target_term !== undefined)         { fields.push("target_term = ?"); values.push(data.target_term); }
    if (data.domain !== undefined)              { fields.push("domain = ?"); values.push(data.domain); }
    if (data.priority !== undefined)            { fields.push("priority = ?"); values.push(data.priority); }
    if (data.context_source !== undefined)      { fields.push("context_source = ?"); values.push(data.context_source); }
    if (data.context_target !== undefined)      { fields.push("context_target = ?"); values.push(data.context_target); }
    if (data.variant_group !== undefined)       { fields.push("variant_group = ?"); values.push(data.variant_group); }
    if (data.verification_status !== undefined) { fields.push("verification_status = ?"); values.push(data.verification_status); }
    if (data.verified_by !== undefined)         { fields.push("verified_by = ?"); values.push(data.verified_by); }
    if (data.verified_at !== undefined)         { fields.push("verified_at = ?"); values.push(data.verified_at); }
    if (data.reviewer_notes !== undefined)      { fields.push("reviewer_notes = ?"); values.push(data.reviewer_notes); }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE terminology_terms SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteTerm(id: number): void {
    db.prepare("DELETE FROM terminology_terms WHERE id = ?").run(id);
  }

  verifyTerm(id: number, status: 'verified' | 'rejected', verifiedBy: string, notes?: string): void {
    db.prepare(`
      UPDATE terminology_terms
      SET verification_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, reviewer_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, verifiedBy, notes || null, id);
  }

  batchVerifyTerms(ids: number[], status: 'verified' | 'rejected', verifiedBy: string): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`
      UPDATE terminology_terms
      SET verification_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(status, verifiedBy, ...ids);
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
