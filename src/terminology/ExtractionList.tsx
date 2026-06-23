import React from "react";
import { Clock, FileText } from "lucide-react";
import type { TerminologyExtraction } from "../types/terminology";

interface ExtractionListProps {
  extractions: TerminologyExtraction[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString();
  } catch {
    return dateStr;
  }
}

function parseDocCount(docIdsJson: string): number {
  try {
    const arr = JSON.parse(docIdsJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

const ExtractionList: React.FC<ExtractionListProps> = ({
  extractions,
  selectedId,
  onSelect,
}) => {
  if (extractions.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-400 text-center border-t border-gray-200">
        No past extractions.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">
        Past Extractions
      </div>
      <div className="overflow-y-auto max-h-48">
        {extractions.map((ex) => (
          <div
            key={ex.id}
            onClick={() => onSelect(ex.id!)}
            className={`px-3 py-2 cursor-pointer border-b border-gray-100 transition ${
              selectedId === ex.id
                ? "bg-blue-50 border-l-2 border-l-blue-500"
                : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-600 truncate">
                {formatDate(ex.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">
                {parseDocCount(ex.document_ids)} doc{parseDocCount(ex.document_ids) !== 1 ? "s" : ""}
              </span>
              {ex.model_name && (
                <span className="text-xs text-gray-400 ml-auto truncate">
                  {ex.model_name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtractionList;
