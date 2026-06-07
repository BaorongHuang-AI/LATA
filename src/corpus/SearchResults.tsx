import React from "react";
import { Spin, Tag } from "antd";
import { Search, FileText } from "lucide-react";
import type { CorpusSearchResult } from "../types/corpus";
import { getDir } from "../utils/LayoutUtils";

interface SearchResultsProps {
  results: CorpusSearchResult[];
  loading: boolean;
  hasSearched: boolean;
  pattern: string;
}

// ---- highlight helpers ----

function highlightMatches(text: string, pattern: string): string {
  const escaped = escapeHtml(text);
  if (!pattern) return escaped;
  try {
    // Validate the regex
    new RegExp(pattern, "i");
    return escaped.replace(
      new RegExp(`(${escapeRegex(pattern)})`, "gi"),
      '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>'
    );
  } catch {
    return escaped;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "green";
  if (confidence >= 0.7) return "orange";
  return "red";
}

// ---- results component ----

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  hasSearched,
  pattern,
}) => {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Spin size="large" />
      </div>
    );
  }

  // No search performed yet
  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
        <Search size={48} className="text-gray-300" />
        <div className="text-sm text-center max-w-sm">
          Select documents in the sidebar, enter a regex pattern above, and
          click <span className="font-semibold text-gray-500">Search</span> to
          find matching aligned segments.
        </div>
      </div>
    );
  }

  // No results
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
        <FileText size={48} className="text-gray-300" />
        <div className="text-sm text-center max-w-sm">
          No matching segments found. Try broadening your regex pattern or
          clearing metadata filters.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Results count */}
      <div className="text-sm text-gray-500 px-1">
        {results.length} match{results.length !== 1 ? "es" : ""}
        {pattern && (
          <span>
            {" "}
            for{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">{pattern}</code>
          </span>
        )}
      </div>

      {results.map((result, idx) => (
        <SearchResultCard key={`${result.alignmentId}-${idx}`} result={result} pattern={pattern} />
      ))}
    </div>
  );
};

// ---- individual result card (extracted for clarity) ----

const SearchResultCard: React.FC<{ result: CorpusSearchResult; pattern: string }> = ({
  result,
  pattern,
}) => {
  const sourceDir = getDir(result.sourceLanguage);
  const targetDir = getDir(result.targetLanguage);
  const sourceIsRTL = sourceDir === "rtl";
  const targetIsRTL = targetDir === "rtl";

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Document header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <FileText size={14} className="text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-800 truncate">
          {result.documentTitle}
        </span>
        {result.projectTitle && (
          <span className="text-xs text-gray-400 truncate">
            · {result.projectTitle}
          </span>
        )}
      </div>

      {/* Source text */}
      <div className="px-4 py-3 border-l-2 border-l-blue-400 bg-blue-50/30">
        <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide mb-1">
          Source
          {result.sourceLanguage && (
            <span className="ml-1 font-normal normal-case">
              ({result.sourceLanguage.toUpperCase()})
            </span>
          )}
        </div>
        <div
          className={`text-sm text-gray-800 leading-relaxed whitespace-pre-wrap ${
            sourceIsRTL ? "font-arabic" : ""
          }`}
          style={{
            direction: sourceDir,
            textAlign: sourceIsRTL ? "right" : "left",
          }}
          dangerouslySetInnerHTML={{
            __html: highlightMatches(result.sourceText, pattern),
          }}
        />
      </div>

      {/* Target text */}
      <div className="px-4 py-3 border-l-2 border-l-green-400 bg-green-50/30">
        <div className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">
          Target
          {result.targetLanguage && (
            <span className="ml-1 font-normal normal-case">
              ({result.targetLanguage.toUpperCase()})
            </span>
          )}
        </div>
        <div
          className={`text-sm text-gray-800 leading-relaxed whitespace-pre-wrap ${
            targetIsRTL ? "font-arabic" : ""
          }`}
          style={{
            direction: targetDir,
            textAlign: targetIsRTL ? "right" : "left",
          }}
          dangerouslySetInnerHTML={{
            __html: highlightMatches(result.targetText, pattern),
          }}
        />
      </div>

      {/* Metadata tags */}
      <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1.5 items-center">
        {/* Language pair */}
        {result.sourceLanguage && result.targetLanguage && (
          <Tag color="blue" className="text-[10px] leading-tight">
            {result.sourceLanguage.toUpperCase()} →{" "}
            {result.targetLanguage.toUpperCase()}
          </Tag>
        )}

        {/* Confidence */}
        {result.confidence != null && (
          <Tag
            color={getConfidenceColor(result.confidence)}
            className="text-[10px] leading-tight"
          >
            conf: {result.confidence.toFixed(2)}
          </Tag>
        )}

        {/* Strategy */}
        {result.strategy && (
          <Tag color="purple" className="text-[10px] leading-tight">
            {result.strategy}
          </Tag>
        )}

        {/* Domains */}
        {result.sourceDomain && (
          <Tag color="cyan" className="text-[10px] leading-tight">
            {result.sourceDomain}
          </Tag>
        )}
        {result.targetDomain &&
          result.targetDomain !== result.sourceDomain && (
            <Tag color="cyan" className="text-[10px] leading-tight">
              {result.targetDomain}
            </Tag>
          )}

        {/* Authors */}
        {result.sourceAuthors.slice(0, 3).map((author) => (
          <Tag key={`sa-${author}`} color="geekblue" className="text-[10px] leading-tight">
            {author}
          </Tag>
        ))}
        {result.targetAuthors
          .filter((a) => !result.sourceAuthors.includes(a))
          .slice(0, 3)
          .map((author) => (
            <Tag key={`ta-${author}`} color="geekblue" className="text-[10px] leading-tight">
              {author}
            </Tag>
          ))}
        {(result.sourceAuthors.length > 3 ||
          result.targetAuthors.filter((a) => !result.sourceAuthors.includes(a))
            .length > 3) && (
          <span className="text-[10px] text-gray-400">+more</span>
        )}

        {/* Keywords */}
        {result.sourceKeywords.slice(0, 4).map((kw) => (
          <Tag key={`sk-${kw}`} color="gold" className="text-[10px] leading-tight">
            #{kw}
          </Tag>
        ))}
        {result.targetKeywords
          .filter((k) => !result.sourceKeywords.includes(k))
          .slice(0, 4)
          .map((kw) => (
            <Tag key={`tk-${kw}`} color="gold" className="text-[10px] leading-tight">
              #{kw}
            </Tag>
          ))}
      </div>
    </div>
  );
};

export default SearchResults;
