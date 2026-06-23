import React from "react";
import { Button, Select, message } from "antd";
import { Play, Settings } from "lucide-react";
import type { TerminologySkill } from "../types/terminology";

interface ExtractionControlsProps {
  selectedCount: number;
  running: boolean;
  skills: TerminologySkill[];
  selectedSkillKey: string | null;
  onSkillChange: (key: string) => void;
  onRun: () => void;
  onManageSkills: () => void;
}

const ExtractionControls: React.FC<ExtractionControlsProps> = ({
  selectedCount,
  running,
  skills,
  selectedSkillKey,
  onSkillChange,
  onRun,
  onManageSkills,
}) => {
  const handleRun = async () => {
    if (selectedCount === 0) {
      message.warning("Please select at least one document.");
      return;
    }

    // Check LLM configuration
    try {
      const models = await window.api.getLLMModels?.();
      if (models && models.length === 0) {
        message.warning("No LLM model configured. Please configure one in LLM Settings.");
        return;
      }
    } catch {
      // If getLLMModels fails, proceed anyway (will show error from backend)
    }

    onRun();
  };

  return (
    <div className="p-3 border-b border-gray-200 space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Extraction Skill</label>
        <Select
          value={selectedSkillKey}
          onChange={onSkillChange}
          className="w-full"
          placeholder="Select a skill..."
          options={skills.map((s) => ({ value: s.key, label: s.label }))}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="primary"
          block
          icon={<Play size={14} />}
          onClick={handleRun}
          loading={running}
          disabled={selectedCount === 0}
          style={{
            backgroundColor: '#1677ff',
            borderColor: '#1677ff',
            color: '#fff',
          }}
        >
          {running ? "Extracting..." : "Extract Terms"}
        </Button>
        <Button
          icon={<Settings size={14} />}
          onClick={onManageSkills}
        >
          Skills
        </Button>
      </div>
      <p className="text-xs text-gray-400">
        {selectedCount === 0
          ? "Select documents on the left to begin."
          : `${selectedCount} document${selectedCount > 1 ? "s" : ""} selected.`}
      </p>
    </div>
  );
};

export default ExtractionControls;
