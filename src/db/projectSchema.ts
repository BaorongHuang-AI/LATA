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

export default initProjectSchema;
