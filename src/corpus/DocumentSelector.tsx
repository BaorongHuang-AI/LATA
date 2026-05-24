import React, { useEffect, useState, useCallback } from "react";
import { Checkbox, Input, Spin, Tag } from "antd";
import { Search } from "lucide-react";
import type { AlignedDocument } from "../types/corpus";

interface DocumentSelectorProps {
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

const DocumentSelector: React.FC<DocumentSelectorProps> = ({ selectedIds, onSelectionChange }) => {
  const [documents, setDocuments] = useState<AlignedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.api.getAlignedDocuments();
      setDocuments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filtered = documents.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.project_title && d.project_title.toLowerCase().includes(q)) ||
      (d.source_language && d.source_language.toLowerCase().includes(q)) ||
      (d.target_language && d.target_language.toLowerCase().includes(q))
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const noneSelected = filtered.length === 0 || filtered.every((d) => !selectedIds.has(d.id));

  const handleToggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) {
      filtered.forEach((d) => next.delete(d.id));
    } else {
      filtered.forEach((d) => next.add(d.id));
    }
    onSelectionChange(next);
  };

  const handleToggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Input
          prefix={<Search size={14} className="text-gray-400" />}
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          allowClear
        />
        <div className="flex items-center justify-between text-xs text-gray-500">
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && !noneSelected}
            onChange={handleToggleAll}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Checkbox>
          <span>
            {selectedIds.size} of {documents.length} selected
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm px-4">
            {search.trim()
              ? "No documents match your search."
              : "No aligned documents found. Align some documents first."}
          </div>
        ) : (
          filtered.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            return (
              <label
                key={doc.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${
                  isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggle(doc.id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {doc.title}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {doc.source_language && doc.target_language && (
                      <Tag className="text-[10px] leading-tight" color="blue">
                        {doc.source_language.toUpperCase()} &rarr; {doc.target_language.toUpperCase()}
                      </Tag>
                    )}
                    <Tag className="text-[10px] leading-tight" color="green">
                      {doc.alignment_count} segment{doc.alignment_count !== 1 ? "s" : ""}
                    </Tag>
                  </div>
                  {doc.project_title && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {doc.project_title}
                    </div>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentSelector;
