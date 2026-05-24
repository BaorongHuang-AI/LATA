// @ts-nocheck
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// const { contextBridge, ipcRenderer } = require("electron");
//
// contextBridge.exposeInMainWorld("electron", {
//     ipcRenderer: {
//         send: (channel, data) => ipcRenderer.send(channel, data),
//         on: (channel, func) =>
//             ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
//         removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
//     },
// });
import {AppState, Document, DocumentMetadata, DocumentWithMetadata} from "./types/database";
import {Line, Link, LLMSettings} from "./types/alignment";
import {PromptEntity} from "./types/prompt";
import {Project, ProjectMetadata} from "./types/project";

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    downloadFile: (fileInfo) => ipcRenderer.send('download-file', fileInfo),
});
let finishedListener: any = null;
contextBridge.exposeInMainWorld('api', {
    startSession: (s) => ipcRenderer.invoke('session:start', s),
    endSession: (id) => ipcRenderer.invoke('session:end', id),

    register: (form: any) =>
        ipcRenderer.invoke("auth:register", form),

    login: (data: { usernameOrEmail: string; password: string }) =>
        ipcRenderer.invoke("auth:login", data),

    restoreLogin: () => ipcRenderer.invoke("auth:restore"),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getSession: () => ipcRenderer.invoke("auth:getSession"),

    getLLMSettings: () =>
        ipcRenderer.invoke("llm:getSettings"),

    saveLLMSettings: (settings: LLMSettings) =>
        ipcRenderer.invoke("llm:saveSettings", settings),

    testLLMApiKey: (apiKey: string) =>
        ipcRenderer.invoke("llm:testApiKey", apiKey),

    saveAlignTask: (payload) =>
        ipcRenderer.invoke("aligner:saveTask", payload),

     createDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        return ipcRenderer.invoke('db:createDocument', doc);
    },

     getDocument(id: number): Promise<Document | null> {
        return ipcRenderer.invoke('db:getDocument', id);
    },

     getDocumentWithMetadata(id: number): Promise<DocumentWithMetadata | null> {
        return ipcRenderer.invoke('db:getDocumentWithMetadata', id);
    },

     getAllDocuments(): Promise<Document[]> {
        return ipcRenderer.invoke('db:getAllDocuments');
    },

     updateDocument(id: number, updates: Partial<Document>): Promise<void> {
        return ipcRenderer.invoke('db:updateDocument', id, updates);
    },

     deleteDocument(id: number): Promise<void> {
         return ipcRenderer.invoke('db:deleteDocument', id);
    },

    // ==================== Metadata ====================

     upsertMetadata(metadata: Omit<DocumentMetadata, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
         return ipcRenderer.invoke('db:upsertMetadata', metadata);
    },

     getMetadata(documentId: number, type: 'source' | 'target'): Promise<DocumentMetadata | null> {
        return ipcRenderer.invoke('db:getMetadata', documentId, type);
    },

    // ==================== Combined Operations ====================

     saveDocumentWithMetadata(data: {
        document: Omit<Document, 'id' | 'created_at' | 'updated_at'>;
        sourceMetadata?: Partial<DocumentMetadata>;
        targetMetadata?: Partial<DocumentMetadata>;
    }): Promise<number> {
        return ipcRenderer.invoke('db:saveDocumentWithMetadata', data);
    },

     updateDocumentWithMetadata(id: number, data: {
        document?: Partial<Document>;
        sourceMetadata?: Partial<DocumentMetadata>;
        targetMetadata?: Partial<DocumentMetadata>;
    }): Promise<void> {
         return ipcRenderer.invoke('db:updateDocumentWithMetadata', id, data);
    },

    // ==================== Search ====================

     searchDocuments(query: string): Promise<Document[]> {
        return ipcRenderer.invoke('db:searchDocuments', query);
    },

    // ==================== Files ====================

     addDocumentFile(file: any): Promise<number> {
        return ipcRenderer.invoke('db:addDocumentFile', file);
    },

     getDocumentFiles(documentId: number): Promise<any[]> {
        return ipcRenderer.invoke('db:getDocumentFiles', documentId);
    },

     deleteDocumentFile(id: number): Promise<void> {
        return ipcRenderer.invoke('db:deleteDocumentFile', id);
    },

    getHomeOverview: () => ipcRenderer.invoke("home:getOverview"),

    /* =========================
     Paragraph Alignment
  ========================= */

    alignParas(data : {documentId: number, sourceText: string, targetText: string, srcLang: string, tgtLang: string}) {
        return ipcRenderer.invoke("align:paragraphs", data);
    },

    paraAlign(documentId: number) {
        return ipcRenderer.invoke("align:para", documentId);
    },

    getParaAlignments(documentId: number) {
        return ipcRenderer.invoke("align:para:list", documentId);
    },

    /* =========================
       Sentence Alignment (later)
    ========================= */
    sentenceAlign(documentId: number) {
        return ipcRenderer.invoke("align:sentence", documentId);
    },

    /* =========================
       Utility
    ========================= */
    openExternal(url: string) {
        ipcRenderer.send("shell:openExternal", url);
    },

    getParaAlignmentState(documentId: number) {
        console.log("[preload] getParaAlignmentState called", documentId);
        return ipcRenderer.invoke("alignment:getParaState", documentId);
    },

    getAlignmentState(documentId: number, alignmentType: string) {
        console.log("[preload] getParaAlignmentState called", documentId, alignmentType);
        return ipcRenderer.invoke("alignment:getAlignState", documentId, alignmentType);
    },

    saveHistoryState: (
        documentId: number,
        state: AppState,
        action: "edit" | "undo" | "redo" | "init",
        alignmentType: string,
    ) =>
        ipcRenderer.invoke(
            "alignment:saveHistoryState",
            documentId,
            state,
            action
        ),
    updateDocumentMetadata: (payload: {
        documentId: number;
        sourceMeta?: any;
        targetMeta?: any;
    }) => ipcRenderer.invoke("update-document-metadata", payload),

    saveParagraphLinks(documentId: number,
                       state: any,
                       action: any) {
        return ipcRenderer.invoke("alignment:saveParagraphLinks", documentId, state, action);
    },

    saveLinks(documentId: number,
                       state: any,
                       action: any,
              documentType: string) {
        return ipcRenderer.invoke("alignment:saveLinks", documentId, state, action, documentType);
    },

    testLLMCredential: (modelId: string) =>
        ipcRenderer.invoke("llm:test-credential", modelId),

    chatWithLLM: (request) =>
        ipcRenderer.invoke("llm:chat", request),

    alignParagraphBatch: (
        pairs: {
            sourceId: string;
            targetId: string;
            sourceLines: Line[];
            targetLines: Line[];
        }[],
        srcLang: string,
        tgtLang: string,
        documentId: string,
    ) =>
        ipcRenderer.invoke("align:paragraph-batch", {
            pairs,
            srcLang,
            tgtLang,
            documentId,
        }),

        saveCESAlignmentZip: (data: {
            sourceDocXml: string;
            targetDocXml: string;
            alignXml: string;
            sourceDocFilename: string;
            targetDocFilename: string;
        }) => ipcRenderer.invoke('save-ces-alignment-zip', data),

    /**
     * prompts
     */
    listPrompts: (): Promise<PromptEntity[]> => ipcRenderer.invoke("prompts:list"),
    savePrompt: (p: PromptEntity) => ipcRenderer.invoke("prompts:save", p),
    deletePrompt: (id: number) => ipcRenderer.invoke("prompts:delete", id),
    updatePrompt: (id, data) => ipcRenderer.invoke("prompts:update", id, data),

    /**
     * translation strategy tag
     */
    listTags: () => ipcRenderer.invoke("tags:list"),
    createTag: (data: any) => ipcRenderer.invoke("tags:create", data),
    updateTag: (id: number, data: any) => ipcRenderer.invoke("tags:update", id, data),
    deleteTag: (id: number) => ipcRenderer.invoke("tags:delete", id),

    /**
     * llm SETTINGS
     */
    /* =====================
      QUERY
   ====================== */
    getLLMModels: () =>
        ipcRenderer.invoke("llm:get-models"),

    /* =====================
       SAVE / CREATE
    ====================== */
    saveLLMModel: (payload) =>
        ipcRenderer.invoke("llm:save-model", payload),

    createLLMModel: (payload) =>
        ipcRenderer.invoke("llm:create-model", payload),

    setDefaultLLMModel: (id: string) =>
        ipcRenderer.invoke("llm:set-default", id),

    /* =====================
       TEST
    ====================== */
    testLLMModel: (payload) =>
        ipcRenderer.invoke("llm:test-model", payload),

    /* =====================
       APP
    ====================== */
    getAppVersion: () => ipcRenderer.invoke("app:getVersion"),

    /* =====================
       ENCRYPT
    ====================== */
    encryptApiKey: (apiKey: string) =>
        ipcRenderer.invoke("llm:encrypt-key", apiKey),

    /**
     * align stats
     */
    getStats: (documentId?: number) =>
        ipcRenderer.invoke("sentence-alignments:get-stats", documentId),


    resetPasswordByEmail: (email: string) =>
        ipcRenderer.invoke("user:reset-password-by-email", email),

    onAlignmentProgress: (callback) =>
        ipcRenderer.on("alignment-progress", (_, data) => callback(data)),

    removeAlignmentProgress: (callback) =>
        ipcRenderer.removeListener("alignment-progress", callback),

    getDocumentStatus: (id) =>
        ipcRenderer.invoke("get-document-status", id),

    markAlignmentCompleted: (documentId: number) =>
        ipcRenderer.invoke("alignment:markCompleted", documentId),

    getDocumentAlignments: (docId: number) =>
        ipcRenderer.invoke("get-document-alignments", docId),

    // ================= WORD ALIGNMENT =================
    getWordAlignmentState: (documentId: number, sourceKey: string, targetKey: string) =>
        ipcRenderer.invoke("word:getState", documentId, sourceKey, targetKey),

    saveWordAlignment: (documentId: number, sourceKey: string, targetKey: string, state: any) =>
        ipcRenderer.invoke("word:saveState", documentId, sourceKey, targetKey, state),

    checkWordAlignments: (documentId: number) =>
        ipcRenderer.invoke("word:checkExists", documentId),

    segmentAndAlignWords: (payload: {
        sourceText: string; targetText: string;
        srcLang: string; tgtLang: string;
        documentId: number; sourceKey: string; targetKey: string;
    }) => ipcRenderer.invoke("word:segmentAndAlign", payload),

    realignBlock: (payload: {
        sourceSentences: { id: string; text: string }[];
        targetSentences: { id: string; text: string }[];
        srcLang: string;
        tgtLang: string;
    }) => ipcRenderer.invoke("align:realign", payload),

    // ================= PROJECTS =================
    createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        return ipcRenderer.invoke('projects:create', project);
    },

    getProject(id: number): Promise<Project | null> {
        return ipcRenderer.invoke('projects:get', id);
    },

    getProjectWithMetadata(id: number): Promise<any | null> {
        return ipcRenderer.invoke('projects:getWithMetadata', id);
    },

    getAllProjects(): Promise<Project[]> {
        return ipcRenderer.invoke('projects:getAll');
    },

    getAllProjectsWithMetadata(): Promise<any[]> {
        return ipcRenderer.invoke('projects:getAllWithMetadata');
    },

    updateProject(id: number, updates: Partial<Project>): Promise<void> {
        return ipcRenderer.invoke('projects:update', id, updates);
    },

    deleteProject(id: number): Promise<void> {
        return ipcRenderer.invoke('projects:delete', id);
    },

    upsertProjectMetadata(metadata: Omit<ProjectMetadata, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
        return ipcRenderer.invoke('projects:upsertMetadata', metadata);
    },

    getProjectMetadata(projectId: number): Promise<ProjectMetadata | null> {
        return ipcRenderer.invoke('projects:getMetadata', projectId);
    },

    getInheritedMetadata(projectId: number): Promise<Partial<ProjectMetadata> | null> {
        return ipcRenderer.invoke('projects:getInheritedMetadata', projectId);
    },

    getProjectDocuments(projectId: number): Promise<any[]> {
        return ipcRenderer.invoke('projects:getDocuments', projectId);
    },

    addDocumentToProject(documentId: number, projectId: number): Promise<void> {
        return ipcRenderer.invoke('projects:addDocument', documentId, projectId);
    },

    removeDocumentFromProject(documentId: number): Promise<void> {
        return ipcRenderer.invoke('projects:removeDocument', documentId);
    },

    saveProjectWithMetadata(data: {
        project: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        metadata?: Omit<ProjectMetadata, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
    }): Promise<number> {
        return ipcRenderer.invoke('projects:saveWithMetadata', data);
    },

    updateProjectWithMetadata(id: number, data: {
        project?: Partial<Project>;
        metadata?: Partial<Omit<ProjectMetadata, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
    }): Promise<void> {
        return ipcRenderer.invoke('projects:updateWithMetadata', id, data);
    },

    exportProject(projectId: number): Promise<any> {
        return ipcRenderer.invoke('projects:exportAll', projectId);
    },

    saveProjectZip: (data: {
        projectTitle: string;
        documents: any[];
    }) => ipcRenderer.invoke('save-project-zip', data),

    // ================= MULTIMODAL LLM SETTINGS =================
    getMultimodalLLMModels: () =>
        ipcRenderer.invoke("multimodalllm:get-models"),

    saveMultimodalLLMModel: (payload: {
        id: string; model_name: string; base_url: string; api_key: string;
    }) => ipcRenderer.invoke("multimodalllm:save-model", payload),

    createMultimodalLLMModel: (payload: {
        model_name: string; base_url: string; api_key: string;
    }) => ipcRenderer.invoke("multimodalllm:create-model", payload),

    setDefaultMultimodalLLMModel: (id: string) =>
        ipcRenderer.invoke("multimodalllm:set-default", id),

    testMultimodalLLMModel: (payload: {
        base_url: string; api_key: string; model_name: string;
    }) => ipcRenderer.invoke("multimodalllm:test-model", payload),

    // ================= MULTIMODAL PAIRS =================
    listMultimodalPairs: () =>
        ipcRenderer.invoke("multimodal:listPairs"),

    getMultimodalPair: (id: number) =>
        ipcRenderer.invoke("multimodal:getPair", id),

    createMultimodalPair: (data: any) =>
        ipcRenderer.invoke("multimodal:createPair", data),

    updateMultimodalPair: (id: number, data: any) =>
        ipcRenderer.invoke("multimodal:updatePair", id, data),

    deleteMultimodalPair: (id: number) =>
        ipcRenderer.invoke("multimodal:deletePair", id),

    pickImageFile: () =>
        ipcRenderer.invoke("multimodal:pickImage"),

    getMultimodalAnalyses: (pairId: number) =>
        ipcRenderer.invoke("multimodal:getAnalyses", pairId),

    analyzeMultimodalPair: (payload: {
        pairId: number; analysisType: string; customPrompt?: string;
    }) => ipcRenderer.invoke("multimodal:analyze", payload),

    // ================= CORPUS ANALYSIS =================
    getAlignedDocuments: () => ipcRenderer.invoke("corpus:getAlignedDocuments"),
    getCorpusSegments: (documentIds: number[]) => ipcRenderer.invoke("corpus:getSegments", documentIds),
    getCorpusSkills: () => ipcRenderer.invoke("corpus:getSkills"),
    runCorpusAnalysis: (payload: { documentIds: number[]; skillKey: string; customPrompt?: string }) =>
        ipcRenderer.invoke("corpus:runAnalysis", payload),
    getCorpusAnalyses: () => ipcRenderer.invoke("corpus:getAnalyses"),

    // ================= FINISHED =================
    onAlignmentFinished: (callback: (data: any) => void) => {
        if (finishedListener) {
            ipcRenderer.removeListener("alignment-finished", finishedListener);
        }

        finishedListener = (_event: any, data: any) => {
            callback(data);
        };

        ipcRenderer.on("alignment-finished", finishedListener);
    },

});






