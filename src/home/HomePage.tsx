import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message, Modal, Input, Select } from "antd";
import { downloadCESAlignmentZip } from "../utils/xmlExport";
import {
  Plus, Folder, FileText, ChevronRight, Trash2, Download,
  Settings, Loader2, FolderOpen, FileSpreadsheet, Search, X,
} from "lucide-react";
import type { ProjectWithMetadata } from "../types/project";
import CreateProjectModal from "../projects/CreateProjectModal";
import ProjectMetadataPanel from "../projects/ProjectMetadataPanel";

interface AlignmentStats {
  totalDocs: number;
  totalAlignments: number;
  oneToOne: number;
  oneToMany: number;
  manyToOne: number;
  manyToMany: number;
}

interface AlignedDocument {
  id: number;
  title: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  one_to_one: number;
  one_to_many: number;
  many_to_one: number;
  many_to_many: number;
  updated_at: string;
  project_id?: number | null;
}

const getDocTypeFromStatus = (status: string): "doc" | "para" | "sent" => {
  if (!status) return "doc";
  if (status.startsWith("pending-")) {
    return status.replace("pending-", "") as "doc" | "para" | "sent";
  }
  return "doc";
};

const HomePage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AlignmentStats | null>(null);
  const [docs, setDocs] = useState<AlignedDocument[]>([]);
  const [projects, setProjects] = useState<ProjectWithMetadata[]>([]);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [exportingExcelId, setExportingExcelId] = useState<number | null>(null);
  const [exportingProjectId, setExportingProjectId] = useState<number | null>(null);
  const [exportingProjectExcelId, setExportingProjectExcelId] = useState<number | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMetadata | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // Search/filter state
  const [searchProject, setSearchProject] = useState("");
  const [searchDoc, setSearchDoc] = useState("");
  const [filterSourceLang, setFilterSourceLang] = useState<string | null>(null);
  const [filterTargetLang, setFilterTargetLang] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // ==================== Data Loading ====================

  const loadData = async () => {
    try {
      const [overview, allProjects] = await Promise.all([
        window.api.getHomeOverview(),
        window.api.getAllProjectsWithMetadata(),
      ]);
      setStats(overview.stats);
      setDocs(overview.documents);
      setProjects(allProjects);
    } catch (e) {
      console.error("Failed to load home data", e);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ==================== Derived data ====================

  // Gather distinct languages for filter dropdowns
  const { sourceLangs, targetLangs } = useMemo(() => {
    const src = new Set<string>();
    const tgt = new Set<string>();
    docs.forEach(d => {
      if (d.sourceLang) src.add(d.sourceLang);
      if (d.targetLang) tgt.add(d.targetLang);
    });
    return {
      sourceLangs: Array.from(src).sort(),
      targetLangs: Array.from(tgt).sort(),
    };
  }, [docs]);

  // Filter documents by all criteria
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      if (filterSourceLang && doc.sourceLang !== filterSourceLang) return false;
      if (filterTargetLang && doc.targetLang !== filterTargetLang) return false;
      if (filterStatus && doc.status !== filterStatus) return false;
      if (searchDoc && !doc.title.toLowerCase().includes(searchDoc.toLowerCase())) return false;
      return true;
    });
  }, [docs, filterSourceLang, filterTargetLang, filterStatus, searchDoc]);

  // Filter projects by name
  const filteredProjects = useMemo(() => {
    if (!searchProject) return projects;
    const q = searchProject.toLowerCase();
    return projects.filter(p => p.title.toLowerCase().includes(q));
  }, [projects, searchProject]);

  const docsByProject = (projectId: number | null) =>
    filteredDocs.filter(doc => doc.project_id === projectId);

  // Unassigned docs come after all projects
  const unassignedDocs = useMemo(() => {
    // Show unassigned only when not filtered by project name
    if (searchProject) return [];
    return docsByProject(null);
  }, [filteredDocs, searchProject]);

  const hasActiveFilters = searchProject || searchDoc || filterSourceLang || filterTargetLang || filterStatus;

  const clearFilters = () => {
    setSearchProject("");
    setSearchDoc("");
    setFilterSourceLang(null);
    setFilterTargetLang(null);
    setFilterStatus(null);
  };

  // ==================== Document Actions ====================

  const handleExportDocument = async (doc: AlignedDocument) => {
    setExportingId(doc.id);
    try {
      const docType = getDocTypeFromStatus(doc.status);
      const data = await window.api.getAlignmentState(doc.id, docType);
      await downloadCESAlignmentZip(data.sourceMeta, data.targetMeta, data.sourceLines, data.targetLines, data.links);
      message.success("Exported successfully");
    } catch { message.error("Export failed"); }
    finally { setExportingId(null); }
  };

  const handleExportDocumentExcel = async (doc: AlignedDocument) => {
    setExportingExcelId(doc.id);
    try {
      const docType = getDocTypeFromStatus(doc.status);
      const data = await window.api.getAlignmentState(doc.id, docType);
      const result = await window.api.saveExcelAlignment({
        sourceMeta: data.sourceMeta, targetMeta: data.targetMeta,
        sourceLines: data.sourceLines, targetLines: data.targetLines,
        links: data.links, documentTitle: doc.title,
      });
      if (!result.canceled) message.success("Excel exported successfully");
    } catch { message.error("Excel export failed"); }
    finally { setExportingExcelId(null); }
  };

  const handleDeleteDocument = (doc: AlignedDocument) => {
    Modal.confirm({
      title: "Move to Trash",
      content: `Are you sure you want to move "${doc.title}" to trash? You can restore it from the Trash page later.`,
      okText: "Delete", okType: "danger", cancelText: "Cancel",
      onOk: async () => { await window.api.deleteDocument(doc.id); loadData(); },
    });
  };

  // ==================== Project Actions ====================

  const handleNewDocument = (project: ProjectWithMetadata) => {
    if (!project.id) return;
    navigate("/docalign", { state: { projectId: project.id } });
  };

  const handleExportProject = async (project: ProjectWithMetadata) => {
    if (!project.id) return;
    setExportingProjectId(project.id);
    try {
      const result = await window.api.exportProject(project.id);
      if (!result.success || !result.documents?.length) {
        message.warning("No documents to export in this project"); return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportDocs: any[] = [];
      for (const doc of result.documents) {
        try {
          const docType = getDocTypeFromStatus(doc.status);
          const state = await window.api.getAlignmentState(doc.id, docType);
          if (state) {
            const { generateCESDocument, generateCESAlignXML } = await import("../utils/xmlExport");
            const srcFilename = `${state.sourceMeta.language}_${(doc.title || "doc").replace(/\s+/g, "_")}.xml`;
            const tgtFilename = `${state.targetMeta.language}_${(doc.title || "doc").replace(/\s+/g, "_")}.xml`;
            exportDocs.push({
              title: doc.title, sourceFilename: srcFilename, targetFilename: tgtFilename,
              sourceDocXml: generateCESDocument(state.sourceMeta, state.sourceLines, "source"),
              targetDocXml: generateCESDocument(state.targetMeta, state.targetLines, "target"),
              alignXml: generateCESAlignXML(state.sourceMeta, state.targetMeta, state.sourceLines, state.targetLines, state.links),
            });
          }
        } catch { /* skip */ }
      }
      if (exportDocs.length === 0) { message.warning("No exportable documents found"); return; }
      const saveResult = await window.api.saveProjectZip({ projectTitle: project.title, documents: exportDocs });
      if (saveResult.success) message.success(`Project "${project.title}" exported successfully`);
    } catch { message.error("Failed to export project"); }
    finally { setExportingProjectId(null); }
  };

  const handleExportProjectExcel = async (project: ProjectWithMetadata) => {
    if (!project.id) return;
    setExportingProjectExcelId(project.id);
    try {
      const result = await window.api.exportProject(project.id);
      if (!result.success || !result.documents?.length) {
        message.warning("No documents to export in this project"); return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const excelDocs: any[] = [];
      for (const doc of result.documents) {
        try {
          const docType = getDocTypeFromStatus(doc.status);
          const state = await window.api.getAlignmentState(doc.id, docType);
          if (state) {
            excelDocs.push({
              sourceMeta: state.sourceMeta, targetMeta: state.targetMeta,
              sourceLines: state.sourceLines, targetLines: state.targetLines,
              links: state.links, documentTitle: doc.title,
            });
          }
        } catch { /* skip */ }
      }
      if (excelDocs.length === 0) { message.warning("No exportable documents found"); return; }
      const saveResult = await window.api.saveProjectExcel({ projectTitle: project.title, documents: excelDocs });
      if (saveResult.success) message.success(`Project "${project.title}" exported to Excel successfully`);
    } catch { message.error("Failed to export project to Excel"); }
    finally { setExportingProjectExcelId(null); }
  };

  const handleDeleteProject = (project: ProjectWithMetadata) => {
    Modal.confirm({
      title: "Delete Project",
      content: (
        <div>
          <p>Are you sure you want to delete "{project.title}"?</p>
          {(project.document_count ?? 0) > 0 && (
            <p className="text-red-500 mt-2">
              This will also delete {project.document_count} document(s). This action cannot be undone.
            </p>
          )}
        </div>
      ),
      okText: "Delete", okType: "danger", cancelText: "Cancel",
      onOk: async () => { await window.api.deleteProject(project.id!); message.success("Project deleted"); loadData(); },
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreateProject = async (data: any) => {
    await window.api.saveProjectWithMetadata(data);
    message.success("Project created");
    setShowCreateModal(false);
    loadData();
  };

  const toggleExpanded = (projectId: number) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(projects.map(p => p.id!));
    setExpandedProjects(allIds);
  };

  const collapseAll = () => setExpandedProjects(new Set());

  // ==================== Render ====================

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Alignment Workspace</h1>
            <p className="text-sm text-gray-500">Project-centric document alignment overview</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
            >
              <Folder size={16} /> New Project
            </button>
            <Link
              to="/docalign"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus size={16} /> New Align Task
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-6 gap-3">
          <MiniStat label="Documents" value={stats?.totalDocs || 0} />
          <MiniStat label="Alignments" value={stats?.totalAlignments || 0} />
          <MiniStat label="1→1" value={stats?.oneToOne || 0} color="green" />
          <MiniStat label="1→N" value={stats?.oneToMany || 0} color="blue" />
          <MiniStat label="N→1" value={stats?.manyToOne || 0} color="orange" />
          <MiniStat label="N→N" value={stats?.manyToMany || 0} color="purple" />
        </div>
      </div>

      {/* Search / Filter bar */}
      <div className="bg-white border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Search size={16} className="text-gray-400 shrink-0" />
          <Input
            placeholder="Filter by project name..."
            value={searchProject}
            onChange={e => setSearchProject(e.target.value)}
            className="w-44"
            size="small"
            allowClear
            prefix={<Folder size={12} className="text-gray-400" />}
          />
          <Input
            placeholder="Filter by document name..."
            value={searchDoc}
            onChange={e => setSearchDoc(e.target.value)}
            className="w-48"
            size="small"
            allowClear
            prefix={<FileText size={12} className="text-gray-400" />}
          />
          <Select
            allowClear
            placeholder="Source language"
            value={filterSourceLang}
            onChange={setFilterSourceLang}
            className="w-36"
            size="small"
            options={sourceLangs.map(l => ({ value: l, label: l }))}
          />
          <Select
            allowClear
            placeholder="Target language"
            value={filterTargetLang}
            onChange={setFilterTargetLang}
            className="w-36"
            size="small"
            options={targetLangs.map(l => ({ value: l, label: l }))}
          />
          <Select
            allowClear
            placeholder="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            className="w-32"
            size="small"
            options={[
              { value: "draft", label: "Draft" },
              { value: "pending-doc", label: "Pending Doc" },
              { value: "pending-para", label: "Pending Para" },
              { value: "pending-sent", label: "Pending Sent" },
              { value: "completed", label: "Completed" },
              { value: "review", label: "Review" },
            ]}
          />
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <X size={12} /> Clear filters
            </button>
          )}
          <div className="flex-1" />
          <span className="text-xs text-gray-400">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            {" · "}
            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
          </span>
          <button onClick={expandAll} className="text-xs text-blue-500 hover:text-blue-700">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600">Collapse all</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ---- Projects (above all documents) ---- */}
          {filteredProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Projects
              </h2>
              <div className="space-y-3">
                {filteredProjects.map(project => {
                  const projectDocs = docsByProject(project.id!);
                  const isExpanded = expandedProjects.has(project.id!);
                  return (
                    <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* Project header */}
                      <div
                        className="px-5 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition"
                        onClick={() => toggleExpanded(project.id!)}
                      >
                        <ChevronRight
                          size={16}
                          className={`text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        />
                        <FolderOpen size={20} className="text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-800">{project.title}</span>
                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                              {projectDocs.length} doc{projectDocs.length !== 1 ? 's' : ''}
                            </span>
                            {project.metadata?.source_language && (
                              <span className="text-xs text-gray-400">
                                {project.metadata.source_language}
                                {project.metadata.target_language ? ` → ${project.metadata.target_language}` : ''}
                              </span>
                            )}
                            {project.metadata?.domain && (
                              <span className="text-xs text-gray-400">· {project.metadata.domain}</span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{project.description}</p>
                          )}
                        </div>
                        {/* Quick actions */}
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleNewDocument(project)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            <Plus size={12} /> Doc
                          </button>
                          {exportingProjectId === project.id ? (
                            <button disabled className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-gray-100 text-gray-400">
                              <Loader2 size={12} className="animate-spin" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExportProject(project)}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              title="Export ZIP"
                            >
                              <Download size={12} />
                            </button>
                          )}
                          {exportingProjectExcelId === project.id ? (
                            <button disabled className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-gray-100 text-gray-400">
                              <Loader2 size={12} className="animate-spin" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleExportProjectExcel(project)}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100"
                              title="Export Excel"
                            >
                              <FileSpreadsheet size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectedProject(project); setShowMetadataModal(true); }}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Settings size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded bg-red-50 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded documents */}
                      {isExpanded && (
                        projectDocs.length > 0 ? (
                          <DocumentTable
                            documents={projectDocs}
                            onExport={handleExportDocument}
                            onExportExcel={handleExportDocumentExcel}
                            onDelete={handleDeleteDocument}
                            exportingId={exportingId}
                            exportingExcelId={exportingExcelId}
                          />
                        ) : (
                          <div className="px-5 py-6 text-center text-gray-400 border-t">
                            <FileText size={28} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No documents in this project yet</p>
                            <button
                              onClick={() => handleNewDocument(project)}
                              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            >
                              <Plus size={12} /> Create First Document
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- Unassigned Documents ---- */}
          {unassignedDocs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                <span className="font-semibold text-gray-700">Unassigned Documents</span>
                <span className="text-xs text-amber-600 ml-1">({unassignedDocs.length})</span>
              </div>
              <DocumentTable
                documents={unassignedDocs}
                onExport={handleExportDocument}
                onExportExcel={handleExportDocumentExcel}
                onDelete={handleDeleteDocument}
                exportingId={exportingId}
                exportingExcelId={exportingExcelId}
              />
            </div>
          )}

          {/* Empty state */}
          {filteredProjects.length === 0 && unassignedDocs.length === 0 && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-200">
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">
                {hasActiveFilters ? "No results match your filters" : "No documents yet"}
              </p>
              <p className="text-sm mb-4">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria."
                  : "Create a project or add your first alignment task."}
              </p>
              {hasActiveFilters ? (
                <button onClick={clearFilters} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                  Clear All Filters
                </button>
              ) : (
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                    Create Project
                  </button>
                  <Link to="/docalign" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    New Align Task
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateProjectModal
        visible={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onSave={handleCreateProject}
      />
      <ProjectMetadataPanel
        visible={showMetadataModal}
        project={selectedProject}
        onCancel={() => setShowMetadataModal(false)}
        onSave={async (data) => {
          if (selectedProject?.id) {
            await window.api.upsertProjectMetadata({ ...data, project_id: selectedProject.id });
            message.success("Metadata updated");
            setShowMetadataModal(false);
            loadData();
          }
        }}
      />
    </div>
  );
};

// ==================== Document Table ====================

interface DocumentTableProps {
  documents: AlignedDocument[];
  onExport: (doc: AlignedDocument) => void;
  onExportExcel: (doc: AlignedDocument) => void;
  onDelete: (doc: AlignedDocument) => void;
  exportingId: number | null;
  exportingExcelId: number | null;
}

const alignPathByStatus: Record<string, (id: number) => string> = {
  "pending-doc": (id) => `/docalign/${id}`,
  "pending-para": (id) => `/alignpara/${id}`,
  "pending-sent": (id) => `/alignsent/${id}`,
  review: (id) => `/alignsent/${id}`,
  completed: (id) => `/alignsent/${id}`,
};

const statusBadge = (status: string) => {
  const config: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    review: "bg-yellow-100 text-yellow-700",
    "pending-sent": "bg-blue-100 text-blue-700",
    "pending-para": "bg-indigo-100 text-indigo-700",
    draft: "bg-gray-100 text-gray-600",
  };
  return `px-2 py-0.5 rounded text-xs font-medium ${config[status] || config.draft}`;
};

const DocumentTable = ({ documents, onExport, onExportExcel, onDelete, exportingId, exportingExcelId }: DocumentTableProps) => {
  if (documents.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Languages</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1→1</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1→N</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">N→1</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">N→N</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
            <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map(doc => (
            <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
              <td className="px-4 py-2.5 font-medium text-sm text-gray-800">{doc.title}</td>
              <td className="px-4 py-2.5 text-sm text-gray-500">{doc.sourceLang} → {doc.targetLang}</td>
              <td className="px-4 py-2.5"><span className={statusBadge(doc.status)}>{doc.status}</span></td>
              <td className="px-4 py-2.5 text-center text-sm">{doc.one_to_one}</td>
              <td className="px-4 py-2.5 text-center text-sm">{doc.one_to_many}</td>
              <td className="px-4 py-2.5 text-center text-sm">{doc.many_to_one}</td>
              <td className="px-4 py-2.5 text-center text-sm">{doc.many_to_many}</td>
              <td className="px-4 py-2.5 text-xs text-gray-400">{doc.updated_at?.slice(0, 10)}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-center gap-1.5">
                  <Link
                    to={(alignPathByStatus[doc.status] ?? alignPathByStatus["pending-doc"])(doc.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {doc.status === "completed" ? "Review" : doc.status === "draft" ? "Edit" : "Align"}
                  </Link>
                  {doc.status === "completed" && (
                    <Link to={`/viewer/${doc.id}`} className="inline-flex items-center px-2.5 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">
                      View
                    </Link>
                  )}
                  <button
                    disabled={exportingId === doc.id}
                    onClick={() => onExport(doc)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    title="Export ZIP"
                  >
                    {exportingId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  </button>
                  <button
                    disabled={exportingExcelId === doc.id}
                    onClick={() => onExportExcel(doc)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    title="Export Excel"
                  >
                    {exportingExcelId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                  </button>
                  <button
                    onClick={() => onDelete(doc)}
                    className="inline-flex items-center px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ==================== Mini Stat ====================

const MiniStat = ({ label, value, color }: { label: string; value: number; color?: string }) => {
  const colorMap: Record<string, string> = {
    green: "text-emerald-600", blue: "text-blue-600", orange: "text-orange-600", purple: "text-purple-600",
  };
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
      <div className={`text-lg font-bold ${color ? colorMap[color] || "" : "text-gray-700"}`}>{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  );
};

export default HomePage;
