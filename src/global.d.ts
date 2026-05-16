import {ipcRenderer} from "electron";
import {AppState, DocumentFile, DocumentMetadata, DocumentWithMetadata, ParaAlignment} from "./types/database";
import {AlignmentResult, Line, LLMSettings, SentenceAlignmentStats} from "./types/alignment";
import {ChatResponse, LLMRow} from "./types/llminterfaces";
import {PromptEntity} from "./types/prompt";
import {Tag, TagInput} from "./types/tag";

export {};
interface Highlight {
    id: string;
    start_index: number;
    end_index: number;
    comment: string;
    type?: "AI" | "USER" | "VOCAB" | "GRAMMAR";
    suggestion?: string;
    session_id?: number;
}

interface RegisterForm {
    username: string;
    password: string;
    email: string;
    cellphone: string;

    // invitationCode: string;
    role?: string;
    age?: string;
    gender?: string;
    university?: string;
    major?: string;
    grade?: string;
}

interface RegisterResult {
    success: boolean;
    message: string;
}
interface AlignmentFinishedPayload {
    documentId: number;
    status: string;
    sentenceAlignments?: number;
}

declare global {
    interface Window {
        api: {
            startSession: (s: {
                userId: string;
                questionId: number;
                condition: string;
            }) => Promise<number>;

            endSession: (id: number) => void;

            logKeystroke: (k: {
                sessionId: number;
                type: string;
                key: string;
                cursor: number;
                time: number;
            }) => void;

            saveVersion: (v: {
                sessionId: number;
                index: number;
                text: string;
                final?: boolean;
            }) => void;

            aiShow: (a: {
                sessionId: number;
                text: string;
            }) => Promise<number>;

            aiResolve: (a: {
                id: number;
                accepted: string;
                action: string;
            }) => void;

            exportCSV: (table: string) => void;
            heatmap: (sessionId: number) => Promise<any[]>;
            replay: (sessionId: number) => Promise<any[]>;
            getExercises: (filter?: { cefr?: string, exercise_type?: string }) => Promise<any[]>;
            saveExercise: (data: any) => Promise<{ sessionId: number }>;

            getExerciseById: (id: number) => Promise<any>;
            createExercise: (data: any) => Promise<{ id: number }>;
            updateExercise: (data: any) => Promise<{ success: boolean }>;

            searchTags: (keyword: string) => Promise<string[]>;
            createTag: (tag: string) => Promise<{ success: boolean }>;

            saveHighlight: (highlight: Highlight) => Promise<boolean>;
            getHighlights: (sessionId: number) => Promise<Highlight[]>;

            /**
             * Login with username / email / phone + password
             * Returns user info + JWT token
             */
            login: (params: {
                usernameOrEmail: string;
                password: string;
            }) => Promise<{
                user: {
                    user_id: number;
                    user_name: string;
                    email?: string;
                    cellphone?: string;
                    role: "admin" | "student";
                    enabled: number;
                };
                token: string;
            }>;

            /**
             * Restore login state on app startup
             * Returns JWT payload or null
             */
            restoreLogin: () => Promise<{
                userId: number;
                username: string;
                role: "admin" | "student";
                iat: number;
                exp: number;
            } | null>;

            /**
             * Logout and clear session
             */
            logout: () => Promise<boolean>;

            /**
             * 🔁 Auto-login session
             */
            getSession: () => Promise<{
                user: {
                    user_id: number;
                    user_name: string;
                    role: "admin" | "student";
                    email?: string;
                };
                token: string;
            } | null>;

            register: (form: RegisterForm) => Promise<RegisterResult>;

            getLLMSettings(): Promise<LLMSettings>;

            saveLLMSettings(settings: LLMSettings): Promise<void>;

            testLLMApiKey(apiKey: string): Promise<{
                success: boolean;
            }>;

            saveAlignTask(payload: any): Promise<{
                success: boolean;
            }>;

            // ==================== Documents ====================

            getDocument(id: number): Promise<Document | null>;

            getDocumentWithMetadata(id: number): Promise<any | null>;

            getAllDocuments(): Promise<Document[]>;

            updateDocument(
                id: number,
                updates: Partial<Document>
            ): Promise<void>;

            deleteDocument(id: number): Promise<void>;

            // ==================== Metadata ====================

            upsertMetadata(
                metadata: Omit<DocumentMetadata, "id" | "created_at" | "updated_at">
            ): Promise<void>;

            getMetadata(
                documentId: number,
                type: "source" | "target"
            ): Promise<DocumentMetadata | null>;

            // ==================== Combined Operations ====================

            saveDocumentWithMetadata(data: {
                document: any;
                sourceMetadata?: any;
                targetMetadata?: any;
            }): Promise<number>;

            updateDocumentWithMetadata(
                id: number,
                data: {
                    document?: any;
                    sourceMetadata?: any;
                    targetMetadata?: any;
                }
            ): Promise<void>;

            // ==================== Search ====================

            searchDocuments(query: string): Promise<Document[]>;

            // ==================== Files ====================

            addDocumentFile(file: any): Promise<number>;

            getDocumentFiles(documentId: number): Promise<DocumentFile[]>;

            deleteDocumentFile(id: number): Promise<void>;



            getHomeOverview: () => Promise<any>;

            /* =========================
        Paragraph Alignment
     ========================= */
            paraAlign: (documentId: number) => Promise<{
                status: "ok";
                alignmentCount: number;
            }>;

            getParaAlignments: (documentId: number) => Promise<ParaAlignment[]>;

            alignParas:  (data: {documentId, sourceText, targetText, srcLang, tgtLang}) => Promise<{
                    status: "ok";
                     alignmentCount: number;
                srcLang: string,
                tgtLang: string,
                 }>;



            /* =========================
               Sentence Alignment
            ========================= */
            sentenceAlign: (documentId: number) => Promise<{
                status: "ok";
                sentenceCount: number;
            }>;

            getParaAlignmentState: (documentId: number) => Promise<AppState>;

            getAlignmentState: (documentId: number, alignmentType: string) => Promise<any>;

            saveHistoryState: (
                documentId: number,
                state: any,
                action: "edit" | "undo" | "redo" | "init",
                alignmentType: string,
            ) => Promise<{ ok: boolean }>;

            updateDocumentMetadata: (payload: {
                documentId: any;
                sourceMeta?: any;
                targetMeta?: any;
            }) => Promise<void>;

            saveParagraphLinks: (
                documentId: number,
                state: any,
                action: any
            ) => Promise<{ ok: boolean }>;


            saveLinks: (
                documentId: number,
                state: any,
                action: any,
                documentType: string,
            ) => Promise<{ ok: boolean }>;

            testLLMCredential: (modelId: string) => Promise<void>,
            chatWithLLM:(request) => Promise<ChatResponse>,
            alignParagraphBatch: (
                pairs: {
                    sourceId: string;
                    targetId: string;
                    sourceLines: Line[];
                    targetLines: Line[];
                }[],
                srcLang: string,
                tgtLang: string,
                // modelId: string,
                documentId: string,
            ) => Promise<AlignmentResult[]>;
            saveCESAlignmentZip: (data: {
                sourceDocXml: string;
                targetDocXml: string;
                alignXml: string;
                sourceDocFilename: string;
                targetDocFilename: string;
            }) => Promise<{
                success: boolean;
                filePath?: string;
                canceled?: boolean;
                error?: string;
            }>;
            /**
             * prompts
             */
            listPrompts(): Promise<any[]>;
            savePrompt(p: any): Promise<void>;
            deletePrompt(id: number): Promise<void>;
            updatePrompt: (id: number, data: any) => Promise<void>;

            /**
             * translation strategy tag
             */
            listTags(): Promise<Tag[]>;
            createTag(data: any): Promise<any>;
            updateTag(id: number, data: any): Promise<any>;
            deleteTag(id: number): Promise<any>;

            /**
             * LLM settings
             */
            /* =====================
        LLM MODELS
     ====================== */
            getLLMModels(): Promise<LLMRow[]>;

            saveLLMModel(payload: {
                id: string;
                model_name: string;
                base_url: string;
                api_key: string;
            }): Promise<void>;

            createLLMModel(payload: {
                model_name: string;
                base_url: string;
                api_key: string;
            }): Promise<void>;

            setDefaultLLMModel(id: string): Promise<void>;

            testLLMModel(payload: {
                base_url: string;
                api_key: string;
                model_name: string;
            }): Promise<void>;

            encryptApiKey(apiKey: string): Promise<string>;

            /**
             * stats
             */
            getStats: (documentId?: number) => Promise<SentenceAlignmentStats>;
            resetPasswordByEmail: (email: string) => Promise<any>;

            onAlignmentProgress: (callback: any) => Promise<any>;

            removeAlignmentProgress: (callback: any)=> Promise<any>;

            getDocumentStatus: (id: any)=> Promise<any>;

            markAlignmentCompleted: (documentId: number) => Promise<any>;

            getDocumentAlignments: (docId: number) => Promise<any>;

            // Word alignment
            getWordAlignmentState: (documentId: number, sourceKey: string, targetKey: string) => Promise<{
                sourceWords: import("./types/alignment").Line[];
                targetWords: import("./types/alignment").Line[];
                wordLinks: import("./types/alignment").Link[];
            }>;
            saveWordAlignment: (documentId: number, sourceKey: string, targetKey: string, state: any) => Promise<{ ok: boolean }>;
            checkWordAlignments: (documentId: number) => Promise<string[]>;
            segmentAndAlignWords: (payload: {
                sourceText: string; targetText: string;
                srcLang: string; tgtLang: string;
                documentId: number; sourceKey: string; targetKey: string;
            }) => Promise<{
                sourceWords: import("./types/alignment").Line[];
                targetWords: import("./types/alignment").Line[];
                wordLinks: import("./types/alignment").Link[];
            }>;

            onAlignmentFinished: (
                callback: (data: AlignmentFinishedPayload) => void
            ) => void;

            // ==================== Projects ====================
            createProject(project: any): Promise<number>;
            getProject(id: number): Promise<any>;
            getProjectWithMetadata(id: number): Promise<any>;
            getAllProjects(): Promise<any[]>;
            getAllProjectsWithMetadata(): Promise<any[]>;
            updateProject(id: number, updates: any): Promise<void>;
            deleteProject(id: number): Promise<void>;
            upsertProjectMetadata(metadata: any): Promise<void>;
            getProjectMetadata(projectId: number): Promise<any>;
            getInheritedMetadata(projectId: number): Promise<any>;
            getProjectDocuments(projectId: number): Promise<any[]>;
            addDocumentToProject(documentId: number, projectId: number): Promise<void>;
            removeDocumentFromProject(documentId: number): Promise<void>;
            saveProjectWithMetadata(data: any): Promise<number>;
            updateProjectWithMetadata(id: number, data: any): Promise<void>;
            exportProject(projectId: number): Promise<any>;
            saveProjectZip(data: any): Promise<any>;
        };
    }
}
