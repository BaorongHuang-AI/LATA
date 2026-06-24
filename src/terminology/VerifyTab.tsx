import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button, Select, Input, message, Tag, Checkbox, Tooltip } from "antd";
import { Check, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getDir } from "../utils/LayoutUtils";
import type { TerminologyTerm, ProjectDocumentInfo } from "../types/terminology";

interface AlignedSegment {
  index: number;
  source_text: string;
  target_text: string;
}

interface Props {
  projectId: number;
  onTermsChanged?: () => void;
}

// ---- text highlighting ----
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTerms(
  text: string,
  allTerms: string[],
  selectedTermText: string | null,
  selectedSourceTerm: string | null,
): string {
  const escaped = escapeHtml(text);
  if (allTerms.length === 0) return escaped;

  // Sort by length descending so longer terms match before shorter ones
  // (e.g. "الكتاب" before "كتاب", "subcontract" before "contract")
  const sorted = [...new Set(allTerms)].sort((a, b) => b.length - a.length);

  // Build patterns separately: ones that can use \b (Latin scripts) and ones that can't (Arabic, CJK, etc.)
  // \b word boundary only works for \w = [a-zA-Z0-9_], so Arabic/Chinese/etc. terms are invisible to it.
  const latinTerms = sorted.filter(t => /^[a-zA-Z0-9_\s-]+$/.test(t));
  const nonLatinTerms = sorted.filter(t => !/^[a-zA-Z0-9_\s-]+$/.test(t));

  const patterns: string[] = [];
  if (latinTerms.length > 0) {
    patterns.push(`\\b(${latinTerms.map(t => escapeRegex(t)).join('|')})\\b`);
  }
  if (nonLatinTerms.length > 0) {
    // For non-Latin scripts: match anywhere (no \b — it doesn't work for Arabic/CJK)
    patterns.push(`(${nonLatinTerms.map(t => escapeRegex(t)).join('|')})`);
  }

  if (patterns.length === 0) return escaped;

  try {
    return escaped.replace(
      new RegExp(patterns.join('|'), 'gi'),
      (match) => {
        const lower = match.toLowerCase();
        const isSelected = (selectedTermText && lower === selectedTermText.toLowerCase()) ||
                           (selectedSourceTerm && lower === selectedSourceTerm.toLowerCase());
        const cssClass = isSelected
          ? 'bg-yellow-300 ring-1 ring-yellow-400'
          : 'bg-amber-100';
        const escapedMatch = escapeHtml(match);
        return `<mark class="${cssClass} rounded px-0.5 cursor-pointer" data-term="${lower}">${escapedMatch}</mark>`;
      }
    );
  } catch {
    return escaped;
  }
}

const DOMAINS = ["general","legal","medical","technical","financial","academic","literary","other"];
const PRIORITIES = ["high","medium","low"];

