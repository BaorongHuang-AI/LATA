import React from "react";
import { Button, Spin, Tag, message } from "antd";
import type { MultimodalAnalysis } from "../types/multimodal";

const ANALYSIS_TYPES = [
    { key: "description", label: "Describe Images" },
    { key: "text_extraction", label: "Extract Text" },
    { key: "comparison", label: "Compare Images" },
    { key: "discourse_analysis", label: "Discourse Analysis" },
    { key: "custom", label: "Custom Prompt" },
];

interface AnalysisPanelProps {
    pairId: number;
    analyses: MultimodalAnalysis[];
    loading: boolean;
    analyzing: boolean;
    onRunAnalysis: (analysisType: string, customPrompt?: string) => void;
    onRefresh: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    pairId,
    analyses,
    loading,
    analyzing,
    onRunAnalysis,
    onRefresh,
}) => {
    const [activeResult, setActiveResult] = React.useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = React.useState("");

    const handleRun = (analysisType: string) => {
        if (analysisType === "custom") {
            const prompt = window.prompt("Enter your custom analysis prompt:");
            if (!prompt) return;
            onRunAnalysis(analysisType, prompt);
        } else {
            onRunAnalysis(analysisType);
        }
    };

    const latestByType: Record<string, MultimodalAnalysis> = {};
    analyses.forEach((a) => {
        if (!latestByType[a.analysis_type]) {
            latestByType[a.analysis_type] = a;
        }
    });

    const typeLabels: Record<string, string> = {
        description: "Description",
        text_extraction: "Text Extract",
        comparison: "Comparison",
        discourse_analysis: "Discourse",
        custom: "Custom",
    };

    return (
        <div className="space-y-4">
            {/* Analysis buttons */}
            <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Run Analysis</h4>
                <div className="flex flex-wrap gap-2">
                    {ANALYSIS_TYPES.map((at) => (
                        <Button
                            key={at.key}
                            size="small"
                            onClick={() => handleRun(at.key)}
                            loading={analyzing}
                            style={
                                at.key === "discourse_analysis"
                                    ? {
                                          backgroundColor: '#1677ff',
                                          borderColor: '#1677ff',
                                          color: '#fff',
                                      }
                                    : undefined
                            }
                        >
                            {at.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="text-center py-8">
                    <Spin />
                </div>
            ) : analyses.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                    No analyses yet. Click a button above to analyze this pair.
                </div>
            ) : (
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Results</h4>
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {Object.entries(latestByType).map(([type, analysis]) => (
                            <button
                                key={type}
                                onClick={() => setActiveResult(activeResult === type ? null : type)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    activeResult === type
                                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                                        : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                                }`}
                            >
                                {typeLabels[type] || type}
                                {analysis.model_name && (
                                    <span className="ml-1 text-gray-400">
                                        ({analysis.model_name})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {activeResult && latestByType[activeResult] && (
                        <div className="bg-gray-50 border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <Tag color="blue">{typeLabels[activeResult] || activeResult}</Tag>
                                <span className="text-xs text-gray-400">
                                    {latestByType[activeResult].created_at}
                                </span>
                            </div>
                            <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 leading-relaxed max-h-96 overflow-y-auto">
                                {latestByType[activeResult].result || "No result"}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnalysisPanel;
