import React, { useState, useCallback, useEffect } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { message, Select, Input } from "antd";
import DocumentSelector from "../corpus/DocumentSelector";
import ExtractionControls from "./ExtractionControls";
import ExtractionList from "./ExtractionList";
import TermTable from "./TermTable";
import SkillManagerModal from "./SkillManagerModal";
import type { TerminologyExtraction, TerminologyTerm, TerminologySkill } from "../types/terminology";

const TerminologyExtractionPage: React.FC = () => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
  const [skills, setSkills] = useState<TerminologySkill[]>([]);
  const [extractions, setExtractions] = useState<TerminologyExtraction[]>([]);
  const [selectedExtractionId, setSelectedExtractionId] = useState<number | null>(null);
  const [terms, setTerms] = useState<TerminologyTerm[]>([]);
  const [running, setRunning] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<TerminologyTerm | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Filter state
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const loadSkills = useCallback(async () => {
    try {
      const data = await window.api.getTerminologySkills();
      setSkills(data || []);
      if (data && data.length > 0 && !selectedSkillKey) {
        setSelectedSkillKey(data[0].key);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedSkillKey]);

  const loadExtractions = useCallback(async () => {
    try {
      const data = await window.api.getTerminologyExtractions();
      setExtractions(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadTerms = useCallback(async (extractionId: number) => {
    try {
      const data = await window.api.getTerminologyTerms(extractionId);
      setTerms(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadSkills();
    loadExtractions();
  }, []);

  const handleSelectionChange = useCallback((ids: Set<number>) => {
    setSelectedDocIds(ids);
  }, []);

  const handleSkillChange = (key: string) => {
    setSelectedSkillKey(key);
  };

  const handleRunExtraction = async () => {
    if (selectedDocIds.size === 0) {
      message.warning("Please select at least one document.");
      return;
    }

    // Check LLM configuration
    try {
      const models = await window.api.getLLMModels();
      if (!models || models.length === 0) {
        message.warning("No LLM model configured. Please configure one in LLM Settings.");
        return;
      }
    } catch {
      // proceed; backend will error if no model
    }

    setRunning(true);
    setDebugInfo(null);
    setLastError(null);
    try {
      const result = await window.api.runTerminologyExtraction({
        documentIds: Array.from(selectedDocIds),
        skillKey: selectedSkillKey || undefined,
      });

      // Store debug info for display
      if (result.debug) {
        setDebugInfo(result.debug);
      }

      const tokenInfo = result.debug
        ? ` (${result.debug.completionTokens ?? result.debug.totalTokens ?? '?'} tokens used)`
        : '';

      message.success(
        `Extraction complete! ${result.terms.length} term pairs extracted from ${result.segment_count} segments.${tokenInfo}` +
        (result.truncated ? " (Note: corpus was truncated to 200 segments)" : "")
      );

      await loadExtractions();
      // Auto-select the new extraction
      if (result.extraction?.id) {
        setSelectedExtractionId(result.extraction.id);
        setTerms(result.terms || []);
        setSelectedTerm(null);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.message || "Extraction failed";
      const cleanMsg = msg.startsWith("[api]") ? msg.slice(5) : msg;
      setLastError(cleanMsg);
      // Use a longer duration for detailed errors
      message.error({ content: cleanMsg, duration: 15 });
      console.error("Terminology extraction error:", e);
    } finally {
      setRunning(false);
    }
  };

  const handleSelectExtraction = (id: number) => {
    setSelectedExtractionId(id);
    loadTerms(id);
    setSelectedTerm(null);
  };

  const handleTermsChanged = () => {
    if (selectedExtractionId) {
      loadTerms(selectedExtractionId);
    }
  };

  const handleTermSelect = (term: TerminologyTerm | null) => {
    setSelectedTerm(term);
  };

  // Apply filters
  const filteredTerms = terms.filter((t) => {
    if (filterDomain && t.domain !== filterDomain) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        t.source_term.toLowerCase().includes(q) ||
        t.target_term.toLowerCase().includes(q) ||
        (t.context_source && t.context_source.toLowerCase().includes(q)) ||
        (t.context_target && t.context_target.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const domainOptions = [
    { value: "general", label: "General" },
    { value: "legal", label: "Legal" },
    { value: "medical", label: "Medical" },
    { value: "technical", label: "Technical" },
    { value: "financial", label: "Financial" },
    { value: "academic", label: "Academic" },
    { value: "literary", label: "Literary" },
    { value: "other", label: "Other" },
  ];

  const priorityOptions = [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <BookOpen size={20} className="text-emerald-500" />
        <h1 className="text-lg font-bold text-gray-800">Terminology Extraction</h1>
        <span className="text-xs text-gray-400 ml-2">
          LLM-powered bilingual term extraction with context and classification
        </span>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Document Selector + Controls */}
        <div className="w-80 bg-white border-r shrink-0 flex flex-col">
          <DocumentSelector
            selectedIds={selectedDocIds}
            onSelectionChange={handleSelectionChange}
          />
          <ExtractionControls
            selectedCount={selectedDocIds.size}
            running={running}
            skills={skills}
            selectedSkillKey={selectedSkillKey}
            onSkillChange={handleSkillChange}
            onRun={handleRunExtraction}
            onManageSkills={() => setSkillModalOpen(true)}
          />
          <ExtractionList
            extractions={extractions}
            selectedId={selectedExtractionId}
            onSelect={handleSelectExtraction}
          />
        </div>

        {/* Right: Term Table + Detail Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedExtractionId ? (
            <>
              {/* Filter bar */}
              <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
                <Select
                  allowClear
                  placeholder="All Domains"
                  value={filterDomain}
                  onChange={setFilterDomain}
                  className="w-32"
                  size="small"
                  options={domainOptions}
                />
                <Select
                  allowClear
                  placeholder="All Priorities"
                  value={filterPriority}
                  onChange={setFilterPriority}
                  className="w-32"
                  size="small"
                  options={priorityOptions}
                />
                <Input.Search
                  placeholder="Search terms or context..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1 max-w-xs"
                  size="small"
                  allowClear
                />
                <span className="text-xs text-gray-400 ml-auto">
                  {filteredTerms.length} of {terms.length} terms
                </span>
              </div>

              {/* Term table */}
              <div className="flex-1 min-h-0 overflow-hidden bg-white">
                <TermTable
                  terms={filteredTerms}
                  extractionId={selectedExtractionId}
                  onTermsChanged={handleTermsChanged}
                  onTermSelect={handleTermSelect}
                  selectedTermId={selectedTerm?.id ?? null}
                />
              </div>

              {/* Detail panel for selected term */}
              {selectedTerm && (
                <div className="border-t border-gray-200 bg-white p-4 shrink-0" style={{ maxHeight: 180, overflowY: "auto" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Context: <span className="text-blue-600">{selectedTerm.source_term}</span>
                      {" → "}
                      <span className="text-emerald-600">{selectedTerm.target_term}</span>
                    </h3>
                    <button
                      onClick={() => setSelectedTerm(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded p-2 border-l-2 border-blue-400">
                      <div className="text-[10px] text-blue-500 font-medium mb-1">SOURCE CONTEXT</div>
                      <div className="text-xs text-gray-700">
                        {selectedTerm.context_source || <span className="text-gray-400 italic">No context available</span>}
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded p-2 border-l-2 border-emerald-400">
                      <div className="text-[10px] text-emerald-500 font-medium mb-1">TARGET CONTEXT</div>
                      <div className="text-xs text-gray-700">
                        {selectedTerm.context_target || <span className="text-gray-400 italic">No context available</span>}
                      </div>
                    </div>
                  </div>
                  {selectedTerm.variant_group && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">Variant group:</span> {selectedTerm.variant_group}
                    </div>
                  )}
                </div>
              )}

              {/* Debug panel */}
              {(debugInfo || lastError) && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 shrink-0" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                      🔍 Debug Info
                    </h4>
                    <button
                      onClick={() => { setDebugInfo(null); setLastError(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ✕ Dismiss
                    </button>
                  </div>

                  {lastError && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                      <div className="text-xs font-medium text-red-700 mb-1">Error Details</div>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                        {lastError}
                      </pre>
                    </div>
                  )}

                  {debugInfo && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Model</span>
                        <div className="font-medium text-gray-700 truncate">{debugInfo.model}</div>
                      </div>
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Prompt tokens</span>
                        <div className="font-medium text-gray-700">
                          {debugInfo.promptTokens ?? '?'} <span className="text-gray-400">(est. ~{debugInfo.estimatedPromptTokens})</span>
                        </div>
                      </div>
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Completion tokens</span>
                        <div className="font-medium text-gray-700">{debugInfo.completionTokens ?? '?'}</div>
                      </div>
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Total tokens</span>
                        <div className="font-medium text-gray-700">{debugInfo.totalTokens ?? '?'}</div>
                      </div>
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Response length</span>
                        <div className="font-medium text-gray-700">{debugInfo.rawResponseLength} chars</div>
                      </div>
                      <div className="bg-white rounded p-2 border">
                        <span className="text-gray-400">Truncated</span>
                        <div className="font-medium text-gray-700">{debugInfo.truncated ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No Extraction Selected</p>
                <p className="text-xs mt-1 max-w-xs">
                  {running ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 size={14} className="animate-spin" />
                      Extracting terms...
                    </span>
                  ) : extractions.length === 0 ? (
                    "Select documents on the left and click 'Extract Terms' to begin."
                  ) : (
                    "Select a past extraction from the left panel, or run a new one."
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Skill Manager Modal */}
      <SkillManagerModal
        open={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
        onSkillsChanged={loadSkills}
      />
    </div>
  );
};

export default TerminologyExtractionPage;
