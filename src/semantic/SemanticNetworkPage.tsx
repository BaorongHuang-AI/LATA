/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Select, message, Tag, Spin, Card, Statistic, Row, Col, Empty } from "antd";
import { Play, Network, Trash2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import DocumentSelector from "../corpus/DocumentSelector";
import { Network as VisNetwork } from "vis-network/standalone";
import type { SemanticNetworkData, SemanticNetworkExtraction } from "../types/semanticNetwork";

const SemanticNetworkPage: React.FC = () => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [extractions, setExtractions] = useState<SemanticNetworkExtraction[]>([]);
  const [selectedExtractionId, setSelectedExtractionId] = useState<number | null>(null);
  const [networkData, setNetworkData] = useState<SemanticNetworkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);

  const loadExtractions = useCallback(async () => {
    try {
      setExtractions(await window.api.getSemanticExtractions());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadExtractions(); }, [loadExtractions]);

  const handleRun = async () => {
    if (selectedDocIds.size === 0) { message.warning("Select documents first"); return; }
    setLoading(true);
    try {
      const result = await window.api.runSemanticExtraction({ documentIds: Array.from(selectedDocIds) });
      setNetworkData(result.network_data);
      setSelectedExtractionId(result.id);
      message.success(`Network extracted: ${result.network_data.nodes.length} concepts, ${result.network_data.edges.length} mappings`);
      loadExtractions();
    } catch (e: any) { message.error(e.message || "Extraction failed"); }
    finally { setLoading(false); }
  };

  const handleLoad = async (id: number) => {
    setSelectedExtractionId(id);
    try {
      const ext = await window.api.getSemanticExtraction(id);
      if (ext) {
        setNetworkData(JSON.parse(ext.network_data));
        setSelectedNode(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    await window.api.deleteSemanticExtraction(id);
    if (selectedExtractionId === id) { setSelectedExtractionId(null); setNetworkData(null); }
    loadExtractions();
  };

  // Render vis-network graph
  useEffect(() => {
    if (!containerRef.current || !networkData) return;

    // Derive label from ID if missing: "src:contract" → "contract", "tgt:عقد" → "عقد"
    const deriveLabel = (n: any) => n.label || (n.id?.includes(':') ? n.id.split(':').slice(1).join(':') : n.id) || '?';

    const nodes = networkData.nodes.map((n: any) => ({
      id: n.id,
      label: deriveLabel(n),
      group: n.semanticField || n.group,
      value: Math.max(8, Math.min(60, (n.frequency || 1) * 6)),
      color: {
        background: n.language === 'source' ? '#DBEAFE' : '#D1FAE5',
        border: n.color || '#6B7280',
        highlight: { background: n.language === 'source' ? '#93C5FD' : '#6EE7B7', border: '#2563EB' },
      },
      font: {
        size: Math.max(12, Math.min(22, (n.frequency || 1) * 2 + 10)),
        color: '#1F2937',
        face: 'Arial, sans-serif',
        bold: { color: '#111827', mod: 'bold' },
      },
      shape: n.language === 'source' ? 'dot' : 'diamond',
      size: Math.max(15, Math.min(50, (n.frequency || 1) * 5)),
      borderWidth: 2,
    }));

    const edges = networkData.edges.map((e: any) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: `${e.weight || 1}`,
      width: Math.max(1, Math.min(6, e.weight || 1)),
      color: { color: e.color?.color || '#9CA3AF', opacity: e.color?.opacity || 0.8, highlight: '#2563EB' },
      dashes: e.dashed ? [5, 5] : false,
      font: { size: 9, color: '#6B7280', background: '#FFFFFF', strokeWidth: 2 },
      arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    }));

    const options = {
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -30,
          centralGravity: 0.005,
          springLength: 120,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: { iterations: 150, updateInterval: 25 },
      },
      interaction: { hover: true, tooltipDelay: 100, zoomView: true, dragView: true },
      nodes: { font: { size: 14, color: '#1F2937' } },
      edges: { font: { size: 9, color: '#6B7280', align: 'middle' } },
    };

    const network = new VisNetwork(containerRef.current, { nodes, edges }, options);
    networkRef.current = network;

    network.on("click", (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = networkData.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          const connectedEdges = networkData.edges.filter((e: any) => e.source === nodeId || e.target === nodeId);
          const connectedNodes = connectedEdges.map((e: any) => {
            const otherId = e.source === nodeId ? e.target : e.source;
            return networkData.nodes.find((n: any) => n.id === otherId);
          }).filter(Boolean);
          setSelectedNode({ node, connectedEdges, connectedNodes });
        }
      } else {
        setSelectedNode(null);
      }
    });

    return () => { network.destroy(); };
  }, [networkData]);

  const handleZoomIn = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) * 1.3 });
  const handleZoomOut = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) * 0.7 });
  const handleReset = () => networkRef.current?.fit({ animation: { duration: 500 } });

  const summary = networkData?.summary;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Network size={20} className="text-violet-500" />
        <h1 className="text-lg font-bold text-gray-800">Semantic Network</h1>
        <span className="text-xs text-gray-400 ml-2">Cross-lingual concept mapping visualization</span>
        <div className="flex-1" />
        {networkData && (
          <div className="flex gap-1">
            <Button size="small" icon={<ZoomIn size={14} />} onClick={handleZoomIn} />
            <Button size="small" icon={<ZoomOut size={14} />} onClick={handleZoomOut} />
            <Button size="small" icon={<RotateCcw size={14} />} onClick={handleReset} />
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className="w-72 bg-white border-r shrink-0 flex flex-col">
          <DocumentSelector selectedIds={selectedDocIds} onSelectionChange={setSelectedDocIds} />
          <div className="p-3 border-t space-y-2">
            <Button type="primary" block icon={<Play size={14} />} onClick={handleRun} loading={loading}
              disabled={selectedDocIds.size === 0}
              style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED', color: '#fff' }}>
              Extract Network
            </Button>
          </div>
          <div className="flex-1 overflow-auto border-t">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">Past Networks</div>
            {extractions.map(ex => (
              <div key={ex.id}
                onClick={() => handleLoad(ex.id!)}
                className={`px-3 py-2 cursor-pointer border-b text-xs hover:bg-gray-50 transition ${
                  selectedExtractionId === ex.id ? "bg-violet-50 border-l-2 border-l-violet-500" : ""}`}>
                <div className="font-medium text-gray-600">{ex.model_name || "Unknown"}</div>
                <div className="text-gray-400 flex justify-between">
                  <span>{ex.created_at?.slice(0, 10)}</span>
                  <Trash2 size={12} className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(ex.id!); }} />
                </div>
              </div>
            ))}
            {extractions.length === 0 && <div className="p-3 text-xs text-gray-400 text-center">No extractions yet.</div>}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Spin size="large" /></div>
          ) : networkData ? (
            <>
              {/* Stats bar */}
              {summary && (
                <div className="bg-white border-b px-4 py-2 shrink-0">
                  <Row gutter={12}>
                    <Col span={4}><Statistic title="Concepts" value={summary.total_concepts} /></Col>
                    <Col span={4}><Statistic title="Mappings" value={summary.total_mappings} /></Col>
                    <Col span={4}><Statistic title="Avg/Concept" value={summary.avg_mappings_per_concept.toFixed(1)} /></Col>
                    <Col span={4}><Statistic title="Ambiguity" value={summary.ambiguity_index.toFixed(3)} valueStyle={{ color: summary.ambiguity_index > 0.5 ? '#EF4444' : '#10B981' }} /></Col>
                    <Col span={8}>
                      <div className="flex gap-1 flex-wrap">
                        {summary.dominant_semantic_fields?.map((f: any) => (
                          <Tag key={f.field} color="purple" className="text-[10px]">{f.field}: {f.count}</Tag>
                        ))}
                      </div>
                    </Col>
                  </Row>
                </div>
              )}
              {/* Graph */}
              <div className="flex-1 min-h-0 bg-white" ref={containerRef} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Empty description="Select documents and click 'Extract Network' to build a cross-lingual concept map." />
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {selectedNode && (
          <div className="w-64 bg-white border-l shrink-0 overflow-auto">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Concept Detail</h3>
              <button onClick={() => setSelectedNode(null)} className="text-xs text-gray-400">✕</button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <span className="text-xs text-gray-400">Concept</span>
                <div className="font-semibold text-sm">{selectedNode.node.label}</div>
              </div>
              <div>
                <span className="text-xs text-gray-400">Language</span>
                <Tag color={selectedNode.node.language === 'source' ? 'blue' : 'green'}>
                  {selectedNode.node.language === 'source' ? 'Source' : 'Target'}
                </Tag>
              </div>
              <div>
                <span className="text-xs text-gray-400">Field</span>
                <Tag color="purple">{selectedNode.node.semanticField || selectedNode.node.group}</Tag>
              </div>
              <div>
                <span className="text-xs text-gray-400">Frequency</span>
                <div className="text-sm">{selectedNode.node.frequency}</div>
              </div>
              <div>
                <span className="text-xs text-gray-400">Connected Concepts ({selectedNode.connectedNodes.length})</span>
                <div className="space-y-1 mt-1">
                  {selectedNode.connectedNodes.map((n: any) => (
                    <div key={n.id} className="text-xs flex items-center gap-1">
                      <Tag color={n.language === 'source' ? 'blue' : 'green'} className="text-[10px] leading-none px-1">
                        {n.language === 'source' ? 'S' : 'T'}
                      </Tag>
                      {n.label}
                      <Tag className="text-[10px] leading-none px-1">{n.semanticField || n.group}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SemanticNetworkPage;
