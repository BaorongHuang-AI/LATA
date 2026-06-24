import { useEffect, useState, useCallback } from "react";
import { message } from "antd";
import {
    Loader2,
    Download,
    Server,
    RefreshCw,
    DownloadCloud,
    CheckCircle2,
    XCircle,
    Plus,
    Monitor,
    Cpu,
    ExternalLink,
    HardDrive,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────
const POPULAR_MODELS = [
    { name: "llama3.1:8b", label: "Llama 3.1 8B", size: "~4.7 GB" },
    { name: "qwen2.5:14b", label: "Qwen 2.5 14B", size: "~8.5 GB" },
    { name: "mistral:7b", label: "Mistral 7B", size: "~4.1 GB" },
    { name: "phi3:mini", label: "Phi-3 Mini", size: "~2.3 GB" },
    { name: "gemma2:9b", label: "Gemma 2 9B", size: "~5.4 GB" },
];

const PRESET_SERVERS = [
    { name: "Ollama", url: "http://localhost:11434/v1", key: "ollama", icon: "🦙" },
    { name: "LM Studio", url: "http://localhost:1234/v1", key: "lm-studio", icon: "📦" },
    { name: "llama.cpp", url: "http://localhost:8080/v1", key: "llama-cpp", icon: "🔧" },
];

type DetectionResult = {
    status: string;
    models?: OllamaModel[];
    error?: string;
};

type TabState = "detecting" | "not_running" | "ready" | "pulling" | "error";

// ── Helpers ───────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return dateStr;
    }
}

