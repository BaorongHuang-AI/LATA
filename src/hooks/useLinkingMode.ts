// src/hooks/useLinkingMode.ts
import {useState, useCallback, useMemo} from 'react';
import { message } from 'antd';
import type { Line, Link, LinkingMode, AppState } from '../types/alignment';
import { getLinkType } from '../utils/linkHelpers';

interface UseLinkingModeProps {
    sourceLines: Line[];
    targetLines: Line[];
    links: Link[];
    updateState: (updates: Partial<AppState>) => void; // CHANGE THIS
}

export const useLinkingMode = ({
                                   sourceLines,
                                   targetLines,
                                   links,
                                   updateState, // CHANGE THIS
                               }: UseLinkingModeProps) => {
    const [linkingMode, setLinkingMode] = useState<LinkingMode>('click');
    const [clickLinkingStep, setClickLinkingStep] = useState<
        'idle' | 'source-selected' | 'target-selected'
        >('idle');
    const [pendingSourceIds, setPendingSourceIds] = useState<string[]>([]);
    const [pendingTargetIds, setPendingTargetIds] = useState<string[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
    const [linkFormState, setLinkFormState] = useState({
        confidence: 1.0,
        strategy: '',
        comment: '',
    });

    // Realign mode state
    const [realignStep, setRealignStep] = useState<'idle' | 'start-selected' | 'end-selected'>('idle');
    const [realignStartSourceId, setRealignStartSourceId] = useState<string | null>(null);
    const [realignEndSourceId, setRealignEndSourceId] = useState<string | null>(null);

    const linkedSourceIds = useMemo(
        () => new Set(links.flatMap(l => l.sourceIds)),
        [links]
    )

    const linkedTargetIds = useMemo(
        () => new Set(links.flatMap(l => l.targetIds)),
        [links]
    )
    function resolveLineNumber(
        id: string,
        sourceLines: Line[],
        targetLines: Line[]
    ): string | undefined {
        return (
            sourceLines.find(l => l.id === id)?.lineNumber ??
            targetLines.find(l => l.id === id)?.lineNumber
        )
    }

    const sourceIdToLineNumber = new Map(
        sourceLines.map(l => [l.id, l.lineNumber])
    );

    const targetIdToLineNumber = new Map(
        targetLines.map(l => [l.id, l.lineNumber])
    );

    const handleLineClick = useCallback(
        (type: 'source' | 'target', id: string) => {
            if (linkingMode === 'realign') {
                if (type !== 'source') {
                    message.warning('In realign mode, please click source lines only.');
                    return;
                }

                if (realignStep === 'idle') {
                    setRealignStartSourceId(id);
                    setRealignStep('start-selected');
                    message.info('Start source selected. Now click an end source line that is also aligned.');
                } else if (realignStep === 'start-selected') {
                    if (id === realignStartSourceId) {
                        message.warning('End must be different from start. Click a different source line.');
                        return;
                    }
                    setRealignEndSourceId(id);
                    setRealignStep('end-selected');
                    message.info('End source selected. Ready to realign.');
                }
                // end-selected: ignore further clicks
                return;
            }

            if (linkingMode === 'click') {
                // Click linking logic
                if (clickLinkingStep === 'idle') {
                    if (type === 'source') {
                        const lineNumber = resolveLineNumber(id, sourceLines, targetLines)
                        // console.log("selecting source now", sourceLines, targetLines, links, id, lineNumber);

                        // Check if any selected source or target ID is already used in existing links
                        const usedSourceId = linkedSourceIds.has(lineNumber);
                        if (usedSourceId) {
                            message.warning(`Source line ${lineNumber} is already used in an existing link`);
                            return;
                        }
                        setPendingSourceIds([id]);
                        setClickLinkingStep('source-selected');
                        message.info('Source selected. Now click a target line to create link.');
                    } else {
                        message.warning('Please click a source line first.');
                    }

                } else if (clickLinkingStep === 'source-selected') {
                    if (type === 'source') {
                        const lineNumber = resolveLineNumber(id, sourceLines, targetLines)
                        console.log("selecting source now", sourceLines, targetLines, links, id, lineNumber);
                        //
                        // Check if any selected source or target ID is already used in existing links
                        const usedSourceId = linkedSourceIds.has(lineNumber);
                        if (usedSourceId) {
                            message.warning(`Source line ${lineNumber} is already used in an existing link`);
                            return;
                        }
                        setPendingSourceIds((prev) => {


                            const newIds = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
                            if (newIds.length === 0) {
                                setClickLinkingStep('idle');
                                message.info('Source selection cleared.');
                            }
                            return newIds;
                        });
                    } else {
                        const lineNumber = resolveLineNumber(id, sourceLines, targetLines)

                        console.log("selecting target now", sourceLines, targetLines, links, id, lineNumber, linkedTargetIds);


                        const usedTargetId = linkedTargetIds.has(lineNumber);



                        if (usedTargetId) {
                            message.warning(`Target line ${lineNumber} is already used in an existing link`);
                            return;
                        }
                        setPendingTargetIds([id]);
                        setClickLinkingStep('target-selected');
                    }
                } else if (clickLinkingStep === 'target-selected') {

                    if (type === 'target') {

                        setPendingTargetIds((prev) =>
                            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                        );
                    }

                }
            } else {
                // Manual selection logic
                if (type === 'source') {
                    setSelectedSourceIds((prev) =>
                        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                    );
                } else {
                    setSelectedTargetIds((prev) =>
                        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                    );
                }
            }
        },
        [linkingMode, clickLinkingStep, realignStep, realignStartSourceId, linkedSourceIds, linkedTargetIds]
    );

    function notUndefined<T>(x: T | undefined): x is T {
        return x !== undefined;
    }

    const confirmQuickLink = useCallback(() => {
        if (pendingSourceIds.length === 0 || pendingTargetIds.length === 0) {
            message.warning('Please select at least one source and one target line');
            return;
        }



        const linkType = getLinkType(pendingSourceIds.length, pendingTargetIds.length);

        const newLink: Link = {
            id: `l${Date.now()}`,
            source_sentence_keys: [...pendingSourceIds],
            target_sentence_keys: [...pendingTargetIds],
            sourceIds: [...pendingSourceIds]
                .map(id => sourceIdToLineNumber.get(id))
                .filter(notUndefined),

            targetIds: [...pendingTargetIds]
                .map(id => targetIdToLineNumber.get(id))
                .filter(notUndefined),
            confidence: linkFormState.confidence,
            strategy: linkFormState.strategy || undefined,
            comment: linkFormState.comment || undefined,
            isFavorite: false,
        };

        // console.log("new link", newLink);
        const updatedLinks = [...links, newLink];
        updateState({ links: updatedLinks }); // CHANGE THIS
        // setLinks(updatedLinks);
        // saveToHistory({ sourceLines, targetLines, links: updatedLinks });

        setPendingSourceIds([]);
        setPendingTargetIds([]);
        setClickLinkingStep('idle');
        setLinkFormState({ confidence: 0.8, strategy: '', comment: '' });

        message.success(`${linkType} link created successfully`);
    }, [pendingSourceIds, pendingTargetIds, linkFormState, links, sourceLines, targetLines, updateState]);

    const cancelClickLinking = useCallback(() => {
        setPendingSourceIds([]);
        setPendingTargetIds([]);
        setClickLinkingStep('idle');
        setLinkFormState({ confidence: 0.8, strategy: '', comment: '' });
        message.info('Link creation cancelled');
    }, []);

    const cancelRealigning = useCallback(() => {
        setRealignStartSourceId(null);
        setRealignEndSourceId(null);
        setRealignStep('idle');
        message.info('Realign cancelled');
    }, []);

    return {
        linkingMode,
        clickLinkingStep,
        pendingSourceIds,
        pendingTargetIds,
        selectedSourceIds,
        selectedTargetIds,
        linkFormState,
        setLinkingMode,
        setLinkFormState,
        handleLineClick,
        confirmQuickLink,
        cancelClickLinking,
        setSelectedSourceIds,
        setSelectedTargetIds,
        realignStep,
        realignStartSourceId,
        realignEndSourceId,
        cancelRealigning,
        setRealignStep,
        setRealignStartSourceId,
        setRealignEndSourceId,
    };
};
