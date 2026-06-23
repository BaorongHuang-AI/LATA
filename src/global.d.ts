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
            permanentDeleteDocument(id: number): Promise<void>;
            restoreDocument(id: number): Promise<void>;
            getTrashedDocuments(): Promise<Document[]>;

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

            // ==================== Excel Export ====================
            saveExcelAlignment(data: {
                sourceMeta: Record<string, unknown>;
                targetMeta: Record<string, unknown>;
                sourceLines: Array<{ id: string; text: string }>;
                targetLines: Array<{ id: string; text: string }>;
                links: Array<{ sourceIds: string[]; targetIds: string[]; confidence?: number; strategy?: string }>;
                documentTitle?: string;
            }): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
            saveProjectExcel(payload: {
                projectTitle: string;
                documents: Array<{
                    sourceMeta: Record<string, unknown>;
                    targetMeta: Record<string, unknown>;
                    sourceLines: Array<{ id: string; text: string }>;
                    targetLines: Array<{ id: string; text: string }>;
                    links: Array<{ sourceIds: string[]; targetIds: string[]; confidence?: number; strategy?: string }>;
                    documentTitle?: string;
                }>;
            }): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;

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

            getAppVersion(): Promise<string>;

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

            realignBlock: (payload: {
                sourceSentences: { id: string; text: string }[];
                targetSentences: { id: string; text: string }[];
                srcLang: string;
                tgtLang: string;
            }) => Promise<import("./types/alignment").Alignment[]>;

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

            // ==================== Multimodal LLM Settings ====================
            getMultimodalLLMModels(): Promise<import("./types/multimodal").MultimodalLLMRow[]>;
            saveMultimodalLLMModel(payload: { id: string; model_name: string; base_url: string; api_key: string }): Promise<void>;
            createMultimodalLLMModel(payload: { model_name: string; base_url: string; api_key: string }): Promise<void>;
            setDefaultMultimodalLLMModel(id: string): Promise<void>;
            testMultimodalLLMModel(payload: { base_url: string; api_key: string; model_name: string }): Promise<void>;

            // ==================== Multimodal Pairs ====================
            listMultimodalPairs(): Promise<import("./types/multimodal").MultimodalPair[]>;
            getMultimodalPair(id: number): Promise<import("./types/multimodal").MultimodalPair | null>;
            createMultimodalPair(data: any): Promise<number>;
            updateMultimodalPair(id: number, data: any): Promise<void>;
            deleteMultimodalPair(id: number): Promise<void>;
            pickImageFile(): Promise<{ filePath: string; fileName: string } | null>;
            getMultimodalAnalyses(pairId: number): Promise<import("./types/multimodal").MultimodalAnalysis[]>;
            analyzeMultimodalPair(payload: { pairId: number; analysisType: string; customPrompt?: string }): Promise<import("./types/multimodal").MultimodalAnalysis>;

            // ==================== Corpus Analysis ====================
            getAlignedDocuments(): Promise<import("./types/corpus").AlignedDocument[]>;
            getCorpusSegments(documentIds: number[]): Promise<import("./types/corpus").AlignedSegment[]>;
            getCorpusSkills(): Promise<import("./types/corpus").CorpusSkill[]>;
            runCorpusAnalysis(payload: { documentIds: number[]; skillKey: string; customPrompt?: string }): Promise<import("./types/corpus").CorpusAnalysis & { segment_count: number; truncated: boolean }>;
            getCorpusAnalyses(): Promise<import("./types/corpus").CorpusAnalysis[]>;
            saveCorpusSkill(skill: { name: string; system_prompt: string; user_prompt_template: string }): Promise<number>;
            updateCorpusSkill(id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }): Promise<void>;
            deleteCorpusSkill(id: number): Promise<void>;

            // ==================== Corpus Search ====================
            searchCorpusSegments(params: import("./types/corpus").CorpusSearchRequest): Promise<import("./types/corpus").CorpusSearchResult[]>;
            getCorpusMetadataOptions(documentIds: number[]): Promise<import("./types/corpus").CorpusMetadataOptions>;

            // ==================== Terminology Extraction ====================
            getTerminologySkills(): Promise<import("./types/terminology").TerminologySkill[]>;
            saveTerminologySkill(skill: { name: string; system_prompt: string; user_prompt_template: string }): Promise<number>;
            updateTerminologySkill(id: number, skill: { name?: string; system_prompt?: string; user_prompt_template?: string }): Promise<void>;
            deleteTerminologySkill(id: number): Promise<void>;
            getTerminologyExtractions(): Promise<import("./types/terminology").TerminologyExtraction[]>;
            runTerminologyExtraction(payload: { projectId?: number; documentIds: number[]; skillKey?: string; customPrompt?: string }): Promise<{
                extraction: import("./types/terminology").TerminologyExtraction;
                terms: import("./types/terminology").TerminologyTerm[];
                segment_count: number;
                truncated: boolean;
                debug: {
                    model: string;
                    promptTokens?: number;
                    completionTokens?: number;
                    totalTokens?: number;
                    estimatedPromptTokens: number;
                    rawResponseLength: number;
                    truncated: boolean;
                };
            }>;
            getTerminologyTerms(extractionId: number): Promise<import("./types/terminology").TerminologyTerm[]>;
            addTerminologyTerm(extractionId: number, term: {
                source_term: string; target_term: string; domain?: string;
                priority?: 'high' | 'medium' | 'low'; context_source?: string; context_target?: string;
            }): Promise<number>;
            updateTerminologyTerm(id: number, data: Partial<import("./types/terminology").TerminologyTerm>): Promise<void>;
            deleteTerminologyTerm(id: number): Promise<void>;

            // ==================== Terminology Projects ====================
            createTerminologyProject(data: { title: string; description?: string; source?: string; extractor?: string; reviewer?: string; status?: string }): Promise<number>;
            updateTerminologyProject(id: number, data: Partial<import("./types/terminology").TerminologyProject>): Promise<void>;
            deleteTerminologyProject(id: number): Promise<void>;
            getTerminologyProject(id: number): Promise<import("./types/terminology").TerminologyProject & { document_count: number }>;
            getAllTerminologyProjects(): Promise<(import("./types/terminology").TerminologyProject & { document_count: number })[]>;
            addProjectDocument(projectId: number, documentId: number): Promise<void>;
            removeProjectDocument(projectId: number, documentId: number): Promise<void>;
            setProjectDocuments(projectId: number, documentIds: number[]): Promise<void>;
            getProjectDocuments(projectId: number): Promise<import("./types/terminology").ProjectDocumentInfo[]>;
            getExtractionsByProject(projectId: number): Promise<import("./types/terminology").TerminologyExtraction[]>;
            getProjectTerms(projectId: number): Promise<import("./types/terminology").TerminologyTerm[]>;

            // ==================== Terminology Verification ====================
            verifyTerm(id: number, status: 'verified' | 'rejected', verifiedBy: string, notes?: string): Promise<void>;
            batchVerifyTerms(ids: number[], status: 'verified' | 'rejected', verifiedBy: string): Promise<void>;

            // ==================== Terminology Export ====================
            exportTerminologyProjectExcel(projectId: number): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;

            // ==================== Semantic Network ====================
            getSemanticExtractions(): Promise<import("./types/semanticNetwork").SemanticNetworkExtraction[]>;
            getSemanticExtraction(id: number): Promise<import("./types/semanticNetwork").SemanticNetworkExtraction | undefined>;
            deleteSemanticExtraction(id: number): Promise<void>;
            runSemanticExtraction(payload: { documentIds: number[] }): Promise<{
                id: number; network_data: import("./types/semanticNetwork").SemanticNetworkData;
                model_name: string; segment_count: number; truncated: boolean;
            }>;

            // ==================== Analytics ====================
            createAnalyticsExperiment(data: { title: string; research_question?: string; hypothesis?: string; configuration: string }): Promise<number>;
            updateAnalyticsExperiment(id: number, data: { title?: string; status?: 'draft' | 'running' | 'completed' | 'error'; configuration?: string }): Promise<void>;
            deleteAnalyticsExperiment(id: number): Promise<void>;
            getAnalyticsExperiment(id: number): Promise<import("./types/analytics").AnalyticsExperiment | undefined>;
            getAllAnalyticsExperiments(): Promise<import("./types/analytics").AnalyticsExperiment[]>;
            runAnalyticsExperiment(experimentId: number): Promise<import("./types/analytics").ExperimentResult>;
            getAnalyticsResults(experimentId: number): Promise<import("./types/analytics").AnalyticsResult[]>;
            saveAnalyticsReport(experimentId: number, format: string, content: string): Promise<number>;
            getAnalyticsReport(experimentId: number): Promise<import("./types/analytics").AnalyticsReport | undefined>;

            // ==================== Database Export/Import ====================
            exportDatabase(): Promise<{ success: boolean; filePath?: string; sizeMB?: string; canceled?: boolean; error?: string }>;
            importDatabase(): Promise<{ success: boolean; backupPath?: string; canceled?: boolean; error?: string }>;
            restartApp(): Promise<void>;
        };
    }
}
