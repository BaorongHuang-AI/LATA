import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Modal, Input, message, Tag, Select } from "antd";
import { Plus, BookOpen, Trash2, Edit3, FolderOpen } from "lucide-react";
import type { TerminologyProject } from "../types/terminology";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft:     { color: "default",  label: "Draft" },
  extracted: { color: "blue",     label: "Extracted" },
  reviewed:  { color: "orange",   label: "Reviewed" },
  completed: { color: "green",    label: "Completed" },
};

const TerminologyProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<(TerminologyProject & { document_count: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<(TerminologyProject & { document_count: number }) | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", source: "", extractor: "", reviewer: "",
  });

  const loadProjects = useCallback(async () => {
    try {
      const data = await window.api.getAllTerminologyProjects();
      setProjects(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const resetForm = () => setForm({ title: "", description: "", source: "", extractor: "", reviewer: "" });

  const handleCreate = async () => {
    if (!form.title.trim()) { message.warning("Project title is required."); return; }
    setLoading(true);
    try {
      await window.api.createTerminologyProject({
        title: form.title.trim(),
        description: form.description,
        source: form.source,
        extractor: form.extractor,
        reviewer: form.reviewer,
      });
      message.success("Project created.");
      setShowCreate(false);
      resetForm();
      loadProjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (e: any) {
      message.error(e.message || "Failed to create project.");
    } finally { setLoading(false); }
  };

  const handleUpdate = async () => {
    if (!editProject || !form.title.trim()) { message.warning("Title required."); return; }
    setLoading(true);
    try {
      await window.api.updateTerminologyProject(editProject.id!, form);
      message.success("Project updated.");
      setEditProject(null);
      resetForm();
      loadProjects();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (e: any) {
      message.error(e.message || "Failed to update.");
    } finally { setLoading(false); }
  };

  const handleDelete = (project: TerminologyProject & { document_count: number }) => {
    Modal.confirm({
      title: "Delete this project?",
      content: `Are you sure you want to delete "${project.title}"? All extractions and terms will be permanently deleted.`,
      okText: "Delete",
      okButtonProps: { danger: true, style: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' } },
      onOk: async () => {
        try {
          await window.api.deleteTerminologyProject(project.id!);
          message.success("Project deleted.");
          loadProjects();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (e: any) { message.error(e.message || "Failed to delete."); }
      },
    });
  };

  const startEdit = (p: TerminologyProject & { document_count: number }) => {
    setEditProject(p);
    setForm({
      title: p.title, description: p.description || "",
      source: p.source || "", extractor: p.extractor || "", reviewer: p.reviewer || "",
    });
  };

  const filtered = statusFilter === "all"
    ? projects
    : projects.filter(p => p.status === statusFilter);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <BookOpen size={20} className="text-emerald-500" />
        <h1 className="text-lg font-bold text-gray-800">Terminology Projects</h1>
        <span className="text-xs text-gray-400 ml-2">
          Manage bilingual terminology extraction projects
        </span>
        <div className="flex-1" />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-32"
          size="small"
          options={[
            { value: "all", label: "All Statuses" },
            ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
          ]}
        />
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => { resetForm(); setShowCreate(true); }}
          style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}
        >
          New Project
        </Button>
      </div>

      {/* Project cards */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No Terminology Projects</p>
              <p className="text-xs mt-1">Create a project to start extracting terms.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition cursor-pointer group"
                onClick={() => navigate(`/terminology/${p.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 truncate flex-1">{p.title}</h3>
                  <div className="flex gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button size="small" type="text" icon={<Edit3 size={12} />} onClick={() => startEdit(p)} />
                    <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => handleDelete(p)} />
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Tag color={STATUS_CONFIG[p.status]?.color || "default"}>
                    {STATUS_CONFIG[p.status]?.label || p.status}
                  </Tag>
                  <Tag icon={<FolderOpen size={10} />} color="blue">
                    {p.document_count || 0} doc{(p.document_count || 0) !== 1 ? "s" : ""}
                  </Tag>
                </div>
                <div className="text-xs text-gray-400 space-y-0.5">
                  {p.source && <div>📄 Source: {p.source}</div>}
                  {p.extractor && <div>🤖 Extractor: {p.extractor}</div>}
                  {p.reviewer && <div>👤 Reviewer: {p.reviewer}</div>}
                  {p.updated_at && (
                    <div className="mt-1">
                      Updated: {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        title={editProject ? "Edit Project" : "New Terminology Project"}
        open={showCreate || !!editProject}
        onCancel={() => { setShowCreate(false); setEditProject(null); resetForm(); }}
        onOk={editProject ? handleUpdate : handleCreate}
        okText={editProject ? "Update" : "Create"}
        okButtonProps={{ style: { backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' } }}
        confirmLoading={loading}
      >
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Project Title *</label>
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., Legal Terminology v1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <Input.TextArea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source</label>
              <Input value={form.source} onChange={e => setForm({...form, source: e.target.value})} placeholder="e.g., UN Treaty" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Extractor</label>
              <Input value={form.extractor} onChange={e => setForm({...form, extractor: e.target.value})} placeholder="e.g., GPT-4o" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Reviewer</label>
              <Input value={form.reviewer} onChange={e => setForm({...form, reviewer: e.target.value})} placeholder="e.g., John Smith" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TerminologyProjectsPage;
