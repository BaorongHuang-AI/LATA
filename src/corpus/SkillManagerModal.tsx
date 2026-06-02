import React, { useEffect, useState } from "react";
import { Modal, Button, Input, message } from "antd";
import { Plus, Trash2 } from "lucide-react";
import type { CorpusSkill } from "../types/corpus";

interface Props {
  open: boolean;
  onClose: () => void;
  onSkillsChanged: () => void;
}

const emptySkill = {
  name: "",
  system_prompt: "",
  user_prompt_template: "",
};

const SkillManagerModal: React.FC<Props> = ({ open, onClose, onSkillsChanged }) => {
  const [skills, setSkills] = useState<CorpusSkill[]>([]);
  const [selected, setSelected] = useState<CorpusSkill | null>(null);
  const [form, setForm] = useState(emptySkill);
  const [saving, setSaving] = useState(false);

  const loadSkills = async () => {
    try {
      const data = await window.api.getCorpusSkills();
      setSkills(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) {
      loadSkills();
      setSelected(null);
      setForm(emptySkill);
    }
  }, [open]);

  const startCreate = () => {
    setSelected(null);
    setForm(emptySkill);
  };

  const startEdit = (skill: CorpusSkill) => {
    setSelected(skill);
    setForm({
      name: skill.label,
      system_prompt: skill.system_prompt,
      user_prompt_template: skill.user_prompt_template,
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      message.warning("Skill name is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      system_prompt: form.system_prompt,
      user_prompt_template: form.user_prompt_template,
    };

    setSaving(true);
    try {
      if (selected) {
        await window.api.updateCorpusSkill(selected.id, payload);
        message.success("Skill updated.");
      } else {
        await window.api.saveCorpusSkill(payload);
        message.success("Skill created.");
      }
      await loadSkills();
      onSkillsChanged();
      setSelected(null);
      setForm(emptySkill);
    } catch (e) {
      message.error("Failed to save skill.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    Modal.confirm({
      title: "Delete this skill?",
      content: `Are you sure you want to delete "${selected.label}"?`,
      okText: "Delete",
      okButtonProps: { danger: true, style: { backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' } },
      onOk: async () => {
        try {
          await window.api.deleteCorpusSkill(selected.id);
          message.success("Skill deleted.");
          setSelected(null);
          setForm(emptySkill);
          await loadSkills();
          onSkillsChanged();
        } catch (e) {
          message.error("Failed to delete skill.");
          console.error(e);
        }
      },
    });
  };

  return (
    <Modal
      title="Manage Analysis Skills"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <div className="flex gap-4 mt-4" style={{ height: 400 }}>
        {/* Left: Skill list */}
        <div className="w-56 bg-gray-50 rounded border overflow-y-auto shrink-0">
          <div className="p-2 border-b bg-white">
            <Button
              type="dashed"
              block
              icon={<Plus size={14} />}
              onClick={startCreate}
            >
              New Skill
            </Button>
          </div>
          {skills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => startEdit(skill)}
              className={`p-3 cursor-pointer border-b border-gray-100 transition ${
                selected?.id === skill.id
                  ? "bg-blue-50 border-l-2 border-l-blue-500"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="text-sm font-medium truncate">{skill.label}</div>
            </div>
          ))}
          {skills.length === 0 && (
            <div className="p-3 text-xs text-gray-400 text-center">
              No skills yet. Click "New Skill" to create one.
            </div>
          )}
        </div>

        {/* Right: Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Skill Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Statistical Overview"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                System Prompt
              </label>
              <Input.TextArea
                rows={6}
                value={form.system_prompt}
                onChange={(e) =>
                  setForm({ ...form, system_prompt: e.target.value })
                }
                placeholder="You are a corpus linguist..."
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                User Prompt Template
              </label>
              <Input.TextArea
                rows={6}
                value={form.user_prompt_template}
                onChange={(e) =>
                  setForm({ ...form, user_prompt_template: e.target.value })
                }
                placeholder="Use {'{{segments}}'} placeholder for aligned segment data..."
              />
              <p className="text-xs text-gray-400 mt-1">
                Use <code>{'{{segments}}'}</code> as placeholder for aligned
                corpus data. For custom analysis skills, also use{" "}
                <code>{'{{custom_prompt}}'}</code>.
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                style={{
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                  color: '#fff',
                }}
              >
                {selected ? "Update" : "Create"}
              </Button>
              {selected && (
                <Button
                  danger
                  icon={<Trash2 size={14} />}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SkillManagerModal;
