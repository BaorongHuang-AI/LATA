import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Input, Select, message, Steps, Card, Statistic, Table, Modal } from "antd";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Play, BarChart3, FileText } from "lucide-react";
import type { AnalyticsExperiment, AnalyticsConfig, AnalyticsResult, ExperimentResult, ExperimentGroup } from "../types/analytics";

const METRICS_LIST = [
  { value: "ttr", label: "Type-Token Ratio (TTR)" },
  { value: "guiraud_r", label: "Guiraud's R" },
  { value: "herdans_c", label: "Herdan's C" },
  { value: "yules_k", label: "Yule's K" },
  { value: "honore_h", label: "Honoré's H" },
  { value: "avg_word_length", label: "Average Word Length" },
  { value: "avg_sentence_length", label: "Avg Sentence Length" },
  { value: "alignment_density", label: "Alignment Density" },
  { value: "one_to_one_ratio", label: "1:1 Alignment Ratio" },
  { value: "avg_confidence", label: "Avg Alignment Confidence" },
  { value: "expansion_ratio", label: "Expansion Ratio (Target/Source)" },
  { value: "lexical_delta", label: "Lexical Diversity Delta (TTR Target - Source)" },
  { value: "flesch_reading_ease", label: "Flesch Reading Ease" },
  { value: "target_ttr", label: "Target TTR" },
  { value: "target_guiraud_r", label: "Target Guiraud's R" },
  { value: "cultural_preservation_ratio", label: "Cultural Preservation Ratio" },
  { value: "cultural_substitution_ratio", label: "Cultural Substitution Ratio" },
  { value: "cultural_explicitation_ratio", label: "Cultural Explicitation Ratio" },
  { value: "cultural_omission_ratio", label: "Cultural Omission Ratio" },
  { value: "cultural_addition_count", label: "Cultural Addition Count" },
  { value: "cultural_avg_politeness_shift", label: "Avg Politeness Shift (-1 to +1)" },
  { value: "cultural_avg_distance_score", label: "Avg Cultural Distance (1-5)" },
];

const TEST_LIST = [
  { value: "ttest_independent", label: "Independent t-test (2 groups)" },
  { value: "ttest_paired", label: "Paired t-test (matched pairs)" },
  { value: "mannwhitney", label: "Mann-Whitney U (non-parametric)" },
  { value: "anova_oneway", label: "One-way ANOVA (3+ groups)" },
  { value: "kruskalwallis", label: "Kruskal-Wallis (non-parametric ANOVA)" },
  { value: "kolmogorov_smirnov", label: "Kolmogorov-Smirnov (distribution comparison)" },
  { value: "chisquare", label: "Chi-Square (independence)" },
];

