import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { message, Modal } from "antd";
import { downloadCESAlignmentZip } from "../utils/xmlExport";
import { Plus, Folder, FileText, ChevronRight, Trash2, Download, Settings, Loader2, FolderOpen } from "lucide-react";
import type { ProjectWithMetadata, ProjectDocument } from "../types/project";
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
    const [exportingProjectId, setExportingProjectId] = useState<number | null>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
    const [viewMode, setViewMode] = useState<"all" | "unassigned">("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectWithMetadata | null>(null);
    const [showMetadataModal, setShowMetadataModal] = useState(false);

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

    useEffect(() => {
        loadData();
    }, []);

    // ==================== Document Actions ====================

    const handleExportDocument = async (doc: AlignedDocument) => {
        setExportingId(doc.id);
        try {
            const docType = getDocTypeFromStatus(doc.status);
            const data = await window.api.getAlignmentState(doc.id, docType);
            await downloadCESAlignmentZip(
                data.sourceMeta,
                data.targetMeta,
                data.sourceLines,
                data.targetLines,
                data.links
            );
            message.success("Exported successfully");
        } catch (e) {
            message.error("Export failed");
        } finally {
            setExportingId(null);
        }
    };

    const handleDeleteDocument = (doc: AlignedDocument) => {
        Modal.confirm({
            title: "Delete Align Task",
            content: `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk: async () => {
                await window.api.deleteDocument(doc.id);
                loadData();
            },
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
                message.warning("No documents to export in this project");
                return;
            }

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
                            title: doc.title,
                            sourceFilename: srcFilename,
                            targetFilename: tgtFilename,
                            sourceDocXml: generateCESDocument(state.sourceMeta, state.sourceLines, "source"),
                            targetDocXml: generateCESDocument(state.targetMeta, state.targetLines, "target"),
                            alignXml: generateCESAlignXML(state.sourceMeta, state.targetMeta, state.sourceLines, state.targetLines, state.links),
                        });
                    }
                } catch {
                    // Skip documents that fail to export
                }
            }

            if (exportDocs.length === 0) {
                message.warning("No exportable documents found");
                return;
            }

            const saveResult = await window.api.saveProjectZip({
                projectTitle: project.title,
                documents: exportDocs,
            });

            if (saveResult.success) {
                message.success(`Project "${project.title}" exported successfully`);
            }
        } catch (e) {
            console.error("Failed to export project:", e);
            message.error("Failed to export project");
        } finally {
            setExportingProjectId(null);
        }
    };

    const handleDeleteProject = (project: ProjectWithMetadata) => {
        Modal.confirm({
            title: "Delete Project",
            content: (
                <div>
                    <p>
                        Are you sure you want to delete "{project.title}"?
                    </p>
                    {(project.document_count ?? 0) > 0 && (
                        <p className="text-red-500 mt-2">
                            This will also delete {project.document_count} document(s) in this project.
                            This action cannot be undone.
                        </p>
                    )}
                </div>
            ),
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk: async () => {
                await window.api.deleteProject(project.id!);
                message.success("Project deleted");
                loadData();
            },
        });
    };

    const handleEditMetadata = (project: ProjectWithMetadata) => {
        setSelectedProject(project);
        setShowMetadataModal(true);
    };

    const handleCreateProject = async (data: any) => {
        await window.api.saveProjectWithMetadata(data);
        message.success("Project created");
        setShowCreateModal(false);
        loadData();
    };

    const toggleExpanded = (projectId: number) => {
        setExpandedProjects((prev) => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    };

    // ==================== Computed ====================

    const filteredDocs = docs.filter((doc) => {
        if (viewMode === "unassigned") return doc.project_id === null;
        return true;
    });

    const docsByProject = (projectId: number | null) =>
        filteredDocs.filter((doc) => doc.project_id === projectId);

    const unassignedDocs = docsByProject(null);
    const canExportProject = true; // feature flag

    return (
        <div className="p-6 max-w-12xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Alignment Workspace</h1>
                    <p className="text-gray-500">Document alignment overview</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded flex items-center gap-2 hover:bg-purple-700"
                    >
                        <Folder size={18} />
                        New Project
                    </button>
                    <Link
                        to="/docalign"
                        className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700"
                    >
                        <Plus size={18} />
                        New Align Task
                    </Link>
                    <Link
                        to="/settings"
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Configure LLM API
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Stat title="Documents" value={stats?.totalDocs || 0} />
                <Stat title="Alignments" value={stats?.totalAlignments || 0} />
                <Stat title="1 → 1" value={stats?.oneToOne || 0} />
                <Stat title="1 → N" value={stats?.oneToMany || 0} />
                <Stat title="N → 1" value={stats?.manyToOne || 0} />
                <Stat title="N → N" value={stats?.manyToMany || 0} />
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-4 border-b border-gray-200">
                <button
                    onClick={() => setViewMode("all")}
                    className={`pb-2 px-4 text-sm font-medium ${
                        viewMode === "all"
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    All Documents
                </button>
                <button
                    onClick={() => setViewMode("unassigned")}
                    className={`pb-2 px-4 text-sm font-medium ${
                        viewMode === "unassigned"
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Unassigned Documents
                </button>
            </div>

            {/* Unassigned Documents */}
            {unassignedDocs.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-medium">
                        Unassigned Documents
                    </div>
                    <DocumentTable
                        documents={unassignedDocs}
                        onExport={handleExportDocument}
                        onDelete={handleDeleteDocument}
                        exportingId={exportingId}
                    />
                </div>
            )}

            {/* Projects with Documents */}
            {projects.map((project) => {
                const projectDocs = docsByProject(project.id!);
                if (projectDocs.length === 0 && viewMode === "unassigned") return null;

                return (
                    <div
                        key={project.id}
                        className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                    >
                        {/* Project Header */}
                        <div
                            className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleExpanded(project.id!)}
                        >
                            <div className="flex items-center gap-3">
                                <FolderOpen className="text-purple-600" size={20} />
                                <div>
                                    <span className="font-medium">{project.title}</span>
                                    <span className="ml-3 text-sm text-gray-500">
                                        {projectDocs.length} doc{projectDocs.length !== 1 ? "s" : ""}
                                    </span>
                                    {project.metadata && (
                                        <span className="ml-3 text-xs text-gray-400">
                                            {project.metadata.source_language || "?"} → {project.metadata.target_language || "?"}
                                            {project.metadata.domain ? ` · ${project.metadata.domain}` : ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight
                                size={18}
                                className={`text-gray-400 transition-transform ${
                                    expandedProjects.has(project.id!) ? "rotate-90" : ""
                                }`}
                            />
                        </div>

                        {/* Project Actions */}
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleNewDocument(project);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <FileText size={14} />
                                New Document
                            </button>
                            {canExportProject && (
                                exportingProjectId === project.id ? (
                                    <button
                                        disabled
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-emerald-50 text-emerald-600"
                                    >
                                        <Loader2 size={14} className="animate-spin" />
                                        Exporting...
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExportProject(project);
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    >
                                        <Download size={14} />
                                        Export All
                                    </button>
                                )
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditMetadata(project);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-white border hover:bg-gray-100"
                            >
                                <Settings size={14} />
                                Metadata
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProject(project);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >
                                <Trash2 size={14} />
                                Delete
                            </button>
                        </div>

                        {/* Documents Table (Expandable) */}
                        {expandedProjects.has(project.id!) && (
                            projectDocs.length > 0 ? (
                                <DocumentTable
                                    documents={projectDocs}
                                    onExport={handleExportDocument}
                                    onDelete={handleDeleteDocument}
                                    exportingId={exportingId}
                                />
                            ) : (
                                <div className="p-6 text-center text-gray-500">
                                    <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No documents in this project yet</p>
                                    <button
                                        onClick={() => handleNewDocument(project)}
                                        className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                    >
                                        <Plus size={14} />
                                        Create First Document
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                );
            })}

            {/* Empty State */}
            {filteredDocs.length === 0 && projects.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">No documents yet</p>
                    <p className="text-sm mb-4">Create a project or add your first alignment task</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            Create Project
                        </button>
                        <Link
                            to="/docalign"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            New Align Task
                        </Link>
                    </div>
                </div>
            )}

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
                        await window.api.upsertProjectMetadata({
                            ...data,
                            project_id: selectedProject.id,
                        });
                        message.success("Metadata updated");
                        setShowMetadataModal(false);
                        loadData();
                    }
                }}
            />
        </div>
    );
};

/* ==================== Document Table ==================== */

interface DocumentTableProps {
    documents: AlignedDocument[];
    onExport: (doc: AlignedDocument) => void;
    onDelete: (doc: AlignedDocument) => void;
    exportingId: number | null;
}

const alignPathByStatus: Record<string, (id: number) => string> = {
    "pending-doc": (id) => `/docalign/${id}`,
    "pending-para": (id) => `/alignpara/${id}`,
    "pending-sent": (id) => `/alignsent/${id}`,
    review: (id) => `/alignsent/${id}`,
    completed: (id) => `/alignsent/${id}`,
};

const DocumentTable = ({ documents, onExport, onDelete, exportingId }: DocumentTableProps) => {
    if (documents.length === 0) return null;

    return (
        <table className="w-full table-auto">
            <thead className="bg-gray-50">
                <tr>
                    <Th>Document</Th>
                    <Th>Languages</Th>
                    <Th>Status</Th>
                    <Th center>1 → 1</Th>
                    <Th center>1 → N</Th>
                    <Th center>N → 1</Th>
                    <Th center>N → N</Th>
                    <Th>Updated</Th>
                    <Th center>Actions</Th>
                </tr>
            </thead>
            <tbody>
                {documents.map((doc) => (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                        <Td className="font-medium">{doc.title}</Td>
                        <Td>
                            {doc.sourceLang} → {doc.targetLang}
                        </Td>
                        <Td>
                            <span
                                className={`px-2 py-1 rounded text-xs ${
                                    doc.status === "completed"
                                        ? "bg-green-100 text-green-700"
                                        : doc.status === "review"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-blue-100 text-blue-700"
                                }`}
                            >
                                {doc.status}
                            </span>
                        </Td>
                        <Td center>{doc.one_to_one}</Td>
                        <Td center>{doc.one_to_many}</Td>
                        <Td center>{doc.many_to_one}</Td>
                        <Td center>{doc.many_to_many}</Td>
                        <Td className="text-sm text-gray-500">{doc.updated_at}</Td>
                        <Td center>
                            <div className="flex items-center justify-center gap-2">
                                <Link
                                    to={
                                        (alignPathByStatus[doc.status] ?? alignPathByStatus["pending-doc"])(
                                            doc.id
                                        )
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {doc.status === "completed" ? "Review" : doc.status === "draft" ? "Edit" : "Align"}
                                </Link>
                                {doc.status === "completed" && (
                                    <Link
                                        to={`/viewer/${doc.id}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                                    >
                                        View
                                    </Link>
                                )}
                                <button
                                    disabled={exportingId === doc.id}
                                    onClick={() => onExport(doc)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {exportingId === doc.id ? (
                                        "Exporting..."
                                    ) : (
                                        <Download size={14} />
                                    )}
                                </button>
                                <button
                                    onClick={() => onDelete(doc)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </Td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

/* ==================== Helpers ==================== */

const Stat = ({ title, value }: { title: string; value: number }) => (
    <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
    </div>
);

const Th = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
    <th className={`px-4 py-2 text-sm font-medium ${center ? "text-center" : "text-left"}`}>
        {children}
    </th>
);

const Td = ({
    children,
    center,
    className = "",
}: {
    children: React.ReactNode;
    center?: boolean;
    className?: string;
}) => <td className={`px-4 py-2 ${center ? "text-center" : ""} ${className}`}>{children}</td>;

export default HomePage;
