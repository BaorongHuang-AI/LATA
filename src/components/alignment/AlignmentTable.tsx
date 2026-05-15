import React, { useMemo } from 'react';
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
}

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
}) => {
    const rows = useMemo(
        () => buildAlignmentRows(sourceLines, targetLines, links),
        [sourceLines, targetLines, links]
    );

    const sourceRTL = !!sourceMeta?.language && RTL_LANGS.indexOf(sourceMeta.language) !== -1;
    const targetRTL = !!targetMeta?.language && RTL_LANGS.indexOf(targetMeta.language) !== -1;

    const activeSourceIds = linkingMode === 'manual' ? selectedSourceIds : pendingSourceIds;
    const activeTargetIds = linkingMode === 'manual' ? selectedTargetIds : pendingTargetIds;

    const showSourceMerge =
        linkingMode === 'manual' && activeSourceIds.length >= 2 && (alignmentType === 'para' || alignmentType === 'sent' || alignmentType === 'word');
    const showTargetMerge =
        linkingMode === 'manual' && activeTargetIds.length >= 2 && (alignmentType === 'para' || alignmentType === 'sent' || alignmentType === 'word');

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50">
            {/* Processing indicator */}
            {processing && (
                <div className="sticky top-0 z-20 w-full h-1 bg-blue-100">
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
                                Source ({sourceMeta.language?.toUpperCase()})
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
                                Target ({targetMeta.language?.toUpperCase()})
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

            {/* Alignment rows */}
            <div>
                {rows.map((row, rowIndex) => (
                    <AlignmentRowComponent
                        key={row.id}
                        row={row}
                        rowIndex={rowIndex}
                        alignmentType={alignmentType}
                        fontSettings={fontSettings}
                        linkingMode={linkingMode}
                        activeSourceIds={activeSourceIds}
                        activeTargetIds={activeTargetIds}
                        editingLine={editingLine}
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
                    />
                ))}

                {rows.length === 0 && (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        No lines loaded
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Individual alignment row ─── */

interface AlignmentRowProps {
    row: AlignmentRowData;
    rowIndex: number;
    alignmentType: string;
    fontSettings: FontSettings;
    linkingMode: LinkingMode;
    activeSourceIds: string[];
    activeTargetIds: string[];
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
}

const AlignmentRowComponent: React.FC<AlignmentRowProps> = ({
    row,
    rowIndex,
    alignmentType,
    fontSettings,
    linkingMode,
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

    return (
        <div className={`flex border-b border-gray-300 min-h-[3.5rem] ${rowBg}`}>
            {/* Source cell */}
            <div
                className={`flex-1 p-3 ${
                    isUnlinkedTarget ? 'bg-gray-100/30' : ''
                }`}
            >
                {row.sourceItems.length > 0 ? (
                    <div className="space-y-2">
                        {row.sourceItems.map((item) => (
                            <CellLineItem
                                key={item.line.id}
                                item={item}
                                type="source"
                                alignmentType={alignmentType}
                                fontSettings={fontSettings}
                                linkingMode={linkingMode}
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
            <div
                className={`flex-1 p-3 ${
                    isUnlinkedSource ? 'bg-gray-100/30' : ''
                }`}
            >
                {row.targetItems.length > 0 ? (
                    <div className="space-y-2">
                        {row.targetItems.map((item) => (
                            <CellLineItem
                                key={item.line.id}
                                item={item}
                                type="target"
                                alignmentType={alignmentType}
                                fontSettings={fontSettings}
                                linkingMode={linkingMode}
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

/* ─── Wrapper that adapts LineItem for row context ─── */

interface CellLineItemProps {
    item: AlignmentRowLineItem;
    type: 'source' | 'target';
    alignmentType: string;
    fontSettings: FontSettings;
    linkingMode: LinkingMode;
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
}

const CellLineItem: React.FC<CellLineItemProps> = ({
    item,
    type,
    alignmentType,
    fontSettings,
    linkingMode,
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
}) => {
    const { line, globalIndex } = item;
    const fontFamily = type === 'source' ? fontSettings.sourceFontFamily : fontSettings.targetFontFamily;
    const isEditing = editingLine?.type === type && editingLine?.id === line.id;

    return (
        <LineItem
            alignmentType={alignmentType}
            line={line}
            index={globalIndex}
            type={type}
            isSelected={activeIds.includes(line.id)}
            linkedTo={links.filter((lnk) =>
                type === 'source'
                    ? lnk.sourceIds.includes(line.id)
                    : lnk.targetIds.includes(line.id)
            )}
            isHighlighted={false}
            isEditing={isEditing}
            editingText={editingLine?.text || ''}
            linkingMode={linkingMode}
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
