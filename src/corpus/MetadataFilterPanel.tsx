import React, { useEffect, useState } from "react";
import { Select, Spin } from "antd";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import type { CorpusSearchFilters, CorpusMetadataOptions } from "../types/corpus";

interface MetadataFilterPanelProps {
  selectedDocIds: Set<number>;
  filters: CorpusSearchFilters;
  onFiltersChange: (filters: CorpusSearchFilters) => void;
}

const emptyFilters: CorpusSearchFilters = {
  sourceLanguages: [],
  targetLanguages: [],
  domains: [],
  authors: [],
  keywords: [],
};

const MetadataFilterPanel: React.FC<MetadataFilterPanelProps> = ({
  selectedDocIds,
  filters,
  onFiltersChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [options, setOptions] = useState<CorpusMetadataOptions | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = Array.from(selectedDocIds);
    if (ids.length === 0) {
      setOptions(null);
      return;
    }

    setLoading(true);
    window.api
      .getCorpusMetadataOptions(ids)
      .then((data) => setOptions(data))
      .catch(() => setOptions(null))
      .finally(() => setLoading(false));
  }, [selectedDocIds]);

  const hasActiveFilters =
    filters.sourceLanguages.length > 0 ||
    filters.targetLanguages.length > 0 ||
    filters.domains.length > 0 ||
    filters.authors.length > 0 ||
    filters.keywords.length > 0;

  const clearAll = () => onFiltersChange({ ...emptyFilters });

  const selectStyle = { width: "100%" };

  return (
    <div className="border-t border-gray-200">
      {/* Collapsible header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <Filter size={12} />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {filters.sourceLanguages.length +
                filters.targetLanguages.length +
                filters.domains.length +
                filters.authors.length +
                filters.keywords.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-2">
              <Spin size="small" />
            </div>
          )}

          {!loading && !options && selectedDocIds.size === 0 && (
            <div className="text-xs text-gray-400 py-2 text-center">
              Select documents to see filter options
            </div>
          )}

          {!loading && options && (
            <>
              {/* Source Language */}
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 font-medium uppercase">
                  Source Language
                </div>
                <Select
                  mode="multiple"
                  size="small"
                  style={selectStyle}
                  placeholder="Any"
                  value={filters.sourceLanguages}
                  onChange={(vals) =>
                    onFiltersChange({ ...filters, sourceLanguages: vals })
                  }
                  options={options.sourceLanguages.map((l) => ({
                    value: l,
                    label: l.toUpperCase(),
                  }))}
                  maxTagCount={2}
                  allowClear
                />
              </div>

              {/* Target Language */}
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 font-medium uppercase">
                  Target Language
                </div>
                <Select
                  mode="multiple"
                  size="small"
                  style={selectStyle}
                  placeholder="Any"
                  value={filters.targetLanguages}
                  onChange={(vals) =>
                    onFiltersChange({ ...filters, targetLanguages: vals })
                  }
                  options={options.targetLanguages.map((l) => ({
                    value: l,
                    label: l.toUpperCase(),
                  }))}
                  maxTagCount={2}
                  allowClear
                />
              </div>

              {/* Domain */}
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 font-medium uppercase">
                  Domain
                </div>
                <Select
                  mode="multiple"
                  size="small"
                  style={selectStyle}
                  placeholder="Any"
                  value={filters.domains}
                  onChange={(vals) =>
                    onFiltersChange({ ...filters, domains: vals })
                  }
                  options={options.domains.map((d) => ({
                    value: d,
                    label: d,
                  }))}
                  maxTagCount={2}
                  allowClear
                />
              </div>

              {/* Author */}
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 font-medium uppercase">
                  Author
                </div>
                <Select
                  mode="multiple"
                  size="small"
                  style={selectStyle}
                  placeholder="Any"
                  value={filters.authors}
                  onChange={(vals) =>
                    onFiltersChange({ ...filters, authors: vals })
                  }
                  options={options.authors.map((a) => ({
                    value: a,
                    label: a,
                  }))}
                  maxTagCount={2}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </div>

              {/* Keyword */}
              <div>
                <div className="text-[10px] text-gray-400 mb-0.5 font-medium uppercase">
                  Keyword
                </div>
                <Select
                  mode="multiple"
                  size="small"
                  style={selectStyle}
                  placeholder="Any"
                  value={filters.keywords}
                  onChange={(vals) =>
                    onFiltersChange({ ...filters, keywords: vals })
                  }
                  options={options.keywords.map((k) => ({
                    value: k,
                    label: `#${k}`,
                  }))}
                  maxTagCount={2}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </div>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition mt-1"
                  onClick={clearAll}
                >
                  <X size={12} />
                  Clear All Filters
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MetadataFilterPanel;
