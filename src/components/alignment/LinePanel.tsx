// src/components/alignment/LinePanel.tsx
import React, { forwardRef } from 'react';
import { LineItem } from './LineItem';
import type { Line, Link, FontSettings, LinkingMode } from '../../types/alignment';
import { Globe, Star, MessageSquare, Edit2, Check, X, Combine } from 'lucide-react';
import {Button} from "antd";
import {RTL_LANGS} from "../../utils/Constants";

interface LinePanelProps {
    alignmentType:string,
    type: 'source' | 'target';
    lines: Line[];
    language: string;
    // metaData: any,
    title: string;
    fontSettings: FontSettings;
    links: Link[];
    hoveredLink?: string | null;   // ✅ OPTIONAL
    selectedIds: string[];
    editingLine: { type: 'source' | 'target'; id: string; text: string } | null;
    linkingMode: LinkingMode;
    onLineClick: (type: 'source' | 'target', id: string) => void;
    onEditLine: (id: string, text: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onToggleFavorite: (id: string) => void;
    onEditComment: (id: string, comment?: string) => void;
    onEditLineNumber: (id: string, lineNumber: string) => void;
    onMergeLines?: () => void;
    onSplitLine?: (lineId: string, cursorPosition: number) => void;
    onMoveUp?: (lineId: string) => void;
    onMoveDown?: (lineId: string) => void;
}

export const LinePanel = forwardRef<HTMLDivElement, LinePanelProps>(
    (
        {
            alignmentType,
            type,
            lines,
            language,
            title,
            fontSettings,
            links,
            hoveredLink,
            selectedIds,
            editingLine,
            linkingMode,
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
        },
        ref
    ) => {
        const gradientClass =
            type === 'source'
                ? 'bg-gradient-to-br from-blue-50 to-white'
                : 'bg-gradient-to-bl from-green-50 to-white';
        const colorClass = type === 'source' ? 'bg-blue-500' : 'bg-green-500';
        const fontFamily =
            type === 'source' ? fontSettings.sourceFontFamily : fontSettings.targetFontFamily;

        const isRTL =  !!language && RTL_LANGS.indexOf(language) !== -1;

        return (
            <div ref={ref} className={`flex-1 overflow-y-auto p-6 ${gradientClass}`}>
                <div className={`max-w-2xl ${type === 'source' ? 'ml-auto' : 'mr-auto'}`}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className={`w-3 h-3 ${colorClass} rounded-full`}></span>
                        {title} ({language.toUpperCase()})
                    </h2>

                    {/*<div className="flex items-center justify-between">*/}
                    {/*    <h2 className="text-sm font-semibold text-blue-900 flex items-center gap-2">*/}
                    {/*        <Globe size={16} />*/}
                    {/*        {type === 'source' ? metadata.sourceTitle : metadata.targetTitle}*/}
                    {/*        <span className="text-blue-600">*/}
                    {/*            ({metadata[type === 'source' ? 'sourceLang' : 'targetLang'].toUpperCase()})*/}
                    {/*        </span>*/}
                    {/*    </h2>*/}
                    {/*    <span className="text-xs text-blue-700 font-medium">*/}
                    {/*        {lines.length} lines*/}
                    {/*    </span>*/}
                    {/*</div>*/}

                    {/* ADD MERGE BUTTON */}
                    {linkingMode === 'manual' && selectedIds.length >= 2 && onMergeLines && (alignmentType == 'para' || alignmentType == 'sent') && (
                        <div className="mt-2">
                            <Button
                                size="small"
                                icon={<Combine size={14} />}
                                onClick={onMergeLines}
                                className="w-full"
                            >
                                Merge {selectedIds.length} Lines
                            </Button>
                        </div>
                    )}
                    <div className="space-y-3">
                        {lines.map((line, index) => (
                            <LineItem
                                alignmentType={alignmentType}
                                key={line.id}
                                line={line}
                                index={index}
                                type={type}
                                isSelected={selectedIds.includes(line.id)}
                                linkedTo={links.filter((link) =>
                                    type === 'source'
                                        ? link.sourceIds.includes(line.id)
                                        : link.targetIds.includes(line.id)
                                )}
                                isHighlighted={links
                                    .filter((link) =>
                                        type === 'source'
                                            ? link.sourceIds.includes(line.id)
                                            : link.targetIds.includes(line.id)
                                    )
                                    .some((link) => hoveredLink === link.id)}
                                isEditing={
                                    editingLine?.type === type && editingLine?.id === line.id
                                }
                                // editingText={editingLine.text}
                                editingText={editingLine?.text || ''}
                                linkingMode={linkingMode}
                                fontFamily={fontFamily}
                                fontSize={fontSettings.fontSize}
                                onLineClick={() => onLineClick(type, line.id)}
                                onEditLine={(text) => onEditLine(line.id, text)}
                                onSaveEdit={onSaveEdit}
                                onCancelEdit={onCancelEdit}
                                onToggleFavorite={() => onToggleFavorite(line.id)}
                                onEditComment={() => onEditComment(line.id, line.comment)}
                                onEditLineNumber={() => onEditLineNumber(line.id, line.lineNumber)}
                                setEditingText={(text) => {
                                    if (editingLine) {
                                        onEditLine(line.id, text);
                                    }
                                }}
                                onSplitLine={onSplitLine}
                                isRTL={isRTL}
                                onMoveUp={onMoveUp ? () => onMoveUp(line.id) : undefined}
                                onMoveDown={onMoveDown ? () => onMoveDown(line.id) : undefined}
                                totalLines={lines.length}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }
);

LinePanel.displayName = 'LinePanel';

// Convenience wrappers
export const SourcePanel = forwardRef<HTMLDivElement, Omit<LinePanelProps, 'type' | 'language' | 'title'> & { metadata: { language: string } }>(
    ({ metadata, ...props }, ref) => (
        <LinePanel {...props} ref={ref} type="source" language={metadata.language} title="Source" />
    )
);

export const TargetPanel = forwardRef<HTMLDivElement, Omit<LinePanelProps, 'type' | 'language' | 'title'> & { metadata: { language: string } }>(
    ({ metadata, ...props }, ref) => (
        <LinePanel {...props} ref={ref} type="target" language={metadata.language} title="Target" />
    )
);

SourcePanel.displayName = 'SourcePanel';
TargetPanel.displayName = 'TargetPanel';