const AnalyticsExperimentPage: React.FC = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();
  const isNew = experimentId === "new";

  const [experiment, setExperiment] = useState<AnalyticsExperiment | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  // Wizard form state
  const [title, setTitle] = useState("");
  const [researchQ, setResearchQ] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [groups, setGroups] = useState<ExperimentGroup[]>([
    { name: "group1", label: "Group 1", documentIds: [] },
    { name: "group2", label: "Group 2", documentIds: [] },
  ]);
  const [selectedMetric, setSelectedMetric] = useState("ttr");
  const [selectedTest, setSelectedTest] = useState("ttest_independent");

  const loadExperiment = useCallback(async () => {
    if (isNew) return;
    const id = Number(experimentId);
    const exp = await window.api.getAnalyticsExperiment(id);
    if (!exp) { message.error("Experiment not found"); navigate("/analytics"); return; }
    setExperiment(exp);
    setTitle(exp.title);
    setResearchQ(exp.research_question || "");
    setHypothesis(exp.hypothesis || "");
    try {
      const config: AnalyticsConfig = JSON.parse(exp.configuration);
      setGroups(config.groups);
      setSelectedMetric(config.metrics[0] || "ttr");
      setSelectedTest(config.testType);
    } catch { /* config parse error */ }
    if (exp.status === "completed") {
      try {
        const res = await window.api.getAnalyticsResults(id);
        setResult({ experiment: exp, results: res });
      } catch { /* not yet run */ }
    }
  }, [experimentId, isNew, navigate]);

  useEffect(() => { loadExperiment(); }, [loadExperiment]);

  const handleSave = async () => {
    if (!title.trim()) { message.warning("Title required"); return; }
    const config: AnalyticsConfig = {
      groups: groups.filter(g => g.documentIds.length > 0),
      metrics: [selectedMetric],
      testType: selectedTest as any,
    };
    if (config.groups.length < 2) { message.warning("Need at least 2 groups with documents"); return; }
    setLoading(true);
    try {
      if (isNew) {
        const id = await window.api.createAnalyticsExperiment({
          title: title.trim(), research_question: researchQ, hypothesis,
          configuration: JSON.stringify(config),
        });
        navigate(`/analytics/${id}`, { replace: true });
        message.success("Experiment saved. Click Run to execute.");
      } else {
        await window.api.updateAnalyticsExperiment(Number(experimentId), {
          title: title.trim(), configuration: JSON.stringify(config),
        });
        message.success("Experiment updated.");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const handleRun = async () => {
    const id = Number(experimentId);
    setLoading(true);
    try {
      const res = await window.api.runAnalyticsExperiment(id);
      setResult(res);
      setExperiment(res.experiment);
      message.success(`Experiment complete! ${res.results.length} documents analyzed.`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message || "Experiment failed"); }
    finally { setLoading(false); }
  };

  const handleGenerateReport = async () => {
    if (!result) return;
    const id = Number(experimentId);
    const to = result.testOutput;
    const md = [
      `# ${title || "Analytics Report"}`,
      researchQ ? `\n**Research Question:** ${researchQ}` : "",
      hypothesis ? `\n**Hypothesis:** ${hypothesis}` : "",
      `\n## Methods`,
      `- **Metric:** ${METRICS_LIST.find(m => m.value === selectedMetric)?.label || selectedMetric}`,
      `- **Test:** ${TEST_LIST.find(t => t.value === selectedTest)?.label || selectedTest}`,
      `- **Groups:** ${groups.map(g => `${g.label} (n=${g.documentIds.length})`).join(", ")}`,
      `\n## Results`,
      to ? [
        `- **Statistic:** ${to.testStatistic.toFixed(4)}`,
        `- **p-value:** ${to.pValue.toFixed(4)} ${to.significant ? "✅ Significant (p < 0.05)" : "❌ Not significant"}`,
        to.effectSize != null ? `- **Effect size:** ${to.effectSize.toFixed(3)} (${to.effectSizeLabel})` : "",
        `\n| Group | N | Mean | SD | Median |`,
        `|-------|---|------|----|--------|`,
        ...to.groupStats.map(g => `| ${g.groupName} | ${g.n} | ${g.mean.toFixed(3)} | ${g.stdDev.toFixed(3)} | ${g.median.toFixed(3)} |`),
      ].join("\n") : "No statistical output.",
      `\n## Raw Data`,
      `| Document | Group | ${selectedMetric} |`,
      `|----------|-------|${"-".repeat(selectedMetric.length + 2)}|`,
      ...result.results.map(r => `| ${r.document_title || r.document_id} | ${r.group_name} | ${(r.metrics as any)[selectedMetric]?.toFixed(4) ?? "-"} |`),
    ].filter(Boolean).join("\n");

    try {
      await window.api.saveAnalyticsReport(id, "markdown", md);
      message.success("Report generated. Copy from console or save.");
      // Show in a simple dialog
      Modal.info({
        title: "Generated Report (Markdown)",
        width: 800,
        content: <pre className="text-xs max-h-96 overflow-auto whitespace-pre-wrap">{md}</pre>,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message); }
  };

  const addGroup = () => {
    setGroups([...groups, { name: `group${groups.length + 1}`, label: `Group ${groups.length + 1}`, documentIds: [] }]);
  };

  const updateGroup = (idx: number, field: string, value: string | number[]) => {
    setGroups(groups.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const parseDocIds = (val: string): number[] => {
    return val.split(/[,;\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate("/analytics")}>Back</Button>
        <BarChart3 size={18} className="text-indigo-500" />
        <h1 className="text-lg font-bold text-gray-800">{isNew ? "New Experiment" : title || "Experiment"}</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {!experiment || experiment.status === "draft" ? (
            <Steps current={step} size="small" className="mb-6" onChange={setStep}
              items={[
                { title: "Info", description: "Question & hypothesis" },
                { title: "Groups", description: "Define comparison groups" },
                { title: "Analysis", description: "Metric & test" },
                { title: "Save & Run", description: "Execute experiment" },
              ]} />
          ) : null}

          {step === 0 && (
            <Card title="Experiment Information" className="mb-4">
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Title *</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Lexical Diversity: Legal vs Medical" /></div>
                <div><label className="text-xs text-gray-500">Research Question</label>
                  <Input.TextArea rows={2} value={researchQ} onChange={e => setResearchQ(e.target.value)}
                    placeholder="e.g., Do legal translations exhibit lower lexical diversity than medical translations?" /></div>
                <div><label className="text-xs text-gray-500">Hypothesis (H₁)</label>
                  <Input value={hypothesis} onChange={e => setHypothesis(e.target.value)}
                    placeholder="e.g., Legal translations have significantly lower TTR than medical translations" /></div>
                <div className="flex justify-end"><Button onClick={() => setStep(1)}>Next →</Button></div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card title="Comparator Groups" className="mb-4">
              <p className="text-xs text-gray-400 mb-3">Define groups to compare. Enter document IDs separated by commas.</p>
              {groups.map((g, i) => (
                <div key={i} className="border rounded p-3 mb-2">
                  <div className="flex gap-2 mb-2">
                    <Input size="small" className="w-32" placeholder="Group name" value={g.name}
                      onChange={e => updateGroup(i, "name", e.target.value)} />
                    <Input size="small" className="flex-1" placeholder="Label" value={g.label}
                      onChange={e => updateGroup(i, "label", e.target.value)} />
                  </div>
                  <Input size="small" placeholder="Document IDs (e.g., 1, 2, 5)" value={g.documentIds.join(", ")}
                    onChange={e => updateGroup(i, "documentIds", parseDocIds(e.target.value))} />
                  {g.documentIds.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">{g.documentIds.length} document(s)</div>
                  )}
                </div>
              ))}
              <Button size="small" onClick={addGroup}>+ Add Group</Button>
              <div className="flex justify-between mt-3">
                <Button onClick={() => setStep(0)}>← Back</Button>
                <Button onClick={() => setStep(2)}>Next →</Button>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card title="Metric & Statistical Test" className="mb-4">
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Metric to analyze</label>
                  <Select value={selectedMetric} onChange={setSelectedMetric} className="w-full"
                    options={METRICS_LIST} /></div>
                <div><label className="text-xs text-gray-500">Statistical test</label>
                  <Select value={selectedTest} onChange={setSelectedTest} className="w-full"
                    options={TEST_LIST} /></div>
                <div className="flex justify-between">
                  <Button onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={() => setStep(3)}>Next →</Button>
                </div>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card title="Review & Execute" className="mb-4">
              <div className="space-y-2 text-sm">
                <div><strong>Title:</strong> {title || "(none)"}</div>
                <div><strong>Question:</strong> {researchQ || "(none)"}</div>
                <div><strong>Groups:</strong> {groups.map(g => `${g.label} (${g.documentIds.length} docs)`).join(", ")}</div>
                <div><strong>Metric:</strong> {METRICS_LIST.find(m => m.value === selectedMetric)?.label}</div>
                <div><strong>Test:</strong> {TEST_LIST.find(t => t.value === selectedTest)?.label}</div>
              </div>
              <div className="flex justify-between mt-4">
                <Button onClick={() => setStep(2)}>← Back</Button>
                <div className="flex gap-2">
                  <Button onClick={handleSave} loading={loading}
                    style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}>
                    {isNew ? "Save Experiment" : "Update"}
                  </Button>
                  {!isNew && (
                    <Button type="primary" icon={<Play size={14} />} onClick={handleRun} loading={loading}
                      style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }}>
                      Run Now
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Results */}
          {result && (
            <Card title="Results" className="mt-4">
              {result.testOutput && (
                <div className="mb-4">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Statistic title="Test Statistic" value={result.testOutput.testStatistic.toFixed(4)} />
                    <Statistic title="p-value" value={result.testOutput.pValue.toFixed(4)}
                      valueStyle={{ color: result.testOutput.significant ? '#10b981' : '#ef4444' }} />
                    {result.testOutput.effectSize != null && (
                      <Statistic title="Effect Size" value={result.testOutput.effectSize.toFixed(3)}
                        suffix={result.testOutput.effectSizeLabel} />
                    )}
                  </div>
                  <Table size="small" pagination={false} dataSource={result.testOutput.groupStats}
                    rowKey="groupName" columns={[
                      { title: "Group", dataIndex: "groupName" },
                      { title: "N", dataIndex: "n" },
                      { title: "Mean", dataIndex: "mean", render: (v: number) => v.toFixed(4) },
                      { title: "SD", dataIndex: "stdDev", render: (v: number) => v.toFixed(4) },
                      { title: "Median", dataIndex: "median", render: (v: number) => v.toFixed(4) },
                      { title: "Min", dataIndex: "min", render: (v: number) => v.toFixed(2) },
                      { title: "Max", dataIndex: "max", render: (v: number) => v.toFixed(2) },
                    ]} />
                </div>
              )}
              <Table size="small" pagination={{ pageSize: 20 }}
                dataSource={result.results} rowKey={(r: any) => `${r.document_id}-${r.group_name}`}
                columns={[
                  { title: "Document", dataIndex: "document_title" },
                  { title: "Group", dataIndex: "group_name" },
                  { title: "Metric", key: "metric",
                    render: (_: any, r: AnalyticsResult) => (r.metrics as any)[selectedMetric]?.toFixed(4) ?? "-" },
                ]} />
              <div className="mt-3">
                <Button icon={<FileText size={14} />} onClick={handleGenerateReport}>
                  Generate Report
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsExperimentPage;
