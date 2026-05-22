import { ipcMain, dialog, BrowserWindow } from "electron";
import { db } from "../db/db";
import * as fs from "fs";
import * as path from "path";
import { sendMultimodalChatCompletion } from "../utils/sendMultimodalChatCompletion";
import type { MultimodalContentPart, ChatMessage } from "../types/llminterfaces";

const ANALYSIS_PROMPTS: Record<string, string> = {
    description: "Describe each image in detail, noting visual elements, composition, and any text visible. Reference 'Image 1 (Source)' and 'Image 2 (Target)' in your description.",
    text_extraction: "Extract all visible text from both images. Return as JSON with keys: sourceText (text from Image 1) and targetText (text from Image 2).",
    comparison: "Compare the two images. Identify similarities and differences in composition, text content, visual style, and cultural context.",
    discourse_analysis: "Perform a critical discourse analysis comparing these two images. Consider: power relations, cultural framing, linguistic choices, visual rhetoric, and ideological positioning.",
};

function readImageAsBase64(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
    };
    const mime = mimeMap[ext] || "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
}

/* =====================
   LIST PAIRS
===================== */
ipcMain.handle("multimodal:listPairs", () => {
    return db.prepare(`
        SELECT * FROM multimodal_pairs ORDER BY updated_at DESC
    `).all();
});

/* =====================
   GET PAIR
===================== */
ipcMain.handle("multimodal:getPair", (_, id: number) => {
    return db.prepare(`SELECT * FROM multimodal_pairs WHERE id = ?`).get(id) || null;
});

/* =====================
   CREATE PAIR
===================== */
ipcMain.handle("multimodal:createPair", (_, data) => {
    const result = db.prepare(`
        INSERT INTO multimodal_pairs (
            title, description, source_image_path, source_image_name,
            source_language, source_description, source_text_content,
            target_image_path, target_image_name, target_language,
            target_description, target_text_content, domain, context_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.title, data.description || null,
        data.source_image_path, data.source_image_name || null,
        data.source_language || null, data.source_description || null,
        data.source_text_content || null,
        data.target_image_path, data.target_image_name || null,
        data.target_language || null, data.target_description || null,
        data.target_text_content || null,
        data.domain || null, data.context_notes || null
    );
    return result.lastInsertRowid as number;
});

/* =====================
   UPDATE PAIR
===================== */
ipcMain.handle("multimodal:updatePair", (_, id: number, data) => {
    db.prepare(`
        UPDATE multimodal_pairs SET
            title = ?, description = ?, source_image_path = ?, source_image_name = ?,
            source_language = ?, source_description = ?, source_text_content = ?,
            target_image_path = ?, target_image_name = ?, target_language = ?,
            target_description = ?, target_text_content = ?, domain = ?,
            context_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        data.title, data.description || null,
        data.source_image_path, data.source_image_name || null,
        data.source_language || null, data.source_description || null,
        data.source_text_content || null,
        data.target_image_path, data.target_image_name || null,
        data.target_language || null, data.target_description || null,
        data.target_text_content || null,
        data.domain || null, data.context_notes || null,
        id
    );
});

/* =====================
   DELETE PAIR
===================== */
ipcMain.handle("multimodal:deletePair", (_, id: number) => {
    db.prepare(`DELETE FROM multimodal_analyses WHERE pair_id = ?`).run(id);
    db.prepare(`DELETE FROM multimodal_pairs WHERE id = ?`).run(id);
});

/* =====================
   PICK IMAGE FILE
===================== */
ipcMain.handle("multimodal:pickImage", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
        title: "Select an image",
        filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] },
        ],
        properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    return { filePath, fileName };
});

/* =====================
   GET ANALYSES FOR PAIR
===================== */
ipcMain.handle("multimodal:getAnalyses", (_, pairId: number) => {
    return db.prepare(`
        SELECT * FROM multimodal_analyses WHERE pair_id = ? ORDER BY created_at DESC
    `).all(pairId);
});

/* =====================
   RUN ANALYSIS
===================== */
ipcMain.handle("multimodal:analyze", async (_, payload: {
    pairId: number;
    analysisType: string;
    customPrompt?: string;
}) => {
    const { pairId, analysisType, customPrompt } = payload;

    const pair = db.prepare(`SELECT * FROM multimodal_pairs WHERE id = ?`).get(pairId) as any;
    if (!pair) throw new Error("Image pair not found");

    // Read and encode both images
    const sourceB64 = readImageAsBase64(pair.source_image_path);
    const targetB64 = readImageAsBase64(pair.target_image_path);

    // Build system prompt
    const systemPrompt = analysisType === "custom"
        ? (customPrompt || "Analyze these two images.")
        : (ANALYSIS_PROMPTS[analysisType] || ANALYSIS_PROMPTS.description);

    // Build multimodal user message
    const userContent: MultimodalContentPart[] = [
        { type: "text", text: "Image 1 (Source):" },
        { type: "image_url", image_url: { url: sourceB64, detail: "high" } },
        { type: "text", text: "Image 2 (Target):" },
        { type: "image_url", image_url: { url: targetB64, detail: "high" } },
    ];

    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ];

    const response = await sendMultimodalChatCompletion({
        messages,
        temperature: 0.3,
        maxTokens: 4096,
    });

    // Save analysis to DB
    db.prepare(`
        INSERT INTO multimodal_analyses (pair_id, analysis_type, model_name, prompt, result)
        VALUES (?, ?, ?, ?, ?)
    `).run(pairId, analysisType, response.model, systemPrompt, response.content);

    return {
        analysis_type: analysisType,
        model_name: response.model,
        prompt: systemPrompt,
        result: response.content,
    };
});
