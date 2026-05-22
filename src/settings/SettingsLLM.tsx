import { useEffect, useState } from "react";
import { message, Tabs } from "antd";
import { LLMRow } from "../types/llminterfaces";
import { MultimodalLLMRow } from "../types/multimodal";
import { Save, Zap, PlusCircle, Settings2, Eye, EyeOff, Loader2, Star } from "lucide-react";

const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

interface LLMTableSectionProps {
    modelType: "text" | "multimodal";
    models: (LLMRow | MultimodalLLMRow)[];
    loading: boolean;
    savingId: string | null;
    testingId: string | null;
    showKey: Record<string, boolean>;
    onToggleKey: (id: string) => void;
    onUpdateField: (id: string, field: string, value: string) => void;
    onSave: (record: any) => void;
    onTest: (record: any) => void;
    onSetDefault: (id: string) => void;
}

const LLMTableSection: React.FC<LLMTableSectionProps> = ({
    modelType,
    models,
    loading,
    savingId,
    testingId,
    showKey,
    onToggleKey,
    onUpdateField,
    onSave,
    onTest,
    onSetDefault,
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading models…
            </div>
        );
    }

    const label = modelType === "text" ? "Text" : "Multimodal";

    return (
        <div>
            {models.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                    <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No {label} models configured yet. Add one below.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Model Name</th>
                                <th className="px-4 py-3 text-left font-medium">Base URL</th>
                                <th className="px-4 py-3 text-left font-medium">API Key</th>
                                <th className="px-4 py-3 text-center font-medium">Default</th>
                                <th className="px-4 py-3 text-center font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {models.map((model) => (
                                <tr
                                    key={model.id}
                                    className={`transition-colors ${
                                        model.is_default
                                            ? "bg-blue-50/40"
                                            : "hover:bg-gray-50/60"
                                    }`}
                                >
                                    <td className="px-4 py-3 min-w-[160px]">
                                        <input
                                            className={inputClass}
                                            value={model.model_name}
                                            onChange={(e) =>
                                                onUpdateField(model.id, "model_name", e.target.value)
                                            }
                                        />
                                    </td>
                                    <td className="px-4 py-3 min-w-[220px]">
                                        <input
                                            className={inputClass}
                                            value={model.base_url}
                                            onChange={(e) =>
                                                onUpdateField(model.id, "base_url", e.target.value)
                                            }
                                        />
                                    </td>
                                    <td className="px-4 py-3 min-w-[200px]">
                                        <div className="relative">
                                            <input
                                                className={`${inputClass} pr-8`}
                                                type={showKey[model.id] ? "text" : "password"}
                                                value={model.api_key}
                                                onChange={(e) =>
                                                    onUpdateField(model.id, "api_key", e.target.value)
                                                }
                                            />
                                            <button
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                onClick={() => onToggleKey(model.id)}
                                            >
                                                {showKey[model.id] ? (
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => onSetDefault(model.id)}
                                            title={
                                                model.is_default ? "Default model" : "Set as default"
                                            }
                                            className={`transition-colors ${
                                                model.is_default
                                                    ? "text-yellow-500"
                                                    : "text-gray-300 hover:text-yellow-400"
                                            }`}
                                        >
                                            <Star
                                                className="w-5 h-5"
                                                fill={model.is_default ? "currentColor" : "none"}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60 transition-colors"
                                                disabled={savingId === model.id}
                                                onClick={() => onSave(model)}
                                            >
                                                {savingId === model.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Save className="w-3.5 h-3.5" />
                                                )}
                                                {savingId === model.id ? "Saving…" : "Save & Test"}
                                            </button>
                                            <button
                                                className="flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 disabled:opacity-60 transition-colors"
                                                disabled={testingId === model.id}
                                                onClick={() => onTest(model)}
                                            >
                                                {testingId === model.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                                )}
                                                {testingId === model.id ? "Testing…" : "Test"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

interface AddModelSectionProps {
    onAdd: () => void;
    adding: boolean;
    newModel: { model_name: string; base_url: string; api_key: string };
    showNewKey: boolean;
    onToggleNewKey: () => void;
    onUpdateNewModel: (field: string, value: string) => void;
}

const AddModelSection: React.FC<AddModelSectionProps> = ({
    onAdd,
    adding,
    newModel,
    showNewKey,
    onToggleNewKey,
    onUpdateNewModel,
}) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
            <PlusCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-gray-700">Add New Model</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Model Name
                </label>
                <input
                    className={inputClass}
                    placeholder="e.g. gpt-4o"
                    value={newModel.model_name}
                    onChange={(e) => onUpdateNewModel("model_name", e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Base URL
                </label>
                <input
                    className={inputClass}
                    placeholder="e.g. https://api.openai.com/v1"
                    value={newModel.base_url}
                    onChange={(e) => onUpdateNewModel("base_url", e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    API Key
                </label>
                <div className="relative">
                    <input
                        className={`${inputClass} pr-8`}
                        type={showNewKey ? "text" : "password"}
                        placeholder="sk-…"
                        value={newModel.api_key}
                        onChange={(e) => onUpdateNewModel("api_key", e.target.value)}
                    />
                    <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={onToggleNewKey}
                    >
                        {showNewKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                            <Eye className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
        <div className="mt-4 flex justify-end">
            <button
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-60 transition-colors"
                onClick={onAdd}
                disabled={adding}
            >
                {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <PlusCircle className="w-4 h-4" />
                )}
                {adding ? "Adding…" : "Add & Test"}
            </button>
        </div>
    </div>
);

const LLMSettingsPage = () => {
    // ── Text LLM state ──
    const [textModels, setTextModels] = useState<LLMRow[]>([]);
    const [textLoading, setTextLoading] = useState(true);
    const [textSavingId, setTextSavingId] = useState<string | null>(null);
    const [textTestingId, setTextTestingId] = useState<string | null>(null);
    const [textShowKey, setTextShowKey] = useState<Record<string, boolean>>({});
    const [textShowNewKey, setTextShowNewKey] = useState(false);
    const [textNewModel, setTextNewModel] = useState({ model_name: "", base_url: "", api_key: "" });
    const [textAdding, setTextAdding] = useState(false);

    // ── Multimodal LLM state ──
    const [mmModels, setMmModels] = useState<MultimodalLLMRow[]>([]);
    const [mmLoading, setMmLoading] = useState(true);
    const [mmSavingId, setMmSavingId] = useState<string | null>(null);
    const [mmTestingId, setMmTestingId] = useState<string | null>(null);
    const [mmShowKey, setMmShowKey] = useState<Record<string, boolean>>({});
    const [mmShowNewKey, setMmShowNewKey] = useState(false);
    const [mmNewModel, setMmNewModel] = useState({ model_name: "", base_url: "", api_key: "" });
    const [mmAdding, setMmAdding] = useState(false);

    const [activeTab, setActiveTab] = useState<string>("text");

    useEffect(() => {
        if (activeTab === "text") {
            window.api.getLLMModels().then((rows) => {
                setTextModels(rows);
                setTextLoading(false);
            });
        } else {
            window.api.getMultimodalLLMModels().then((rows) => {
                setMmModels(rows);
                setMmLoading(false);
            });
        }
    }, [activeTab]);

    // ── Text LLM handlers ──
    const updateTextField = (id: string, field: string, value: string) => {
        setTextModels((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
        );
    };

    const saveTextModel = async (record: LLMRow) => {
        if (!record.base_url || !record.model_name || !record.api_key) {
            message.warning("Fill all fields before saving");
            return;
        }
        setTextSavingId(record.id);
        try {
            await window.api.testLLMModel({
                base_url: record.base_url,
                api_key: record.api_key,
                model_name: record.model_name,
            });
            await window.api.saveLLMModel({
                id: record.id,
                model_name: record.model_name,
                base_url: record.base_url,
                api_key: record.api_key,
            });
            message.success("Saved & tested successfully");
        } catch (err: any) {
            message.error(err.message || "Save/Test failed");
        } finally {
            setTextSavingId(null);
        }
    };

    const testTextModel = async (record: LLMRow) => {
        setTextTestingId(record.id);
        try {
            await window.api.testLLMModel({
                base_url: record.base_url,
                api_key: record.api_key,
                model_name: record.model_name,
            });
            message.success("Connection successful");
        } catch (err: any) {
            message.error(err.message || "Test failed");
        } finally {
            setTextTestingId(null);
        }
    };

    const setTextDefault = async (id: string) => {
        await window.api.setDefaultLLMModel(id);
        setTextModels((prev) =>
            prev.map((m) => ({ ...m, is_default: m.id === id ? 1 : 0 }))
        );
        message.success("Default model updated");
    };

    const addTextModel = async () => {
        if (!textNewModel.model_name || !textNewModel.base_url || !textNewModel.api_key) {
            message.warning("Fill all fields to add a new model");
            return;
        }
        setTextAdding(true);
        try {
            await window.api.testLLMModel({
                base_url: textNewModel.base_url,
                api_key: textNewModel.api_key,
                model_name: textNewModel.model_name,
            });
            await window.api.createLLMModel({
                model_name: textNewModel.model_name,
                base_url: textNewModel.base_url,
                api_key: textNewModel.api_key,
            });
            const rows = await window.api.getLLMModels();
            setTextModels(rows);
            setTextNewModel({ model_name: "", base_url: "", api_key: "" });
            message.success("Model added & tested successfully");
        } catch (err: any) {
            message.error(err.message || "Failed to add model");
        } finally {
            setTextAdding(false);
        }
    };

    // ── Multimodal LLM handlers ──
    const updateMmField = (id: string, field: string, value: string) => {
        setMmModels((prev) =>
            prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
        );
    };

    const saveMmModel = async (record: MultimodalLLMRow) => {
        if (!record.base_url || !record.model_name || !record.api_key) {
            message.warning("Fill all fields before saving");
            return;
        }
        setMmSavingId(record.id);
        try {
            await window.api.testMultimodalLLMModel({
                base_url: record.base_url,
                api_key: record.api_key,
                model_name: record.model_name,
            });
            await window.api.saveMultimodalLLMModel({
                id: record.id,
                model_name: record.model_name,
                base_url: record.base_url,
                api_key: record.api_key,
            });
            message.success("Saved & tested successfully");
        } catch (err: any) {
            message.error(err.message || "Save/Test failed");
        } finally {
            setMmSavingId(null);
        }
    };

    const testMmModel = async (record: MultimodalLLMRow) => {
        setMmTestingId(record.id);
        try {
            await window.api.testMultimodalLLMModel({
                base_url: record.base_url,
                api_key: record.api_key,
                model_name: record.model_name,
            });
            message.success("Connection successful");
        } catch (err: any) {
            message.error(err.message || "Test failed");
        } finally {
            setMmTestingId(null);
        }
    };

    const setMmDefault = async (id: string) => {
        await window.api.setDefaultMultimodalLLMModel(id);
        setMmModels((prev) =>
            prev.map((m) => ({ ...m, is_default: m.id === id ? 1 : 0 }))
        );
        message.success("Default model updated");
    };

    const addMmModel = async () => {
        if (!mmNewModel.model_name || !mmNewModel.base_url || !mmNewModel.api_key) {
            message.warning("Fill all fields to add a new model");
            return;
        }
        setMmAdding(true);
        try {
            await window.api.testMultimodalLLMModel({
                base_url: mmNewModel.base_url,
                api_key: mmNewModel.api_key,
                model_name: mmNewModel.model_name,
            });
            await window.api.createMultimodalLLMModel({
                model_name: mmNewModel.model_name,
                base_url: mmNewModel.base_url,
                api_key: mmNewModel.api_key,
            });
            const rows = await window.api.getMultimodalLLMModels();
            setMmModels(rows);
            setMmNewModel({ model_name: "", base_url: "", api_key: "" });
            message.success("Model added & tested successfully");
        } catch (err: any) {
            message.error(err.message || "Failed to add model");
        } finally {
            setMmAdding(false);
        }
    };

    const tabItems = [
        {
            key: "text",
            label: "Text LLMs",
            children: (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-700">Text Models</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {textModels.length} model{textModels.length !== 1 ? "s" : ""} configured — used for sentence/word alignment
                        </p>
                    </div>
                    <LLMTableSection
                        modelType="text"
                        models={textModels}
                        loading={textLoading}
                        savingId={textSavingId}
                        testingId={textTestingId}
                        showKey={textShowKey}
                        onToggleKey={(id) =>
                            setTextShowKey((prev) => ({ ...prev, [id]: !prev[id] }))
                        }
                        onUpdateField={updateTextField}
                        onSave={saveTextModel}
                        onTest={testTextModel}
                        onSetDefault={setTextDefault}
                    />
                    <AddModelSection
                        onAdd={addTextModel}
                        adding={textAdding}
                        newModel={textNewModel}
                        showNewKey={textShowNewKey}
                        onToggleNewKey={() => setTextShowNewKey((v) => !v)}
                        onUpdateNewModel={(field, value) =>
                            setTextNewModel((prev) => ({ ...prev, [field]: value }))
                        }
                    />
                </div>
            ),
        },
        {
            key: "multimodal",
            label: "Multimodal LLMs",
            children: (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-700">Multimodal Models</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {mmModels.length} model{mmModels.length !== 1 ? "s" : ""} configured — used for image analysis (GPT-4V, GPT-4o, Claude, etc.)
                        </p>
                    </div>
                    <LLMTableSection
                        modelType="multimodal"
                        models={mmModels}
                        loading={mmLoading}
                        savingId={mmSavingId}
                        testingId={mmTestingId}
                        showKey={mmShowKey}
                        onToggleKey={(id) =>
                            setMmShowKey((prev) => ({ ...prev, [id]: !prev[id] }))
                        }
                        onUpdateField={updateMmField}
                        onSave={saveMmModel}
                        onTest={testMmModel}
                        onSetDefault={setMmDefault}
                    />
                    <AddModelSection
                        onAdd={addMmModel}
                        adding={mmAdding}
                        newModel={mmNewModel}
                        showNewKey={mmShowNewKey}
                        onToggleNewKey={() => setMmShowNewKey((v) => !v)}
                        onUpdateNewModel={(field, value) =>
                            setMmNewModel((prev) => ({ ...prev, [field]: value }))
                        }
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                    <Settings2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">LLM Settings</h1>
                    <p className="text-sm text-gray-500">Configure AI models for alignment and analysis tasks</p>
                </div>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size="large"
            />
        </div>
    );
};

export default LLMSettingsPage;
