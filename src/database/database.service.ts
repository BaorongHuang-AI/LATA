import {db} from "../db/db";
import {Document, DocumentFile, DocumentMeta, DocumentMetadata, DocumentWithMetadata} from "../types/database";

interface DocumentWithMeta {
    document: {
        id: number;
        source_content: string;
        target_content: string;
    };
    sourceMeta: DocumentMeta | null;
    targetMeta: DocumentMeta | null;
}
class DatabaseService {

    createDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): number {
        // if (!this.db) throw new Error('Database not initialized');

        const stmt = db.prepare(`
            INSERT INTO documents (
                title, document_type, version,
                source_content, target_content, status, project_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            doc.title,
            doc.document_type || null,
            doc.version || null,
            doc.source_content || null,
            doc.target_content || null,
            doc.status || 'draft',
            doc.project_id || null
        );

        return result.lastInsertRowid as number;
    }

    getDocument(id: number): Document | null {
        // if (!this.db) throw new Error('Database not initialized');

        const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
        return stmt.get(id) as Document | null;
    }



    getDocumentWithMetadata(id: number): any | null {

        const document = db.prepare(`
        SELECT 
            id,
            title,
            source_content,
            target_content,
            status
        FROM documents
        WHERE id = ?
    `).get(id);

        if (!document) return null;

        // ---- 2. Get source metadata ----
        const sourceMeta = db.prepare(`
        SELECT *
        FROM document_metadata
        WHERE document_id = ?
          AND metadata_type = 'source'
    `).get(id) as DocumentMetadata | undefined;

        // ---- 3. Get target metadata ----
        const targetMeta = db.prepare(`
        SELECT *
        FROM document_metadata
        WHERE document_id = ?
          AND metadata_type = 'target'
    `).get(id) as DocumentMetadata | undefined;

        return {
            document: {
                id: document.id,
                title: document.title,
                source_content: document.source_content,
                target_content: document.target_content,
            },
            sourceMeta: sourceMeta ?? null,
            targetMeta: targetMeta ?? null,
        };


    }

    getAllDocuments(): Document[] {

        const stmt = db.prepare(`
            SELECT * FROM documents 
            ORDER BY updated_at DESC
        `);
        return stmt.all() as Document[];
    }

    updateDocument(id: number, updates: Partial<Document>): void {

        const allowedFields = [
            'title', 'document_type', 'version',
            'source_content', 'target_content', 'status'
        ];

        const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
        if (fields.length === 0) return;

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => updates[f as keyof Document]);

        const stmt = db.prepare(`
            UPDATE documents 
            SET ${setClause}
            WHERE id = ?
        `);

        stmt.run(...values, id);
    }

    deleteDocument(id: number): void {

        const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
        stmt.run(id);
    }

    // ==================== Metadata CRUD ====================

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

    upsertMetadata(metadata: Omit<DocumentMetadata, 'id' | 'created_at' | 'updated_at'>): void {

        const stmt = db.prepare(`
            INSERT INTO document_metadata (
                document_id, metadata_type, title, source, publisher, publish_date,
                language, original_language, domain,
                authors, translators, editors, contributors,
                doi, isbn, volume, issue, page_range, edition,
                url, country,
                copyright_holder, license, access_level,
                keywords, notes
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?
            )
            ON CONFLICT(document_id, metadata_type) DO UPDATE SET
                title = excluded.title,
                source = excluded.source,
                publisher = excluded.publisher,
                publish_date = excluded.publish_date,
                language = excluded.language,
                original_language = excluded.original_language,
                domain = excluded.domain,
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
            metadata.document_id,
            metadata.metadata_type,
            metadata.title || null,
            metadata.source || null,
            metadata.publisher || null,
            metadata.publish_date || null,
            metadata.language || null,
            metadata.original_language || null,
            metadata.domain || null,
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

    getMetadata(documentId: number, type: 'source' | 'target'): DocumentMetadata | null {

        const stmt = db.prepare(`
            SELECT * FROM document_metadata 
            WHERE document_id = ? AND metadata_type = ?
        `);

        const raw = stmt.get(documentId, type) as any;
        if (!raw) return null;

        // Deserialize JSON arrays
        return {
            ...raw,
            authors: this.deserializeArrayField(raw.authors),
            translators: this.deserializeArrayField(raw.translators),
            editors: this.deserializeArrayField(raw.editors),
            contributors: this.deserializeArrayField(raw.contributors),
            keywords: this.deserializeArrayField(raw.keywords)
        };
    }

    deleteMetadata(documentId: number, type: 'source' | 'target'): void {

        const stmt = db.prepare(`
            DELETE FROM document_metadata 
            WHERE document_id = ? AND metadata_type = ?
        `);
        stmt.run(documentId, type);
    }

    // ==================== Files CRUD ====================

    addDocumentFile(file: Omit<DocumentFile, 'id' | 'created_at'>): number {

        const stmt = db.prepare(`
            INSERT INTO document_files (
                document_id, file_name, file_path, file_type, file_size
            ) VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            file.document_id,
            file.file_name,
            file.file_path,
            file.file_type || null,
            file.file_size || null
        );

        return result.lastInsertRowid as number;
    }

    getDocumentFiles(documentId: number): DocumentFile[] {

        const stmt = db.prepare(`
            SELECT * FROM document_files WHERE document_id = ?
        `);
        return stmt.all(documentId) as DocumentFile[];
    }

    deleteDocumentFile(id: number): void {

        const stmt = db.prepare('DELETE FROM document_files WHERE id = ?');
        stmt.run(id);
    }

    // ==================== Advanced Operations ====================

    saveDocumentWithMetadata(data: {
        document: Omit<Document, 'id' | 'created_at' | 'updated_at'>;
        sourceMetadata?: Omit<DocumentMetadata, 'id' | 'document_id' | 'created_at' | 'updated_at'>;
        targetMetadata?: Omit<DocumentMetadata, 'id' | 'document_id' | 'created_at' | 'updated_at'>;
    }): number {

        // Use transaction for atomicity
        const transaction = db.transaction(() => {
            const docId = this.createDocument(data.document);

            if (data.sourceMetadata) {
                this.upsertMetadata({
                    ...data.sourceMetadata,
                    document_id: docId,
                    metadata_type: 'source'
                });
            }

            if (data.targetMetadata) {
                this.upsertMetadata({
                    ...data.targetMetadata,
                    document_id: docId,
                    metadata_type: 'target'
                });
            }

            return docId;
        });

        return transaction();
    }

    updateDocumentWithMetadata(id: number, data: {
        document?: Partial<Document>;
        sourceMetadata?: Partial<Omit<DocumentMetadata, 'id' | 'document_id' | 'created_at' | 'updated_at'>>;
        targetMetadata?: Partial<Omit<DocumentMetadata, 'id' | 'document_id' | 'created_at' | 'updated_at'>>;
    }): void {

        const transaction = db.transaction(() => {
            if (data.document) {
                this.updateDocument(id, data.document);
            }

            if (data.sourceMetadata) {
                const existing = this.getMetadata(id, 'source');
                this.upsertMetadata({
                    ...(existing || {}),
                    ...data.sourceMetadata,
                    document_id: id,
                    metadata_type: 'source'
                } as any);
            }

            if (data.targetMetadata) {
                const existing = this.getMetadata(id, 'target');
                this.upsertMetadata({
                    ...(existing || {}),
                    ...data.targetMetadata,
                    document_id: id,
                    metadata_type: 'target'
                } as any);
            }
        });

        transaction();
    }

    searchDocuments(query: string): Document[] {

        const stmt = db.prepare(`
            SELECT DISTINCT d.* 
            FROM documents d
            LEFT JOIN document_metadata dm ON d.id = dm.document_id
            WHERE 
                d.title LIKE ? OR
                d.source_content LIKE ? OR
                d.target_content LIKE ? OR
                dm.title LIKE ? OR
                dm.source LIKE ? OR
                dm.keywords LIKE ?
            ORDER BY d.updated_at DESC
        `);

        const searchPattern = `%${query}%`;
        return stmt.all(
            searchPattern, searchPattern, searchPattern,
            searchPattern, searchPattern, searchPattern
        ) as Document[];
    }

    getHomeOverview() {
        const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT d.id) AS totalDocs,
      SUM(COALESCE(sa.totalAlignments, 0)) AS totalAlignments,
      SUM(COALESCE(sa.oneToOne, 0)) AS oneToOne,
      SUM(COALESCE(sa.oneToMany, 0)) AS oneToMany,
      SUM(COALESCE(sa.manyToOne, 0)) AS manyToOne,
      SUM(COALESCE(sa.manyToMany, 0)) AS manyToMany
    FROM documents d
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
  `).get();

        const documents = db.prepare(`
    SELECT
      d.id,
      d.title,
      sm.language AS sourceLang,
      tm.language AS targetLang,
      d.status,
      COALESCE(sa.oneToOne, 0) AS one_to_one,
      COALESCE(sa.oneToMany, 0) AS one_to_many,
      COALESCE(sa.manyToOne, 0) AS many_to_one,
      COALESCE(sa.manyToMany, 0) AS many_to_many,
      COALESCE(sa.totalAlignments, 0) AS total_alignments,
      d.updated_at,
      d.project_id
    FROM documents d
    JOIN document_metadata sm
      ON sm.document_id = d.id AND sm.metadata_type = 'source'
    JOIN document_metadata tm
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
    ORDER BY d.updated_at DESC
  `).all();

        return { stats, documents };
    }

    // ==================== Project-Document Association ====================

    addDocumentToProject(documentId: number, projectId: number): void {
        const stmt = db.prepare('UPDATE documents SET project_id = ? WHERE id = ?');
        stmt.run(projectId, documentId);
    }

    removeDocumentFromProject(documentId: number): void {
        const stmt = db.prepare('UPDATE documents SET project_id = NULL WHERE id = ?');
        stmt.run(documentId);
    }
}

export default new DatabaseService();
