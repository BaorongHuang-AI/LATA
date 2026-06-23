import React, { useState, useRef } from "react";
import { Table, Input, Select, Button, Popconfirm, message, Tag, Tooltip } from "antd";
import { Plus, Trash2, Link2 } from "lucide-react";
import type { ColumnsType } from "antd/es/table";
import type { TerminologyTerm } from "../types/terminology";

const DOMAIN_OPTIONS = [
  { value: "general", label: "General" },
  { value: "legal", label: "Legal" },
  { value: "medical", label: "Medical" },
  { value: "technical", label: "Technical" },
  { value: "financial", label: "Financial" },
  { value: "academic", label: "Academic" },
  { value: "literary", label: "Literary" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

interface TermTableProps {
  terms: TerminologyTerm[];
  extractionId: number;
  onTermsChanged: () => void;
  onTermSelect: (term: TerminologyTerm | null) => void;
  selectedTermId: number | null;
}

const TermTable: React.FC<TermTableProps> = ({
  terms,
  extractionId,
  onTermsChanged,
  onTermSelect,
  selectedTermId,
}) => {
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTerm, setNewTerm] = useState({
    source_term: "",
    target_term: "",
    domain: "general",
    priority: "medium" as 'high' | 'medium' | 'low',
    context_source: "",
    context_target: "",
  });

  // Track edited values per term during editing
  const editCache = useRef<Map<number, Partial<TerminologyTerm>>>(new Map());

  const isEditing = (record: TerminologyTerm) => record.id === editingKey;

  const startEdit = (record: TerminologyTerm) => {
    setEditingKey(record.id!);
    if (!editCache.current.has(record.id!)) {
      editCache.current.set(record.id!, {});
    }
  };

  const cancelEdit = () => {
    setEditingKey(null);
    editCache.current.clear();
  };

  const saveEdit = async (id: number) => {
    const changes = editCache.current.get(id);
    if (!changes || Object.keys(changes).length === 0) {
      cancelEdit();
      return;
    }

    try {
      await window.api.updateTerminologyTerm(id, changes);
      message.success("Term updated.");
      cancelEdit();
      onTermsChanged();
    } catch (e) {
      message.error("Failed to update term.");
      console.error(e);
    }
  };

  const handleFieldChange = (id: number, field: string, value: string) => {
    const cache = editCache.current.get(id) || {};
    (cache as Record<string, unknown>)[field] = value;
    editCache.current.set(id, cache);
  };

  const handleDelete = async (id: number) => {
    try {
      await window.api.deleteTerminologyTerm(id);
      message.success("Term deleted.");
      onTermsChanged();
    } catch (e) {
      message.error("Failed to delete term.");
      console.error(e);
    }
  };

  const handleAddNew = async () => {
    if (!newTerm.source_term.trim() || !newTerm.target_term.trim()) {
      message.warning("Both source and target terms are required.");
      return;
    }

    try {
      await window.api.addTerminologyTerm(extractionId, newTerm);
      message.success("Term added.");
      setNewTerm({
        source_term: "",
        target_term: "",
        domain: "general",
        priority: "medium",
        context_source: "",
        context_target: "",
      });
      setAddingNew(false);
      onTermsChanged();
    } catch (e) {
      message.error("Failed to add term.");
      console.error(e);
    }
  };

  const renderEditableCell = (
    value: string | undefined,
    record: TerminologyTerm,
    field: string,
    inputType: "text" | "select" = "text",
    options?: { value: string; label: string }[],
  ) => {
    if (isEditing(record)) {
      const cache = editCache.current.get(record.id!) || {};
      const currentValue = (cache[field as keyof TerminologyTerm] as string) ?? value ?? "";

      if (inputType === "select" && options) {
        return (
          <Select
            value={currentValue}
            onChange={(v) => handleFieldChange(record.id!, field, v)}
            onBlur={() => saveEdit(record.id!)}
            className="w-full"
            autoFocus
            options={options}
            style={{ minWidth: 100 }}
          />
        );
      }

      return (
        <Input
          value={currentValue}
          onChange={(e) => handleFieldChange(record.id!, field, e.target.value)}
          onBlur={() => saveEdit(record.id!)}
          onPressEnter={() => saveEdit(record.id!)}
          autoFocus
          size="small"
        />
      );
    }

    return (
      <div
        onClick={() => startEdit(record)}
        className="cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded min-h-[24px]"
        title="Click to edit"
      >
        {value || <span className="text-gray-300 italic">-</span>}
      </div>
    );
  };

  const priorityColor = (p?: string) => {
    switch (p) {
      case "high": return "red";
      case "medium": return "orange";
      case "low": return "green";
      default: return "default";
    }
  };

  const columns: ColumnsType<TerminologyTerm> = [
    {
      title: "Source Term",
      dataIndex: "source_term",
      key: "source_term",
      width: 160,
      render: (val: string, record: TerminologyTerm) => renderEditableCell(val, record, "source_term"),
    },
    {
      title: "Target Term",
      dataIndex: "target_term",
      key: "target_term",
      width: 160,
      render: (val: string, record: TerminologyTerm) => renderEditableCell(val, record, "target_term"),
    },
    {
      title: "Domain",
      dataIndex: "domain",
      key: "domain",
      width: 120,
      render: (val: string, record: TerminologyTerm) =>
        renderEditableCell(val, record, "domain", "select", DOMAIN_OPTIONS),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (val: string, record: TerminologyTerm) => {
        if (isEditing(record)) {
          return renderEditableCell(val, record, "priority", "select", PRIORITY_OPTIONS);
        }
        return (
          <div
            onClick={() => startEdit(record)}
            className="cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
          >
            <Tag color={priorityColor(val)}>{val || "-"}</Tag>
          </div>
        );
      },
    },
    {
      title: "Context (Source)",
      dataIndex: "context_source",
      key: "context_source",
      width: 200,
      ellipsis: true,
      render: (val: string, record: TerminologyTerm) => {
        if (isEditing(record)) {
          return renderEditableCell(val, record, "context_source");
        }
        return (
          <Tooltip title={val} placement="topLeft">
            <div
              onClick={() => startEdit(record)}
              className="cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded truncate max-w-[180px]"
            >
              {val || <span className="text-gray-300 italic">-</span>}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Context (Target)",
      dataIndex: "context_target",
      key: "context_target",
      width: 200,
      ellipsis: true,
      render: (val: string, record: TerminologyTerm) => {
        if (isEditing(record)) {
          return renderEditableCell(val, record, "context_target");
        }
        return (
          <Tooltip title={val} placement="topLeft">
            <div
              onClick={() => startEdit(record)}
              className="cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded truncate max-w-[180px]"
            >
              {val || <span className="text-gray-300 italic">-</span>}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_, record: TerminologyTerm) => (
        <div className="flex items-center gap-1">
          {record.variant_group && (
            <Tooltip title={`Variant group: ${record.variant_group}`}>
              <Link2 size={12} className="text-blue-400" />
            </Tooltip>
          )}
          {record.is_llm_generated === 0 && (
            <Tag color="blue" className="text-[10px] leading-none px-1 py-0">
              manual
            </Tag>
          )}
          <Popconfirm
            title="Delete this term?"
            onConfirm={() => handleDelete(record.id!)}
            okText="Delete"
            okButtonProps={{ danger: true, style: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' } }}
          >
            <Button size="small" type="text" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <Table
          columns={columns}
          dataSource={terms}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: "calc(100vh - 420px)" }}
          onRow={(record) => ({
            onClick: () => onTermSelect(selectedTermId === record.id ? null : record),
            className: selectedTermId === record.id ? "bg-blue-50" : "",
            style: { cursor: "pointer" },
          })}
          locale={{ emptyText: "No terms extracted yet. Click 'Extract Terms' to begin." }}
        />
      </div>

      {/* Add new term row */}
      <div className="border-t border-gray-200 p-2 bg-gray-50">
        {addingNew ? (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-gray-400 block">Source Term*</label>
              <Input
                size="small"
                value={newTerm.source_term}
                onChange={(e) => setNewTerm({ ...newTerm, source_term: e.target.value })}
                placeholder="Source term"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-gray-400 block">Target Term*</label>
              <Input
                size="small"
                value={newTerm.target_term}
                onChange={(e) => setNewTerm({ ...newTerm, target_term: e.target.value })}
                placeholder="Target term"
              />
            </div>
            <div style={{ width: 110 }}>
              <label className="text-[10px] text-gray-400 block">Domain</label>
              <Select
                size="small"
                value={newTerm.domain}
                onChange={(v) => setNewTerm({ ...newTerm, domain: v })}
                className="w-full"
                options={DOMAIN_OPTIONS}
              />
            </div>
            <div style={{ width: 100 }}>
              <label className="text-[10px] text-gray-400 block">Priority</label>
              <Select
                size="small"
                value={newTerm.priority}
                onChange={(v) => setNewTerm({ ...newTerm, priority: v as 'high' | 'medium' | 'low' })}
                className="w-full"
                options={PRIORITY_OPTIONS}
              />
            </div>
            <div className="flex gap-1 items-end" style={{ paddingBottom: 0 }}>
              <Button
                size="small"
                type="primary"
                onClick={handleAddNew}
                style={{
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  color: '#fff',
                }}
              >
                Save
              </Button>
              <Button size="small" onClick={() => setAddingNew(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="dashed"
            block
            icon={<Plus size={14} />}
            onClick={() => setAddingNew(true)}
          >
            Add Term
          </Button>
        )}
      </div>
    </div>
  );
};

export default TermTable;
