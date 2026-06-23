import { db } from "./db";
import type { SemanticNetworkExtraction } from "../types/semanticNetwork";

class SemanticNetworkService {
  saveExtraction(data: {
    document_ids: string;
    model_name: string;
    token_usage: string | null;
    network_data: string;
  }): number {
    const r = db.prepare(`
      INSERT INTO semantic_networks (document_ids, model_name, token_usage, network_data)
      VALUES (?, ?, ?, ?)
    `).run(data.document_ids, data.model_name, data.token_usage, data.network_data);
    return r.lastInsertRowid as number;
  }

  getExtractions(): SemanticNetworkExtraction[] {
    return db.prepare(`
      SELECT * FROM semantic_networks ORDER BY created_at DESC
    `).all() as SemanticNetworkExtraction[];
  }

  getExtraction(id: number): SemanticNetworkExtraction | undefined {
    return db.prepare("SELECT * FROM semantic_networks WHERE id = ?")
      .get(id) as SemanticNetworkExtraction | undefined;
  }

  deleteExtraction(id: number): void {
    db.prepare("DELETE FROM semantic_networks WHERE id = ?").run(id);
  }
}

export default new SemanticNetworkService();
