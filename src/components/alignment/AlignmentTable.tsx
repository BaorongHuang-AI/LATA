import React, { useMemo, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Button, Tooltip } from 'antd';
import { Star, Link2, Combine } from 'lucide-react';
import { LineItem } from './LineItem';
import { buildAlignmentRows, AlignmentRowData, AlignmentRowLineItem } from '../../utils/alignmentRows';
import { getConfidenceColor, getConfidenceLabel } from '../../utils/confidence';
import { RTL_LANGS } from '../../utils/Constants';
import type { Line, Link, FontSettings, LinkingMode } from '../../types/alignment';

interface AlignmentTableProps {
    alignmentType: string;
    sourceLines: Line[];
    targetLines: Line[];
    links: Link[];
    sourceMeta: { language: string } | null;
    targetMeta: { language: string } | null;
    fontSettings: FontSettings;
    linkingMode: LinkingMode;
    selectedSourceIds: string[];
    selectedTargetIds: string[];
    pendingSourceIds: string[];
    pendingTargetIds: string[];
    editingLine: { type: 'source' | 'target'; id: string; text: string } | null;
    onLineClick: (type: 'source' | 'target', id: string) => void;
    onEditLine: (type: 'source' | 'target', id: string, text: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onToggleFavorite: (type: 'source' | 'target', id: string) => void;
    onEditComment: (type: 'source' | 'target', id: string, comment?: string) => void;
    onEditLineNumber: (type: 'source' | 'target', id: string, lineNumber: string) => void;
    onMergeLines: (type: 'source' | 'target') => void;
    onSplitLine: (type: 'source' | 'target', lineId: string, cursorPosition: number) => void;
    onMoveUp: (type: 'source' | 'target', lineId: string) => void;
    onMoveDown: (type: 'source' | 'target', lineId: string) => void;
    onDeleteLine: (type: 'source' | 'target', lineId: string) => void;
    onInsertLineBelow: (type: 'source' | 'target', lineId: string) => void;
    onLinkClick: (linkId: string) => void;
    sentencesWithWordAlignments?: Set<string>;
    processing?: boolean;
    realignStartSourceId?: string | null;
    realignEndSourceId?: string | null;
}

const DEFAULT_ROW_HEIGHT = 120;
const OVERSCAN = 5;

export const AlignmentTable: React.FC<AlignmentTableProps> = ({
    alignmentType,
    sourceLines,
    targetLines,
    links,
    sourceMeta,
    targetMeta,
    fontSettings,
    linkingMode,
    selectedSourceIds,
    selectedTargetIds,
    pendingSourceIds,
    pendingTargetIds,
    editingLine,
    onLineClick,
    onEditLine,
    onSaveEdit,
    onCancelEdit,
    onToggleFavorite,
    onEditComment,
    onEditLineNumber,
    onMergeLines,
    onSplitLine,
    onMoveUp,
    onMoveDown,
    onDeleteLine,
    onInsertLineBelow,
    onLinkClick,
    sentencesWithWordAlignments,
    processing,
    realignStartSourceId,
    realignEndSourceId,
}) => {
    const rows = useMemo(
        () => buildAlignmentRows(sourceLines, targetLines, links),
        [sourceLines, targetLines, links]
    );

    const sourceRTL = !!sourceMeta?.language && RTL_LANGS.indexOf(sourceMeta.language) !== -1;
    const targetRTL = !!targetMeta?.language && RTL_LANGS.indexOf(targetMeta.language) !== -1;

    const activeSourceIds = useMemo(() => {
        if (linkingMode === 'realign') {
            const ids: string[] = [];
            if (realignStartSourceId) ids.push(realignStartSourceId);
            if (realignEndSourceId) ids.push(realignEndSourceId);
            return ids;
        }
        return linkingMode === 'manual' ? selectedSourceIds : pendingSourceIds;
    }, [linkingMode, selectedSourceIds, pendingSourceIds, realignStartSourceId, realignEndSourceId]);

    const activeTargetIds = useMemo(() => {
        if (linkingMode === 'realign') return [];
        return linkingMode === 'manual' ? selectedTargetIds : pendingTargetIds;
    }, [linkingMode, selectedTargetIds, pendingTargetIds]);

    const realignRangeSourceIds = useMemo(() => {
        if (linkingMode !== 'realign' || !realignStartSourceId) return new Set<string>();
        const startIdx = sourceLines.findIndex(l => l.id === realignStartSourceId);
        const endIdx = realignEndSourceId
            ? sourceLines.findIndex(l => l.id === realignEndSourceId)
            : sourceLines.length - 1;
        if (startIdx === -1) return new Set<string>();
        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        return new Set(sourceLines.slice(lo, hi + 1).map(l => l.id));
    }, [linkingMode, realignStartSourceId, realignEndSourceId, sourceLines]);

    const showSourceMerge =
        linkingMode === 'manual' && activeSourceIds.length >= 2 && (alignmentType === 'para' || alignmentType === 'sent' || alignmentType === 'word');
    const showTargetMerge =
        linkingMode === 'manual' && activeTargetIds.length >= 2 && (alignmentType === 'para' || alignmentType === 'sent' || alignmentType === 'word');

    // -- Dynamic-height virtual scrolling --
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Store measured row heights keyed by row.id
    const rowHeightsRef = useRef<Map<string, number>>(new Map());
    const [heightTick, setHeightTick] = useState(0);

    const onRowHeight = useCallback((rowId: string, h: number) => {
        const rounded = Math.ceil(h);
        if (rowHeightsRef.current.get(rowId) !== rounded) {
            rowHeightsRef.current.set(rowId, rounded);
            setHeightTick(t => t + 1);
        }
    }, []);

    // Clear stale height entries when the row set changes
    const prevRowIdsRef = useRef<Set<string>>(new Set());
    const currentRowIds = useMemo(() => new Set(rows.map(r => r.id)), [rows]);
    if (prevRowIdsRef.current !== currentRowIds) {
        // remove entries no longer in the row set
        for (const key of rowHeightsRef.current.keys()) {
            if (!currentRowIds.has(key)) rowHeightsRef.current.delete(key);
        }
        prevRowIdsRef.current = currentRowIds;
    }

    // Compute cumulative offsets and total height
    const { rowOffsets, totalHeight } = useMemo(() => {
        const offsets: number[] = new Array(rows.length);
        let offset = 0;
        for (let i = 0; i < rows.length; i++) {
            offsets[i] = offset;
            const h = rowHeightsRef.current.get(rows[i].id);
            offset += h && h > 0 ? h : DEFAULT_ROW_HEIGHT;
        }
        return { rowOffsets: offsets, totalHeight: offset };
    }, [rows, heightTick]);

    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            setScrollTop(containerRef.current.scrollTop);
        }
    }, []);

    useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerHeight(containerRef.current.clientHeight);
            const observer = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setContainerHeight(entry.contentRect.height);
                }
            });
            observer.observe(containerRef.current);
            return () => observer.disconnect();
        }
    }, []);

    // Find start index using binary search for the first row whose offset > scrollTop
    const startIndex = useMemo(() => {
        let lo = 0, hi = rowOffsets.length;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (rowOffsets[mid] <= scrollTop) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return Math.max(0, lo - 1 - OVERSCAN);
    }, [rowOffsets, scrollTop]);

    // Find end index by scanning forward from startIndex
    const endIndex = useMemo(() => {
        const limit = scrollTop + (containerHeight || window.innerHeight);
        let ei = startIndex + OVERSCAN;
        while (ei < rows.length && rowOffsets[ei] < limit) {
            ei++;
        }
        return Math.min(rows.length, ei + OVERSCAN);
    }, [rowOffsets, scrollTop, containerHeight, startIndex, rows.length]);

    const visibleRows = useMemo(
        () => rows.slice(startIndex, endIndex),
        [rows, startIndex, endIndex]
    );

    const visibleOffset = rowOffsets[startIndex] ?? 0;

    const editingLineId = editingLine?.id || '';

    return (
        <div
            ref={containerRef}
            className="flex-1 min-h-0 overflow-y-auto bg-gray-50"
            onScroll={handleScroll}
        >
            {/* Processing indicator */}
            {processing && (
                <div className="sticky top-0 z-30 w-full h-1 bg-blue-100">
                    <div className="h-full bg-blue-500 animate-pulse transition-all duration-300" style={{ width: '100%' }} />
                </div>
            )}
            {/* Sticky column headers */}
            <div className="sticky top-0 z-10 bg-white border-b-2 border-gray-300 shadow-sm">
                <div className="flex">
                    <div className="flex-1 px-6 py-2.5 bg-blue-50/80">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                            <span className="text-sm font-semibold text-blue-900">
                                Source ({sourceMeta?.language?.toUpperCase()})
                            </span>
                            <span className="text-xs text-blue-600 font-normal">
                                {sourceLines.length} lines
                            </span>
                            {showSourceMerge && (
                                <Button
                                    size="small"
                                    icon={<Combine size={12} />}
                                    onClick={() => onMergeLines('source')}
                                    className="ml-auto"
                                >
                                    Merge {activeSourceIds.length}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="w-16 bg-gray-100 flex items-center justify-center border-x border-gray-300">
                        <Link2 size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 px-6 py-2.5 bg-green-50/80">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                            <span className="text-sm font-semibold text-green-900">
                                Target ({targetMeta?.language?.toUpperCase()})
                            </span>
                            <span className="text-xs text-green-600 font-normal">
                                {targetLines.length} lines
                            </span>
                            {showTargetMerge && (
                                <Button
                                    size="small"
                                    icon={<Combine size={12} />}
                                    onClick={() => onMergeLines('target')}
                                    className="ml-auto"
                                >
                                    Merge {activeTargetIds.length}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Virtualized rows with dynamic heights */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ position: 'absolute', top: visibleOffset, left: 0, right: 0 }}>
                    {visibleRows.map((row, i) => (
                        <MemoAlignmentRow
                            key={row.id}
                            row={row}
                            rowIndex={startIndex + i}
                            alignmentType={alignmentType}
                            fontSettings={fontSettings}
                            activeSourceIds={activeSourceIds}
                            activeTargetIds={activeTargetIds}
                            editingLineId={editingLineId}
                            links={links}
                            sourceRTL={sourceRTL}
                            targetRTL={targetRTL}
                            sourceLineCount={sourceLines.length}
                            targetLineCount={targetLines.length}
                            onLineClick={onLineClick}
                            onEditLine={onEditLine}
                            onSaveEdit={onSaveEdit}
                            onCancelEdit={onCancelEdit}
                            onToggleFavorite={onToggleFavorite}
                            onEditComment={onEditComment}
                            onEditLineNumber={onEditLineNumber}
                            onSplitLine={onSplitLine}
                            onMoveUp={onMoveUp}
                            onMoveDown={onMoveDown}
                            onDeleteLine={onDeleteLine}
                            onInsertLineBelow={onInsertLineBelow}
                            onLinkClick={onLinkClick}
                            sentencesWithWordAlignments={sentencesWithWordAlignments}
                            editingLine={editingLine}
                            onHeight={onRowHeight}
                            realignRangeSourceIds={realignRangeSourceIds}
                        />
                    ))}
                </div>
            </div>

            {rows.length === 0 && (
                <div className="flex items-center justify-center py-20 text-gray-400">
                    No lines loaded
                </div>
            )}
        </div>
    );
};

/* ─── Memoized alignment row ─── */

interface MemoAlignmentRowProps {
    row: AlignmentRowData;
    rowIndex: number;
    alignmentType: string;
    fontSettings: FontSettings;
    activeSourceIds: string[];
    activeTargetIds: string[];
    editingLineId: string;
    editingLine: { type: 'source' | 'target'; id: string; text: string } | null;
    links: Link[];
    sourceRTL: boolean;
    targetRTL: boolean;
    sourceLineCount: number;
    targetLineCount: number;
    onLineClick: (type: 'source' | 'target', id: string) => void;
    onEditLine: (type: 'source' | 'target', id: string, text: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onToggleFavorite: (type: 'source' | 'target', id: string) => void;
    onEditComment: (type: 'source' | 'target', id: string, comment?: string) => void;
    onEditLineNumber: (type: 'source' | 'target', id: string, lineNumber: string) => void;
    onSplitLine: (type: 'source' | 'target', lineId: string, cursorPosition: number) => void;
    onMoveUp: (type: 'source' | 'target', lineId: string) => void;
    onMoveDown: (type: 'source' | 'target', lineId: string) => void;
    onDeleteLine: (type: 'source' | 'target', lineId: string) => void;
    onInsertLineBelow: (type: 'source' | 'target', lineId: string) => void;
    onLinkClick: (linkId: string) => void;
    sentencesWithWordAlignments?: Set<string>;
    onHeight: (rowId: string, height: number) => void;
    realignRangeSourceIds?: Set<string>;
}

const rowSourceIds = (row: AlignmentRowData) => row.sourceItems.map(i => i.line.id).join(',');
const rowTargetIds = (row: AlignmentRowData) => row.targetItems.map(i => i.line.id).join(',');

const areRowPropsEqual = (prev: MemoAlignmentRowProps, next: MemoAlignmentRowProps) => {
    if (prev.row.id !== next.row.id) return false;
    if (prev.rowIndex !== next.rowIndex) return false;
    if (rowSourceIds(prev.row) !== rowSourceIds(next.row)) return false;
    if (rowTargetIds(prev.row) !== rowTargetIds(next.row)) return false;
    // Check if link changed
    const prevLinkId = prev.row.link?.id;
    const nextLinkId = next.row.link?.id;
    if (prevLinkId !== nextLinkId) return false;
    // Check if this row's editing state changed
    const prevRowIds = [...prev.row.sourceItems.map(i => i.line.id), ...prev.row.targetItems.map(i => i.line.id)];
    if (prev.editingLineId !== next.editingLineId) {
        if (prevRowIds.includes(prev.editingLineId) || prevRowIds.includes(next.editingLineId)) return false;
    }
    // Check if active IDs changed for this row
    const prevActiveSrc = prev.activeSourceIds.filter(id => prevRowIds.includes(id)).join(',');
    const nextActiveSrc = next.activeSourceIds.filter(id => prevRowIds.includes(id)).join(',');
    if (prevActiveSrc !== nextActiveSrc) return false;
    const prevActiveTgt = prev.activeTargetIds.filter(id => prevRowIds.includes(id)).join(',');
    const nextActiveTgt = next.activeTargetIds.filter(id => prevRowIds.includes(id)).join(',');
    if (prevActiveTgt !== nextActiveTgt) return false;
    // Check callbacks (skip onHeight – it always changes)
    if (prev.onMoveUp !== next.onMoveUp) return false;
    if (prev.onMoveDown !== next.onMoveDown) return false;
    if (prev.onDeleteLine !== next.onDeleteLine) return false;
    if (prev.onInsertLineBelow !== next.onInsertLineBelow) return false;
    // Check font settings
    if (prev.fontSettings.fontSize !== next.fontSettings.fontSize) return false;
    if (prev.fontSettings.sourceFontFamily !== next.fontSettings.sourceFontFamily) return false;
    if (prev.fontSettings.targetFontFamily !== next.fontSettings.targetFontFamily) return false;
    // Check realign range
    const prevRealignRange = prev.realignRangeSourceIds ?? new Set<string>();
    const nextRealignRange = next.realignRangeSourceIds ?? new Set<string>();
    if (prevRealignRange !== nextRealignRange) return false;
    return true;
};

const AlignmentRowComponent: React.FC<MemoAlignmentRowProps> = ({
    row,
    rowIndex,
    alignmentType,
    fontSettings,
    activeSourceIds,
    activeTargetIds,
    editingLine,
    links,
    sourceRTL,
    targetRTL,
    sourceLineCount,
    targetLineCount,
    onLineClick,
    onEditLine,
    onSaveEdit,
    onCancelEdit,
    onToggleFavorite,
    onEditComment,
    onEditLineNumber,
    onSplitLine,
    onMoveUp,
    onMoveDown,
    onDeleteLine,
    onInsertLineBelow,
    onLinkClick,
    sentencesWithWordAlignments,
    onHeight,
    realignRangeSourceIds,
}) => {
    const hasLink = !!row.link;
    const isUnlinkedSource = row.sourceItems.length > 0 && row.targetItems.length === 0;
    const isUnlinkedTarget = row.sourceItems.length === 0 && row.targetItems.length > 0;

    const hasWordAlignment = hasLink && row.link && sentencesWithWordAlignments && (
        row.link.sourceIds.some(id => sentencesWithWordAlignments.has(id)) ||
        row.link.targetIds.some(id => sentencesWithWordAlignments.has(id))
    );

    const rowBg = hasLink
        ? rowIndex % 2 === 0
            ? 'bg-white'
            : 'bg-slate-100'
        : 'bg-amber-50/40';

    // Measure this row's height and report to parent for virtual scrolling
    const rowRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = rowRef.current;
        if (!el || !onHeight) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                onHeight(row.id, entry.contentRect.height);
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [row.id, onHeight]);

    return (
        <div ref={rowRef} className={`flex border-b border-gray-300 min-h-[3.5rem] ${rowBg}`}>
            {/* Source cell */}
            <div className={`flex-1 p-3 ${isUnlinkedTarget ? 'bg-gray-100/30' : ''}`}>
                {row.sourceItems.length > 0 ? (
                    <div className="space-y-2">
                        {row.sourceItems.map((item) => (
                            <MemoCellLineItem
                                key={item.line.id}
                                item={item}
                                type="source"
                                alignmentType={alignmentType}
                                fontSettings={fontSettings}
                                activeIds={activeSourceIds}
                                editingLine={editingLine}
                                links={links}
                                isRTL={sourceRTL}
                                totalLines={sourceLineCount}
                                onLineClick={onLineClick}
                                onEditLine={onEditLine}
                                onSaveEdit={onSaveEdit}
                                onCancelEdit={onCancelEdit}
                                onToggleFavorite={onToggleFavorite}
                                onEditComment={onEditComment}
                                onEditLineNumber={onEditLineNumber}
                                onSplitLine={onSplitLine}
                                onMoveUp={onMoveUp}
                                onMoveDown={onMoveDown}
                                onDeleteLine={onDeleteLine}
                                onInsertLineBelow={onInsertLineBelow}
                                realignRangeSourceIds={realignRangeSourceIds}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full min-h-[2rem] text-gray-300 text-sm select-none">
                        —
                    </div>
                )}
            </div>

            {/* Link indicator column */}
            <div className="w-16 flex flex-col items-center justify-center border-x border-gray-200 shrink-0 gap-1">
                {hasLink && row.link && (
                    <Tooltip
                        title={`${getConfidenceLabel(row.link.confidence)} (${(
                            row.link.confidence * 100
                        ).toFixed(0)}%)`}
                    >
                        <button
                            className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
                            style={{
                                backgroundColor: getConfidenceColor(row.link.confidence),
                            }}
                            onClick={() => onLinkClick(row.link!.id)}
                        >
                            {row.link.isFavorite ? (
                                <Star size={12} className="text-white fill-white" />
                            ) : (
                                <Link2 size={12} className="text-white" />
                            )}
                        </button>
                    </Tooltip>
                )}
                {hasWordAlignment && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded px-1.5 py-0.5 leading-none">
                        W
                    </span>
                )}
            </div>

            {/* Target cell */}
            <div className={`flex-1 p-3 ${isUnlinkedSource ? 'bg-gray-100/30' : ''}`}>
                {row.targetItems.length > 0 ? (
                    <div className="space-y-2">
                        {row.targetItems.map((item) => (
                            <MemoCellLineItem
                                key={item.line.id}
                                item={item}
                                type="target"
                                alignmentType={alignmentType}
                                fontSettings={fontSettings}
                                activeIds={activeTargetIds}
                                editingLine={editingLine}
                                links={links}
                                isRTL={targetRTL}
                                totalLines={targetLineCount}
                                onLineClick={onLineClick}
                                onEditLine={onEditLine}
                                onSaveEdit={onSaveEdit}
                                onCancelEdit={onCancelEdit}
                                onToggleFavorite={onToggleFavorite}
                                onEditComment={onEditComment}
                                onEditLineNumber={onEditLineNumber}
                                onSplitLine={onSplitLine}
                                onMoveUp={onMoveUp}
                                onMoveDown={onMoveDown}
                                onDeleteLine={onDeleteLine}
                                onInsertLineBelow={onInsertLineBelow}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full min-h-[2rem] text-gray-300 text-sm select-none">
                        —
                    </div>
                )}
            </div>
        </div>
    );
};

const MemoAlignmentRow = React.memo(AlignmentRowComponent, areRowPropsEqual);

/* ─── Memoized cell line item ─── */

interface CellLineItemProps {
    item: AlignmentRowLineItem;
    type: 'source' | 'target';
    alignmentType: string;
    fontSettings: FontSettings;
    activeIds: string[];
    editingLine: { type: 'source' | 'target'; id: string; text: string } | null;
    links: Link[];
    isRTL: boolean;
    totalLines: number;
    onLineClick: (type: 'source' | 'target', id: string) => void;
    onEditLine: (type: 'source' | 'target', id: string, text: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onToggleFavorite: (type: 'source' | 'target', id: string) => void;
    onEditComment: (type: 'source' | 'target', id: string, comment?: string) => void;
    onEditLineNumber: (type: 'source' | 'target', id: string, lineNumber: string) => void;
    onSplitLine: (type: 'source' | 'target', lineId: string, cursorPosition: number) => void;
    onMoveUp: (type: 'source' | 'target', lineId: string) => void;
    onMoveDown: (type: 'source' | 'target', lineId: string) => void;
    onDeleteLine: (type: 'source' | 'target', lineId: string) => void;
    onInsertLineBelow: (type: 'source' | 'target', lineId: string) => void;
    realignRangeSourceIds?: Set<string>;
}

const areCellPropsEqual = (prev: CellLineItemProps, next: CellLineItemProps) => {
    if (prev.item.line.id !== next.item.line.id) return false;
    if (prev.item.line.text !== next.item.line.text) return false;
    if (prev.item.line.isFavorite !== next.item.line.isFavorite) return false;
    if (prev.item.line.comment !== next.item.line.comment) return false;
    if (prev.item.globalIndex !== next.item.globalIndex) return false;
    if (prev.type !== next.type) return false;
    if (prev.onMoveUp !== next.onMoveUp) return false;
    if (prev.onMoveDown !== next.onMoveDown) return false;
    if (prev.onDeleteLine !== next.onDeleteLine) return false;
    if (prev.onInsertLineBelow !== next.onInsertLineBelow) return false;
    const prevActive = prev.activeIds.includes(prev.item.line.id);
    const nextActive = next.activeIds.includes(next.item.line.id);
    if (prevActive !== nextActive) return false;
    const prevEditing = prev.editingLine?.type === prev.type && prev.editingLine?.id === prev.item.line.id;
    const nextEditing = next.editingLine?.type === next.type && next.editingLine?.id === next.item.line.id;
    if (prevEditing !== nextEditing) return false;
    if (prevEditing && nextEditing && prev.editingLine?.text !== next.editingLine?.text) return false;
    if (prev.fontSettings.fontSize !== next.fontSettings.fontSize) return false;
    if (prev.totalLines !== next.totalLines) return false;
    const prevInRange = prev.realignRangeSourceIds?.has(prev.item.line.id) ?? false;
    const nextInRange = next.realignRangeSourceIds?.has(next.item.line.id) ?? false;
    if (prevInRange !== nextInRange) return false;
    return true;
};

const CellLineItem: React.FC<CellLineItemProps> = ({
    item,
    type,
    alignmentType,
    fontSettings,
    activeIds,
    editingLine,
    links,
    isRTL,
    totalLines,
    onLineClick,
    onEditLine,
    onSaveEdit,
    onCancelEdit,
    onToggleFavorite,
    onEditComment,
    onEditLineNumber,
    onSplitLine,
    onMoveUp,
    onMoveDown,
    onDeleteLine,
    onInsertLineBelow,
    realignRangeSourceIds,
}) => {
    const { line, globalIndex } = item;
    const fontFamily = type === 'source' ? fontSettings.sourceFontFamily : fontSettings.targetFontFamily;
    const isEditing = editingLine?.type === type && editingLine?.id === line.id;
    const isSelected = activeIds.includes(line.id);
    const isHighlighted = type === 'source' && !isSelected && (realignRangeSourceIds?.has(line.id) ?? false);

    return (
        <MemoLineItem
            alignmentType={alignmentType}
            line={line}
            index={globalIndex}
            type={type}
            isSelected={isSelected}
            linkedTo={links.filter((lnk) =>
                type === 'source'
                    ? lnk.sourceIds.includes(line.id)
                    : lnk.targetIds.includes(line.id)
            )}
            isHighlighted={isHighlighted}
            isEditing={isEditing}
            editingText={editingLine?.text || ''}
            linkingMode="manual"
            fontFamily={fontFamily}
            fontSize={fontSettings.fontSize}
            onLineClick={() => onLineClick(type, line.id)}
            onEditLine={(text: string) => onEditLine(type, line.id, text)}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onToggleFavorite={() => onToggleFavorite(type, line.id)}
            onEditComment={() => onEditComment(type, line.id, line.comment)}
            onEditLineNumber={() => onEditLineNumber(type, line.id, line.lineNumber)}
            setEditingText={(text: string) => {
                if (editingLine) {
                    onEditLine(type, line.id, text);
                }
            }}
            onSplitLine={
                alignmentType === 'para' || alignmentType === 'sent'
                    ? (lineId: string, pos: number) => onSplitLine(type, lineId, pos)
                    : undefined
            }
            isRTL={isRTL}
            onMoveUp={() => onMoveUp(type, line.id)}
            onMoveDown={() => onMoveDown(type, line.id)}
            onDeleteLine={() => onDeleteLine(type, line.id)}
            onInsertLineBelow={() => onInsertLineBelow(type, line.id)}
            totalLines={totalLines}
        />
    );
};

const MemoCellLineItem = React.memo(CellLineItem, areCellPropsEqual);

/* ─── Memoized LineItem wrapper ─── */

const areLineItemEqual = (prev: any, next: any) => {
    if (prev.line !== next.line) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.isHighlighted !== next.isHighlighted) return false;
    if (prev.isEditing !== next.isEditing) return false;
    if (prev.editingText !== next.editingText) return false;
    if (prev.index !== next.index) return false;
    if (prev.fontSize !== next.fontSize) return false;
    if (prev.fontFamily !== next.fontFamily) return false;
    if (prev.isRTL !== next.isRTL) return false;
    if (prev.totalLines !== next.totalLines) return false;
    if (prev.alignmentType !== next.alignmentType) return false;
    if (prev.onMoveUp !== next.onMoveUp) return false;
    if (prev.onMoveDown !== next.onMoveDown) return false;
    if (prev.onDeleteLine !== next.onDeleteLine) return false;
    if (prev.onInsertLineBelow !== next.onInsertLineBelow) return false;
    return true;
};

const MemoLineItem = React.memo(LineItem, areLineItemEqual);
