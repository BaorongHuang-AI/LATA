import React, { useState, useCallback } from "react";
import { Input, Checkbox, Button, message } from "antd";
import { Search } from "lucide-react";
import DocumentSelector from "./DocumentSelector";
import MetadataFilterPanel from "./MetadataFilterPanel";
import SearchResults from "./SearchResults";
import type { CorpusSearchFilters, CorpusSearchResult } from "../types/corpus";

const emptyFilters: CorpusSearchFilters = {
  sourceLanguages: [],
  targetLanguages: [],
  domains: [],
  authors: [],
  keywords: [],
};

const CorpusSearchPage: React.FC = () => {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [pattern, setPattern] = useState("");
  const [searchSource, setSearchSource] = useState(true);
  const [searchTarget, setSearchTarget] = useState(true);
  const [filters, setFilters] = useState<CorpusSearchFilters>({ ...emptyFilters });
  const [results, setResults] = useState<CorpusSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSelectionChange = useCallback((ids: Set<number>) => {
    setSelectedDocIds(ids);
    setFilters({ ...emptyFilters });
  }, []);

  const handleSearch = useCallback(async () => {
    if (selectedDocIds.size === 0) {
      message.warning("Please select at least one document to search.");
      return;
    }
    if (!pattern.trim()) {
      message.warning("Please enter a search pattern.");
      return;
    }
    if (!searchSource && !searchTarget) {
      message.warning("Please select at least one of Source or Target to search.");
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const data = await window.api.searchCorpusSegments({
        documentIds: Array.from(selectedDocIds),
        pattern: pattern.trim(),
        searchSource,
        searchTarget,
        filters,
      });
      setResults(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Search failed. Please try again.";
      message.error(msg);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [selectedDocIds, pattern, searchSource, searchTarget, filters]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <Search size={20} className="text-blue-500" />
        <h1 className="text-lg font-bold text-gray-800">Corpus Search</h1>
        <span className="text-xs text-gray-400 ml-2">
          Search aligned bilingual content with regex and filter by document
          metadata
        </span>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: Document Selector + Metadata Filters */}
        <div className="w-80 bg-white border-r shrink-0 flex flex-col">
          {/* Document Selector */}
          <div className="flex-1 min-h-0">
            <DocumentSelector
              selectedIds={selectedDocIds}
              onSelectionChange={handleSelectionChange}
            />
          </div>

          {/* Metadata filters at bottom */}
          <MetadataFilterPanel
            selectedDocIds={selectedDocIds}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Right panel: Search bar + Results */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search bar — fixed at top of right panel */}
          <div className="bg-white border-b px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              {/* Regex input */}
              <div className="flex-1">
                <Input
                  prefix={<Search size={16} className="text-gray-400" />}
                  placeholder="Regex pattern (e.g. committee, enviro.*impact, \bword\b)"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  allowClear
                  onPressEnter={handleSearch}
                  disabled={selectedDocIds.size === 0}
                />
              </div>

              {/* Source / Target toggles */}
              <Checkbox
                checked={searchSource}
                onChange={(e) => setSearchSource(e.target.checked)}
              >
                <span className="text-sm">Source</span>
              </Checkbox>
              <Checkbox
                checked={searchTarget}
                onChange={(e) => setSearchTarget(e.target.checked)}
              >
                <span className="text-sm">Target</span>
              </Checkbox>

              {/* Search button */}
              <Button
                type="primary"
                loading={searching}
                disabled={selectedDocIds.size === 0}
                onClick={handleSearch}
                icon={<Search size={14} />}
                style={{
                  backgroundColor: "#1677ff",
                  borderColor: "#1677ff",
                  color: "#fff",
                }}
              >
                Search
              </Button>
            </div>
          </div>

          {/* Results area */}
          <SearchResults
            results={results}
            loading={searching}
            hasSearched={hasSearched}
            pattern={pattern.trim()}
          />
        </div>
      </div>
    </div>
  );
};

export default CorpusSearchPage;
