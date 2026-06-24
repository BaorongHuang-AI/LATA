/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { Button, Select, message, Statistic, Row, Col, Card, Tag, Empty, Spin } from "antd";
import { BookOpen, Play, Trash2 } from "lucide-react";
import DocumentSelector from "../corpus/DocumentSelector";
import type { NarrativeAnalysis, NarrativeData } from "../types/narrative";

const ARC_COLORS = { source: "#3B82F6", target: "#10B981" };
const MODE_COLORS: Record<string, string> = { dialogue: "#8B5CF6", description: "#3B82F6", action: "#EF4444", reflection: "#F59E0B", exposition: "#10B981" };
const REL_COLORS: Record<string, string> = { allies: "#10B981", adversaries: "#EF4444", family: "#8B5CF6", romantic: "#EC4899", neutral: "#9CA3AF" };

const NarrativeAnalysisPage: React.FC = () => {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<NarrativeAnalysis[]>([]);
  const [selected, setSelected] = useState<NarrativeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const list = await window.api.getNarrativeAnalyses();
      // Parse data if it arrives as string from IPC
      const parsed = (list || []).map((a: any) => ({...a, data: typeof a.data === 'string' ? JSON.parse(a.data) : a.data}));
      setAnalyses(parsed);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const handleAnalyze = async () => {
    if (!selectedDocId) { message.warning("Select a document"); return; }
    setLoading(true);
    try {
      const result = await window.api.analyzeNarrative({ documentId: selectedDocId });
      const d = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      message.success(`Analysis complete: ${d?.characters?.length || 0} characters identified`);
      load();
      // Use the directly returned data to avoid IPC round-trip issues
      setSelected({ id: result.id, document_id: selectedDocId, document_title: `Doc ${selectedDocId}`, model_name: result.model_name, data: d, source_language: undefined, target_language: undefined } as any);
    } catch (e: any) { message.error(e.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  const handleSelect = (a: NarrativeAnalysis) => {
    const d = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
    setSelected({ ...a, data: d });
  };

  // Safety: data may arrive as JSON string from IPC; parse if needed
  const rawData = selected?.data;
  const d: NarrativeData | null = rawData
    ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData)
    : null;

  if (!d || !d.summary) return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <BookOpen size={20} className="text-violet-500" />
        <h1 className="text-lg font-bold text-gray-800">Narrative Analysis</h1>
        <span className="text-xs text-gray-400">LLM-powered literary narrative structure analysis</span>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-80 bg-white border-r flex flex-col">
          <DocumentSelector selectedIds={selectedDocId ? new Set([selectedDocId]) : new Set()} onSelectionChange={s => setSelectedDocId(s.size > 0 ? [...s][0] : null)} />
          <div className="p-3 border-t">
            <Button type="primary" block icon={<Play size={14} />} onClick={handleAnalyze} loading={loading}
              disabled={!selectedDocId} style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED', color: '#fff' }}>
              Analyze Narrative
            </Button>
          </div>
          <div className="flex-1 overflow-auto border-t">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">Past Analyses</div>
            {analyses.map(a => (
              <div key={a.id} onClick={() => handleSelect(a)} className={`px-3 py-2 cursor-pointer border-b text-xs hover:bg-gray-50 ${selected?.id===a.id?"bg-violet-50 border-l-2 border-l-violet-500":""}`}>
                <div className="font-medium">{a.document_title}</div>
                <div className="text-gray-400 flex justify-between">
                  <span>{a.created_at?.slice(0,10)}</span>
                  <Trash2 size={12} className="text-red-400" onClick={async e => { e.stopPropagation(); await window.api.deleteNarrativeAnalysis(a.id!); load(); setSelected(null); }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? <div className="flex items-center justify-center h-full"><Spin size="large" /></div> : (
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Summary */}
              <Row gutter={12}>
                <Col span={4}><Card size="small"><Statistic title="Characters" value={d.summary.character_count} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Emo Range (Src)" value={d.summary.emotional_range_source?.toFixed(2)} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Emo Range (Tgt)" value={d.summary.emotional_range_target?.toFixed(2)} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Emo Corr" value={d.summary.emotional_correlation?.toFixed(3)} valueStyle={{ color: (d.summary.emotional_correlation || 0) > 0.7 ? '#10B981' : '#EF4444' }} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Pace (Src)" value={d.summary.narrative_pace_source || "?"} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Pace (Tgt)" value={d.summary.narrative_pace_target || "?"} /></Card></Col>
              </Row>
              <Row gutter={12}>
                <Col span={6}><Card size="small"><Statistic title="Voice" value={d.voice?.point_of_view?.replace(/_/g," ") || "?"} /></Card></Col>
                <Col span={6}><Card size="small"><Statistic title="Linear?" value={d.temporal?.is_linear ? "Yes" : "No"} /></Card></Col>
                <Col span={6}><Card size="small"><Statistic title="Dialogue% Src" value={`${((d.summary.dialogue_ratio_source||0)*100).toFixed(0)}%`} /></Card></Col>
                <Col span={6}><Card size="small"><Statistic title="Dialogue% Tgt" value={`${((d.summary.dialogue_ratio_target||0)*100).toFixed(0)}%`} /></Card></Col>
              </Row>

              {/* Emotional Arc Chart */}
              <Card title="Emotional Arc (Source vs Translation)" size="small">
                <SvgLineChart data={d.emotional_arc} dataKeySrc="source_sentiment" dataKeyTgt="target_sentiment" labels={d.emotional_arc.map(e=>e.label)} height={180} />
              </Card>

              {/* Narrative Structure Modes */}
              <Card title="Narrative Structure by Mode" size="small">
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs text-gray-400 mb-1">Source</div>
                    <SvgModeChart data={d.structure} dataKey="source_density" height={100} /></div>
                  <div><div className="text-xs text-gray-400 mb-1">Target</div>
                    <SvgModeChart data={d.structure} dataKey="target_density" height={100} /></div>
                </div>
              </Card>

              {/* Character Network */}
              <Card title={`Character Network (${d.characters.length} characters)`} size="small">
                <div className="flex flex-wrap gap-2 mb-3">
                  {d.characters.map(c => (
                    <Tag key={c.name} color={c.role==="protagonist"?"blue":c.role==="antagonist"?"red":"default"}>
                      {c.name} ({c.role}) S:{c.mentions_source} T:{c.mentions_target}
                    </Tag>
                  ))}
                </div>
                {d.character_interactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 text-xs">
                    {d.character_interactions.map((ci, i) => (
                      <span key={i} className="px-2 py-1 rounded border" style={{ borderColor: REL_COLORS[ci.relationship] || "#9CA3AF" }}>
                        {ci.source} ↔ {ci.target} <span className="text-gray-400">({ci.weight})</span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              {/* Temporal & Voice */}
              <Row gutter={12}>
                <Col span={12}>
                  <Card title="Temporal Structure" size="small">
                    <div className="space-y-1 text-sm">
                      <div>Linear: {d.temporal?.is_linear ? "✅" : "❌"}</div>
                      <div>Flashbacks (Src): {d.temporal?.flashback_count_source ?? 0}</div>
                      <div>Flashbacks (Tgt): {d.temporal?.flashback_count_target ?? 0}</div>
                      <div>Time Compression: {d.temporal?.time_compression_ratio?.toFixed(2)}</div>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Narrative Voice" size="small">
                    <div className="space-y-1 text-sm">
                      <div>POV: {d.voice?.point_of_view?.replace(/_/g," ")}</div>
                      <div>Narrator Intrusion (Src): {d.voice?.narrator_intrusion_source?.toFixed(3)}</div>
                      <div>Narrator Intrusion (Tgt): {d.voice?.narrator_intrusion_target?.toFixed(3)}</div>
                      <div>Free Indirect Discourse (Src): {d.voice?.free_indirect_discourse_source?.toFixed(3)}</div>
                      <div>Free Indirect Discourse (Tgt): {d.voice?.free_indirect_discourse_target?.toFixed(3)}</div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== SVG Chart Components ====================

const SvgLineChart: React.FC<{ data: any[]; dataKeySrc: string; dataKeyTgt: string; labels: string[]; height: number }> = ({ data, dataKeySrc, dataKeyTgt, labels, height }) => {
  const w = 700; const h = height; const pad = { top: 15, right: 20, bottom: 30, left: 40 };
  const pw = w - pad.left - pad.right; const ph = h - pad.top - pad.bottom;
  if (!data.length) return <div className="text-gray-400 text-xs text-center py-4">No emotional arc data</div>;
  const allVals = data.flatMap(d => [d[dataKeySrc], d[dataKeyTgt]]);
  const yMin = Math.min(-1, ...allVals); const yMax = Math.max(1, ...allVals); const yr = yMax - yMin || 1;
  const sx = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * pw;
  const sy = (v: number) => pad.top + ph - ((v - yMin) / yr) * ph;
  const line = (key: string, color: string) => data.map((d, i) => `${i===0?'M':'L'}${sx(i)},${sy(d[key]||0)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{maxHeight:h}}>
      <line x1={pad.left} y1={pad.top+ph/2} x2={pad.left+pw} y2={pad.top+ph/2} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4 4" />
      {[-1,0,1].map(v => <text key={v} x={pad.left-5} y={sy(v)+4} textAnchor="end" fontSize={9} fill="#9CA3AF">{v}</text>)}
      {labels.filter((_,i)=>i%2===0).map((l,i) => <text key={i} x={sx(i*2)} y={h-4} textAnchor="middle" fontSize={8} fill="#9CA3AF">{l}</text>)}
      <path d={line(dataKeySrc, ARC_COLORS.source)} fill="none" stroke={ARC_COLORS.source} strokeWidth={2} />
      <path d={line(dataKeyTgt, ARC_COLORS.target)} fill="none" stroke={ARC_COLORS.target} strokeWidth={2} strokeDasharray="4 2" />
      <text x={pad.left+5} y={12} fontSize={9} fill={ARC_COLORS.source}>━ Source</text>
      <text x={pad.left+65} y={12} fontSize={9} fill={ARC_COLORS.target}>┅ Target</text>
    </svg>
  );
};

const SvgModeChart: React.FC<{ data: any[]; dataKey: string; height: number }> = ({ data, dataKey, height }) => {
  const w = 400; const h = height; const pad = { top: 5, right: 5, bottom: 5, left: 5 };
  const pw = w - pad.left - pad.right; const ph = h - pad.top - pad.bottom;
  if (!data.length) return null;
  const modes = ["dialogue","description","action","reflection","exposition"];
  const segW = pw / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{maxHeight:h}}>
      {data.map((d, i) => {
        let y = pad.top;
        return modes.map(mode => {
          const v = (d[dataKey] || 0) * (d[dataKey+"_"+mode] !== undefined ? 1 : (mode === d.mode ? (d[dataKey]||0) : 0));
          const actualV = d[dataKey+"_"+mode] !== undefined ? d[dataKey+"_"+mode] : (d.mode === mode ? (d[dataKey]||0) : 0);
          const rectH = actualV * ph;
          // Simplified: just show the dominant mode per segment
          if (mode !== d.mode) return null;
          const rect = <rect key={`${i}-${mode}`} x={pad.left + i * segW} y={pad.top} width={segW-1} height={ph} fill={MODE_COLORS[mode] || "#9CA3AF"} opacity={0.8} rx={1} />;
          return rect;
        });
      })}
    </svg>
  );
};

export default NarrativeAnalysisPage;
