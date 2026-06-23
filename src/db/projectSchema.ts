import {db} from "./db";

export const initProjectSchema = () => {
    // ==================== Projects Table ====================
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            -- Basic Info
            title TEXT NOT NULL,
            description TEXT,

            -- Status
            status TEXT DEFAULT 'active',  -- active, archived, completed

            UNIQUE(title)
        );

        CREATE TRIGGER IF NOT EXISTS update_projects_timestamp
        AFTER UPDATE ON projects
        BEGIN
            UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

        CREATE INDEX IF NOT EXISTS idx_projects_title ON projects(title);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    `);

    // ==================== Project Metadata Table ====================
    db.exec(`
        CREATE TABLE IF NOT EXISTS project_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL UNIQUE,

            -- Publication Info
            source TEXT,
            publisher TEXT,
            publish_date TEXT,

            -- Language & Domain
            source_language TEXT,
            target_language TEXT,
            domain TEXT,
            document_type TEXT,

            -- People (stored as JSON arrays)
            authors TEXT,      -- JSON array: ["Author 1", "Author 2"]
            translators TEXT,  -- JSON array
            editors TEXT,      -- JSON array
            contributors TEXT,  -- JSON array

            -- Academic/Publication
            doi TEXT,
            isbn TEXT,
            volume TEXT,
            issue TEXT,
            page_range TEXT,
            edition TEXT,

            -- Source & Links
            url TEXT,
            country TEXT,

            -- Rights & Legal
            copyright_holder TEXT,
            license TEXT,
            access_level TEXT,

            -- Other
            keywords TEXT,  -- JSON array: ["keyword1", "keyword2"]
            notes TEXT,

            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TRIGGER IF NOT EXISTS update_project_metadata_timestamp
        AFTER UPDATE ON project_metadata
        BEGIN
            UPDATE project_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

        CREATE INDEX IF NOT EXISTS idx_project_metadata_project ON project_metadata(project_id);
    `);

    // ==================== Add project_id to documents table ====================
    // Check if project_id column exists in documents table
    const columns = db.pragma("table_info(documents)");
    const hasProjectId = columns.some((col: any) => col.name === 'project_id');

    if (!hasProjectId) {
        db.exec(`
            ALTER TABLE documents ADD COLUMN project_id INTEGER;
            CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
        `);
    }

    // ==================== Add deleted_at to documents table ====================
    const columns2 = db.pragma("table_info(documents)");
    const hasDeletedAt = columns2.some((col: any) => col.name === 'deleted_at');

    if (!hasDeletedAt) {
        db.exec(`
            ALTER TABLE documents ADD COLUMN deleted_at DATETIME;
            CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted_at);
        `);
    }
};

// ==================== Terminology Extraction Schema ====================
export const initTerminologySchema = () => {
    const hasExtractions = db.pragma("table_info(terminology_extractions)");
    if (!hasExtractions || hasExtractions.length === 0) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminology_extractions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_ids TEXT NOT NULL,
                model_name TEXT,
                token_usage TEXT,
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }
    const hasTerms = db.pragma("table_info(terminology_terms)");
    if (!hasTerms || hasTerms.length === 0) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminology_terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                extraction_id INTEGER NOT NULL,
                source_term TEXT NOT NULL,
                target_term TEXT NOT NULL,
                domain TEXT,
                priority TEXT CHECK(priority IN ('high','medium','low')),
                context_source TEXT,
                context_target TEXT,
                variant_group TEXT,
                is_llm_generated INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (extraction_id) REFERENCES terminology_extractions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_terminology_terms_extraction
                ON terminology_terms(extraction_id);
            CREATE INDEX IF NOT EXISTS idx_terminology_terms_domain
                ON terminology_terms(domain);
            CREATE INDEX IF NOT EXISTS idx_terminology_terms_priority
                ON terminology_terms(priority);
        `);
    }
};

