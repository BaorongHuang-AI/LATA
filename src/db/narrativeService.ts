import { db } from "./db";
import type { NarrativeAnalysis } from "../types/narrative";

class NarrativeService {
  save(data: Omit<NarrativeAnalysis, "id" | "created_at">): number {
    const r = db.prepare(`INSERT INTO narrative_analyses (document_id, document_title, model_name, source_language, target_language, data) VALUES (?,?,?,?,?,?)`)
      .run(data.document_id, data.document_title, data.model_name, data.source_language||null, data.target_language||null, JSON.stringify(data.data));
    return r.lastInsertRowid as number;
  }
  getAll(): NarrativeAnalysis[] {
    const rows = db.prepare("SELECT * FROM narrative_analyses ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({...r, data: JSON.parse(r.data)}));
  }
  get(id: number): NarrativeAnalysis|undefined {
    const r = db.prepare("SELECT * FROM narrative_analyses WHERE id=?").get(id) as any;
    if (!r) return undefined;
    return {...r, data: JSON.parse(r.data)};
  }
  delete(id: number): void { db.prepare("DELETE FROM narrative_analyses WHERE id=?").run(id); }
}
export default new NarrativeService();
