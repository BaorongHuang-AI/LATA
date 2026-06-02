import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button, Select, Spin, message } from "antd";
import { Send, FileText, Database, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CorpusSkill, CorpusAnalysis } from "../types/corpus";
import SkillManagerModal from "./SkillManagerModal";

interface AnalysisChatProps {
  selectedDocIds: Set<number>;
}

const AnalysisChat: React.FC<AnalysisChatProps> = ({ selectedDocIds }) => {
  const [skills, setSkills] = useState<CorpusSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [analyses, setAnalyses] = useState<CorpusAnalysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<number | null>(null);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const data = await window.api.getCorpusSkills();
      setSkills(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const loadAnalyses = useCallback(async () => {
    try {
      const data = await window.api.getCorpusAnalyses();
      setAnalyses(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadSkills();
    loadAnalyses();
  }, [loadSkills, loadAnalyses]);

  useEffect(() => {
    if (resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [analyses, activeAnalysis]);

  const handleRun = async () => {
    if (!selectedSkill || selectedDocIds.size === 0) return;

    const models = await window.api.getLLMModels();
    if (!models || models.length === 0) {
      message.warning("No LLM model configured. Go to Settings > LLMs to add one.");
      return;
    }

    const skill = skills.find((s) => s.key === selectedSkill);
    if (!skill) return;

    let customPrompt: string | undefined;
    if (selectedSkill === "Custom Analysis") {
      customPrompt = window.prompt("Enter your custom analysis prompt:");
      if (!customPrompt) return;
    }

    setRunning(true);
    try {
      const result = await window.api.runCorpusAnalysis({
        documentIds: Array.from(selectedDocIds),
        skillKey: selectedSkill,
        customPrompt,
      });
      message.success(`Analysis complete (${result.segment_count} segments)`);
      await loadAnalyses();
      setActiveAnalysis(null);
    } catch (e: unknown) {
      const msg = String((e as Error)?.message || e).replace(/^\[api\] /, "");
      console.error("Analysis failed:", msg);
      message.error(`Analysis failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const skillOptions = skills.map((s) => ({
    value: s.key,
    label: s.label,
  }));

  const canRun = selectedSkill && selectedDocIds.size > 0 && !running;

  return (
    <div className="flex flex-col h-full">
      {skillsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spin />
        </div>
      ) : (
        <>
          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {analyses.length === 0 && !running ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Database size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Select documents on the left, choose a skill below,</p>
                  <p className="text-sm mt-1">then run analysis to see results here.</p>
                </div>
              </div>
            ) : (
              analyses.map((analysis) => {
                const isActive = activeAnalysis === analysis.id;
                const docIds = (() => {
                  try { return JSON.parse(analysis.document_ids) as number[]; } catch { return []; }
                })();
                return (
                  <div key={analysis.id} className="space-y-3">
                    {/* User message bubble */}
                    <div className="flex justify-end">
                      <div
                        className="max-w-[80%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 cursor-pointer hover:bg-blue-600 transition"
                        onClick={() => setActiveAnalysis(isActive ? null : (analysis.id ?? null))}
                      >
                        <div className="text-sm font-medium">{analysis.skill_label}</div>
                        <div className="text-xs text-blue-100 mt-1">
                          {docIds.length} document{docIds.length !== 1 ? "s" : ""}
                          {analysis.model_name && ` · ${analysis.model_name}`}
                        </div>
                        <div className="text-xs text-blue-100 mt-0.5">
                          {analysis.created_at}
                        </div>
                      </div>
                    </div>

                    {/* Assistant message bubble */}
                    {isActive && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                          <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                            <FileText size={12} />
                            <span>{analysis.skill_label} Result</span>
                            {analysis.model_name && (
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                {analysis.model_name}
                              </span>
                            )}
                          </div>
                          <div className="wmde-markdown text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {analysis.result}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {running && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm max-w-[80%]">
                  <div className="flex items-center gap-3 text-gray-500">
                    <Spin size="small" />
                    <span className="text-sm">
                      Analyzing {selectedDocIds.size} document{selectedDocIds.size !== 1 ? "s" : ""}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={resultsEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t bg-gray-50 p-4 shrink-0">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Analysis Skill</label>
                <Select
                  value={selectedSkill}
                  onChange={setSelectedSkill}
                  options={skillOptions}
                  placeholder="Select an analysis skill..."
                  style={{ width: "100%" }}
                  size="middle"
                  loading={skillsLoading}
                />
              </div>
              <Button
                type="primary"
                icon={<Send size={14} />}
                onClick={handleRun}
                loading={running}
                disabled={!canRun}
                style={{
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  color: '#fff',
                }}
              >
                Run
              </Button>
              <Button
                icon={<Settings size={14} />}
                onClick={() => setSkillModalOpen(true)}
              >
                Skills
              </Button>
            </div>
            {selectedDocIds.size === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Select at least one aligned document from the left panel.
              </p>
            )}
          </div>

          <SkillManagerModal
            open={skillModalOpen}
            onClose={() => setSkillModalOpen(false)}
            onSkillsChanged={loadSkills}
          />
        </>
      )}
    </div>
  );
};

export default AnalysisChat;
