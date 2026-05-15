import {db} from "./db";
import {Project, ProjectMetadata, ProjectWithMetadata, ProjectDocument} from "../types/project";

class ProjectService {
    // ==================== Projects CRUD ====================

    createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): number {
        const stmt = db.prepare(`
            INSERT INTO projects (
                title, description, status
            ) VALUES (?, ?, ?)
        `);

        const result = stmt.run(
            project.title,
            project.description || null,
            project.status || 'active'
        );

        return result.lastInsertRowid as number;
    }

    getProject(id: number): Project | null {
        const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        return stmt.get(id) as Project | null;
    }

    getProjectWithMetadata(id: number): ProjectWithMetadata | null {
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;

        if (!project) return null;

        const metadata = db.prepare(`
            SELECT * FROM project_metadata
            WHERE project_id = ?
        `).get(id) as ProjectMetadata | undefined;

        const documentCount = db.prepare(`
            SELECT COUNT(*) as count
            FROM documents
            WHERE project_id = ?
        `).get(id) as {count: number} | undefined;

        return {
            ...project,
            metadata: metadata ?? undefined,
            document_count: documentCount?.count ?? 0
        };
    }

    getAllProjects(): Project[] {
        const stmt = db.prepare(`
            SELECT * FROM projects
            ORDER BY updated_at DESC
        `);
        return stmt.all() as Project[];
    }

    getAllProjectsWithMetadata(): ProjectWithMetadata[] {
        const stmt = db.prepare(`
            SELECT
                p.*,
                pm.id as metadata_id,
                pm.source,
                pm.publisher,
                pm.publish_date,
                pm.source_language,
                pm.target_language,
                pm.domain,
                pm.document_type,
                pm.authors,
                pm.translators,
                pm.editors,
                pm.contributors,
                pm.doi,
                pm.isbn,
                pm.volume,
                pm.issue,
                pm.page_range,
                pm.edition,
                pm.url,
                pm.country,
                pm.copyright_holder,
                pm.license,
                pm.access_level,
                pm.keywords,
                pm.notes,
                (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as document_count
            FROM projects p
            LEFT JOIN project_metadata pm ON pm.project_id = p.id
            ORDER BY p.updated_at DESC
        `);

        const rows = stmt.all() as any[];
        return rows.map(row => {
            const metadata: ProjectMetadata | undefined = row.metadata_id ? {
                id: row.metadata_id,
                project_id: row.id,
                source: row.source,
                publisher: row.publisher,
                publish_date: row.publish_date,
                source_language: row.source_language,
                target_language: row.target_language,
                domain: row.domain,
                document_type: row.document_type,
                authors: this.deserializeArrayField(row.authors),
                translators: this.deserializeArrayField(row.translators),
                editors: this.deserializeArrayField(row.editors),
                contributors: this.deserializeArrayField(row.contributors),
                doi: row.doi,
                isbn: row.isbn,
                volume: row.volume,
                issue: row.issue,
                page_range: row.page_range,
                edition: row.edition,
                url: row.url,
                country: row.country,
                copyright_holder: row.copyright_holder,
                license: row.license,
                access_level: row.access_level,
                keywords: this.deserializeArrayField(row.keywords),
                notes: row.notes
            } : undefined;

            return {
                id: row.id,
                title: row.title,
                description: row.description,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
                metadata,
                document_count: row.document_count
            };
        });
    }

    updateProject(id: number, updates: Partial<Project>): void {
        const allowedFields = ['title', 'description', 'status'];
        const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (fields.length === 0) return;

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => updates[f as keyof Project]);

        const stmt = db.prepare(`
            UPDATE projects
            SET ${setClause}
            WHERE id = ?
        `);

        stmt.run(...values, id);
    }

    deleteProject(id: number): void {
        const transaction = db.transaction(() => {
            // Delete project metadata
            db.prepare('DELETE FROM project_metadata WHERE project_id = ?').run(id);
            // Delete documents in project (cascade should handle this, but explicit for clarity)
            db.prepare('DELETE FROM documents WHERE project_id = ?').run(id);
            // Delete project
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        });
        transaction();
    }

    // ==================== Project Metadata CRUD ====================

    private serializeArrayField(value: any): string | null {
        if (!value) return null;
        if (Array.isArray(value)) {
            return value.length > 0 ? JSON.stringify(value) : null;
        }
        return null;
    }

    private deserializeArrayField(value: string | null): string[] | undefined {
        if (!value) return undefined;
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }

    upsertProjectMetadata(metadata: Omit<ProjectMetadata, 'id' | 'created_at' | 'updated_at'>): void {
        const stmt = db.prepare(`
            INSERT INTO project_metadata (
                project_id, source, publisher, publish_date,
                source_language, target_language, domain, document_type,
                authors, translators, editors, contributors,
                doi, isbn, volume, issue, page_range, edition,
                url, country,
                copyright_holder, license, access_level,
                keywords, notes
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?
            )
            ON CONFLICT(project_id) DO UPDATE SET
                source = excluded.source,
                publisher = excluded.publisher,
                publish_date = excluded.publish_date,
                source_language = excluded.source_language,
                target_language = excluded.target_language,
                domain = excluded.domain,
                document_type = excluded.document_type,
                authors = excluded.authors,
                translators = excluded.translators,
                editors = excluded.editors,
                contributors = excluded.contributors,
                doi = excluded.doi,
                isbn = excluded.isbn,
                volume = excluded.volume,
                issue = excluded.issue,
                page_range = excluded.page_range,
                edition = excluded.edition,
                url = excluded.url,
                country = excluded.country,
                copyright_holder = excluded.copyright_holder,
                license = excluded.license,
                access_level = excluded.access_level,
                keywords = excluded.keywords,
                notes = excluded.notes
        `);

        stmt.run(
            metadata.project_id,
            metadata.source || null,
            metadata.publisher || null,
            metadata.publish_date || null,
            metadata.source_language || null,
            metadata.target_language || null,
            metadata.domain || null,
            metadata.document_type || null,
            this.serializeArrayField(metadata.authors),
            this.serializeArrayField(metadata.translators),
            this.serializeArrayField(metadata.editors),
            this.serializeArrayField(metadata.contributors),
            metadata.doi || null,
            metadata.isbn || null,
            metadata.volume || null,
            metadata.issue || null,
            metadata.page_range || null,
            metadata.edition || null,
            metadata.url || null,
            metadata.country || null,
            metadata.copyright_holder || null,
            metadata.license || null,
            metadata.access_level || null,
            this.serializeArrayField(metadata.keywords),
            metadata.notes || null
        );
    }

    getProjectMetadata(projectId: number): ProjectMetadata | null {
        const stmt = db.prepare(`
            SELECT * FROM project_metadata
            WHERE project_id = ?
        `);

        const raw = stmt.get(projectId) as any;
        if (!raw) return null;

        return {
            ...raw,
            authors: this.deserializeArrayField(raw.authors),
            translators: this.deserializeArrayField(raw.translators),
            editors: this.deserializeArrayField(raw.editors),
            contributors: this.deserializeArrayField(raw.contributors),
            keywords: this.deserializeArrayField(raw.keywords)
        };
    }

    // ==================== Project Documents ====================

    getProjectDocuments(projectId: number): ProjectDocument[] {
        const stmt = db.prepare(`
            SELECT
                d.id,
                d.title,
                d.status,
                d.updated_at,
                sm.language as source_language,
                tm.language as target_language,
                COALESCE(sa.oneToOne, 0) AS one_to_one,
                COALESCE(sa.oneToMany, 0) AS one_to_many,
                COALESCE(sa.manyToOne, 0) AS many_to_one,
                COALESCE(sa.manyToMany, 0) AS many_to_many
            FROM documents d
            LEFT JOIN document_metadata sm
                ON sm.document_id = d.id AND sm.metadata_type = 'source'
            LEFT JOIN document_metadata tm
                ON tm.document_id = d.id AND tm.metadata_type = 'target'
            LEFT JOIN (
                SELECT
                    document_id,
                    COUNT(*) AS totalAlignments,
                    SUM(CASE WHEN source_count = 1 AND target_count = 1 THEN 1 ELSE 0 END) AS oneToOne,
                    SUM(CASE WHEN source_count = 1 AND target_count > 1 THEN 1 ELSE 0 END) AS oneToMany,
                    SUM(CASE WHEN source_count > 1 AND target_count = 1 THEN 1 ELSE 0 END) AS manyToOne,
                    SUM(CASE WHEN source_count > 1 AND target_count > 1 THEN 1 ELSE 0 END) AS manyToMany
                FROM sentence_alignments
                GROUP BY document_id
            ) sa ON sa.document_id = d.id
            WHERE d.project_id = ?
            ORDER BY d.updated_at DESC
        `);

        return stmt.all(projectId) as ProjectDocument[];
    }

    // ==================== Combined Operations ====================

    saveProjectWithMetadata(data: {
        project: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        metadata?: Omit<ProjectMetadata, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
    }): number {
        const transaction = db.transaction(() => {
            const projectId = this.createProject(data.project);

            if (data.metadata) {
                this.upsertProjectMetadata({
                    ...data.metadata,
                    project_id: projectId
                });
            }

            return projectId;
        });

        return transaction();
    }

    updateProjectWithMetadata(id: number, data: {
        project?: Partial<Project>;
        metadata?: Partial<Omit<ProjectMetadata, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
    }): void {
        const transaction = db.transaction(() => {
            if (data.project) {
                this.updateProject(id, data.project);
            }

            if (data.metadata) {
                const existing = this.getProjectMetadata(id);
                this.upsertProjectMetadata({
                    ...(existing || {}),
                    ...data.metadata,
                    project_id: id
                } as any);
            }
        });

        transaction();
    }

    // ==================== Document-Project Association ====================

    addDocumentToProject(documentId: number, projectId: number): void {
        const stmt = db.prepare('UPDATE documents SET project_id = ? WHERE id = ?');
        stmt.run(projectId, documentId);
    }

    removeDocumentFromProject(documentId: number): void {
        const stmt = db.prepare('UPDATE documents SET project_id = NULL WHERE id = ?');
        stmt.run(documentId);
    }

    // ==================== Metadata Inheritance ====================

    getInheritedMetadata(projectId: number): Partial<ProjectMetadata> | null {
        const metadata = this.getProjectMetadata(projectId);
        if (!metadata) return null;

        // Return non-null metadata fields for inheritance
        const inherited: Record<string, any> = {};
        const fields = [
            'source', 'publisher', 'publish_date',
            'source_language', 'target_language', 'domain', 'document_type',
            'authors', 'translators', 'editors', 'contributors',
            'doi', 'isbn', 'volume', 'issue', 'page_range', 'edition',
            'url', 'country', 'copyright_holder', 'license', 'access_level',
            'keywords', 'notes'
        ];

        fields.forEach(field => {
            const value = metadata[field as keyof ProjectMetadata];
            if (value !== undefined && value !== null) {
                inherited[field] = value;
            }
        });

        return inherited as Partial<ProjectMetadata>;
    }
}

export default new ProjectService();
