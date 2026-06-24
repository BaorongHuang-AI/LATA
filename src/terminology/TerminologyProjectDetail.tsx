import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, Button, Tag, Select, message } from "antd";
import { ArrowLeft, BookOpen } from "lucide-react";
import SetupTab from "./SetupTab";
import ExtractTab from "./ExtractTab";
import VerifyTab from "./VerifyTab";
import ExportTab from "./ExportTab";
import SkillManagerModal from "./SkillManagerModal";
import type { TerminologyProject, TerminologySkill, TerminologyTerm } from "../types/terminology";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "extracted", label: "Extracted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "completed", label: "Completed" },
];

const STATUS_COLOR: Record<string, string> = {
  draft: "default", extracted: "blue", reviewed: "orange", completed: "green",
};

const TerminologyProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);

  const [project, setProject] = useState<(TerminologyProject & { document_count: number }) | null>(null);
  const [skills, setSkills] = useState<TerminologySkill[]>([]);
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
  const [terms, setTerms] = useState<TerminologyTerm[]>([]);
  const [activeTab, setActiveTab] = useState("setup");
  const [skillModalOpen, setSkillModalOpen] = useState(false);

  const loadProject = useCallback(async () => {
    try {
      const p = await window.api.getTerminologyProject(pid);
      setProject(p);
    } catch (e) { console.error(e); }
  }, [pid]);

  const loadSkills = useCallback(async () => {
    try {
      const s = await window.api.getTerminologySkills();
      setSkills(s || []);
      if (s && s.length > 0 && !selectedSkillKey) {
        setSelectedSkillKey(s[0].key);
      }
    } catch (e) { console.error(e); }
  }, [selectedSkillKey]);

  const loadTerms = useCallback(async () => {
    try {
      const t = await window.api.getProjectTerms(pid);
      setTerms(t || []);
    } catch (e) { console.error(e); }
  }, [pid]);

  useEffect(() => {
    if (pid) { loadProject(); loadSkills(); loadTerms(); }
  }, [pid, loadProject, loadSkills, loadTerms]);

  // Refresh terms when switching to Export or Verify tab (they may have been changed by another tab)
  useEffect(() => {
    if (pid && (activeTab === 'export' || activeTab === 'verify')) {
      loadTerms();
    }
  }, [activeTab, pid, loadTerms]);

  const handleStatusChange = async (status: string) => {
    try {
      await window.api.updateTerminologyProject(pid, { status: status as TerminologyProject['status'] });
      message.success(`Status updated to "${status}".`);
      loadProject();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message); }
  };

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: "setup",
      label: "1. Setup",
      children: (
        <SetupTab
          projectId={pid}
          skills={skills}
          selectedSkillKey={selectedSkillKey}
          onSkillChange={setSelectedSkillKey}
          onDocumentsChanged={loadProject}
        />
      ),
    },
    {
      key: "extract",
      label: `2. Extract${terms.length > 0 ? ` (${terms.length})` : ""}`,
      children: (
        <ExtractTab
          projectId={pid}
          skills={skills}
          selectedSkillKey={selectedSkillKey}
          onSkillChange={setSelectedSkillKey}
          onTermsChanged={loadTerms}
        />
      ),
    },
    {
      key: "verify",
      label: `3. Verify${terms.length > 0 ? ` (${terms.filter(t => t.verification_status === 'verified').length}/${terms.length})` : ""}`,
      children: (
        <VerifyTab
          projectId={pid}
          onTermsChanged={loadTerms}
        />
      ),
    },
    {
      key: "export",
      label: "4. Export",
      children: (
        <ExportTab
          project={project}
          terms={terms}
        />
      ),
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate("/terminology")}>
            Back
          </Button>
          <BookOpen size={18} className="text-emerald-500" />
          <h1 className="text-lg font-bold text-gray-800">{project.title}</h1>
          <Select
            value={project.status}
            onChange={handleStatusChange}
            className="w-28"
            size="small"
            options={STATUS_OPTIONS}
          />
          <Tag color={STATUS_COLOR[project.status] || "default"}>
            {project.status}
          </Tag>
        </div>
        <div className="flex gap-4 text-xs text-gray-500 ml-10">
          {project.source && <span>📄 Source: <strong>{project.source}</strong></span>}
          {project.extractor && <span>🤖 Extractor: <strong>{project.extractor}</strong></span>}
          {project.reviewer && <span>👤 Reviewer: <strong>{project.reviewer}</strong></span>}
          <span>📚 Documents: <strong>{project.document_count || 0}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          tabBarStyle={{ paddingLeft: 24, marginBottom: 0, background: '#fff', borderBottom: '1px solid #e5e7eb' }}
        >
          {tabItems.map(item => (
            <Tabs.TabPane tab={item.label} key={item.key}>
              <div className="flex-1 flex min-h-0" style={{ height: 'calc(100vh - 140px)' }}>
                {item.children}
              </div>
            </Tabs.TabPane>
          ))}
        </Tabs>
      </div>

      <SkillManagerModal
        open={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
        onSkillsChanged={loadSkills}
      />
    </div>
  );
};

export default TerminologyProjectDetail;
