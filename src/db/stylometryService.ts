import { db } from "./db";
import type { StylometricProfile } from "../types/stylometry";

class StylometryService {
  saveProfile(profile: Omit<StylometricProfile, "id" | "created_at">): number {
    const r = db.prepare(`
      INSERT INTO stylometric_profiles (document_id, document_title, source_language, target_language, metadata, features)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(profile.document_id, profile.document_title,
      profile.source_language || null, profile.target_language || null,
      JSON.stringify(profile.metadata), JSON.stringify(profile.features));
    return r.lastInsertRowid as number;
  }

  getProfiles(): StylometricProfile[] {
    const rows = db.prepare("SELECT * FROM stylometric_profiles ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata), features: JSON.parse(r.features) }));
  }

  getProfile(id: number): StylometricProfile | undefined {
    const r = db.prepare("SELECT * FROM stylometric_profiles WHERE id = ?").get(id) as any;
    if (!r) return undefined;
    return { ...r, metadata: JSON.parse(r.metadata), features: JSON.parse(r.features) };
  }

  deleteProfile(id: number): void {
    db.prepare("DELETE FROM stylometric_profiles WHERE id = ?").run(id);
  }
}

export default new StylometryService();
