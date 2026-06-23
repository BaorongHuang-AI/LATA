import { db } from "./db";
import type { AnalyticsExperiment, AnalyticsResult, AnalyticsReport } from "../types/analytics";

class AnalyticsService {
  // ==================== Experiments ====================

  createExperiment(data: {
    title: string;
    research_question?: string;
    hypothesis?: string;
    configuration: string;
  }): number {
    const r = db.prepare(`
      INSERT INTO analytics_experiments (title, research_question, hypothesis, configuration, status)
      VALUES (?, ?, ?, ?, 'draft')
    `).run(data.title, data.research_question || null, data.hypothesis || null, data.configuration);
    return r.lastInsertRowid as number;
  }

  updateExperiment(id: number, data: Partial<Pick<AnalyticsExperiment, 'title' | 'status' | 'configuration'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.configuration !== undefined) { fields.push("configuration = ?"); values.push(data.configuration); }
    if (fields.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE analytics_experiments SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteExperiment(id: number): void {
    db.prepare("DELETE FROM analytics_experiments WHERE id = ?").run(id);
  }

  getExperiment(id: number): AnalyticsExperiment | undefined {
    return db.prepare("SELECT * FROM analytics_experiments WHERE id = ?").get(id) as AnalyticsExperiment | undefined;
  }

  getAllExperiments(): AnalyticsExperiment[] {
    return db.prepare("SELECT * FROM analytics_experiments ORDER BY created_at DESC").all() as AnalyticsExperiment[];
  }

  // ==================== Results ====================

  saveResults(results: Omit<AnalyticsResult, 'id'>[]): void {
    const stmt = db.prepare(`
      INSERT INTO analytics_results (experiment_id, document_id, group_name, document_title, source_language, target_language, metrics)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const r of results) {
        stmt.run(r.experiment_id, r.document_id, r.group_name,
          r.document_title || null, r.source_language || null, r.target_language || null,
          JSON.stringify(r.metrics));
      }
    });
    tx();
  }

  deleteResults(experimentId: number): void {
    db.prepare("DELETE FROM analytics_results WHERE experiment_id = ?").run(experimentId);
  }

  getResults(experimentId: number): AnalyticsResult[] {
    const rows = db.prepare(`
      SELECT * FROM analytics_results WHERE experiment_id = ? ORDER BY group_name, document_id
    `).all(experimentId) as Array<Omit<AnalyticsResult, 'metrics'> & { metrics: string }>;
    return rows.map((r) => ({ ...r, metrics: JSON.parse(r.metrics) }));
  }

  // ==================== Reports ====================

  saveReport(experimentId: number, format: string, content: string): number {
    const r = db.prepare(`
      INSERT INTO analytics_reports (experiment_id, format, content) VALUES (?, ?, ?)
    `).run(experimentId, format, content);
    return r.lastInsertRowid as number;
  }

  getReport(experimentId: number): AnalyticsReport | undefined {
    return db.prepare("SELECT * FROM analytics_reports WHERE experiment_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(experimentId) as AnalyticsReport | undefined;
  }
}

export default new AnalyticsService();
