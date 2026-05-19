// src/components/alignment/AlignmentHeader.tsx
import React from 'react';
import { Button, Radio, Popover } from 'antd';
import {
    Undo,
    Redo,
    Type,
    FileText,
    Download,
    LinkIcon,
    X,
    MousePointer2,
    Hand,
    RefreshCw,
} from 'lucide-react';
import { FontSettingsPopover } from './FontSettingsPopover';
import type { AlignmentMetadata, FontSettings, LinkingMode } from '../../types/alignment';
import {DocumentMetadata} from "../../utils/AlignUtils";
interface AlignmentHeaderProps {
    alignmentType: string,
    sourceMetadata: DocumentMetadata;
    targetMetadata: DocumentMetadata;
    linkingMode: LinkingMode;
    setLinkingMode: (mode: LinkingMode) => void;
    clickLinkingStep: 'idle' | 'source-selected' | 'target-selected';
    pendingSourceIds: string[];
    pendingTargetIds: string[];
    selectedSourceIds: string[];
    selectedTargetIds: string[];
    historyIndex: number;
    historyLength: number;
    undo: () => void;
    redo: () => void;
    cancelClickLinking: () => void;
    setSelectedSourceIds: (ids: string[]) => void;
    setSelectedTargetIds: (ids: string[]) => void;
    onMetadataClick: () => void;
    // onFontSettingsClick: () => void;
    onExport: () => void;
    onAlignSentence: () => void;
    fontSettings: FontSettings;
    setFontSettings: (settings: FontSettings | ((prev: FontSettings) => FontSettings)) => void;
    onCreateLink: () => void; // ADD THIS
    onMarkCompleted: () => void;
    realignStep?: 'idle' | 'start-selected' | 'end-selected';
    realignStartSourceId?: string | null;
    realignEndSourceId?: string | null;
    onCancelRealign?: () => void;
    onExecuteRealign?: () => void;
}

