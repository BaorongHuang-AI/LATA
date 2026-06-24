import React, { useState, useEffect, useCallback } from "react";
import { Button, Select, message, Input } from "antd";
import { Play, Settings, Loader2 } from "lucide-react";
import TermTable from "./TermTable";
import SkillManagerModal from "./SkillManagerModal";
import type { TerminologySkill, TerminologyTerm, TerminologyExtraction } from "../types/terminology";

interface Props {
  projectId: number;
  skills: TerminologySkill[];
  selectedSkillKey: string | null;
  onSkillChange: (key: string) => void;
  onTermsChanged: () => void;
}

const ExtractTab: React.FC<Props> = ({ projectId, skills, selectedSkillKey, onSkillChange, onTermsChanged }) => {
  const [extractions, setExtractions] = useState<TerminologyExtraction[]>([]);
  const [selectedExtractionId, setSelectedExtractionId] = useState<number | null>(null);
  const [terms, setTerms] = useState<TerminologyTerm[]>([]);
  const [running, setRunning] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<TerminologyTerm | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const loadExtractions = useCallback(async () => {
    try {
      const data = await window.api.getExtractionsByProject(projectId);
      setExtractions(data || []);
    } catch (e) { console.error(e); }
  }, [projectId]);

  const loadTerms = useCallback(async (extractionId: number) => {
    try {
      const data = await window.api.getTerminologyTerms(extractionId);
      setTerms(data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadExtractions(); }, [loadExtractions]);

  const handleRun = async () => {
    // Check LLM config
    try {
      const models = await window.api.getLLMModels();
      if (!models || models.length === 0) {
        message.warning("No LLM model configured. Please configure one in LLM Settings.");
        return;
      }
    } catch { /* proceed */ }

    setRunning(true);
    setDebugInfo(null);
    setLastError(null);
    try {
      const docs = await window.api.getProjectDocuments(projectId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docIds = docs.map((d: any) => d.id);
      if (docIds.length === 0) {
        message.warning("No documents linked to this project. Set up documents first.");
        setRunning(false);
        return;
      }

      const result = await window.api.runTerminologyExtraction({
        projectId,
        documentIds: docIds,
        skillKey: selectedSkillKey || undefined,
      });

      if (result.debug) setDebugInfo(result.debug);
      const tokenInfo = result.debug ? ` (${result.debug.completionTokens ?? result.debug.totalTokens ?? '?'} tokens)` : '';
      message.success(
        `Extraction complete! ${result.terms.length} term pairs from ${result.segment_count} segments.${tokenInfo}` +
        (result.truncated ? " (Truncated to 200 segments)" : "")
      );

      await loadExtractions();
      if (result.extraction?.id) {
        setSelectedExtractionId(result.extraction.id);
        setTerms(result.terms || []);
        setSelectedTerm(null);
      }
      onTermsChanged();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const msg = e?.message || "Extraction failed";
      setLastError(msg.startsWith("[api]") ? msg.slice(5) : msg);
      message.error({ content: msg.startsWith("[api]") ? msg.slice(5) : msg, duration: 15 });
      console.error(e);
    } finally { setRunning(false); }
  };

  const handleSelectExtraction = (id: number) => {
    setSelectedExtractionId(id);
    loadTerms(id);
    setSelectedTerm(null);
  };

  const handleTermsChanged = () => {
    if (selectedExtractionId) loadTerms(selectedExtractionId);
    onTermsChanged();
  };

  const filtered = terms.filter(t => {
    if (filterDomain && t.domain !== filterDomain) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return t.source_term.toLowerCase().includes(q) || t.target_term.toLowerCase().includes(q)
        || (t.context_source && t.context_source.toLowerCase().includes(q))
        || (t.context_target && t.context_target.toLowerCase().includes(q));
    }
    return true;
  });

  const domainOpts = ["general","legal","medical","technical","financial","academic","literary","other"];
  const priorityOpts = ["high","medium","low"];

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left sidebar */}
      <div className="w-64 bg-white border-r shrink-0 flex flex-col">
        <div className="p-3 border-b space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Skill</label>
            <Select
              value={selectedSkillKey}
              onChange={onSkillChange}
              className="w-full"
              size="small"
              options={skills.map(s => ({ value: s.key, label: s.label }))}
            />
          </div>
          <Button
            type="primary"
            block
            icon={<Play size={14} />}
            onClick={handleRun}
            loading={running}
            style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}
          >
            {running ? "Extracting..." : "Extract Terms"}
          </Button>
          <Button block size="small" icon={<Settings size={12} />} onClick={() => setSkillModalOpen(true)}>
            Manage Skills
          </Button>
        </div>
        {/* Past extractions */}
        <div className="flex-1 overflow-auto">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">Past Extractions</div>
          {extractions.map(ex => (
            <div
              key={ex.id}
              onClick={() => handleSelectExtraction(ex.id!)}
              className={`px-3 py-2 cursor-pointer border-b text-xs hover:bg-gray-50 transition ${
                selectedExtractionId === ex.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
              }`}
            >
              <div className="font-medium text-gray-600">{ex.model_name || "Unknown model"}</div>
              <div className="text-gray-400">{ex.created_at ? new Date(ex.created_at).toLocaleString() : ""}</div>
            </div>
          ))}
          {extractions.length === 0 && (
            <div className="p-3 text-xs text-gray-400 text-center">No extractions yet.</div>
          )}
        </div>
      </div>

      {/* Right: Table + detail */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedExtractionId ? (
          <>
            {/* Filters */}
            <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
              <Select allowClear placeholder="All Domains" value={filterDomain} onChange={setFilterDomain}
                className="w-28" size="small"
                options={domainOpts.map(d => ({ value: d, label: d.charAt(0).toUpperCase()+d.slice(1) }))} />
              <Select allowClear placeholder="All Priorities" value={filterPriority} onChange={setFilterPriority}
                className="w-28" size="small"
                options={priorityOpts.map(p => ({ value: p, label: p.charAt(0).toUpperCase()+p.slice(1) }))} />
              <Input.Search placeholder="Search..." value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="flex-1 max-w-xs" size="small" allowClear />
              <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {terms.length} terms</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden bg-white">
              <TermTable
                terms={filtered}
                extractionId={selectedExtractionId}
                onTermsChanged={handleTermsChanged}
                onTermSelect={setSelectedTerm}
                selectedTermId={selectedTerm?.id ?? null}
              />
            </div>
            {/* Context detail */}
            {selectedTerm && (
              <div className="border-t p-3 bg-white shrink-0" style={{ maxHeight: 160, overflowY: "auto" }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">
                    <span className="text-blue-600">{selectedTerm.source_term}</span> →{" "}
                    <span className="text-emerald-600">{selectedTerm.target_term}</span>
                  </h4>
                  <button onClick={() => setSelectedTerm(null)} className="text-xs text-gray-400">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded p-2 border-l-2 border-blue-400">
                    <div className="text-[10px] text-blue-500 font-medium mb-1">SOURCE CONTEXT</div>
                    <div className="text-xs text-gray-700">{selectedTerm.context_source || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                  <div className="bg-emerald-50 rounded p-2 border-l-2 border-emerald-400">
                    <div className="text-[10px] text-emerald-500 font-medium mb-1">TARGET CONTEXT</div>
                    <div className="text-xs text-gray-700">{selectedTerm.context_target || <span className="text-gray-400 italic">-</span>}</div>
                  </div>
                </div>
              </div>
            )}
            {/* Debug */}
            {(debugInfo || lastError) && (
              <div className="border-t bg-gray-50 p-3 shrink-0" style={{ maxHeight: 200, overflowY: "auto" }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-600">🔍 Debug</h4>
                  <button onClick={() => { setDebugInfo(null); setLastError(null); }} className="text-xs text-gray-400">✕</button>
                </div>
                {lastError && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                    <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono max-h-24 overflow-auto">{lastError}</pre>
                  </div>
                )}
                {debugInfo && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded p-2 border"><span className="text-gray-400">Model</span><div className="font-medium truncate">{debugInfo.model}</div></div>
                    <div className="bg-white rounded p-2 border"><span className="text-gray-400">Prompt Tokens</span><div className="font-medium">{debugInfo.promptTokens ?? '?'}</div></div>
                    <div className="bg-white rounded p-2 border"><span className="text-gray-400">Completion Tokens</span><div className="font-medium">{debugInfo.completionTokens ?? '?'}</div></div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Play size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{running ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Extracting...</span> : "Select a past extraction or run a new one."}</p>
            </div>
          </div>
        )}
      </div>

      <SkillManagerModal open={skillModalOpen} onClose={() => setSkillModalOpen(false)} onSkillsChanged={() => {}} />
    </div>
  );
};

export default ExtractTab;
