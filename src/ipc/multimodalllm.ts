import { ipcMain } from "electron";
import { db } from "../db/db";
import OpenAI from "openai";

/* =====================
   GET MODELS
===================== */
ipcMain.handle("multimodalllm:get-models", () => {
    return db.prepare(`
        SELECT id, model_name, base_url, api_key, is_default
        FROM multimodal_llm_settings
        ORDER BY updated_at DESC
    `).all();
});

/* =====================
   SAVE MODEL (update existing)
===================== */
ipcMain.handle("multimodalllm:save-model", (_, payload) => {
    const { id, model_name, base_url, api_key } = payload;
    db.prepare(`
        UPDATE multimodal_llm_settings
        SET model_name = ?, base_url = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(model_name, base_url, api_key, id);
});

/* =====================
   CREATE MODEL
===================== */
ipcMain.handle("multimodalllm:create-model", (_, payload) => {
    const { model_name, base_url, api_key } = payload;
    db.prepare(`
        INSERT INTO multimodal_llm_settings (model_name, base_url, api_key, is_default)
        VALUES (?, ?, ?, 0)
    `).run(model_name, base_url, api_key);
});

/* =====================
   SET DEFAULT
===================== */
ipcMain.handle("multimodalllm:set-default", (_, id: string) => {
    const tx = db.transaction((modelId: string) => {
        db.prepare(`UPDATE multimodal_llm_settings SET is_default = 0`).run();
        db.prepare(`UPDATE multimodal_llm_settings SET is_default = 1 WHERE id = ?`).run(modelId);
    });
    tx(id);
});

/* =====================
   TEST MODEL
===================== */
ipcMain.handle("multimodalllm:test-model", async (_, payload) => {
    const { base_url, api_key, model_name } = payload;
    if (!base_url || !api_key || !model_name) {
        throw new Error("Missing base_url, api_key, or model_name");
    }

    const client = new OpenAI({
        apiKey: api_key,
        baseURL: base_url,
    });

    try {
        await client.chat.completions.create({
            model: model_name,
            messages: [{ role: "user", content: "ping" }],
            max_completion_tokens: 100,
        });
        return;
    } catch (innerErr: any) {
        const msg = innerErr?.error?.message || innerErr?.message || "Unknown error";
        if (msg.includes("401") || msg.includes("Unauthorized")) {
            throw new Error("Invalid API key");
        }
        if (msg.includes("model") && msg.includes("not found")) {
            throw new Error("Model not available for this API key");
        }
        if (msg.includes("quota") || msg.includes("billing")) {
            throw new Error("API key has no remaining quota");
        }
        throw new Error(`Connection failed: ${msg}`);
    }
});
