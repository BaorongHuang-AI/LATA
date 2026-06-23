import {db} from "./db";
import {initProjectSchema, initTerminologySchema, initTerminologyProjectSchema, initAnalyticsSchema, initSemanticNetworkSchema} from "./projectSchema";
//
// const Database = require('better-sqlite3');
// const path = require('path');
// const { app } = require('electron');
// const dbPath = path.join(app.getPath('userData'), 'experiment.sqlite');
// const db = new Database(dbPath);

// // console.log('Database path:', dbPath);
// const db = new Database(
//     // path.join(process.env.HOME || process.env.APPDATA, 'experiment.sqlite')
//         path.join( 'experiment.sqlite')
//
// );
//
// const exeDir = path.dirname(app.getPath('exe'));
//
// // 将数据库放在 exe 同级目录下
// const dbPath = path.join(exeDir, 'experiment.sqlite');

const schema = `
CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    source_text TEXT NOT NULL,

    start_time INTEGER NOT NULL,  -- Unix ms
    end_time INTEGER,             -- Unix ms

    device_info TEXT,             -- optional JSON
    notes TEXT,

    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX  IF NOT EXISTS  idx_session_user ON session(user_id);
CREATE INDEX IF NOT EXISTS  idx_session_task ON session(task_id);

CREATE TABLE IF NOT EXISTS translation_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    version_index INTEGER NOT NULL,
    translated_text TEXT NOT NULL,
    is_final INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keystroke (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,

    event_type TEXT NOT NULL,   -- keydown | input | paste | cut | undo | redo
    key TEXT,                   -- e.g. "a", "Backspace", "Enter"
    code TEXT,                  -- e.g. "KeyA", "Backspace"

    cursor_start INTEGER,       -- caret position before
    cursor_end INTEGER,         -- caret position after

    content_before TEXT,
    content_after TEXT,

    timestamp INTEGER NOT NULL, -- Unix ms
    delta_ms INTEGER,           -- time since previous keystroke

    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS  idx_keystroke_session ON keystroke(session_id);
CREATE INDEX IF NOT EXISTS  idx_keystroke_time ON keystroke(timestamp);

CREATE TABLE IF NOT EXISTS ai_suggestion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,

    suggestion_type TEXT NOT NULL, -- e.g. "full_translation", "sentence", "term"
    trigger_source TEXT NOT NULL,  -- "auto" | "button" | "shortcut"

    source_segment TEXT NOT NULL,
    ai_output TEXT NOT NULL,

    user_version_before TEXT,
    user_version_after TEXT,

    accepted INTEGER NOT NULL DEFAULT 0, -- 0 = rejected, 1 = accepted
    latency_ms INTEGER,                  -- AI response time

    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),

    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS  idx_ai_session ON ai_suggestion(session_id);
CREATE INDEX IF NOT EXISTS  idx_ai_accept ON ai_suggestion(accepted);


CREATE TABLE IF NOT EXISTS edit_action (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,

    action_type TEXT NOT NULL,  -- insert | delete | replace | undo | redo
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,

    text_before TEXT,
    text_after TEXT,

    related_keystroke_id INTEGER,
    timestamp INTEGER NOT NULL,

    FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
    FOREIGN KEY (related_keystroke_id) REFERENCES keystroke(id)
);

CREATE INDEX IF NOT EXISTS  idx_edit_session ON edit_action(session_id);
CREATE INDEX IF NOT EXISTS  idx_edit_time ON edit_action(timestamp);
CREATE TABLE IF NOT EXISTS exercise_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    source_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    source_text TEXT NOT NULL,
    reference_translation TEXT,
    directions TEXT,
    exercise_type TEXT DEFAULT 'standard'
        CHECK (exercise_type IN (
            'standard','fill_blank','multiple_choice',
            'reorder','image','dialogue','reverse','timed'
        )),
    difficulty_level TEXT
        CHECK (difficulty_level IN ('easy','medium','hard')),
    cefr_level TEXT
        CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    image_url TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS highlight (
  id TEXT PRIMARY KEY,
  session_id INTEGER,
  start_index INTEGER,
  end_index INTEGER,
  comment TEXT,
  type TEXT,
  suggestion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS exercise_tag_map (
    exercise_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, tag_id),
    FOREIGN KEY (exercise_id) REFERENCES exercise_template(id)
        ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES exercise_tag(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exercise_cefr
ON exercise_template(cefr_level);

CREATE INDEX IF NOT EXISTS idx_exercise_type
ON exercise_template(exercise_type);

CREATE TABLE IF NOT EXISTS document (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  language TEXT,           -- en / fr
  author TEXT,
  translator TEXT,
  strategy_profile TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paragraph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  xml_id TEXT,             -- p1
  position INTEGER,
  FOREIGN KEY (document_id) REFERENCES document(id)
);


CREATE TABLE IF NOT EXISTS  alignment_group (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('para', 'sent', 'word')),
  from_document_id INTEGER,
  to_document_id INTEGER,
  parent_alignment_id INTEGER,   -- nesting support
  FOREIGN KEY (from_document_id) REFERENCES document(id),
  FOREIGN KEY (to_document_id) REFERENCES document(id),
  FOREIGN KEY (parent_alignment_id) REFERENCES alignment_group(id)
);

CREATE TABLE IF NOT EXISTS alignment_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alignment_group_id INTEGER NOT NULL,
  source_ids TEXT NOT NULL,   -- e.g. "s1 s2" or "s1:w1"
  target_ids TEXT NOT NULL,   -- e.g. "s1" or "s1:w3"
  FOREIGN KEY (alignment_group_id) REFERENCES alignment_group(id)
);

CREATE TABLE IF NOT EXISTS  alignment_annotation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alignment_link_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('strategy', 'user_comment')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alignment_link_id) REFERENCES alignment_link(id)
);

CREATE TABLE IF NOT EXISTS alignment_confidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alignment_link_id INTEGER NOT NULL,
  score REAL CHECK(score >= 0 AND score <= 1),
  source TEXT CHECK(source IN ('aligner', 'human', 'llm', 'consensus')),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alignment_link_id) REFERENCES alignment_link(id)
);

CREATE TABLE IF NOT EXISTS  text_annotation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  target_type TEXT CHECK(
    target_type IN ('paragraph', 'sentence', 'word', 'alignment')
  ),
  target_id INTEGER NOT NULL,

  annotation_type TEXT CHECK(
    annotation_type IN ('comment', 'question', 'strategy', 'error', 'note')
  ),

  content TEXT NOT NULL,
  color TEXT,                -- UI highlight color
  is_private INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,

  FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE TABLE IF NOT EXISTS alignment_version (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_pair TEXT NOT NULL,   -- e.g. "doc1-doc2"
  version_number INTEGER NOT NULL,
  created_by INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES app_user(id)
);

CREATE TABLE IF NOT EXISTS alignment_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL,

  total_para_links INTEGER,
  total_sent_links INTEGER,
  total_word_links INTEGER,

  one_to_one INTEGER,
  one_to_many INTEGER,
  many_to_one INTEGER,
  many_to_many INTEGER,

  avg_confidence REAL,

  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES alignment_version(id)
);

CREATE TABLE IF NOT EXISTS llm_alignment_suggestion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  source_type TEXT CHECK(source_type IN ('sentence', 'word')),
  source_ids TEXT NOT NULL,    -- same xtarget style

  target_ids TEXT NOT NULL,

  suggested_type TEXT CHECK(
    suggested_type IN ('para', 'sent', 'word')
  ),

  confidence REAL,
  rationale TEXT,              -- chain-of-thought summary
  model_name TEXT,             -- gpt-4o / qwen / llama
  prompt_version TEXT,

  status TEXT CHECK(
    status IN ('pending', 'accepted', 'rejected')
  ) DEFAULT 'pending',

  reviewed_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,

  FOREIGN KEY (reviewed_by) REFERENCES app_user(id)
);

CREATE VIEW IF NOT EXISTS v_all_annotations AS
SELECT
  ta.id,
  u.username,
  ta.target_type,
  ta.target_id,
  ta.annotation_type,
  ta.content,
  ta.color,
  ta.created_at
FROM text_annotation ta
JOIN app_user u ON u.id = ta.user_id;

CREATE TABLE IF NOT EXISTS sys_user (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_seq TEXT,
    real_name TEXT,
    user_name TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    department TEXT,
    cellphone TEXT UNIQUE,
    email TEXT UNIQUE,
    address TEXT,
    gender INTEGER,      
    age INTEGER,
    status INTEGER NOT NULL DEFAULT 1,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_first_login INTEGER DEFAULT 1,
    enabled INTEGER DEFAULT 1,
    locked INTEGER DEFAULT 0,
    expired INTEGER DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    client_name TEXT,
    created_ip TEXT,
    updated_ip TEXT,
    creator TEXT,
    modifier TEXT,
    major TEXT,
    grade TEXT,
    university TEXT
);

CREATE TRIGGER IF NOT EXISTS trg_sys_user_updated_at
AFTER UPDATE ON sys_user
FOR EACH ROW
BEGIN
    UPDATE sys_user
    SET updated_at = CURRENT_TIMESTAMP
    WHERE user_id = OLD.user_id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_user_username ON sys_user(user_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_user_email ON sys_user(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_user_cellphone ON sys_user(cellphone);

CREATE TABLE IF NOT EXISTS user_session (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS llm_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    openrouter_api_key TEXT,
    default_model TEXT NOT NULL DEFAULT 'openai/gpt-4o',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);




CREATE TABLE IF NOT EXISTS llm_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER,
    feature TEXT,            -- alignment / annotation / hint / chat
    model TEXT,

    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,

    cost_usd REAL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS align_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL, -- unique project ID
    title TEXT NOT NULL,
    source_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    domain TEXT,
    source_text TEXT,
    target_text TEXT,
    attachments TEXT, -- JSON array of file paths
    status TEXT DEFAULT 'pending', -- pending, review, completed
    one_to_one INTEGER DEFAULT 0,
    one_to_many INTEGER DEFAULT 0,
    many_to_one INTEGER DEFAULT 0,
    many_to_many INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==================== Main Documents Table ====================
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Basic Info
    title TEXT NOT NULL,
    document_type TEXT,  -- article, book, report, etc.
    version TEXT,
   
    
    -- Content
    source_content TEXT,  -- Original content
    target_content TEXT,  -- Translated content
    
    -- Status
    status TEXT DEFAULT 'draft',  -- draft, in_progress, completed, archived
    
    UNIQUE(title)
);

CREATE TABLE IF NOT EXISTS document_alignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,

    one_to_one INTEGER DEFAULT 0,
    one_to_many INTEGER DEFAULT 0,
    many_to_one INTEGER DEFAULT 0,
    many_to_many INTEGER DEFAULT 0,

    status TEXT DEFAULT 'processing', -- processing | completed | review

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id)
);
-- ==================== Document Metadata Table ====================
CREATE TABLE IF NOT EXISTS document_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    metadata_type TEXT NOT NULL,  -- 'source' or 'target'
    
    -- Publication Info
    title TEXT,
    source TEXT,
    publisher TEXT,
    publish_date DATE,
    
    -- Language & Domain
    language TEXT,
    original_language TEXT,
    domain TEXT,
    documentType TEXT,
    -- People (stored as JSON arrays)
    authors TEXT,  -- JSON array: ["Author 1", "Author 2"]
    translators TEXT,  -- JSON array
    editors TEXT,  -- JSON array
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
    
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE(document_id, metadata_type)
);

-- ==================== Document Files Table ====================
-- For storing attachments or related files
CREATE TABLE IF NOT EXISTS document_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,  -- pdf, docx, txt, etc.
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- ==================== Indexes for Performance ====================
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_metadata_document ON document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_metadata_type ON document_metadata(metadata_type);
CREATE INDEX IF NOT EXISTS idx_files_document ON document_files(document_id);

-- ==================== Triggers for updated_at ====================
CREATE TRIGGER IF NOT EXISTS update_documents_timestamp 
AFTER UPDATE ON documents
BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_metadata_timestamp 
AFTER UPDATE ON document_metadata
BEGIN
    UPDATE document_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS document_paragraphs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  side TEXT CHECK(side IN ('source','target')),
  para_index INTEGER,
  text TEXT NOT NULL,
    comment TEXT,
  isFavorite INTEGER,
);

-- =====================
-- Paragraph Links
-- =====================

CREATE TABLE IF NOT EXISTS paragraph_alignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,

  -- Algorithm-space (sequence indices)
  source_indices TEXT NOT NULL,   -- JSON array: [0,1]
  target_indices TEXT NOT NULL,   -- JSON array: [0]

  -- DB-space (resolved paragraph IDs)
  source_para_ids TEXT NOT NULL,  -- JSON array: [12,13]
  target_para_ids TEXT NOT NULL,  -- JSON array: [21]

  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,

  confidence REAL NOT NULL,
  strategy TEXT,
  status TEXT DEFAULT 'pending',
  comment TEXT,
  isFavorite INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (json_valid(source_indices)),
  CHECK (json_valid(target_indices)),
  CHECK (json_valid(source_para_ids)),
  CHECK (json_valid(target_para_ids))
);

CREATE INDEX IF NOT EXISTS idx_para_alignments_doc
  ON paragraph_alignments(document_id);


//TODO 重新设计
CREATE TABLE IF NOT EXISTS document_sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paragraph_id INTEGER,
  side TEXT CHECK(side IN ('source','target')),
  sentence_index INTEGER,
  text TEXT,
  comment TEXT,
  isFavorite INTEGER,
);

-- =====================
-- Sentence Links
-- =====================
CREATE TABLE IF NOT EXISTS sentence_alignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  paragraph_alignment_id INTEGER,
  confidence REAL,
  strategy TEXT,
  comment TEXT,
  isFavorite INTEGER,
);

CREATE TABLE IF NOT EXISTS document_sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  paragraph_id INTEGER NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('source', 'target')),
  sentence_index INTEGER NOT NULL,
  sentence_key TEXT NOT NULL UNIQUE, -- e.g., 'p1-s1', 'p2-s3'
  text TEXT NOT NULL,
  comment TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sentences_document 
  ON document_sentences(document_id);
CREATE INDEX IF NOT EXISTS idx_sentences_paragraph 
  ON document_sentences(document_id, paragraph_id, side);
CREATE INDEX IF NOT EXISTS idx_sentences_key 
  ON document_sentences(sentence_key);

-- =====================
-- Sentence Alignments
-- =====================
CREATE TABLE IF NOT EXISTS sentence_alignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  source_paragraph_id INTEGER NOT NULL,
  target_paragraph_id INTEGER NOT NULL,
  source_sentence_keys TEXT NOT NULL, -- JSON array: ["p1-s1"] or ["p1-s1", "p1-s2"]
  target_sentence_keys TEXT NOT NULL, -- JSON array: ["p2-s1"] or ["p2-s1", "p2-s2"]
  confidence REAL,
  strategy TEXT NOT NULL, -- 'llm' or 'gale-church'
  comment TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_paragraph_id) REFERENCES paragraphs(id) ON DELETE CASCADE,
  FOREIGN KEY (target_paragraph_id) REFERENCES paragraphs(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alignments_document 
  ON sentence_alignments(document_id);
CREATE INDEX IF NOT EXISTS idx_alignments_paragraphs
  ON sentence_alignments(source_paragraph_id, target_paragraph_id);

-- =====================
-- Word Tables
-- =====================
CREATE TABLE IF NOT EXISTS document_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  sentence_key TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('source', 'target')),
  word_index INTEGER NOT NULL,
  word_key TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  comment TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_words_document ON document_words(document_id);
CREATE INDEX IF NOT EXISTS idx_words_sentence ON document_words(sentence_key, side);

CREATE TABLE IF NOT EXISTS word_alignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  source_sentence_key TEXT NOT NULL,
  target_sentence_key TEXT NOT NULL,
  source_word_keys TEXT NOT NULL,
  target_word_keys TEXT NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  confidence REAL,
  strategy TEXT,
  comment TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_word_alignments_doc ON word_alignments(document_id);
CREATE INDEX IF NOT EXISTS idx_word_alignments_pair ON word_alignments(source_sentence_key, target_sentence_key);
`;