// ==================== Terminology Projects Schema ====================
export const initTerminologyProjectSchema = () => {
    // -- terminology_projects table --
    const hasProjects = db.pragma("table_info(terminology_projects)");
    if (!hasProjects || hasProjects.length === 0) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminology_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                source TEXT,
                extractor TEXT,
                reviewer TEXT,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_term_projects_status
                ON terminology_projects(status);
        `);
    }

    // -- terminology_project_documents (many-to-many) --
    const hasProjDocs = db.pragma("table_info(terminology_project_documents)");
    if (!hasProjDocs || hasProjDocs.length === 0) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS terminology_project_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                document_id INTEGER NOT NULL,
                UNIQUE(project_id, document_id),
                FOREIGN KEY (project_id) REFERENCES terminology_projects(id) ON DELETE CASCADE,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_term_proj_docs_project
                ON terminology_project_documents(project_id);
            CREATE INDEX IF NOT EXISTS idx_term_proj_docs_document
                ON terminology_project_documents(document_id);
        `);
    }

    // -- Add project_id to terminology_extractions --
    const extrCols = db.pragma("table_info(terminology_extractions)");
    const hasProjIdOnExtr = extrCols.some((col: any) => col.name === 'project_id');
    if (!hasProjIdOnExtr) {
        db.exec(`ALTER TABLE terminology_extractions ADD COLUMN project_id INTEGER REFERENCES terminology_projects(id) ON DELETE SET NULL`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_term_extractions_project ON terminology_extractions(project_id)`);
    }

    // -- Add verification fields to terminology_terms --
    const termCols = db.pragma("table_info(terminology_terms)");
    const hasVerStatus = termCols.some((col: any) => col.name === 'verification_status');
    if (!hasVerStatus) {
        db.exec(`ALTER TABLE terminology_terms ADD COLUMN verification_status TEXT DEFAULT 'unverified'`);
    }
    const hasVerifiedBy = termCols.some((col: any) => col.name === 'verified_by');
    if (!hasVerifiedBy) {
        db.exec(`ALTER TABLE terminology_terms ADD COLUMN verified_by TEXT`);
    }
    const hasVerifiedAt = termCols.some((col: any) => col.name === 'verified_at');
    if (!hasVerifiedAt) {
        db.exec(`ALTER TABLE terminology_terms ADD COLUMN verified_at DATETIME`);
    }
    const hasReviewerNotes = termCols.some((col: any) => col.name === 'reviewer_notes');
    if (!hasReviewerNotes) {
        db.exec(`ALTER TABLE terminology_terms ADD COLUMN reviewer_notes TEXT`);
    }

    // -- Repair alignment stats (fill NULL source_count / target_count) --
    const sentCols = db.pragma("table_info(sentence_alignments)");
    const hasSrcCount = sentCols.some((col: any) => col.name === 'source_count');
    const hasTgtCount = sentCols.some((col: any) => col.name === 'target_count');

    if (hasSrcCount && hasTgtCount) {
        // Check if any rows have NULL counts
        const nullCount = db.prepare(`
            SELECT COUNT(*) as cnt FROM sentence_alignments
            WHERE source_count IS NULL OR target_count IS NULL
        `).get() as { cnt: number } | undefined;

        if (nullCount && nullCount.cnt > 0) {
            // Parse JSON arrays in JS and update counts
            const rows = db.prepare(`
                SELECT id, source_sentence_keys, target_sentence_keys
                FROM sentence_alignments
                WHERE source_count IS NULL OR target_count IS NULL
            `).all() as Array<{
                id: number;
                source_sentence_keys: string | null;
                target_sentence_keys: string | null;
            }>;

            const updateStmt = db.prepare(`
                UPDATE sentence_alignments
                SET source_count = ?, target_count = ?
                WHERE id = ?
            `);

            const fixCount = db.transaction(() => {
                let fixed = 0;
                for (const row of rows) {
                    let srcCount = 0;
                    let tgtCount = 0;
                    try {
                        if (row.source_sentence_keys) {
                            const arr = JSON.parse(row.source_sentence_keys);
                            srcCount = Array.isArray(arr) ? arr.length : 0;
                        }
                    } catch { srcCount = 0; }
                    try {
                        if (row.target_sentence_keys) {
                            const arr = JSON.parse(row.target_sentence_keys);
                            tgtCount = Array.isArray(arr) ? arr.length : 0;
                        }
                    } catch { tgtCount = 0; }
                    updateStmt.run(srcCount, tgtCount, row.id);
                    fixed++;
                }
                return fixed;
            });

            const fixed = fixCount();
            console.log(`[migration] Repaired alignment stats: ${fixed} rows updated`);
        }
    }
};

export default initProjectSchema;
