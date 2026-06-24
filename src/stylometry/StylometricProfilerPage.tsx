/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Select, message, Tag, Statistic, Row, Col, Input, Modal, Empty, Spin } from "antd";
import { Fingerprint, Play, Trash2 } from "lucide-react";
import DocumentSelector from "../corpus/DocumentSelector";
import type { StylometricProfile, StylometricMetadata, PCAResult, ClusterResult, DomainComparison } from "../types/stylometry";

const CLUSTER_COLORS = ["#3B82F6","#EF4444","#10B981","#F59E0B","#8B5CF6","#EC4899","#06B6D4"];

const StylometricProfilerPage: React.FC = () => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [profiles, setProfiles] = useState<StylometricProfile[]>([]);
  const [pca, setPca] = useState<PCAResult | null>(null);
  const [clusters, setClusters] = useState<ClusterResult | null>(null);
  const [discrimination, setDiscrimination] = useState<Array<{ name: string; score: number }>>([]);
  const [domainComparison, setDomainComparison] = useState<DomainComparison[]>([]);
  const [useDeltas, setUseDeltas] = useState(true);
  const [domainMetric, setDomainMetric] = useState("delta_ttr");
  const [loading, setLoading] = useState(false);
  const [colorBy, setColorBy] = useState<string>("translator_type");
  const [shapeBy, setShapeBy] = useState<string>("translator_type");
  const [metadataModal, setMetadataModal] = useState(false);
  const [pendingDocIds, setPendingDocIds] = useState<number[]>([]);
  const [metaForm, setMetaForm] = useState<StylometricMetadata>({
    translator: "", era: "", domain: "", translator_type: "human", llm_model: "", notes: "",
  });

  const loadProfiles = useCallback(async () => {
    try { setProfiles(await window.api.getStylometricProfiles()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleExtract = () => {
    const ids = Array.from(selectedDocIds);
    if (ids.length < 2) { message.warning("Select at least 2 documents"); return; }
    setPendingDocIds(ids);
    setMetadataModal(true);
  };

  const handleRunExtraction = async () => {
    setMetadataModal(false);
    setLoading(true);
    try {
      const metaList = pendingDocIds.map(() => ({ ...metaForm }));
      const result = await window.api.extractStylometricProfiles({
        documentIds: pendingDocIds, metadataList: metaList, useDeltas,
      });
      setProfiles(result.profiles);
      setPca(result.pca);
      setClusters(result.clusters);
      setDiscrimination(result.discrimination);
      setDomainComparison(result.domainComparison || []);
      message.success(`${result.profiles.length} profiles extracted. ${result.useDeltas ? 'Delta mode (target-source).' : 'Raw mode.'} PCA: ${result.pca ? `${result.pca.explainedVariance.map(v => (v*100).toFixed(0)+"%").join(", ")}` : "need ≥3 documents"}`);
      loadProfiles();
    } catch (e: any) { message.error(e.message || "Extraction failed"); }
    finally { setLoading(false); }
  };

  const handleClear = async () => {
    await window.api.deleteAllStylometricProfiles();
    setProfiles([]); setPca(null); setClusters(null); setDiscrimination([]);
    message.success("Cleared");
  };

  // Build scatter data from PCA projections
  const scatterData = pca ? profiles.map((p, i) => ({
    x: pca.projected[i]?.[0] || 0,
    y: pca.projected[i]?.[1] || 0,
    z: 20,
    name: p.document_title || `Doc ${p.document_id}`,
    profile: p,
    cluster: clusters?.labels[i] ?? -1,
  })) : [];

  const colorValue = (p: StylometricProfile) => (p.metadata as any)[colorBy] || "unknown";
  const uniqueColors = [...new Set(profiles.map(colorValue))];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Fingerprint size={20} className="text-rose-500" />
        <h1 className="text-lg font-bold text-gray-800">Stylometric Profiler</h1>
        <span className="text-xs text-gray-400 ml-2">Translation fingerprinting & authorship attribution</span>
        <div className="flex-1" />
        {profiles.length > 0 && (
          <Button size="small" danger icon={<Trash2 size={14} />} onClick={handleClear}>Clear</Button>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className="w-72 bg-white border-r shrink-0 flex flex-col">
          <DocumentSelector selectedIds={selectedDocIds} onSelectionChange={setSelectedDocIds} />
          <div className="p-3 border-t space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <div><label className="text-[10px] text-gray-400">Translator</label>
                <Input size="small" value={metaForm.translator || ""}
                  onChange={e => setMetaForm({...metaForm, translator: e.target.value})} placeholder="e.g. John Smith" /></div>
              <div><label className="text-[10px] text-gray-400">Domain</label>
                <Input size="small" value={metaForm.domain || ""}
                  onChange={e => setMetaForm({...metaForm, domain: e.target.value})} placeholder="e.g. legal" /></div>
              <div><label className="text-[10px] text-gray-400">Era</label>
                <Input size="small" value={metaForm.era || ""}
                  onChange={e => setMetaForm({...metaForm, era: e.target.value})} placeholder="e.g. 1980s" /></div>
              <div><label className="text-[10px] text-gray-400">Type</label>
                <Select size="small" value={metaForm.translator_type} className="w-full"
                  onChange={v => setMetaForm({...metaForm, translator_type: v})}
                  options={[{value:"human",label:"Human"},{value:"llm",label:"LLM"}]} /></div>
            </div>
            <Button type="primary" block icon={<Play size={14} />} onClick={handleExtract} loading={loading}
              disabled={selectedDocIds.size < 2}
              style={{ backgroundColor: '#E11D48', borderColor: '#E11D48', color: '#fff' }}>
              Extract Profiles ({selectedDocIds.size})
            </Button>
          </div>
          {profiles.length > 0 && (
            <div className="flex-1 overflow-auto border-t">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">{profiles.length} Profiles</div>
              {profiles.map(p => (
                <div key={p.id} className="px-3 py-2 border-b text-xs">
                  <div className="font-medium text-gray-700 truncate">{p.document_title}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <Tag className="text-[10px] leading-none px-1 py-0" color="blue">{p.metadata.translator || "?"}</Tag>
                    <Tag className="text-[10px] leading-none px-1 py-0" color={p.metadata.translator_type==="llm"?"purple":"green"}>
                      {p.metadata.translator_type || "?"}</Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Spin size="large" /></div>
          ) : pca && scatterData.length > 0 ? (
            <>
              {/* Stats */}
              <div className="bg-white border-b px-4 py-2 shrink-0">
                <Row gutter={12}>
                  <Col span={4}><Statistic title="Profiles" value={profiles.length} /></Col>
                  <Col span={4}><Statistic title="PC1" value={`${(pca.explainedVariance[0]*100).toFixed(0)}%`} suffix="variance" /></Col>
                  <Col span={4}><Statistic title="PC2" value={`${(pca.explainedVariance[1]*100).toFixed(0)}%`} suffix="variance" /></Col>
                  <Col span={4}><Statistic title="Silhouette" value={clusters?.silhouetteScore.toFixed(3) || "-"}
                    valueStyle={{ color: (clusters?.silhouetteScore || 0) > 0.5 ? '#10B981' : '#EF4444' }} /></Col>
                  <Col span={8}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Mode:</span>
                      <Select size="small" value={useDeltas ? "delta" : "raw"} onChange={v => { setUseDeltas(v === "delta"); setPca(null); }}
                        className="w-20" options={[{value:"delta",label:"Delta"},{value:"raw",label:"Raw"}]} />
                      <span className="text-xs text-gray-400">Color:</span>
                      <Select size="small" value={colorBy} onChange={setColorBy} className="w-28"
                        options={["translator","domain","era","translator_type"].map(k=>({value:k,label:k.replace(/_/g," ")}))} />
                      <span className="text-xs text-gray-400">Shape:</span>
                      <Select size="small" value={shapeBy} onChange={setShapeBy} className="w-28"
                        options={["translator_type","domain"].map(k=>({value:k,label:k.replace(/_/g," ")}))} />
                    </div>
                  </Col>
                </Row>
              </div>
              {/* Custom SVG Scatter Plot */}
              <div className="flex-1 bg-white relative" style={{ minHeight: 400 }}>
                <SvgScatterPlot
                  data={scatterData}
                  pca={pca}
                  colorBy={colorBy}
                  shapeBy={shapeBy}
                  uniqueColors={uniqueColors}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Empty description="Select ≥2 documents, set metadata, and click 'Extract Profiles' to visualize their stylometric landscape." />
            </div>
          )}
        </div>

        {/* Domain comparison bar */}
        {domainComparison.length > 0 && (
          <div className="bg-white border-t px-4 py-2 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-gray-600">Domain Comparison:</span>
              <span className="text-xs text-gray-400">Source → Target deltas by domain</span>
              <Select size="small" value={domainMetric} onChange={setDomainMetric} className="w-36"
                options={[
                  {value:"delta_ttr",label:"TTR Δ"}, {value:"delta_guiraud_r",label:"Guiraud Δ"},
                  {value:"delta_avg_sentence_length",label:"Sent Len Δ"}, {value:"delta_avg_word_length",label:"Word Len Δ"},
                  {value:"delta_passive_density",label:"Passive Δ"}, {value:"delta_pronoun_density",label:"Pronoun Δ"},
                  {value:"delta_noun_ratio",label:"Noun Δ"}, {value:"delta_preposition_density",label:"Prep Δ"},
                  {value:"expansion_ratio",label:"Expansion"}, {value:"formality_score",label:"Formality"},
                ]} />
            </div>
            <div className="flex gap-3">
              {domainComparison.map(dc => (
                <div key={dc.domain} className="flex-1 bg-gray-50 rounded-lg p-2 border">
                  <div className="text-xs font-medium text-gray-700">{dc.domain}</div>
                  <div className="text-[10px] text-gray-400">n={dc.n}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`text-sm font-bold ${dc.delta_mean > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {dc.delta_mean > 0 ? '+' : ''}{dc.delta_mean.toFixed(3)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      src={dc.source_mean.toFixed(2)} → tgt={dc.target_mean.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400">d={dc.cohens_d_vs_zero.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right: Feature discrimination */}
        {discrimination.length > 0 && (
          <div className="w-56 bg-white border-l shrink-0 overflow-auto">
            <div className="p-3 border-b text-xs font-semibold">Top Discriminators</div>
            <div className="p-2">
              {discrimination.slice(0, 12).map(d => (
                <div key={d.name} className="mb-1.5">
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>{d.name.replace(/_/g," ")}</span>
                    <span>{d.score.toFixed(2)}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded">
                    <div className="h-1 bg-rose-500 rounded" style={{ width: `${Math.min(100, d.score*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal title="Extract Profiles" open={metadataModal} onCancel={() => setMetadataModal(false)}
        onOk={handleRunExtraction} okText="Extract" okButtonProps={{ style: { backgroundColor: '#E11D48', borderColor: '#E11D48', color: '#fff' } }}>
        <p className="text-sm text-gray-500 mb-4">Extracting {pendingDocIds.length} profiles with the metadata above. This computes 30+ stylometric features per document.</p>
      </Modal>
    </div>
  );
};

// ==================== SVG Scatter Plot ====================

const SHAPES: Record<string, (cx: number, cy: number, r: number) => string> = {
  circle: (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" />`,
  cross: (cx, cy, r) => {
    const s = r * 1.4;
    return `<path d="M${cx-s},${cy-s}L${cx+s},${cy+s}M${cx+s},${cy-s}L${cx-s},${cy+s}" stroke-width="2" />`;
  },
  triangle: (cx, cy, r) => {
    const s = r * 1.3;
    return `<polygon points="${cx},${cy-s} ${cx+s},${cy+s} ${cx-s},${cy+s}" />`;
  },
};

interface SvgScatterPlotProps {
  data: Array<{ x: number; y: number; name: string; profile: any; cluster: number }>;
  pca: { explainedVariance: number[] };
  colorBy: string;
  shapeBy: string;
  uniqueColors: any[];
}

const SvgScatterPlot: React.FC<SvgScatterPlotProps> = ({ data, pca, colorBy, shapeBy, uniqueColors }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; profile: any } | null>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const pad = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotW = dims.w - pad.left - pad.right;
  const plotH = dims.h - pad.top - pad.bottom;

  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const xMin = Math.min(...xs, 0);
  const xMax = Math.max(...xs, 0);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const scaleX = (v: number) => pad.left + ((v - xMin) / xRange) * plotW;
  const scaleY = (v: number) => pad.top + plotH - ((v - yMin) / yRange) * plotH;

  const colorValue = (p: any) => (p.metadata || {})[colorBy] || "unknown";
  const shapeValue = (p: any) => (p.metadata || {})[shapeBy] || "unknown";

  // Grid lines
  const xTicks = 5;
  const yTicks = 5;

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${dims.w} ${dims.h}`}>
        {/* Grid */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const x = pad.left + (plotW * i) / xTicks;
          return <line key={`gx${i}`} x1={x} y1={pad.top} x2={x} y2={pad.top + plotH} stroke="#E5E7EB" strokeWidth={1} />;
        })}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = pad.top + (plotH * i) / yTicks;
          return <line key={`gy${i}`} x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#E5E7EB" strokeWidth={1} />;
        })}
        {/* Axes */}
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#9CA3AF" strokeWidth={1.5} />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#9CA3AF" strokeWidth={1.5} />
        {/* Axis labels */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = xMin + (xRange * i) / xTicks;
          const x = scaleX(v);
          return <text key={`xl${i}`} x={x} y={pad.top + plotH + 18} textAnchor="middle" fontSize={11} fill="#6B7280">{v.toFixed(2)}</text>;
        })}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = yMin + (yRange * i) / yTicks;
          const y = scaleY(v);
          return <text key={`yl${i}`} x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#6B7280">{v.toFixed(2)}</text>;
        })}
        <text x={dims.w / 2} y={dims.h - 4} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600}>
          PC1 ({((pca.explainedVariance?.[0] || 0) * 100).toFixed(0)}%)
        </text>
        <text x={14} y={dims.h / 2} textAnchor="middle" fontSize={12} fill="#374151" fontWeight={600}
          transform={`rotate(-90, 14, ${dims.h / 2})`}>
          PC2 ({((pca.explainedVariance?.[1] || 0) * 100).toFixed(0)}%)
        </text>
        {/* Data points */}
        {data.map((d, i) => {
          const cx = scaleX(d.x);
          const cy = scaleY(d.y);
          const r = 6;
          const clr = CLUSTER_COLORS[uniqueColors.indexOf(colorValue(d.profile)) % CLUSTER_COLORS.length] || "#6B7280";
          const shape = SHAPES[shapeValue(d.profile) === "llm" ? "cross" : "circle"] || SHAPES.circle;
          return (
            <g key={i} style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, profile: d.profile });
              }}
              onMouseLeave={() => setTooltip(null)}>
              <g dangerouslySetInnerHTML={{ __html: shape(cx, cy, r) }}
                stroke={clr} fill={clr} fillOpacity={0.7} />
            </g>
          );
        })}
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bg-white border rounded-lg p-2 shadow-lg text-xs pointer-events-none z-10"
          style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="font-semibold">{tooltip.profile.document_title}</div>
          <div>Translator: {tooltip.profile.metadata.translator || "?"}</div>
          <div>Type: {tooltip.profile.metadata.translator_type}</div>
          <div>Domain: {tooltip.profile.metadata.domain || "?"}</div>
          <div>TTR: {tooltip.profile.features.ttr?.toFixed(3)}</div>
          <div>Guirard: {tooltip.profile.features.guiraud_r?.toFixed(1)}</div>
          <div>Formality: {tooltip.profile.features.formality_score?.toFixed(2)}</div>
          <div>1:1 Ratio: {((tooltip.profile.features.one_to_one_ratio || 0) * 100).toFixed(0)}%</div>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-2 right-4 flex flex-wrap gap-2">
        {uniqueColors.map((color, ci) => (
          <div key={String(color)} className="flex items-center gap-1 text-[10px]">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CLUSTER_COLORS[ci % CLUSTER_COLORS.length] }} />
            {String(color)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StylometricProfilerPage;
