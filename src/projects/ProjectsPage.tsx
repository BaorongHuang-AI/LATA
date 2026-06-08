import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import { FolderOpen, Plus, Edit2, Trash2, Download, FileText, Settings, ChevronRight, Loader2, FileSpreadsheet } from 'lucide-react';
import type { ProjectWithMetadata, ProjectDocument } from '../types/project';
import CreateProjectModal from './CreateProjectModal';
import ProjectMetadataPanel from './ProjectMetadataPanel';

const ProjectsPage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<ProjectWithMetadata[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectWithMetadata | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showMetadataModal, setShowMetadataModal] = useState(false);
    const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
    const [exportingProjectId, setExportingProjectId] = useState<number | null>(null);
    const [exportingProjectExcelId, setExportingProjectExcelId] = useState<number | null>(null);

    const loadProjects = async () => {
        try {
            const data = await window.api.getAllProjectsWithMetadata();
            setProjects(data);
        } catch (error) {
            console.error('Failed to load projects:', error);
            message.error('Failed to load projects');
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleCreateProject = async (data: any) => {
        try {
            await window.api.saveProjectWithMetadata(data);
            message.success('Project created successfully');
            setShowCreateModal(false);
            loadProjects();
        } catch (error) {
            console.error('Failed to create project:', error);
            message.error('Failed to create project');
        }
    };

    const handleEditProject = async (data: any) => {
        if (!selectedProject?.id) return;
        try {
            await window.api.updateProjectWithMetadata(selectedProject.id, data);
            message.success('Project updated successfully');
            setShowEditModal(false);
            loadProjects();
        } catch (error) {
            console.error('Failed to update project:', error);
            message.error('Failed to update project');
        }
    };

    const handleDeleteProject = (project: ProjectWithMetadata) => {
        Modal.confirm({
            title: 'Delete Project',
            content: (
                <div>
                    <p>Are you sure you want to delete "{project.title}"?</p>
                    {project.document_count && project.document_count > 0 && (
                        <p className="text-red-500 mt-2">
                            This will also delete {project.document_count} document{project.document_count > 1 ? 's' : ''} in this project.
                            This action cannot be undone.
                        </p>
                    )}
                </div>
            ),
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await window.api.deleteProject(project.id!);
                    message.success('Project deleted');
                    loadProjects();
                } catch (error) {
                    console.error('Failed to delete project:', error);
                    message.error('Failed to delete project');
                }
            },
        });
    };

    const handleMetadata = (project: ProjectWithMetadata) => {
        setSelectedProject(project);
        setShowMetadataModal(true);
    };

    const handleEdit = (project: ProjectWithMetadata) => {
        setSelectedProject(project);
        setShowEditModal(true);
    };

    const handleNewDocument = (project: ProjectWithMetadata) => {
        if (!project.id) return;
        navigate("/docalign", { state: { projectId: project.id } });
    };

    const toggleExpanded = (projectId: number) => {
        const newExpanded = new Set(expandedProjects);
        if (newExpanded.has(projectId)) {
            newExpanded.delete(projectId);
        } else {
            newExpanded.add(projectId);
        }
        setExpandedProjects(newExpanded);
    };

    const getDocTypeFromStatus = (status: string): "doc" | "para" | "sent" => {
        if (!status) return "doc";
        if (status.startsWith("pending-")) {
            return status.replace("pending-", "") as "doc" | "para" | "sent";
        }
        return "doc";
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
                    // Skip documents that fail
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

    const handleExportProjectExcel = async (project: ProjectWithMetadata) => {
        if (!project.id) return;
        setExportingProjectExcelId(project.id);
        try {
            const result = await window.api.exportProject(project.id);
            if (!result.success || !result.documents?.length) {
                message.warning("No documents to export in this project");
                return;
            }

            const excelDocs: Array<{
                sourceMeta: Record<string, unknown>;
                targetMeta: Record<string, unknown>;
                sourceLines: Array<{ id: string; text: string }>;
                targetLines: Array<{ id: string; text: string }>;
                links: Array<{ sourceIds: string[]; targetIds: string[]; confidence?: number; strategy?: string }>;
                documentTitle?: string;
            }> = [];

            for (const doc of result.documents) {
                try {
                    const docType = getDocTypeFromStatus(doc.status);
                    const state = await window.api.getAlignmentState(doc.id, docType);
                    if (state) {
                        excelDocs.push({
                            sourceMeta: state.sourceMeta,
                            targetMeta: state.targetMeta,
                            sourceLines: state.sourceLines,
                            targetLines: state.targetLines,
                            links: state.links,
                            documentTitle: doc.title,
                        });
                    }
                } catch {
                    // Skip documents that fail
                }
            }

            if (excelDocs.length === 0) {
                message.warning("No exportable documents found");
                return;
            }

            const saveResult = await window.api.saveProjectExcel({
                projectTitle: project.title,
                documents: excelDocs,
            });

            if (saveResult.success) {
                message.success(`Project "${project.title}" exported to Excel successfully`);
            }
        } catch (e) {
            console.error("Failed to export project to Excel:", e);
            message.error("Failed to export project to Excel");
        } finally {
            setExportingProjectExcelId(null);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Projects</h1>
                    <p className="text-gray-500">Organize your alignment documents</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    <Plus size={18} />
                    New Project
                </button>
            </div>

            {/* Projects List */}
            <div className="space-y-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                    >
                        {/* Project Header */}
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <div
                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                    onClick={() => toggleExpanded(project.id!)}
                                >
                                    <FolderOpen className="text-blue-600" size={24} />
                                    <div className="flex-1">
                                        <h2 className="text-lg font-semibold">{project.title}</h2>
                                        {project.description && (
                                            <p className="text-sm text-gray-500">{project.description}</p>
                                        )}
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className={`text-gray-400 transition-transform ${
                                            expandedProjects.has(project.id!) ? 'rotate-90' : ''
                                        }`}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                                        {project.document_count || 0} docs
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                        project.status === 'active'
                                            ? 'bg-green-100 text-green-700'
                                            : project.status === 'archived'
                                            ? 'bg-gray-100 text-gray-700'
                                            : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {project.status || 'active'}
                                    </span>
                                </div>
                            </div>

                            {/* Project metadata preview */}
                            {project.metadata && (
                                <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-600">
                                    {project.metadata.source_language && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                            🌐 {project.metadata.source_language}
                                        </span>
                                    )}
                                    {project.metadata.target_language && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                            {project.metadata.source_language || ''} → {project.metadata.target_language}
                                        </span>
                                    )}
                                    {project.metadata.domain && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                            📚 {project.metadata.domain}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Project Actions */}
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={() => handleNewDocument(project)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                                title="Create New Document in Project"
                            >
                                <FileText size={14} />
                                New Document
                            </button>
                            {exportingProjectId === project.id ? (
                                <button
                                    disabled
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-green-50 text-green-600"
                                >
                                    <Loader2 size={14} className="animate-spin" />
                                    Zip...
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleExportProject(project)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-green-50 text-green-600 hover:bg-green-100"
                                    title="Export project as ZIP"
                                >
                                    <Download size={14} />
                                    Zip
                                </button>
                            )}
                            {exportingProjectExcelId === project.id ? (
                                <button
                                    disabled
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-emerald-50 text-emerald-600"
                                >
                                    <Loader2 size={14} className="animate-spin" />
                                    Excel...
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleExportProjectExcel(project)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    title="Export project to Excel"
                                >
                                    <FileSpreadsheet size={14} />
                                    Excel
                                </button>
                            )}
                            <button
                                onClick={() => handleMetadata(project)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-white border hover:bg-gray-50"
                                title="Edit Metadata"
                            >
                                <Settings size={14} />
                                Metadata
                            </button>
                            <button
                                onClick={() => handleEdit(project)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-white border hover:bg-gray-50"
                                title="Edit Project"
                            >
                                <Edit2 size={14} />
                                Edit
                            </button>
                            <button
                                onClick={() => handleDeleteProject(project)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-red-50 text-red-600 hover:bg-red-100"
                                title="Delete Project"
                            >
                                <Trash2 size={14} />
                                Delete
                            </button>
                        </div>

                        {/* Documents List (Expandable) */}
                        {expandedProjects.has(project.id!) && (
                            <div className="p-4">
                                <ProjectDocumentsList
                                    projectId={project.id!}
                                    onDocumentChange={loadProjects}
                                    project={project}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-lg mb-2">No projects yet</p>
                        <p className="text-sm mb-4">Create your first project to start organizing documents</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            <Plus size={18} />
                            Create Project
                        </button>
                    </div>
                )}
            </div>

            {/* Modals */}
            <CreateProjectModal
                visible={showCreateModal}
                onCancel={() => setShowCreateModal(false)}
                onSave={handleCreateProject}
            />
            <CreateProjectModal
                visible={showEditModal}
                project={selectedProject}
                onCancel={() => setShowEditModal(false)}
                onSave={handleEditProject}
                title="Edit Project"
            />
            <ProjectMetadataPanel
                visible={showMetadataModal}
                project={selectedProject}
                onCancel={() => setShowMetadataModal(false)}
                onSave={async (data) => {
                    if (selectedProject?.id) {
                        await window.api.upsertProjectMetadata({
                            ...data,
                            project_id: selectedProject.id
                        });
                        message.success('Metadata updated');
                        setShowMetadataModal(false);
                        loadProjects();
                    }
                }}
            />
        </div>
    );
};

interface ProjectDocumentsListProps {
    projectId: number;
    onDocumentChange: () => void;
    project: ProjectWithMetadata;
}

const ProjectDocumentsList = ({ projectId, onDocumentChange, project }: ProjectDocumentsListProps) => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<ProjectDocument[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadDocuments();
    }, [projectId]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const data = await window.api.getProjectDocuments(projectId);
            setDocuments(data);
        } catch (error) {
            console.error('Failed to load documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDocTypeFromStatus = (status: string): "doc" | "para" | "sent" => {
        if (!status) return "doc";
        if (status.startsWith("pending-")) {
            return status.replace("pending-", "") as "doc" | "para" | "sent";
        }
        return "doc";
    };

    const alignPathByStatus = {
        "pending-doc": (id) => `/docalign/${id}`,
        "pending-para": (id) => `/alignpara/${id}`,
        "pending-sent": (id) => `/alignsent/${id}`,
        "review": (id) => `/alignsent/${id}`,
        "completed": (id) => `/alignsent/${id}`,
    };

    if (loading) {
        return <div className="text-center py-4 text-gray-500">Loading documents...</div>;
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-6 text-gray-500">
                <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                <p>No documents in this project</p>
                {project.metadata && project.metadata.source_language && project.metadata.target_language && (
                    <button
                        onClick={() => navigate("/docalign", { state: { projectId } })}
                        className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                    >
                        <Plus size={14} />
                        Create First Document
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {documents.map((doc) => (
                <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
                >
                    <div className="flex items-center gap-3 flex-1">
                        <FileText size={18} className="text-gray-500" />
                        <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-gray-500">
                                {doc.source_language || '?'} → {doc.target_language || '?'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mr-4">
                        <span>1→1: {doc.one_to_one || 0}</span>
                        <span>1→N: {doc.one_to_many || 0}</span>
                        <span>N→1: {doc.many_to_one || 0}</span>
                        <span>N→N: {doc.many_to_many || 0}</span>
                    </div>
                    <Link
                        to={(alignPathByStatus[doc.status] || alignPathByStatus["pending-doc"])(doc.id)}
                        className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {doc.status === "draft" ? "Edit" : doc.status === "completed" ? "Review" : "Open"}
                    </Link>
                </div>
            ))}
        </div>
    );
};

export default ProjectsPage;