export const AlignmentHeader: React.FC<AlignmentHeaderProps> = ({
                                                                    alignmentType,
                                                                    sourceMetadata,
                                                                    targetMetadata,
                                                                    linkingMode,
                                                                    setLinkingMode,
                                                                    clickLinkingStep,
                                                                    pendingSourceIds,
                                                                    pendingTargetIds,
                                                                    selectedSourceIds,
                                                                    selectedTargetIds,
                                                                    historyIndex,
                                                                    historyLength,
                                                                    undo,
                                                                    redo,
                                                                    cancelClickLinking,
                                                                    setSelectedSourceIds,
                                                                    setSelectedTargetIds,
                                                                    onMetadataClick,
                                                                    onExport,
                                                                    onAlignSentence,
                                                                    fontSettings,
                                                                    setFontSettings,
                                                                    onCreateLink, // ADD THIS
                                                                    onMarkCompleted,
                                                                    realignStep,
                                                                    realignStartSourceId,
                                                                    realignEndSourceId,
                                                                    onCancelRealign,
                                                                    onExecuteRealign,
                                                                }) => {
    return (
        <>
            <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Parallel Text Aligner</h1>
                        <p className="text-sm text-gray-500 mt-1">
    <span className="truncate inline-block max-w-xs align-bottom">
      {sourceMetadata.title}
    </span>
                            {' '}↔{' '}
                            <span className="truncate inline-block max-w-xs align-bottom">
      {targetMetadata.title}
    </span>
                        </p>
                    </div>

                    <div className="flex gap-2 items-center">
                        <LinkingModeSelector
                            mode={linkingMode}
                            onChange={(mode) => {
                                setLinkingMode(mode);
                                if (mode === 'manual') {
                                    cancelClickLinking();
                                    onCancelRealign?.();
                                } else if (mode === 'click') {
                                    setSelectedSourceIds([]);
                                    setSelectedTargetIds([]);
                                    onCancelRealign?.();
                                } else if (mode === 'realign') {
                                    cancelClickLinking();
                                    setSelectedSourceIds([]);
                                    setSelectedTargetIds([]);
                                }
                            }}
                        />

                        <Button
                            icon={<Undo size={16} />}
                            onClick={undo}
                            disabled={historyIndex === 0}
                            title="Undo (Ctrl+Z)"
                        >
                            Undo
                        </Button>

                        <Button
                            icon={<Redo size={16} />}
                            onClick={redo}
                            disabled={historyIndex === historyLength - 1}
                            title="Redo (Ctrl+Y)"
                        >
                            Redo
                        </Button>

                        <FontSettingsPopover
                            fontSettings={fontSettings}
                            setFontSettings={setFontSettings}
                        />

                        <Button icon={<FileText size={16} />} onClick={onMetadataClick}>
                            Metadata
                        </Button>
                        {alignmentType == 'para' && < Button type="default" icon={<Download size={16} />} onClick={onAlignSentence}>
                            Align Sentences
                            </Button>
                        }
                        <Button
                            type="default"
                            onClick={onMarkCompleted}
                        >
                            Mark Completed
                        </Button>
                        <Button type="default" icon={<Download size={16} />} onClick={onExport}>
                            Export
                        </Button>

                        {linkingMode === 'manual' && (
                            <ManualModeControls
                                selectedSourceIds={selectedSourceIds}
                                selectedTargetIds={selectedTargetIds}
                                onCreateLink={onCreateLink} // ADD THIS
                                onClearSelection={() => {
                                    setSelectedSourceIds([]);
                                    setSelectedTargetIds([]);
                                }}
                            />
                        )}

                        {linkingMode === 'click' && clickLinkingStep !== 'idle' && (
                            <Button danger icon={<X size={16} />} onClick={cancelClickLinking}>
                                Cancel Linking
                            </Button>
                        )}

                        {linkingMode === 'realign' && realignStep && realignStep !== 'idle' && (
                            <>
                                <Button danger icon={<X size={16} />} onClick={onCancelRealign}>
                                    Cancel Realign
                                </Button>
                                {realignStep === 'end-selected' && (
                                    <Button
                                        type="primary"
                                        onClick={onExecuteRealign}
                                        style={{
                                            backgroundColor: '#1677ff',
                                            borderColor: '#1677ff',
                                            color: '#fff',
                                        }}
                                    >
                                        Execute Realign
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {linkingMode === 'click' && (
                    <ClickModeInstructions
                        step={clickLinkingStep}
                        sourceCount={pendingSourceIds.length}
                        targetCount={pendingTargetIds.length}
                    />
                )}

                {linkingMode === 'realign' && realignStep && (
                    <RealignInstructions
                        step={realignStep}
                        startId={realignStartSourceId}
                        endId={realignEndSourceId}
                    />
                )}
            </div>
        </>
    );
};

const LinkingModeSelector: React.FC<{
    mode: LinkingMode;
    onChange: (mode: LinkingMode) => void;
}> = ({ mode, onChange }) => (
    <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-gray-100 rounded-lg">
        {/*<span className="text-sm font-medium text-gray-700">Mode:</span>*/}
        <Radio.Group
            value={mode}
            onChange={(e) => onChange(e.target.value)}
            size="small"
            style={{ display: 'flex', flexWrap: 'nowrap' }}
        >
            <Radio.Button value="click" className="text-xs py-0">
                <MousePointer2 size={10} className="inline mr-1" />
                Click
            </Radio.Button>
            <Radio.Button value="manual" className="text-xs py-0">
                <Hand size={10} className="inline mr-1" />
                Manual
            </Radio.Button>
            <Radio.Button value="realign" className="text-xs py-0">
                <RefreshCw size={10} className="inline mr-1" />
                Realign
            </Radio.Button>
        </Radio.Group>
    </div>
);

const ManualModeControls: React.FC<{
    selectedSourceIds: string[];
    selectedTargetIds: string[];
    onCreateLink: () => void; // ADD THIS
    onClearSelection: () => void;
}> = ({ selectedSourceIds, selectedTargetIds, onCreateLink, onClearSelection }) => (
    <>
        <Button
            type="default"
            icon={<LinkIcon size={16} />}
            disabled={selectedSourceIds.length === 0 || selectedTargetIds.length === 0}
            onClick={onCreateLink} // ADD THIS
        >
            Link ({selectedSourceIds.length} ↔ {selectedTargetIds.length})
        </Button>
        <Button
            icon={<X size={16} />}
            onClick={onClearSelection}
            disabled={selectedSourceIds.length === 0 && selectedTargetIds.length === 0}
        >
            Clear
        </Button>
    </>
);

const ClickModeInstructions: React.FC<{
    step: 'idle' | 'source-selected' | 'target-selected';
    sourceCount: number;
    targetCount: number;
}> = ({ step, sourceCount, targetCount }) => {
    const getMessage = () => {
        switch (step) {
            case 'idle':
                return '💡 Click a source line to start creating a link';
            case 'source-selected':
                return `✅ Source selected (${sourceCount}). Click a target line to continue.`;
            case 'target-selected':
                return `✅ Target selected (${targetCount}). Configure link settings below.`;
        }
    };

    return (
        <div className="mt-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-900">
                {getMessage()}
                {step !== 'idle' && ' (Press ESC to cancel)'}
            </p>
        </div>
    );
};

const RealignInstructions: React.FC<{
    step: 'idle' | 'start-selected' | 'end-selected';
    startId: string | null;
    endId: string | null;
}> = ({ step, startId, endId }) => {
    const getMessage = () => {
        switch (step) {
            case 'idle':
                return 'Click an aligned source line to set the START of the realignment range.';
            case 'start-selected':
                return `Start: ${startId}. Now click an aligned source line AFTER the start to set the END (or skip to realign to the end).`;
            case 'end-selected':
                return `Start: ${startId} | End: ${endId}. Ready to realign. Click "Execute Realign" to proceed.`;
        }
    };

    return (
        <div className="mt-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-900">
                {getMessage()}
                {step !== 'idle' && ' (Press ESC to cancel)'}
            </p>
        </div>
    );
};