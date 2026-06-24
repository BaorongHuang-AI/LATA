import React, { useState } from "react";
import { Button, message, Tag, Statistic, Card, Row, Col } from "antd";
import { Download } from "lucide-react";
import type { TerminologyProject, TerminologyTerm } from "../types/terminology";

interface Props {
  project: TerminologyProject & { document_count: number };
  terms: TerminologyTerm[];
}

const ExportTab: React.FC<Props> = ({ project, terms }) => {
  const [exporting, setExporting] = useState(false);

  const stats = {
    total: terms.length,
    verified: terms.filter(t => t.verification_status === 'verified').length,
    rejected: terms.filter(t => t.verification_status === 'rejected').length,
    unverified: terms.filter(t => !t.verification_status || t.verification_status === 'unverified').length,
    high: terms.filter(t => t.priority === 'high').length,
    medium: terms.filter(t => t.priority === 'medium').length,
    low: terms.filter(t => t.priority === 'low').length,
  };

  const domains = new Map<string, number>();
  terms.forEach(t => {
    const d = t.domain || 'general';
    domains.set(d, (domains.get(d) || 0) + 1);
  });

  const handleExport = async () => {
    if (terms.length === 0) {
      message.warning("No terms to export.");
      return;
    }
    setExporting(true);
    try {
      const result = await window.api.exportTerminologyProjectExcel(project.id!);
      if (result.canceled) {
        message.info("Export cancelled.");
      } else if (result.success) {
        message.success(`Exported to ${result.filePath}`);
      } else {
        message.error(result.error || "Export failed.");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      message.error(e.message || "Export failed.");
    } finally { setExporting(false); }
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Project summary */}
        <Card title="Project Summary" size="small">
          <Row gutter={[16, 16]}>
            <Col span={8}><Statistic title="Title" value={project.title} /></Col>
            <Col span={4}><Statistic title="Status" value={project.status} valueStyle={{ color: '#1677ff' }} /></Col>
            <Col span={4}><Statistic title="Documents" value={project.document_count || 0} /></Col>
            <Col span={4}><Statistic title="Source" value={project.source || "-"} /></Col>
            <Col span={4}><Statistic title="Reviewer" value={project.reviewer || "-"} /></Col>
          </Row>
        </Card>

        {/* Term stats */}
        <Card title="Term Statistics" size="small">
          <Row gutter={[16, 16]}>
            <Col span={6}><Statistic title="Total Terms" value={stats.total} suffix="terms" /></Col>
            <Col span={6}><Statistic title="Verified" value={stats.verified} valueStyle={{ color: '#10b981' }} /></Col>
            <Col span={6}><Statistic title="Rejected" value={stats.rejected} valueStyle={{ color: '#ef4444' }} /></Col>
            <Col span={6}><Statistic title="Unverified" value={stats.unverified} valueStyle={{ color: '#9ca3af' }} /></Col>
          </Row>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Tag color="red">High: {stats.high}</Tag>
            <Tag color="orange">Medium: {stats.medium}</Tag>
            <Tag color="green">Low: {stats.low}</Tag>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {Array.from(domains.entries()).map(([d, c]) => (
              <Tag key={d} color="blue">{d}: {c}</Tag>
            ))}
          </div>
        </Card>

        {/* Export button */}
        <Card size="small">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-700">Export to Excel</h4>
              <p className="text-xs text-gray-400 mt-1">
                Export all {terms.length} terms with metadata, context, and verification status.
              </p>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<Download size={16} />}
              onClick={handleExport}
              loading={exporting}
              style={{ backgroundColor: '#059669', borderColor: '#059669', color: '#fff' }}
            >
              Export Excel
            </Button>
          </div>
        </Card>

        {/* Preview */}
        <Card title="Export Preview (first 5 rows)" size="small">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1 text-left">Source Term</th>
                  <th className="border p-1 text-left">Target Term</th>
                  <th className="border p-1 text-left">Domain</th>
                  <th className="border p-1 text-left">Priority</th>
                  <th className="border p-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {terms.slice(0, 5).map((t, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-1">{t.source_term}</td>
                    <td className="border p-1">{t.target_term}</td>
                    <td className="border p-1">{t.domain}</td>
                    <td className="border p-1"><Tag color={t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'orange' : 'green'}>{t.priority}</Tag></td>
                    <td className="border p-1">
                      <Tag color={t.verification_status === 'verified' ? 'green' : t.verification_status === 'rejected' ? 'red' : 'default'}>
                        {t.verification_status || 'unverified'}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ExportTab;
