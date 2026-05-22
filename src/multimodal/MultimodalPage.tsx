import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button, message, Spin, Popconfirm, Tag } from "antd";
import { Plus, Edit, Trash2, Image } from "lucide-react";
import PairEditorModal from "./PairEditorModal";
import AnalysisPanel from "./AnalysisPanel";
import type { MultimodalPair, MultimodalAnalysis } from "../types/multimodal";

const MultimodalPage: React.FC = () => {
    const [pairs, setPairs] = useState<MultimodalPair[]>([]);
    const [selectedPair, setSelectedPair] = useState<MultimodalPair | null>(null);
    const [loadingPairs, setLoadingPairs] = useState(true);
    const [editorVisible, setEditorVisible] = useState(false);
    const [editingPair, setEditingPair] = useState<MultimodalPair | null>(null);
    const [analyses, setAnalyses] = useState<MultimodalAnalysis[]>([]);
    const [analysesLoading, setAnalysesLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [imageSrc, setImageSrc] = useState<{ source: string; target: string }>({ source: "", target: "" });

    const loadPairs = useCallback(async () => {
        setLoadingPairs(true);
        try {
            const data = await window.api.listMultimodalPairs();
            setPairs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPairs(false);
        }
    }, []);

    useEffect(() => {
        loadPairs();
    }, [loadPairs]);

    const loadAnalyses = useCallback(async (pairId: number) => {
        setAnalysesLoading(true);
        try {
            const data = await window.api.getMultimodalAnalyses(pairId);
            setAnalyses(data);
        } catch (e) {
            console.error(e);
        } finally {
            setAnalysesLoading(false);
        }
    }, []);

    const selectPair = useCallback((pair: MultimodalPair) => {
        setSelectedPair(pair);
        setImageSrc({
            source: `file://${pair.source_image_path}`,
            target: `file://${pair.target_image_path}`,
        });
        loadAnalyses(pair.id!);
    }, [loadAnalyses]);

    const handleCreate = () => {
        setEditingPair(null);
        setEditorVisible(true);
    };

    const handleEdit = () => {
        setEditingPair(selectedPair);
        setEditorVisible(true);
    };

    const handleDelete = async () => {
        if (!selectedPair?.id) return;
        try {
            await window.api.deleteMultimodalPair(selectedPair.id);
            message.success("Pair deleted");
            setSelectedPair(null);
            setAnalyses([]);
            loadPairs();
        } catch (e) {
            console.error(e);
            message.error("Failed to delete pair");
        }
    };

    const handleSavePair = async (data: any) => {
        try {
            if (editingPair?.id) {
                await window.api.updateMultimodalPair(editingPair.id, data);
                message.success("Pair updated");
            } else {
                await window.api.createMultimodalPair(data);
                message.success("Pair created");
            }
            setEditorVisible(false);
            setEditingPair(null);
            loadPairs();
        } catch (e: any) {
            message.error(e.message || "Failed to save pair");
        }
    };

    const handlePickImage = async () => {
        try {
            return await window.api.pickImageFile();
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    const handleRunAnalysis = async (analysisType: string, customPrompt?: string) => {
        if (!selectedPair?.id) {
            message.warning("Select a pair first");
            return;
        }

        // Check if multimodal models are configured
        const models = await window.api.getMultimodalLLMModels();
        if (!models || models.length === 0) {
            message.warning("No multimodal LLM model configured. Go to Settings > LLMs > Multimodal LLMs tab.");
            return;
        }

        setAnalyzing(true);
        try {
            await window.api.analyzeMultimodalPair({
                pairId: selectedPair.id,
                analysisType,
                customPrompt,
            });
            message.success(`Analysis (${analysisType}) complete`);
            loadAnalyses(selectedPair.id);
        } catch (e: any) {
            const msg = (e?.message || String(e)).replace(/^\[multimodal-api\] /, "");
            console.error("Analysis failed:", msg);
            message.error(`Analysis failed: ${msg}`);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Top bar */}
            <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
                <Image size={20} className="text-blue-500" />
                <h1 className="text-lg font-bold text-gray-800">Multimodal Analysis</h1>
                <span className="text-xs text-gray-400 ml-2">
                    LLM-powered comparative image analysis for translation discourse studies
                </span>
            </div>

            {/* Two-panel body */}
            <div className="flex-1 flex min-h-0">
                {/* Left: Pair List */}
                <div className="w-80 bg-white border-r overflow-y-auto shrink-0 flex flex-col">
                    <div className="p-3 border-b">
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={handleCreate}
                            block
                            style={{
                                backgroundColor: '#1677ff',
                                borderColor: '#1677ff',
                                color: '#fff',
                            }}
                        >
                            New Image Pair
                        </Button>
                    </div>
                    {loadingPairs ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Spin />
                        </div>
                    ) : pairs.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
                            <div>
                                <Image size={40} className="mx-auto mb-2 opacity-30" />
                                <p>No image pairs yet.</p>
                                <p>Click "New Image Pair" to start.</p>
                            </div>
                        </div>
                    ) : (
                        pairs.map((pair) => (
                            <button
                                key={pair.id}
                                onClick={() => selectPair(pair)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition ${
                                    selectedPair?.id === pair.id
                                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                                        : ""
                                }`}
                            >
                                <div className="text-sm font-medium text-gray-800 truncate">
                                    {pair.title}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {pair.source_language || "?"} → {pair.target_language || "?"}
                                    {pair.domain && ` · ${pair.domain}`}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    {pair.created_at?.split(" ")[0]}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Right: Detail + Analysis */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedPair ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <div className="text-center">
                                <Image size={48} className="mx-auto mb-3 opacity-30" />
                                <p>Select an image pair from the left panel</p>
                                <p className="text-sm mt-1">or create a new pair to get started</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Toolbar */}
                            <div className="flex items-center gap-2">
                                <Button icon={<Edit size={14} />} onClick={handleEdit}>
                                    Edit
                                </Button>
                                <Popconfirm
                                    title="Delete this pair?"
                                    description="All associated analyses will also be deleted."
                                    onConfirm={handleDelete}
                                    okText="Delete"
                                    cancelText="Cancel"
                                >
                                    <Button icon={<Trash2 size={14} />} danger>
                                        Delete
                                    </Button>
                                </Popconfirm>
                            </div>

                            {/* Image previews side by side */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Source */}
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">
                                        Source Image
                                        {selectedPair.source_language && (
                                            <Tag className="ml-2" color="blue">
                                                {selectedPair.source_language}
                                            </Tag>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        {imageSrc.source ? (
                                            <img
                                                src={imageSrc.source}
                                                alt="Source"
                                                className="w-full max-h-80 object-contain bg-gray-100 rounded"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                                                Image not found
                                            </div>
                                        )}
                                    </div>
                                    {selectedPair.source_description && (
                                        <div className="px-4 py-2 text-sm text-gray-600 border-t">
                                            {selectedPair.source_description}
                                        </div>
                                    )}
                                    {selectedPair.source_text_content && (
                                        <div className="px-4 py-2 text-sm text-gray-800 border-t bg-gray-50">
                                            <span className="font-medium">Extracted text:</span>{" "}
                                            {selectedPair.source_text_content}
                                        </div>
                                    )}
                                </div>

                                {/* Target */}
                                <div className="border rounded-lg overflow-hidden bg-white">
                                    <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">
                                        Target Image
                                        {selectedPair.target_language && (
                                            <Tag className="ml-2" color="green">
                                                {selectedPair.target_language}
                                            </Tag>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        {imageSrc.target ? (
                                            <img
                                                src={imageSrc.target}
                                                alt="Target"
                                                className="w-full max-h-80 object-contain bg-gray-100 rounded"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                                                Image not found
                                            </div>
                                        )}
                                    </div>
                                    {selectedPair.target_description && (
                                        <div className="px-4 py-2 text-sm text-gray-600 border-t">
                                            {selectedPair.target_description}
                                        </div>
                                    )}
                                    {selectedPair.target_text_content && (
                                        <div className="px-4 py-2 text-sm text-gray-800 border-t bg-gray-50">
                                            <span className="font-medium">Extracted text:</span>{" "}
                                            {selectedPair.target_text_content}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description + context */}
                            {selectedPair.description && (
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                                    <p className="text-sm text-gray-600">{selectedPair.description}</p>
                                </div>
                            )}

                            {selectedPair.context_notes && (
                                <div className="bg-white border rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Context Notes</h4>
                                    <p className="text-sm text-gray-600">{selectedPair.context_notes}</p>
                                </div>
                            )}

                            {selectedPair.domain && (
                                <div className="text-sm text-gray-500">
                                    <span className="font-medium">Domain:</span> {selectedPair.domain}
                                </div>
                            )}

                            {/* Analysis Panel */}
                            <div className="bg-white border rounded-lg p-4">
                                <AnalysisPanel
                                    pairId={selectedPair.id!}
                                    analyses={analyses}
                                    loading={analysesLoading}
                                    analyzing={analyzing}
                                    onRunAnalysis={handleRunAnalysis}
                                    onRefresh={() => loadAnalyses(selectedPair.id!)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Pair Editor Modal */}
            <PairEditorModal
                visible={editorVisible}
                pair={editingPair}
                onCancel={() => {
                    setEditorVisible(false);
                    setEditingPair(null);
                }}
                onSave={handleSavePair}
                onPickImage={handlePickImage}
            />
        </div>
    );
};

export default MultimodalPage;