const schemaNew = `


PRAGMA foreign_keys = false;


-- ----------------------------
-- Table structure for ai_suggestion
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "ai_suggestion" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" INTEGER NOT NULL,
  "suggestion_type" TEXT NOT NULL,
  "trigger_source" TEXT NOT NULL,
  "source_segment" TEXT NOT NULL,
  "ai_output" TEXT NOT NULL,
  "user_version_before" TEXT,
  "user_version_after" TEXT,
  "accepted" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY ("session_id") REFERENCES "session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for align_tasks
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "align_tasks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "source_language" TEXT NOT NULL,
  "target_language" TEXT NOT NULL,
  "domain" TEXT,
  "source_text" TEXT,
  "target_text" TEXT,
  "attachments" TEXT,
  "status" TEXT DEFAULT 'pending',
  "one_to_one" INTEGER DEFAULT 0,
  "one_to_many" INTEGER DEFAULT 0,
  "many_to_one" INTEGER DEFAULT 0,
  "many_to_many" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- Table structure for alignment_annotation
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "alignment_annotation" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "alignment_link_id" INTEGER NOT NULL,
  "type" TEXT,
  "content" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("alignment_link_id") REFERENCES "alignment_link" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for alignment_confidence
-- ----------------------------
CREATE TABLE IF NOT EXISTS  "alignment_confidence" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "alignment_link_id" INTEGER NOT NULL,
  "score" REAL CHECK (score >= 0 AND score <= 1),
  "source" TEXT CHECK (source IN ('aligner', 'human', 'llm', 'consensus')),
  "note" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("alignment_link_id") REFERENCES "alignment_link" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);


-- ----------------------------
-- Table structure for alignment_link
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "alignment_link" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "alignment_group_id" INTEGER NOT NULL,
  "source_ids" TEXT NOT NULL,
  "target_ids" TEXT NOT NULL,
  FOREIGN KEY ("alignment_group_id") REFERENCES "alignment_group" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for alignment_statistics
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "alignment_statistics" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "version_id" INTEGER NOT NULL,
  "total_para_links" INTEGER,
  "total_sent_links" INTEGER,
  "total_word_links" INTEGER,
  "one_to_one" INTEGER,
  "one_to_many" INTEGER,
  "many_to_one" INTEGER,
  "many_to_many" INTEGER,
  "avg_confidence" REAL,
  "generated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("version_id") REFERENCES "alignment_version" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for alignment_version
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "alignment_version" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_pair" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "created_by" INTEGER,
  "description" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("created_by") REFERENCES "app_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);


-- ----------------------------
-- Table structure for document_alignments
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_alignments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "one_to_one" INTEGER DEFAULT 0,
  "one_to_many" INTEGER DEFAULT 0,
  "many_to_one" INTEGER DEFAULT 0,
  "many_to_many" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'processing',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  UNIQUE ("document_id" ASC)
);

-- ----------------------------
-- Table structure for document_files
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_files" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_type" TEXT,
  "file_size" INTEGER,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for document_metadata
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_metadata" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "metadata_type" TEXT NOT NULL,
  "title" TEXT,
  "source" TEXT,
  "documentType" TEXT,
  "publisher" TEXT,
  "publish_date" DATE,
  "language" TEXT,
  "original_language" TEXT,
  "domain" TEXT,
  "authors" TEXT,
  "translators" TEXT,
  "editors" TEXT,
  "contributors" TEXT,
  "doi" TEXT,
  "isbn" TEXT,
  "volume" TEXT,
  "issue" TEXT,
  "page_range" TEXT,
  "edition" TEXT,
  "url" TEXT,
  "country" TEXT,
  "copyright_holder" TEXT,
  "license" TEXT,
  "access_level" TEXT,
  "keywords" TEXT,
  "notes" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  UNIQUE ("document_id" ASC, "metadata_type" ASC)
);

-- ----------------------------
-- Table structure for document_paraalign_history
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_paraalign_history" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" TEXT NOT NULL,
  "action" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("document_id" ASC, "version" ASC)
);

-- ----------------------------
-- Table structure for document_paragraphs
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_paragraphs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "side" TEXT,
  "para_index" INTEGER,
  "text" TEXT NOT NULL,
  "comment" TEXT,
  "isFavorite" integer,
    CONSTRAINT "1" CHECK (side IN ('source','target'))
);

-- ----------------------------
-- Table structure for document_sentalign_history
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_sentalign_history" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" TEXT NOT NULL,
  "action" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("document_id" ASC, "version" ASC)
);

-- ----------------------------
-- Table structure for document_sentences
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "document_sentences" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "paragraph_id" INTEGER,
  "side" TEXT,
  "sentence_index" INTEGER,
  "text" TEXT,
  "document_id" INTEGER,
  "sentence_key" TEXT,
  "isFavorite" integer,
  "comment" TEXT,
  CONSTRAINT "1" CHECK (side IN ('source','target'))
);

-- ----------------------------
-- Table structure for documents
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "documents" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "document_type" TEXT,
  "version" TEXT,
  "source_content" TEXT,
  "target_content" TEXT,
  "status" TEXT DEFAULT 'draft',
  UNIQUE ("title" ASC)
);

-- ----------------------------
-- Table structure for edit_action
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "edit_action" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" INTEGER NOT NULL,
  "action_type" TEXT NOT NULL,
  "range_start" INTEGER NOT NULL,
  "range_end" INTEGER NOT NULL,
  "text_before" TEXT,
  "text_after" TEXT,
  "related_keystroke_id" INTEGER,
  "timestamp" INTEGER NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY ("related_keystroke_id") REFERENCES "keystroke" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for exercise_tag
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "exercise_tag" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "frequency" integer,
  UNIQUE ("name" ASC)
);

-- ----------------------------
-- Table structure for exercise_tag_map
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "exercise_tag_map" (
  "exercise_id" INTEGER NOT NULL,
  "tag_id" INTEGER NOT NULL,
  PRIMARY KEY ("exercise_id", "tag_id"),
  FOREIGN KEY ("exercise_id") REFERENCES "exercise_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY ("tag_id") REFERENCES "exercise_tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for exercise_template
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "exercise_template" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "source_language" TEXT NOT NULL,
  "target_language" TEXT NOT NULL,
  "source_text" TEXT NOT NULL,
  "reference_translation" TEXT,
  "directions" TEXT,
  "exercise_type" TEXT DEFAULT 'standard',
  "difficulty_level" TEXT,
  "cefr_level" TEXT,
  "image_url" TEXT,
  "created_by" INTEGER,
  "created_at" TEXT DEFAULT (datetime('now'))
);

-- ----------------------------
-- Table structure for highlight
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "highlight" (
  "id" TEXT,
  "session_id" INTEGER,
  "start_index" INTEGER,
  "end_index" INTEGER,
  "comment" TEXT,
  "type" TEXT,
  "suggestion" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Table structure for keystroke
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "keystroke" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "key" TEXT,
  "code" TEXT,
  "cursor_start" INTEGER,
  "cursor_end" INTEGER,
  "content_before" TEXT,
  "content_after" TEXT,
  "timestamp" INTEGER NOT NULL,
  "delta_ms" INTEGER,
  FOREIGN KEY ("session_id") REFERENCES "session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for llm_alignment_suggestion
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "llm_alignment_suggestion" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_type" TEXT,
  "source_ids" TEXT NOT NULL,
  "target_ids" TEXT NOT NULL,
  "suggested_type" TEXT,
  "confidence" REAL,
  "rationale" TEXT,
  "model_name" TEXT,
  "prompt_version" TEXT,
  "status" TEXT DEFAULT 'pending',
  "reviewed_by" INTEGER,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" DATETIME,
  FOREIGN KEY ("reviewed_by") REFERENCES "app_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for llm_model_credentials
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "llm_model_credentials" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "model_id" TEXT NOT NULL,
  "api_key_enc" TEXT NOT NULL,
  "base_url" TEXT NOT NULL,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("model_id" ASC)
);

-- ----------------------------
-- Table structure for llm_prompts
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "llm_prompts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "task_type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "user_prompt" TEXT NOT NULL,
  "system_prompt" TEXT,
  "model" TEXT,
  "temperature" REAL DEFAULT 0.2,
  "max_tokens" INTEGER DEFAULT 2048,
  "is_active" INTEGER DEFAULT 1,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("task_type" ASC, "name" ASC)
);

-- ----------------------------
-- Table structure for llm_settings
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "llm_settings" (
  "id" INTEGER,
  "base_url" TEXT,
  "api_key" TEXT,
  "is_default" integer NOT NULL DEFAULT 0,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "api_key_enc" TEXT,
  "model_name" TEXT,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Table structure for llm_usage
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "llm_usage" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "feature" TEXT,
  "model" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "total_tokens" INTEGER,
  "cost_usd" REAL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);



-- ----------------------------
-- Table structure for paragraph_alignments
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "paragraph_alignments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "source_para_ids" TEXT NOT NULL,
  "target_para_ids" TEXT NOT NULL,
  "source_indices" TEXT,
  "target_indices" TEXT,
  "source_count" INTEGER NOT NULL,
  "target_count" INTEGER NOT NULL,
  "confidence" REAL NOT NULL,
  "strategy" TEXT,
  "comment" TEXT,
  "isFavorite" integer,
  "status" TEXT DEFAULT 'pending',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "2" CHECK (json_valid(source_para_ids)),
  CONSTRAINT "3" CHECK (json_valid(target_para_ids))
);

-- ----------------------------
-- Table structure for sentence_alignment_map
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "sentence_alignment_map" (
  "sentence_alignment_id" INTEGER,
  "sentence_id" INTEGER,
  "side" TEXT
);

-- ----------------------------
-- Table structure for sentence_alignments
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "sentence_alignments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "paragraph_alignment_id" INTEGER,
  "confidence" REAL,
  "strategy" TEXT,
  "document_id" INTEGER,
  "comment" TEXT,
  "isFavorite" integer,
  "status" TEXT DEFAULT 'pending',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "source_paragraph_id" text,
  "target_paragraph_id" text,
  "source_sentence_keys" TEXT,
  "target_sentence_keys" TEXT,
  "explanation" TEXT,
  "source_count" INTEGER,
  "target_count" INTEGER
);

-- ----------------------------
-- Table structure for document_words
-- ----------------------------

CREATE TABLE IF NOT EXISTS "document_words" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "sentence_key" TEXT NOT NULL,
  "side" TEXT NOT NULL CHECK(side IN ('source', 'target')),
  "word_index" INTEGER NOT NULL,
  "word_key" TEXT NOT NULL UNIQUE,
  "text" TEXT NOT NULL,
  "comment" TEXT,
  "is_favorite" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_words_document" ON "document_words" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_words_sentence" ON "document_words" ("sentence_key", "side");

-- ----------------------------
-- Table structure for word_alignments
-- ----------------------------

CREATE TABLE IF NOT EXISTS "word_alignments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "document_id" INTEGER NOT NULL,
  "source_sentence_key" TEXT NOT NULL,
  "target_sentence_key" TEXT NOT NULL,
  "source_word_keys" TEXT NOT NULL,
  "target_word_keys" TEXT NOT NULL,
  "source_count" INTEGER NOT NULL,
  "target_count" INTEGER NOT NULL,
  "confidence" REAL,
  "strategy" TEXT,
  "comment" TEXT,
  "is_favorite" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_word_alignments_doc" ON "word_alignments" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_word_alignments_pair" ON "word_alignments" ("source_sentence_key", "target_sentence_key");

-- ----------------------------
-- Table structure for session
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "session" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" TEXT NOT NULL,
  "task_id" TEXT,
  "question_id" INTEGER,
  "source_text" TEXT,
  "condition" TEXT,
  "started_at" INTEGER NOT NULL,
  "ended_at" INTEGER,
  "device_info" TEXT,
  "notes" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);



-- ----------------------------
-- Table structure for sys_user
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "sys_user" (
  "user_id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_seq" TEXT,
  "real_name" TEXT,
  "user_name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "department" TEXT,
  "cellphone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "gender" INTEGER,
  "age" INTEGER,
  "status" INTEGER NOT NULL DEFAULT 1,
  "avatar" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "is_first_login" INTEGER DEFAULT 1,
  "enabled" INTEGER DEFAULT 1,
  "locked" INTEGER DEFAULT 0,
  "expired" INTEGER DEFAULT 0,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "client_name" TEXT,
  "created_ip" TEXT,
  "updated_ip" TEXT,
  "creator" TEXT,
  "modifier" TEXT,
  "major" TEXT,
  "grade" TEXT,
  "university" TEXT,
  UNIQUE ("user_name" ASC),
  UNIQUE ("cellphone" ASC),
  UNIQUE ("email" ASC)
);

-- ----------------------------
-- Table structure for text_annotation
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "text_annotation" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "target_type" TEXT,
  "target_id" INTEGER NOT NULL,
  "annotation_type" TEXT,
  "content" TEXT NOT NULL,
  "color" TEXT,
  "is_private" INTEGER DEFAULT 0,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME,
  FOREIGN KEY ("user_id") REFERENCES "app_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- ----------------------------
-- Table structure for translation_tags
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "translation_tags" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sample" TEXT,
  "color" TEXT DEFAULT '#38bdf8',
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("name" ASC)
);

-- ----------------------------
-- Table structure for translation_version
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "translation_version" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "session_id" INTEGER NOT NULL,
  "version_index" INTEGER NOT NULL,
  "translated_text" TEXT NOT NULL,
  "is_final" INTEGER DEFAULT 0,
  "created_at" INTEGER NOT NULL
);

-- ----------------------------
-- Table structure for user_session
-- ----------------------------

CREATE TABLE IF NOT EXISTS  "user_session" (
  "id" INTEGER,
  "token" TEXT NOT NULL,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- View structure for v_all_annotations
-- ----------------------------
DROP VIEW IF EXISTS "v_all_annotations";
CREATE VIEW "v_all_annotations" AS SELECT
  ta.id,
  u.username,
  ta.target_type,
  ta.target_id,
  ta.annotation_type,
  ta.content,
  ta.color,
  ta.created_at
FROM text_annotation ta
JOIN app_user u ON u.id = ta.user_id;


-- ----------------------------
-- Indexes structure for table ai_suggestion
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_ai_accept"
ON "ai_suggestion" (
  "accepted" ASC
);
CREATE INDEX IF NOT EXISTS "idx_ai_session"
ON "ai_suggestion" (
  "session_id" ASC
);

-- ----------------------------
-- Indexes structure for table document_files
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_files_document"
ON "document_files" (
  "document_id" ASC
);


-- ----------------------------
-- Indexes structure for table document_metadata
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_metadata_document"
ON "document_metadata" (
  "document_id" ASC
);
CREATE INDEX IF NOT EXISTS "idx_metadata_type"
ON "document_metadata" (
  "metadata_type" ASC
);

-- ----------------------------
-- Triggers structure for table document_metadata
-- ----------------------------
CREATE TRIGGER IF NOT EXISTS "update_metadata_timestamp"
AFTER UPDATE
ON "document_metadata"
BEGIN
    UPDATE document_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


-- ----------------------------
-- Indexes structure for table document_paraalign_history
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_doc_history_doc"
ON "document_paraalign_history" (
  "document_id" ASC
);

-- ----------------------------
-- Indexes structure for table document_sentalign_history
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_doc_history_doc_copy1"
ON "document_sentalign_history" (
  "document_id" ASC
);


-- ----------------------------
-- Indexes structure for table documents
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_documents_created"
ON "documents" (
  "created_at" ASC
);
CREATE INDEX IF NOT EXISTS "idx_documents_status"
ON "documents" (
  "status" ASC
);
CREATE INDEX IF NOT EXISTS "idx_documents_title"
ON "documents" (
  "title" ASC
);

-- ----------------------------
-- Triggers structure for table documents
-- ----------------------------
CREATE TRIGGER IF NOT EXISTS "update_documents_timestamp"
AFTER UPDATE
ON "documents"
BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ----------------------------
-- Indexes structure for table edit_action
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_edit_session"
ON "edit_action" (
  "session_id" ASC
);
CREATE INDEX IF NOT EXISTS "idx_edit_time"
ON "edit_action" (
  "timestamp" ASC
);

-- ----------------------------
-- Indexes structure for table session
-- ----------------------------
CREATE INDEX IF NOT EXISTS "idx_session_task"
ON "session" (
  "task_id" ASC
);
CREATE INDEX IF NOT EXISTS  "idx_session_user"
ON "session" (
  "user_id" ASC
);

-- ----------------------------
-- Indexes structure for table sys_user
-- ----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sys_user_cellphone"
ON "sys_user" (
  "cellphone" ASC
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sys_user_email"
ON "sys_user" (
  "email" ASC
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_sys_user_username"
ON "sys_user" (
  "user_name" ASC
);

-- ----------------------------
-- Triggers structure for table sys_user
-- ----------------------------
CREATE TRIGGER IF NOT EXISTS "trg_sys_user_updated_at"
AFTER UPDATE
ON "sys_user"
FOR EACH ROW
BEGIN
    UPDATE sys_user
    SET updated_at = CURRENT_TIMESTAMP
    WHERE user_id = OLD.user_id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_llm_prompts"
ON "llm_prompts" (
  "id" ASC
);

INSERT OR IGNORE INTO sys_user (
    user_name,
    password,
    real_name,
    email,
    status,
    enabled,
    is_first_login
) VALUES (
    'demo',
    '$2b$12$2PKgQFgW.y5ucT4ynldl6.92eSKVfyfOYgUOFqBo8wGD5Ha1qOqYG',  -- 123456
    'Demo User',
    'demo@example.com',
    1,
    1,
    0
);

INSERT OR IGNORE INTO "llm_prompts"
("id", "task_type", "name", "user_prompt", "system_prompt", "model", "temperature", "max_tokens", "is_active", "created_at", "updated_at")
VALUES
(
    2,
    'sentence_segmentation',
    'Sentence Segmentation Template',
    'Language:  {{language}}

Paragraph:
"""
{{paragraph}}
"""

Output JSON:
{
  "sentences": [
    { "id": "s1", "text": "..." }
  ]
}
',
    'You are a professional text segmentation engine.
Split a paragraph into sentences.
Do not translate. Do not normalize.
Return ONLY valid JSON.
If unsure, return {}.',
    'gpt-4.1-mini',
    0.2,
    2048,
    1,
    '2026-01-30 13:43:40',
    '2026-01-30 13:43:40'
);

INSERT  OR IGNORE INTO "llm_prompts"
("id", "task_type", "name", "user_prompt", "system_prompt", "model", "temperature", "max_tokens", "is_active", "created_at", "updated_at")
VALUES
(
    3,
    'sentence_alignment',
    'Sentence Alignment Template',
    'Source language: {{sourceLanguage}}
Target language: {{targetLanguage}}

Source sentences:
{{sourceSentences}}

Target sentences:
{{targetSentences}}

Output JSON:
{
  "alignments": [
    {
      "sourceIds": ["s1"],
      "targetIds": ["t1"],
      "confidence": 0.0,
      "explanation": "..."
    }
  ]
}',
    'You are a professional bilingual sentence alignment engine.
Align sentences by meaning.
One-to-many and many-to-one are allowed.
Return ONLY valid JSON.
If unsure, return {}.',
    'gpt-4.1-mini',
    0.2,
    2048,
    1,
    '2026-02-01 14:49:22',
    '2026-02-01 14:49:22'
);

INSERT OR IGNORE INTO "llm_prompts"
("task_type", "name", "user_prompt", "system_prompt", "model", "temperature", "max_tokens", "is_active", "created_at", "updated_at")
VALUES
(
    'word_segmentation_alignment',
    'Word Segmentation & Alignment Template',
    'Source language: {{sourceLanguage}}
Target language: {{targetLanguage}}

Source sentence:
"""
{{sourceSentence}}
"""

Target sentence:
"""
{{targetSentence}}
"""

Break each sentence into words/terms, then align them by semantic correspondence. Output JSON:
{
  "sourceWords": [{"id": "w0", "text": "..."}],
  "targetWords": [{"id": "w0", "text": "..."}],
  "alignments": [
    {"sourceIds": ["w0"], "targetIds": ["w0"], "confidence": 0.95}
  ]
}',
    'You are a professional bilingual word alignment engine. Break sentences into meaningful terms/words. Align them by semantic correspondence. Return ONLY valid JSON.',
    'gpt-4.1-mini',
    0.2,
    2048,
    1,
    '2026-03-01 00:00:00',
    '2026-03-01 00:00:00'
);

INSERT   OR IGNORE  INTO "translation_tags"
("id", "name", "description", "sample", "color", "created_at", "updated_at")
VALUES
(
    4,
    'Inversion',
    'Changing the word order to fit the target language''s syntax.
English usually follows a strict Subject-Verb-Object (SVO) order. Arabic often prefers Verb-Subject-Object (VSO) for narrative flow, or places adjectives after nouns (English places them before).',
    'English: The president arrived at the airport. (SVO)
Arabic Text: وصل الرئيس إلى المطار',
    '#38bdf8',
    '2026-01-31 10:24:33',
    '2026-01-31 10:24:33'
);

INSERT OR IGNORE INTO   "translation_tags"
("id", "name", "description", "sample", "color", "created_at", "updated_at")
VALUES
(
    5,
    'Addition',
    'Introducing words that are not present in the source text but are grammatically necessary or required for clarity in Arabic.',
    'English: He is interested in science.
Arabic Text: هو مهتم بالعلم',
    '#38bdf8',
    '2026-01-31 10:29:46',
    '2026-01-31 10:29:46'
);

INSERT OR IGNORE INTO  "translation_tags"
("id", "name", "description", "sample", "color", "created_at", "updated_at")
VALUES
(
    6,
    'Omission',
    'Removing words that are redundant or stylistically unnecessary in Arabic, even if they are grammatically required in English.',
    'English: The house is big.
Arabic Text: البيت كبير',
    '#38bdf8',
    '2026-01-31 10:30:10',
    '2026-01-31 10:30:10'
);

-- =====================
-- Multimodal LLM Settings
-- =====================
CREATE TABLE IF NOT EXISTS multimodal_llm_settings (
  id INTEGER PRIMARY KEY,
  model_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- Multimodal Pairs
-- =====================
CREATE TABLE IF NOT EXISTS multimodal_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  source_image_path TEXT NOT NULL,
  source_image_name TEXT,
  source_language TEXT,
  source_description TEXT,
  source_text_content TEXT,
  target_image_path TEXT NOT NULL,
  target_image_name TEXT,
  target_language TEXT,
  target_description TEXT,
  target_text_content TEXT,
  domain TEXT,
  context_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- Multimodal Analyses
-- =====================
CREATE TABLE IF NOT EXISTS multimodal_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_id INTEGER NOT NULL,
  analysis_type TEXT NOT NULL CHECK(analysis_type IN (
    'description', 'text_extraction', 'comparison', 'discourse_analysis', 'custom'
  )),
  model_name TEXT,
  prompt TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pair_id) REFERENCES multimodal_pairs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS corpus_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_ids TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  skill_label TEXT NOT NULL,
  model_name TEXT,
  result TEXT,
  token_usage TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "llm_prompts" (task_type, name, system_prompt, user_prompt, model, temperature, max_tokens)
VALUES
(
  'corpus_analysis',
  'Statistical Overview',
  'You are a corpus linguist analyzing aligned parallel texts. Provide a detailed statistical overview of the corpus: total segments, word counts per language, alignment confidence distribution, segment length ratios, and alignment type distribution (1:1, 1:many, many:1, many:many). Use tables and bullet points for clarity.',
  'Analyze the following aligned parallel corpus segments and provide a comprehensive statistical overview.\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Translation Techniques',
  'You are a translation studies researcher. Analyze the provided parallel segments and identify common translation techniques: literal translation, transposition, modulation, addition, omission, equivalence, adaptation, borrowing, calque, compensation. Reference specific segment numbers. Organize findings by technique category with examples.',
  'Identify and analyze the translation techniques used in the following parallel corpus segments. Reference specific segment numbers.\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Terminology Consistency',
  'You are a terminology analyst. Examine the parallel corpus for key terms in the source language and check whether they are translated consistently in the target language. Flag any inconsistencies with segment references. Suggest standardized translations for problematic terms.',
  'Analyze terminology consistency across the following parallel corpus segments. Identify key terms and check translation consistency.\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Alignment Quality',
  'You are an alignment quality assessor. Review the provided sentence alignments and evaluate their quality. Look for potential misalignments, segments with low confidence, unusual length ratios, and patterns that might indicate alignment errors. Flag specific segment numbers that may need review.',
  'Assess the quality of the following sentence alignments. Flag any segments that may be misaligned or need manual review.\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Readability Analysis',
  'You are a text analyst comparing readability across languages. Analyze the source and target texts for readability characteristics: sentence length distribution, word length, structural complexity, use of passive voice, and register. Compare source vs target readability and note significant divergences.',
  'Compare the readability of source and target texts across the following aligned parallel segments.\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Custom Analysis',
  'You are a corpus analysis expert. Analyze the provided parallel text segments according to the user''s request. Be thorough, reference specific segment numbers, and organize findings clearly.',
  '{{custom_prompt}}\n\nAligned Segments:\n{{segments}}',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Cultural Adaptation Analysis',
  'You are a cross-cultural translation analyst. Analyze the provided parallel segments for cultural adaptation phenomena. For each segment pair, identify:

1. **Cultural references** in the source text (idioms, customs, religious elements, food, clothing, social norms, historical references, proper names with cultural significance)
2. **Adaptation strategy** used in the target:
   - PRESERVED: cultural reference kept as-is (e.g. borrowed word, transliteration)
   - SUBSTITUTED: replaced with a target-culture equivalent
   - EXPLAINED: kept but with added explanation or gloss
   - OMITTED: cultural reference removed entirely
   - GENERALIZED: specific cultural term replaced with a general concept
3. **Cultural additions** in the target that were not in the source (e.g. added honorifics, politeness markers, religious expressions)
4. **Politeness/register shift**: rate whether the target is MORE formal (+1), SAME (0), or LESS formal (-1) than the source
5. **Ideological shifts**: any changes that reflect different ideological or religious perspectives
6. **Overall cultural distance score** (1-5): 1=minimal cultural gap, 5=profound cultural transformation

Return ONLY valid JSON in this format:
{
  "segments": [
    {
      "segment_number": 1,
      "cultural_references_source": ["reference1", "reference2"],
      "adaptations": [
        {"reference": "ref", "strategy": "SUBSTITUTED", "target_form": "target form", "explanation": "why"}
      ],
      "cultural_additions_target": [],
      "politeness_shift": 0,
      "ideological_shifts": [],
      "cultural_distance_score": 2
    }
  ],
  "summary": {
    "total_segments": N,
    "total_references": N,
    "preservation_ratio": 0.X,
    "substitution_ratio": 0.X,
    "explicitation_ratio": 0.X,
    "omission_ratio": 0.X,
    "generalization_ratio": 0.X,
    "cultural_addition_count": N,
    "avg_politeness_shift": 0.X,
    "avg_cultural_distance": 0.X,
    "dominant_strategy": "SUBSTITUTED",
    "key_findings": "Brief analysis..."
  }
}',
  'Analyze the following aligned parallel corpus segments for cultural adaptation phenomena. Identify cultural references, classify adaptation strategies, detect cultural additions, assess politeness shifts, and compute a cultural distance score for each segment.

Aligned Segments:
{{segments}}

Return a JSON object with "segments" array and "summary" object as specified in the system prompt.',
  NULL, 0.3, 4096
),
(
  'corpus_analysis',
  'Cross-Lingual Concept Mapping',
  'You are a cross-lingual semantic network analyst. Analyze the provided aligned parallel segments and extract a concept mapping network between source and target languages. For each segment, identify key semantic concepts that carry conceptual content. Build a mapping between source-language concepts and their target-language realizations. Group inflectional variants under a canonical form. Assign semantic fields: legal, medical, emotional, spatial, temporal, social, cognitive, technical, cultural, religious, commercial, general. Track mapping types (1:1, 1:N, N:1, N:M). Include example sentence pairs. Return ONLY valid JSON with "concepts" array and "summary" object.',
  'Analyze the aligned parallel corpus and extract a cross-lingual concept mapping network.\n\nAligned Segments:\n{{segments}}\n\nReturn JSON with "concepts" array and "summary" object.',
  NULL, 0.3, 4096
),
(
  'terminology_extraction',
  'Bilingual Terminology Extraction',
  'You are a professional bilingual terminology extraction engine. Your task is to analyze aligned parallel text segments and extract significant bilingual term pairs.

For each segment, identify key terms and their translations. Follow these rules:

1. Focus on domain-specific terminology, named entities, technical terms, and culturally significant words. Skip common function words (articles, prepositions, conjunctions) and very general vocabulary.

2. For each term pair, assign:
   - domain: one of [general, legal, medical, technical, financial, academic, literary, other]
   - priority: one of [high, medium, low] based on the term''s significance to the text''s subject matter

3. Include the FULL sentence context from both source and target where the term appears. This is critical for the user to understand how the term is used.

4. IMPORTANT: Treat singular and plural forms as the SAME term. If "contract" and "contracts" both appear, list only ONE entry with the canonical singular form, and note the variant in the context.

5. Do NOT invent terms not present in the provided segments. Only extract terms that actually appear.

6. Return ONLY valid JSON. The response must be a JSON object with a "terms" array.',
  'Analyze the following aligned parallel corpus segments and extract bilingual term pairs. Include full sentence context for each term.

Aligned Segments:
{{segments}}

Output a JSON object with a "terms" array where each entry has: source_term, target_term, domain, priority, context_source, context_target.',
  NULL, 0.3, 4096
),
(
  'terminology_extraction',
  'Custom Extraction',
  'You are a terminology extraction expert. Analyze the provided parallel text segments according to the user''s request. Extract bilingual term pairs with domain, priority, and full sentence context. Treat singular and plural forms as one term. Return ONLY valid JSON with a "terms" array.',
  '{{custom_prompt}}

Aligned Segments:
{{segments}}',
  NULL, 0.3, 4096
);

INSERT OR IGNORE INTO "translation_tags"
("id", "name", "description", "sample", "color", "created_at", "updated_at")
VALUES
(
    7,
    'Negation',
    'Expressing an affirmative English concept using a negative Arabic structure, or vice versa.',
    'English: Remember to call him.
Arabic Text: لا تنس أن تتصل به',
    '#38bdf8',
    '2026-01-31 10:30:40',
    '2026-01-31 10:30:40'
);

`
db.exec(schemaNew);

// Initialize project schema
initProjectSchema();

// Initialize terminology extraction schema
initTerminologySchema();

// Initialize terminology project schema
initTerminologyProjectSchema();

// Initialize analytics schema
initAnalyticsSchema();

// Initialize semantic network schema
initSemanticNetworkSchema();

// module.exports = db;
