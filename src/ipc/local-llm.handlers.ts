import { ipcMain } from "electron";
import axios, { CancelTokenSource } from "axios";
import { db } from "../db/db";

const OLLAMA_BASE = "http://localhost:11434";

let activePullCancel: CancelTokenSource | null = null;

/* =====================
   DETECT OLLAMA
===================== */
ipcMain.handle("local-llm:detect", async () => {
    try {
        const resp = await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 5000 });
        if (resp.status === 200) {
            return { status: "ok", models: resp.data.models || [] };
        }
        return { status: "error", error: `Unexpected response: ${resp.status}` };
    } catch (err: any) {
        if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
            return { status: "not_running", error: "Ollama is not running. Start it with `ollama serve` or launch the Ollama app." };
        }
        if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
            return { status: "not_running", error: "Connection timed out. Is Ollama running?" };
        }
        return { status: "error", error: err.message };
    }
});

/* =====================
   LIST INSTALLED MODELS
===================== */
ipcMain.handle("local-llm:list-models", async () => {
    const resp = await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 5000 });
    return { models: resp.data.models || [] };
});

/* =====================
   PULL MODEL (streams progress via push events)
===================== */
ipcMain.handle("local-llm:pull-model", async (event, modelName: string) => {
    const source = axios.CancelToken.source();
    activePullCancel = source;

    const streamPromise = new Promise<void>((resolve, reject) => {
        axios
            .post(
                `${OLLAMA_BASE}/api/pull`,
                { name: modelName, stream: true },
                { responseType: "stream", cancelToken: source.token, timeout: 0 },
            )
            .then((resp) => {
                let buffer = "";
                resp.data.on("data", (chunk: Buffer) => {
                    buffer += chunk.toString("utf-8");
                    const lines = buffer.split("\n");
                    // Keep the last (possibly incomplete) line in the buffer
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const data = JSON.parse(trimmed);
                            event.sender.send("local-llm:pull-progress", data);
                        } catch {
                            // skip unparseable lines
                        }
                    }
                });

                resp.data.on("end", () => {
                    // Flush remaining buffer
                    if (buffer.trim()) {
                        try {
                            const data = JSON.parse(buffer.trim());
                            event.sender.send("local-llm:pull-progress", data);
                        } catch { /* ignore */ }
                    }
                    event.sender.send("local-llm:pull-progress", { status: "done" });
                    activePullCancel = null;
                    resolve();
                });

                resp.data.on("error", (err: Error) => {
                    event.sender.send("local-llm:pull-progress", {
                        status: "error",
                        error: err.message,
                    });
                    activePullCancel = null;
                    reject(err);
                });
            })
            .catch((err) => {
                if (axios.isCancel(err)) {
                    event.sender.send("local-llm:pull-progress", {
                        status: "cancelled",
                    });
                    resolve(); // cancellation is not a failure
                } else {
                    const msg = err?.message || String(err);
                    event.sender.send("local-llm:pull-progress", {
                        status: "error",
                        error: msg,
                    });
                    reject(err);
                }
                activePullCancel = null;
            });
    });

    try {
        await streamPromise;
        return { success: true };
    } catch (err: any) {
        throw new Error(err.message || "Pull failed");
    }
});

/* =====================
   CANCEL ACTIVE PULL
===================== */
ipcMain.handle("local-llm:cancel-pull", async () => {
    if (activePullCancel) {
        activePullCancel.cancel("User cancelled");
        activePullCancel = null;
        return { cancelled: true };
    }
    return { cancelled: false };
});

/* =====================
   AUTO-CONFIGURE MODEL IN LLM SETTINGS
===================== */
ipcMain.handle(
    "local-llm:auto-configure",
    async (
        _event,
        payload: { model_name: string; base_url: string; api_key: string },
    ) => {
        const { model_name, base_url, api_key } = payload;

        // Check if model already exists
        const existing = db
            .prepare(`SELECT id FROM llm_settings WHERE model_name = ?`)
            .get(model_name) as { id: number } | undefined;

        if (existing) {
            // Update existing
            db.prepare(
                `UPDATE llm_settings SET base_url = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            ).run(base_url, api_key, existing.id);
            return { id: existing.id, created: false };
        }

        const result = db
            .prepare(
                `INSERT INTO llm_settings (model_name, base_url, api_key, is_default)
             VALUES (?, ?, ?, 0)`,
            )
            .run(model_name, base_url, api_key);
        return { id: result.lastInsertRowid as number, created: true };
    },
);