// ── Component ─────────────────────────────────────────────
const LocalLLMTab: React.FC = () => {
    const [state, setState] = useState<TabState>("detecting");
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [errorMsg, setErrorMsg] = useState<string>("");
    const [pullModelName, setPullModelName] = useState<string>("");
    const [pullProgress, setPullProgress] = useState<{
        status: string;
        completed?: number;
        total?: number;
    } | null>(null);
    const [pullError, setPullError] = useState<string>("");
    const [pullComplete, setPullComplete] = useState(false);
    const [configuringModels, setConfiguringModels] = useState<Set<string>>(new Set());
    const [configuredModels, setConfiguredModels] = useState<Set<string>>(new Set());

    // ── Detection ────────────────────────────────────────
    const detect = useCallback(async () => {
        setState("detecting");
        setErrorMsg("");
        try {
            const result: DetectionResult = await window.api.detectOllama();
            if (result.status === "ok") {
                setModels(result.models || []);
                setState("ready");
            } else if (result.status === "not_running") {
                setErrorMsg(result.error || "Ollama is not running.");
                setState("not_running");
            } else {
                setErrorMsg(result.error || "Unknown error");
                setState("error");
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Detection failed");
            setState("error");
        }
    }, []);

    useEffect(() => {
        detect();
    }, [detect]);

    // ── Pull progress listener ──────────────────────────
    useEffect(() => {
        window.api.onPullProgress((data: PullProgress) => {
            setPullProgress(data);
            if (data.status === "done") {
                setPullComplete(true);
                setState("ready");
                // Refresh model list
                window.api.listInstalledModels().then((r) => setModels(r.models));
            } else if (data.status === "error") {
                setPullError(data.error || "Pull failed");
                setState("ready");
            } else if (data.status === "cancelled") {
                setState("ready");
                setPullProgress(null);
            }
        });

        return () => {
            window.api.removePullProgressListener();
        };
    }, []);

    // ── Pull model ───────────────────────────────────────
    const handlePull = async () => {
        const name = pullModelName.trim();
        if (!name) {
            message.warning("Enter a model name");
            return;
        }
        setState("pulling");
        setPullProgress({ status: "starting" });
        setPullError("");
        setPullComplete(false);
        try {
            await window.api.pullModel(name);
        } catch (err: any) {
            setPullError(err.message || "Pull failed");
            setState("ready");
        }
    };

    const handlePullPreset = async (modelName: string) => {
        setPullModelName(modelName);
        setState("pulling");
        setPullProgress({ status: "starting" });
        setPullError("");
        setPullComplete(false);
        try {
            await window.api.pullModel(modelName);
        } catch (err: any) {
            setPullError(err.message || "Pull failed");
            setState("ready");
        }
    };

    const handleCancelPull = async () => {
        await window.api.cancelPull();
    };

    // ── Auto-configure ───────────────────────────────────
    const handleAutoConfigure = async (modelName: string) => {
        setConfiguringModels((prev) => new Set(prev).add(modelName));
        try {
            const result = await window.api.autoConfigureModel({
                model_name: modelName,
                base_url: "http://localhost:11434/v1",
                api_key: "ollama",
            });
            setConfiguredModels((prev) => new Set(prev).add(modelName));
            message.success(
                result.created
                    ? `Added "${modelName}" to Text LLMs`
                    : `Updated "${modelName}" in Text LLMs`,
            );
        } catch (err: any) {
            message.error(err.message || "Failed to configure model");
        } finally {
            setConfiguringModels((prev) => {
                const next = new Set(prev);
                next.delete(modelName);
                return next;
            });
        }
    };

    // ── Open download page ───────────────────────────────
    const handleDownloadOllama = () => {
        try {
            window.api.openExternal("https://ollama.com/download");
        } catch {
            // fallback — openExternal is fire-and-forget
        }
    };

    // ── Render states ────────────────────────────────────

    // ---- Detecting ----
    if (state === "detecting") {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Detecting Ollama…
            </div>
        );
    }

    // ---- Not running ----
    if (state === "not_running") {
        return (
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                    <Server className="w-12 h-12 mx-auto text-amber-400 mb-4" />
                    <h2 className="text-lg font-semibold text-amber-800 mb-2">
                        Ollama Not Running
                    </h2>
                    <p className="text-sm text-amber-600 mb-1 max-w-md mx-auto">
                        {errorMsg ||
                            "Could not connect to Ollama. Make sure it's installed and running."}
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-6">
                        <button
                            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                            onClick={handleDownloadOllama}
                        >
                            <Download className="w-4 h-4" />
                            Download Ollama
                        </button>
                        <button
                            className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white px-4 py-2 rounded-lg text-sm font-medium text-gray-600 transition-colors"
                            onClick={detect}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                    </div>

                    <div className="mt-6 text-left max-w-lg mx-auto bg-white rounded-lg border border-amber-100 p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            How to get started:
                        </h4>
                        <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside">
                            <li>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleDownloadOllama();
                                    }}
                                    className="text-blue-600 hover:underline"
                                >
                                    Download Ollama
                                </a>{" "}
                                for your platform
                            </li>
                            <li>Install and launch the Ollama app</li>
                            <li>
                                Open a terminal and run:{" "}
                                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                                    ollama pull llama3.1:8b
                                </code>
                            </li>
                            <li>Come back here and click "Retry"</li>
                        </ol>
                    </div>
                </div>

                {/* Presets section — always visible */}
                <PresetServersSection />
            </div>
        );
    }

    // ---- Error ----
    if (state === "error") {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                <XCircle className="w-10 h-10 text-red-400" />
                <p className="text-sm text-red-500">{errorMsg}</p>
                <button
                    className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white px-4 py-2 rounded-lg text-sm font-medium text-gray-600 transition-colors"
                    onClick={detect}
                >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                </button>
            </div>
        );
    }

    // ---- Ready or Pulling ----
    const isPulling = state === "pulling";
    const progressPercent =
        pullProgress && pullProgress.total && pullProgress.total > 0
            ? Math.round(
                  ((pullProgress.completed || 0) / pullProgress.total) * 100,
              )
            : 0;

    return (
        <div className="space-y-6">
            {/* ── Header bar ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Cpu className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700">Ollama Models</h3>
                        <p className="text-xs text-gray-400">
                            {models.length} model{models.length !== 1 ? "s" : ""}{" "}
                            installed · running on{" "}
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                                localhost:11434
                            </code>
                        </p>
                    </div>
                </div>
                <button
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    onClick={detect}
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* ── Pull in progress ── */}
            {isPulling && pullProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <DownloadCloud className="w-5 h-5 text-blue-500 animate-pulse" />
                            <span className="font-semibold text-sm text-blue-800">
                                Pulling: {pullModelName}
                            </span>
                        </div>
                        <button
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                            onClick={handleCancelPull}
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Progress bar */}
                    {pullProgress.total && pullProgress.total > 0 ? (
                        <div className="space-y-2">
                            <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-blue-600">
                                <span>
                                    {formatBytes(pullProgress.completed || 0)} /{" "}
                                    {formatBytes(pullProgress.total)}
                                </span>
                                <span>{progressPercent}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {pullProgress.status === "starting"
                                ? "Starting pull…"
                                : pullProgress.status === "pulling manifest"
                                  ? "Fetching manifest…"
                                  : pullProgress.status}
                        </div>
                    )}

                    {pullError && (
                        <p className="text-sm text-red-500 mt-3">{pullError}</p>
                    )}
                </div>
            )}

            {/* ── Pull section ── */}
            {!isPulling && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h4 className="font-semibold text-sm text-gray-700 mb-4">
                        Pull a New Model
                    </h4>

                    {/* Popular model chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {POPULAR_MODELS.map((m) => (
                            <button
                                key={m.name}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                                onClick={() => handlePullPreset(m.name)}
                                title={`${m.label} (${m.size})`}
                            >
                                <DownloadCloud className="w-3 h-3 text-gray-400" />
                                {m.label}
                                <span className="text-gray-400">({m.size})</span>
                            </button>
                        ))}
                    </div>

                    {/* Custom model input */}
                    <div className="flex gap-3">
                        <input
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                            placeholder="e.g. llama3.1:8b or qwen2.5:14b"
                            value={pullModelName}
                            onChange={(e) => setPullModelName(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handlePull()
                            }
                        />
                        <button
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                            disabled={!pullModelName.trim()}
                            onClick={handlePull}
                        >
                            <DownloadCloud className="w-4 h-4" />
                            Pull
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Browse models at{" "}
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                try {
                                    window.api.openExternal(
                                        "https://ollama.com/search",
                                    );
                                } catch { /* ignore */ }
                            }}
                            className="text-blue-600 hover:underline"
                        >
                            ollama.com/search
                        </a>
                    </p>
                </div>
            )}

            {/* ── Installed models ── */}
            {models.length > 0 && !isPulling && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                        <h4 className="font-semibold text-sm text-gray-700">
                            Installed Models ({models.length})
                        </h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {models.map((model) => {
                            const isConfigured = configuredModels.has(model.name);
                            const isConfiguring = configuringModels.has(model.name);
                            return (
                                <div
                                    key={model.digest || model.name}
                                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                                            <Cpu className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {model.name}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatBytes(model.size)}
                                                {model.modified_at &&
                                                    ` · ${formatDate(model.modified_at)}`}
                                                {model.details?.parameter_size &&
                                                    ` · ${model.details.parameter_size}`}
                                                {model.details?.quantization_level &&
                                                    ` · ${model.details.quantization_level}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ml-4 ${
                                            isConfigured
                                                ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
                                                : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                                        }`}
                                        disabled={isConfigured || isConfiguring}
                                        onClick={() => handleAutoConfigure(model.name)}
                                    >
                                        {isConfiguring ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : isConfigured ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <Plus className="w-3.5 h-3.5" />
                                        )}
                                        {isConfigured ? "Added" : "Add to LATA"}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Empty state (running but no models) ── */}
            {models.length === 0 && !isPulling && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <HardDrive className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500 mb-1">
                        No models installed yet
                    </p>
                    <p className="text-xs text-gray-400">
                        Pull a model above, or use the command line:{" "}
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                            ollama pull llama3.1:8b
                        </code>
                    </p>
                </div>
            )}

            {/* ── Pull complete toast ── */}
            {pullComplete && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-medium text-green-800">
                            Model pulled successfully! You can now add it to
                            LATA's LLM settings.
                        </span>
                    </div>
                    <button
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                        onClick={() => setPullComplete(false)}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* ── Preset servers section ── */}
            <PresetServersSection />
        </div>
    );
};