const VerifyTab: React.FC<Props> = ({ projectId, onTermsChanged }) => {
  // ---- state ----
  const [terms, setTerms] = useState<TerminologyTerm[]>([]);
  const [documents, setDocuments] = useState<ProjectDocumentInfo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [segments, setSegments] = useState<AlignedSegment[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<TerminologyTerm | null>(null);
  const [checkedTermIds, setCheckedTermIds] = useState<Set<number>>(new Set());
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);

  // filters
  const [filterDomain, setFilterDomain] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // ---- data loading ----
  const loadTerms = useCallback(async () => {
    setLoadingTerms(true);
    try {
      const data = await window.api.getProjectTerms(projectId);
      setTerms(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingTerms(false); }
  }, [projectId]);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await window.api.getProjectDocuments(projectId);
      setDocuments(data || []);
      if (data && data.length > 0 && !selectedDocId) {
        setSelectedDocId(data[0].id);
      }
    } catch (e) { console.error(e); }
  }, [projectId, selectedDocId]);

  const loadSegments = useCallback(async (docId: number) => {
    setLoadingSegments(true);
    try {
      // Reuse corpusService.getAlignedSegments via the existing IPC
      const segs = await window.api.getCorpusSegments([docId]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSegments((segs || []).map((s: any, i: number) => ({
        index: i + 1,
        source_text: s.source_text,
        target_text: s.target_text,
      })));
    } catch (e) {
      console.error(e);
      setSegments([]);
    } finally { setLoadingSegments(false); }
  }, []);

  useEffect(() => { loadTerms(); loadDocuments(); }, [loadTerms, loadDocuments]);

  useEffect(() => {
    if (selectedDocId) {
      loadSegments(selectedDocId);
      setSelectedTerm(null);
      segmentRefs.current.clear();
    }
  }, [selectedDocId, loadSegments]);

  // ---- filtered terms ----
  const filteredTerms = useMemo(() => {
    return terms.filter(t => {
      if (filterDomain && t.domain !== filterDomain) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus) {
        const st = t.verification_status || 'unverified';
        if (st !== filterStatus) return false;
      }
      if (searchText) {
        const q = searchText.toLowerCase();
        return t.source_term.toLowerCase().includes(q) || t.target_term.toLowerCase().includes(q);
      }
      return true;
    });
  }, [terms, filterDomain, filterPriority, filterStatus, searchText]);

  // ---- build highlight term lists ----
  const allTermTexts = useMemo(() => {
    const src = terms.map(t => t.source_term);
    const tgt = terms.map(t => t.target_term);
    return [...new Set([...src, ...tgt])];
  }, [terms]);

  // ---- verification actions ----
  const handleVerify = async (termId: number) => {
    try {
      const term = terms.find(t => t.id === termId);
      // Cycle: unverified/rejected → verified, verified → unverified
      const current = term?.verification_status || 'unverified';
      const newStatus: 'verified' | 'unverified' = (current === 'verified') ? 'unverified' : 'verified';
      if (newStatus === 'verified') {
        await window.api.verifyTerm(termId, 'verified', 'user');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await window.api.updateTerminologyTerm(termId, { verification_status: 'unverified' } as any);
      }
      const updated = terms.map(t => t.id === termId ? { ...t, verification_status: newStatus } : t);
      setTerms(updated);
      onTermsChanged?.();
      // Auto-update project status if all terms are now resolved
      const allResolved = updated.every(t =>
        t.verification_status === 'verified' || t.verification_status === 'rejected'
      );
      if (allResolved && updated.length > 0) {
        try {
          await window.api.updateTerminologyProject(projectId, { status: 'reviewed' });
          message.success('All terms resolved — project status updated to "reviewed".');
        } catch { /* non-critical */ }
      }
      message.success(newStatus === 'verified' ? 'Term verified.' : 'Verification cleared.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message); }
  };

  const handleBulkAction = async (status: 'verified' | 'rejected') => {
    if (checkedTermIds.size === 0) { message.warning("Select terms first."); return; }
    try {
      await window.api.batchVerifyTerms(Array.from(checkedTermIds), status, 'user');
      const updated = terms.map(t =>
        checkedTermIds.has(t.id!) ? { ...t, verification_status: status } : t
      );
      setTerms(updated);
      setCheckedTermIds(new Set());
      onTermsChanged?.();

      // Auto-update project status: if all terms are now verified/rejected → 'reviewed'
      const allResolved = updated.every(t =>
        t.verification_status === 'verified' || t.verification_status === 'rejected'
      );
      if (allResolved && updated.length > 0) {
        try {
          await window.api.updateTerminologyProject(projectId, { status: 'reviewed' });
          message.success('All terms resolved — project status updated to "reviewed".');
        } catch { /* non-critical */ }
      }
      message.success(`${checkedTermIds.size} terms ${status}.`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) { message.error(e.message); }
  };

  const handleToggleChecked = (id: number) => {
    setCheckedTermIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (checkedTermIds.size === filteredTerms.length) {
      setCheckedTermIds(new Set());
    } else {
      setCheckedTermIds(new Set(filteredTerms.map(t => t.id!)));
    }
  };

  // ---- scroll to term ----
  const handleTermClick = (term: TerminologyTerm) => {
    setSelectedTerm(prev => prev?.id === term.id ? null : term);
    // Find the first segment containing this term and scroll to it
    const lowerSrc = term.source_term.toLowerCase();
    const lowerTgt = term.target_term.toLowerCase();
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.source_text.toLowerCase().includes(lowerSrc) ||
          seg.target_text.toLowerCase().includes(lowerTgt)) {
        const el = segmentRefs.current.get(i);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  };

  // ---- current doc info ----
  const currentDoc = documents.find(d => d.id === selectedDocId);
  const docIndex = documents.findIndex(d => d.id === selectedDocId);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Term list */}
      <div className="w-72 bg-white border-r shrink-0 flex flex-col">
        {/* filters */}
        <div className="p-2 border-b space-y-2">
          <div className="flex gap-1">
            <Select allowClear placeholder="Domain" value={filterDomain} onChange={setFilterDomain}
              className="flex-1" size="small"
              options={DOMAINS.map(d => ({ value: d, label: d.charAt(0).toUpperCase()+d.slice(1) }))} />
            <Select allowClear placeholder="Priority" value={filterPriority} onChange={setFilterPriority}
              className="flex-1" size="small"
              options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase()+p.slice(1) }))} />
          </div>
          <div className="flex gap-1">
            <Select allowClear placeholder="Status" value={filterStatus} onChange={setFilterStatus}
              className="flex-1" size="small"
              options={[
                { value: 'unverified', label: 'Unverified' },
                { value: 'verified', label: 'Verified' },
                { value: 'rejected', label: 'Rejected' },
              ]} />
          </div>
          <Input prefix={<Search size={12} />} placeholder="Search terms..." value={searchText}
            onChange={e => setSearchText(e.target.value)} size="small" allowClear />
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <Checkbox
              checked={checkedTermIds.size === filteredTerms.length && filteredTerms.length > 0}
              indeterminate={checkedTermIds.size > 0 && checkedTermIds.size < filteredTerms.length}
              onChange={handleSelectAll}
            >
              {filteredTerms.length} terms
            </Checkbox>
          </div>
        </div>

        {/* term list */}
        <div className="flex-1 overflow-auto">
          {loadingTerms ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
          ) : filteredTerms.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">No terms match filters.</div>
          ) : (
            filteredTerms.map(term => {
              const vStatus = term.verification_status || 'unverified';
              const isSelected = selectedTerm?.id === term.id;
              return (
                <div
                  key={term.id}
                  className={`px-3 py-2 border-b border-gray-100 cursor-pointer transition flex items-start gap-2 ${
                    isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"
                  }`}
                >
                  <Checkbox
                    checked={checkedTermIds.has(term.id!)}
                    onChange={() => handleToggleChecked(term.id!)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0" onClick={() => handleTermClick(term)}>
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {term.source_term}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      → {term.target_term}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Tag className="text-[10px] leading-none px-1 py-0" color="blue">{term.domain || 'general'}</Tag>
                      <Tag className="text-[10px] leading-none px-1 py-0"
                        color={term.priority === 'high' ? 'red' : term.priority === 'medium' ? 'orange' : 'green'}>
                        {term.priority || 'medium'}
                      </Tag>
                    </div>
                  </div>
                  {/* verification icon */}
                  <Tooltip title={vStatus === 'verified' ? 'Click to unverify' : vStatus === 'rejected' ? 'Rejected' : 'Unverified'}>
                    <button
                      className="shrink-0 mt-1"
                      onClick={(e) => { e.stopPropagation(); handleVerify(term.id!); }}
                    >
                      {vStatus === 'verified' ? (
                        <Check size={14} className="text-green-500" />
                      ) : vStatus === 'rejected' ? (
                        <X size={14} className="text-red-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              );
            })
          )}
        </div>

        {/* bulk actions */}
        <div className="p-2 border-t flex gap-2">
          <Button size="small" icon={<Check size={12} />} onClick={() => handleBulkAction('verified')}
            disabled={checkedTermIds.size === 0}
            style={{ color: '#10b981', borderColor: '#10b981' }}>
            Verify
          </Button>
          <Button size="small" icon={<X size={12} />} onClick={() => handleBulkAction('rejected')}
            disabled={checkedTermIds.size === 0}
            danger>
            Reject
          </Button>
        </div>
      </div>

      {/* Right: Aligned document view */}
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
        {/* document selector bar */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0">
          <Select
            value={selectedDocId}
            onChange={setSelectedDocId}
            className="flex-1 max-w-md"
            size="small"
            options={documents.map(d => ({
              value: d.id,
              label: `${d.title} (${d.source_language || '?'} → ${d.target_language || '?'})`,
            }))}
          />
          <div className="flex items-center gap-1">
            <Button size="small" disabled={docIndex <= 0}
              onClick={() => setSelectedDocId(documents[docIndex - 1]?.id)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-gray-400">
              {docIndex + 1} / {documents.length}
            </span>
            <Button size="small" disabled={docIndex >= documents.length - 1}
              onClick={() => setSelectedDocId(documents[docIndex + 1]?.id)}>
              <ChevronRight size={14} />
            </Button>
          </div>
          {currentDoc && (
            <div className="flex gap-2 ml-auto">
              {currentDoc.source_language && <Tag color="blue">{currentDoc.source_language}</Tag>}
              {currentDoc.target_language && <Tag color="green">{currentDoc.target_language}</Tag>}
              <span className="text-xs text-gray-400">{segments.length} segments</span>
            </div>
          )}
        </div>

        {/* segments */}
        <div className="flex-1 overflow-auto p-4" ref={rightPanelRef}>
          {loadingSegments ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading segments...</div>
          ) : segments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Search size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No aligned segments found for this document.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {segments.map((seg, i) => {
                const srcDir = getDir(currentDoc?.source_language);
                const tgtDir = getDir(currentDoc?.target_language);
                const highlightedSrc = highlightTerms(seg.source_text, allTermTexts, selectedTerm?.source_term || null, null);
                const highlightedTgt = highlightTerms(seg.target_text, allTermTexts, null, selectedTerm?.target_term || null);

                return (
                  <div
                    key={i}
                    ref={el => { if (el) segmentRefs.current.set(i, el); }}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* Source */}
                    <div className="flex">
                      <div className="w-10 shrink-0 bg-blue-50 text-blue-500 text-xs font-medium flex items-center justify-center border-r border-blue-100">
                        {seg.index}
                      </div>
                      <div className="flex-1 p-3 bg-blue-50/30 border-l-2 border-blue-400">
                        <div className="text-[10px] text-blue-500 font-medium mb-1">
                          {currentDoc?.source_language?.toUpperCase() || "SOURCE"}
                        </div>
                        <div
                          className="text-sm text-gray-800 leading-relaxed"
                          style={{ direction: srcDir, textAlign: srcDir === 'rtl' ? 'right' : 'left' }}
                          dangerouslySetInnerHTML={{ __html: highlightedSrc }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'MARK') {
                              const termText = target.getAttribute('data-term');
                              const found = terms.find(t =>
                                t.source_term.toLowerCase() === termText ||
                                t.target_term.toLowerCase() === termText
                              );
                              if (found) {
                                setSelectedTerm(found);
                                // Scroll the term into view in the left panel
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    {/* Target */}
                    <div className="flex border-t border-gray-100">
                      <div className="w-10 shrink-0 bg-emerald-50 text-emerald-500 text-xs font-medium flex items-center justify-center border-r border-emerald-100">
                        {seg.index}
                      </div>
                      <div className="flex-1 p-3 bg-emerald-50/30 border-l-2 border-emerald-400">
                        <div className="text-[10px] text-emerald-500 font-medium mb-1">
                          {currentDoc?.target_language?.toUpperCase() || "TARGET"}
                        </div>
                        <div
                          className="text-sm text-gray-800 leading-relaxed"
                          style={{ direction: tgtDir, textAlign: tgtDir === 'rtl' ? 'right' : 'left' }}
                          dangerouslySetInnerHTML={{ __html: highlightedTgt }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'MARK') {
                              const termText = target.getAttribute('data-term');
                              const found = terms.find(t =>
                                t.source_term.toLowerCase() === termText ||
                                t.target_term.toLowerCase() === termText
                              );
                              if (found) {
                                setSelectedTerm(found);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyTab;
