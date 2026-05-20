import { ipcMain } from "electron";
import {db} from "../db/db";
import OpenAI from "openai";

/* =====================
   GET MODELS
===================== */
/* =====================
   GET MODELS
===================== */
ipcMain.handle("llm:get-models", () => {
    return db.prepare(`
    SELECT
      id,
      model_name,
      base_url,
       api_key,
      is_default
    FROM llm_settings
    ORDER BY updated_at DESC
  `).all();
});

/* =====================
   SAVE MODEL
===================== */
ipcMain.handle("llm:save-model", (_, payload) => {
    const { id, model_name, base_url, api_key } = payload;

    if (id) {
        // UPDATE existing
        db.prepare(`
            UPDATE llm_settings
            SET
              model_name = ?,
              base_url = ?,
              api_key = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(model_name, base_url, api_key, id);
    } else {
        // INSERT new
        db.prepare(`
            INSERT INTO llm_settings (
              model_name,
              base_url,
              api_key,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(model_name, base_url, api_key);
    }
});

/* =====================
   CREATE MODEL
===================== */
ipcMain.handle("llm:create-model", (_, payload) => {
    const {model_name, base_url, api_key } = payload;

    db.prepare(`
    INSERT INTO llm_settings (model_name, base_url, api_key, is_default)
    VALUES (?, ?, ?, 0)
  `).run(model_name, base_url, api_key);
});

/* =====================
   SET DEFAULT
===================== */
ipcMain.handle("llm:set-default", (_, id: string) => {
    const tx = db.transaction((modelId: string) => {
        db.prepare(`UPDATE llm_settings SET is_default = 0`).run();
        db.prepare(`UPDATE llm_settings SET is_default = 1 WHERE id = ?`).run(modelId);
    });
    tx(id);
});
/* =====================
   ENCRYPT
===================== */
ipcMain.handle("llm:encrypt-key", async (_, apiKey: string) => {
    return encryptApiKey(apiKey);
});

/* =====================
   TEST MODEL
===================== */
ipcMain.handle("llm:test-model", async (_, payload) => {
    const { base_url, api_key, model_name } = payload;
    // const client = new OpenAI({
    //     apiKey:api_key,
    //     baseURL: base_url,
    // });
    let client = new OpenAI({
            apiKey: api_key,
            baseURL: base_url,
        }
    )


    if(false) {

        client = new OpenAI({
            apiKey: api_key,
            baseURL: base_url,
        });
    }
    if (!base_url || !api_key || !model_name) {
        throw new Error("Missing base_url, api_key, or model_name");
    }

    try {
        await client.chat.completions.create({
            model: model_name,
            messages: [
                { role: "user", content: "ping" }
            ],
            max_completion_tokens: 100,
        });
        return;
    } catch (innerErr: any) {
        throw new Error(
            normalizeLLMTestError(innerErr)
        );
    }
});


function normalizeLLMTestError(err: any): string {
    const msg =
        err?.error?.message ||
        err?.message ||
        "Unknown error";

    if (msg.includes("401") || msg.includes("Unauthorized")) {
        return "Invalid API key";
    }

    if (msg.includes("model") && msg.includes("not found")) {
        return "Model not available for this API key";
    }

    if (msg.includes("quota") || msg.includes("billing")) {
        return "API key has no remaining quota";
    }

    return `Connection failed: ${msg}`;
}
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY = crypto
    .createHash("sha256")
    .update(process.env.LLM_SECRET || "dev-secret")
    .digest();

export function encryptApiKey(apiKey: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);

    const encrypted = Buffer.concat([
        cipher.update(apiKey, "utf8"),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