// ── Preset Servers Sub-component ────────────────────────────
const PresetServersSection: React.FC = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-gray-500" />
            <h4 className="font-semibold text-sm text-gray-700">
                Other Local Servers
            </h4>
        </div>
        <p className="text-xs text-gray-400 mb-4">
            Already running a different local LLM server? Use these presets to
            quickly add it in the{" "}
            <strong className="text-gray-500">Text LLMs</strong> tab.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESET_SERVERS.map((preset) => (
                <div
                    key={preset.name}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{preset.icon}</span>
                        <div>
                            <p className="text-sm font-medium text-gray-700">
                                {preset.name}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                                {preset.url}
                            </p>
                        </div>
                    </div>
                    <button
                        className="w-full flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                        onClick={async () => {
                            try {
                                await window.api.createLLMModel({
                                    model_name: `${preset.name.toLowerCase().replace(" ", "-")}-local`,
                                    base_url: preset.url,
                                    api_key: preset.key,
                                });
                                message.success(
                                    `Added ${preset.name} preset. Switch to "Text LLMs" tab to configure the model name.`,
                                );
                            } catch (err: any) {
                                message.error(
                                    err.message || "Failed to add preset",
                                );
                            }
                        }}
                    >
                        <Plus className="w-3 h-3" />
                        Add Preset
                    </button>
                    <button
                        className="w-full flex items-center justify-center gap-1.5 text-blue-600 hover:text-blue-800 mt-2 text-xs transition-colors"
                        onClick={() => {
                            try {
                                window.api.openExternal(preset.url);
                            } catch { /* ignore */ }
                        }}
                    >
                        <ExternalLink className="w-3 h-3" />
                        Test in Browser
                    </button>
                </div>
            ))}
        </div>
    </div>
);

export default LocalLLMTab;
