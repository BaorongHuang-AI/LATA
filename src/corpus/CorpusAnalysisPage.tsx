import React, { useState, useCallback } from "react";
import { Database } from "lucide-react";
import DocumentSelector from "./DocumentSelector";
import AnalysisChat from "./AnalysisChat";

const CorpusAnalysisPage: React.FC = () => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

  const handleSelectionChange = useCallback((ids: Set<number>) => {
    setSelectedDocIds(ids);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Database size={20} className="text-blue-500" />
        <h1 className="text-lg font-bold text-gray-800">Corpus Analysis</h1>
        <span className="text-xs text-gray-400 ml-2">
          LLM-powered analysis of aligned parallel texts across documents
        </span>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Document Selector */}
        <div className="w-80 bg-white border-r shrink-0 flex flex-col">
          <DocumentSelector
            selectedIds={selectedDocIds}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        {/* Right: Analysis Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <AnalysisChat selectedDocIds={selectedDocIds} />
        </div>
      </div>
    </div>
  );
};

export default CorpusAnalysisPage;
