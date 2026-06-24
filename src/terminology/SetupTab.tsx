import React, { useState, useEffect, useCallback } from "react";
import { Button, message, Tag, Select } from "antd";
import { Save, X } from "lucide-react";
import DocumentSelector from "../corpus/DocumentSelector";
import type { TerminologySkill, ProjectDocumentInfo } from "../types/terminology";

interface Props {
  projectId: number;
  skills: TerminologySkill[];
  selectedSkillKey: string | null;
  onSkillChange: (key: string) => void;
  onDocumentsChanged: () => void;
}

const SetupTab: React.FC<Props> = ({ projectId, skills, selectedSkillKey, onSkillChange, onDocumentsChanged }) => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [linkedDocs, setLinkedDocs] = useState<ProjectDocumentInfo[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLinkedDocs = useCallback(async () => {
    try {
      const docs = await window.api.getProjectDocuments(projectId);
      setLinkedDocs(docs || []);
      setSelectedDocIds(new Set((docs || []).map((d: ProjectDocumentInfo) => d.id)));
    } catch (e) { console.error(e); }
  }, [projectId]);

  useEffect(() => { loadLinkedDocs(); }, [loadLinkedDocs]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.api.setProjectDocuments(projectId, Array.from(selectedDocIds));
      message.success(`Linked ${selectedDocIds.size} document(s) to project.`);
      loadLinkedDocs();
      onDocumentsChanged();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      message.error(e.message || "Failed to save document selection.");
    } finally { setSaving(false); }
  };

  const handleRemove = async (docId: number) => {
    try {
      await window.api.removeProjectDocument(projectId, docId);
      setSelectedDocIds(prev => { const next = new Set(prev); next.delete(docId); return next; });
      loadLinkedDocs();
      onDocumentsChanged();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message || "Failed to remove document."); }
  };

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Document selector */}
      <div className="w-80 bg-white border-r shrink-0 flex flex-col">
        <DocumentSelector
          selectedIds={selectedDocIds}
          onSelectionChange={setSelectedDocIds}
        />
        <div className="p-3 border-t space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Extraction Skill</label>
            <Select
              value={selectedSkillKey}
              onChange={onSkillChange}
              className="w-full"
              placeholder="Select a skill..."
              options={skills.map(s => ({ value: s.key, label: s.label }))}
            />
          </div>
          <Button
            type="primary"
            block
            icon={<Save size={14} />}
            onClick={handleSave}
            loading={saving}
            disabled={selectedDocIds.size === 0}
            style={{ backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' }}
          >
            Save Document Selection
          </Button>
        </div>
      </div>

      {/* Right: Linked documents */}
      <div className="flex-1 p-4 overflow-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Linked Documents ({linkedDocs.length})
        </h3>
        {linkedDocs.length === 0 ? (
          <p className="text-sm text-gray-400">
            Select documents from the left sidebar and click "Save Document Selection".
          </p>
        ) : (
          <div className="space-y-2">
            {linkedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between bg-white border rounded p-3">
                <div>
                  <div className="font-medium text-gray-700 text-sm">{doc.title}</div>
                  <div className="flex gap-2 mt-1">
                    {doc.source_language && (
                      <Tag color="blue">{doc.source_language}{doc.target_language ? ` → ${doc.target_language}` : ""}</Tag>
                    )}
                    {doc.alignment_count != null && (
                      <Tag color="purple">{doc.alignment_count} segments</Tag>
                    )}
                    <Tag>{doc.status}</Tag>
                  </div>
                </div>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<X size={14} />}
                  onClick={() => handleRemove(doc.id)}
                  title="Remove from project"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupTab;
