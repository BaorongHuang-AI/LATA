import React, { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import { AlignmentHeader } from '../components/alignment/AlignmentHeader';
import { SourcePanel, TargetPanel } from '../components/alignment/LinePanel';
import { LinkCanvas } from '../components/alignment/LinkCanvas';
import { ModalsContainer } from '../components/alignment/ModalsContainer';
import { useAlignmentState } from '../hooks/useAlignmentState';
import { useAlignmentHistory } from '../hooks/useAlignmentHistory';
import { useLinkingMode } from '../hooks/useLinkingMode';
import { useMousePosition } from '../hooks/useMousePosition';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { generateCESAlignXML } from '../utils/xmlExport';
import { getLinkType } from '../utils/linkHelpers';
import type {Line, Link, AppState, AlignmentPair} from '../types/alignment';

/**
 * Removes all links that reference any of the given line IDs
 */
/**
 * Resolves a line ID to its line number
 */
function resolveLineNumber(
    id: string,
    sourceLines: Line[],
    targetLines: Line[]
): string | undefined {
    return (
        sourceLines.find(l => l.id === id)?.lineNumber ??
        targetLines.find(l => l.id === id)?.lineNumber
    );
}

/**
 * Resolves a line number back to its ID in the new line array
 */
function resolveIdFromLineNumber(
    lineNumber: string,
    lines: Line[]
): string | undefined {
    return lines.find(l => l.lineNumber === lineNumber)?.id;
}

/**
 * Reorders lines sequentially starting from 1
 */
const reorderLines = (lines: Line[], prefix: string): Line[] => {
    return lines.map((line, index) => ({
        ...line,
        lineNumber: `${prefix}${index}`,
    }));
};

/**
 * Removes all links that reference any of the given line NUMBERS
 */
const removeLinksReferencingLineNumbers = (
    links: Link[],
    lineNumbers: string [],
    sourceLines: Line[],
    targetLines: Line[]
): Link[] => {
    return links.filter(link => {
        const sourceLineNumbers = link.sourceIds.map(id =>
            resolveIdFromLineNumber(id, sourceLines)
        );
        const targetLineNumbers = link.targetIds.map(id =>
            resolveIdFromLineNumber(id, targetLines)
        );

        const hasSourceLineNumber = sourceLineNumbers.some(ln => ln && lineNumbers.includes(ln));
        const hasTargetLineNumber = targetLineNumbers.some(ln => ln && lineNumbers.includes(ln));

        return !hasSourceLineNumber && !hasTargetLineNumber;
    });
};
/**
 * Updates link references after merge/split operations
 * Creates mapping based on line position (index)
 */
const updateLinksAfterReorder = (
    links: Link[],
    oldLines: Line[],
    newLines: Line[],
    type: 'source' | 'target'
): Link[] => {
    // Create position-based mapping: old position -> old line
    const oldLinesByPosition = new Map<number, Line>();
    oldLines.forEach((line, index) => {
        oldLinesByPosition.set(index, line);
    });

    // Create mapping: oldId -> newId based on content matching at new positions
    const idMapping = new Map<string, string>();

    // For each new line, find which old line it corresponds to by text content
    newLines.forEach((newLine, newIndex) => {
        // Find old line with matching text
        const oldLine = oldLines.find(ol => ol.text === newLine.text);
        if (oldLine) {
            idMapping.set(oldLine.id, newLine.id);
        }
    });

    // Update links with new IDs
    return links.map(link => {
        if (type === 'source') {
            const newSourceIds = link.sourceIds
                .map(id => idMapping.get(id))
                .filter((id): id is string => id !== undefined);

            // If we couldn't map all IDs, this link references deleted lines
            if (newSourceIds.length !== link.sourceIds.length) {
                return null;
            }

            return { ...link, sourceIds: newSourceIds };
        } else {
            const newTargetIds = link.targetIds
                .map(id => idMapping.get(id))
                .filter((id): id is string => id !== undefined);

            // If we couldn't map all IDs, this link references deleted lines
            if (newTargetIds.length !== link.targetIds.length) {
                return null;
            }

            return { ...link, targetIds: newTargetIds };
        }
    }).filter((link): link is Link => link !== null);
};

const ParaAlignmentPage: React.FC = () => {
    const { documentId } = useParams<{ documentId: string }>();

    // Load initial data
    const {
        sourceLines: initialSourceLines,
        targetLines: initialTargetLines,
        links: initialLinks,
        sourceMeta,
        targetMeta,
        setSourceMeta,
        setTargetMeta,
        fontSettings,
        setFontSettings,
        initialState,
    } = useAlignmentState(documentId);

    // History management
    const {
        history,
        historyIndex,
        saveToHistory,
        undo,
        redo,
        currentState,
    } = useAlignmentHistory(documentId, initialState, "para");

    // Working state - derived from current history state or initial
    const [workingState, setWorkingState] = useState<AppState>({
        sourceLines: initialSourceLines,
        targetLines: initialTargetLines,
        links: initialLinks,
    });

    // Sync working state with current history state
    useEffect(() => {
        if (currentState) {
            setWorkingState(currentState);
        }
    }, [currentState]);

    // Sync with initial state when loaded
    useEffect(() => {
        if (initialState && !currentState) {
            setWorkingState(initialState);
        }
    }, [initialState, currentState]);

    // Extract current values
    const sourceLines = workingState.sourceLines;
    const targetLines = workingState.targetLines;
    const links = workingState.links;

    // Update state helper
    const updateState = useCallback((updates: Partial<AppState>) => {
        const newState: AppState = {
            sourceLines: updates.sourceLines ?? sourceLines,
            targetLines: updates.targetLines ?? targetLines,
            links: updates.links ?? links,
        };
        setWorkingState(newState);
        saveToHistory(newState);
    }, [sourceLines, targetLines, links, saveToHistory]);

    // Linking mode
    const {
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
    } = useLinkingMode({
        sourceLines,
        targetLines,
        links,
        updateState,
    });


    // useEffect(() => {
    //     // Define the async function
    //     const handleMetadataSave = async () => {
    //         setSourceMeta(sourceMeta); // 👈 But wait! This may not be needed here
    //         setTargetMeta(targetMeta);
    //
    //         try {
    //             await window.api.updateDocumentMetadata({
    //                 documentId,
    //                 sourceMeta,
    //                 targetMeta,
    //             });
    //             message.success("Metadata saved");
    //         } catch (err) {
    //             console.error("Failed to save metadata", err);
    //             message.error("Failed to save metadata");
    //         }
    //     };
    //
    //     // Call it
    //     handleMetadataSave();
    // }, [sourceMeta, targetMeta]);
    const { mousePosition, handleMouseMove } = useMousePosition();

    // Local state
    const [selectedLinkForDetails, setSelectedLinkForDetails] = useState<string | null>(null);
    const [editingLine, setEditingLine] = useState<{
        type: 'source' | 'target';
        id: string;
        text: string;
    } | null>(null);

    // Modal states
    const [modals, setModals] = useState({
        createLink: false,
        comment: false,
        metadata: false,
        editLine: false,
        fontSettings: false,
        quickLink: false,
        linkDetails: false,
    });

    // Edit state
    const [editingItem, setEditingItem] = useState<{
        type: 'line' | 'link';
        id: string;
        field: 'comment' | 'lineNumber';
    } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Refs
    const sourceContainerRef = useRef<HTMLDivElement>(null);
    const targetContainerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Keyboard shortcuts
    useKeyboardShortcuts({
        undo,
        redo,
        cancelClickLinking,
        clickLinkingStep,
    });

    // Sync quick link modal with click linking step
    useEffect(() => {
        setModals((prev) => ({
            ...prev,
            quickLink: clickLinkingStep === 'target-selected',
        }));
    }, [clickLinkingStep]);

    // Handlers
    const handleExport = () => {
        // const xmlContent = generateCESAlignXML(metadata, sourceLines, targetLines, links);
        // downloadXML(xmlContent);
        message.success('XML file downloaded');
    };

    const handleCreateManualLink = () => {
        setModals((m) => ({ ...m, createLink: true }));
    };

    const toggleLineFavorite = (type: 'source' | 'target', id: string) => {
        if (type === 'source') {
            const newSourceLines = sourceLines.map((line) =>
                line.id === id ? { ...line, isFavorite: !line.isFavorite } : line
            );
            updateState({ sourceLines: newSourceLines });
        } else {
            const newTargetLines = targetLines.map((line) =>
                line.id === id ? { ...line, isFavorite: !line.isFavorite } : line
            );
            updateState({ targetLines: newTargetLines });
        }
    };

    const toggleLinkFavorite = (linkId: string) => {
        const newLinks = links.map((link) =>
            link.id === linkId ? { ...link, isFavorite: !link.isFavorite } : link
        );
        updateState({ links: newLinks });
    };

    const deleteLink = (linkId: string) => {
        const newLinks = links.filter((link) => link.id !== linkId);
        updateState({ links: newLinks });
        message.success('Link deleted');
    };

    const saveLineEdit = () => {
        if (!editingLine) return;

        if (editingLine.type === 'source') {
            const newSourceLines = sourceLines.map((line) =>
                line.id === editingLine.id ? { ...line, text: editingLine.text } : line
            );
            updateState({ sourceLines: newSourceLines });
        } else {
            const newTargetLines = targetLines.map((line) =>
                line.id === editingLine.id ? { ...line, text: editingLine.text } : line
            );
            updateState({ targetLines: newTargetLines });
        }

        setEditingLine(null);
        message.success('Text updated');
    };

    const openEditModal = (
        type: 'line' | 'link',
        id: string,
        field: 'comment' | 'lineNumber',
        currentValue?: string
    ) => {
        setEditingItem({ type, id, field });
        setEditValue(currentValue || '');
        setModals((prev) => ({
            ...prev,
            [field === 'comment' ? 'comment' : 'editLine']: true,
        }));
    };

    const saveEdit = () => {
        if (!editingItem) return;

        if (editingItem.type === 'line') {
            const isSource = sourceLines.some((l) => l.id === editingItem.id);
            if (isSource) {
                const newSourceLines = sourceLines.map((line) =>
                    line.id === editingItem.id ? { ...line, [editingItem.field]: editValue } : line
                );
                updateState({ sourceLines: newSourceLines });
            } else {
                const newTargetLines = targetLines.map((line) =>
                    line.id === editingItem.id ? { ...line, [editingItem.field]: editValue } : line
                );
                updateState({ targetLines: newTargetLines });
            }
        } else {
            const newLinks = links.map((link) =>
                link.id === editingItem.id ? { ...link, [editingItem.field]: editValue } : link
            );
            updateState({ links: newLinks });
        }

        setEditingItem(null);
        setEditValue('');
        message.success('Saved successfully');
    };

    const createLink = () => {
        if (selectedSourceIds.length === 0 || selectedTargetIds.length === 0) {
            message.warning('Please select at least one source and one target line');
            return;
        }

        // Check if any selected source or target ID is already used in existing links
        const usedSourceId = selectedSourceIds.find((id) => {
                console.log("id", id);
                console.log("selected id", selectedSourceIds);
                links.some((link) => link.sourceIds.includes(id));
            }
        );

        const usedTargetId = selectedTargetIds.find((id) =>
            links.some((link) => link.targetIds.includes(id))
        );

        if (usedSourceId) {
            message.warning(`Source line ${usedSourceId} is already used in an existing link`);
            return;
        }

        if (usedTargetId) {
            message.warning(`Target line ${usedTargetId} is already used in an existing link`);
            return;
        }

        const existingLink = links.find(
            (link) =>
                link.sourceIds.length === selectedSourceIds.length &&
                link.targetIds.length === selectedTargetIds.length &&
                link.sourceIds.every((id) => selectedSourceIds.includes(id)) &&
                link.targetIds.every((id) => selectedTargetIds.includes(id))
        );

        if (existingLink) {
            message.warning('This link already exists');
            return;
        }

        const linkType = getLinkType(selectedSourceIds.length, selectedTargetIds.length);

        const newLink: Link = {
            id: `l${Date.now()}`,
            sourceIds: [...selectedSourceIds],
            targetIds: [...selectedTargetIds],
            confidence: linkFormState.confidence,
            strategy: linkFormState.strategy || undefined,
            comment: linkFormState.comment || undefined,
            isFavorite: false,
        };

        console.log("new link", newLink);
        const updatedLinks = [...links, newLink];
        updateState({ links: updatedLinks });

        setSelectedSourceIds([]);
        setSelectedTargetIds([]);
        setModals((m) => ({ ...m, createLink: false }));
        setLinkFormState({ confidence: 1.0, strategy: '', comment: '' });

        message.success(`${linkType} link created successfully`);
    };


    const areConsecutive = (lines: Line[], selectedIds: string[]) => {
        const indices = selectedIds
            .map(id => lines.findIndex(l => l.id === id))
            .sort((a, b) => a - b);

        return indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
    };

// ADD THESE FUNCTIONS:
//
//     const mergeLines = (type: 'source' | 'target') => {
//         const lines = type === 'source' ? sourceLines : targetLines;
//         const selectedIds = type === 'source' ? selectedSourceIds : selectedTargetIds;
//
//         if (selectedIds.length < 2) {
//             message.warning('Please select at least 2 lines to merge');
//             return;
//         }
//
//         if (!areConsecutive(lines, selectedIds)) {
//             message.warning('Selected lines must be consecutive');
//             return;
//         }
//
//         // Get indices and sort
//         const indices = selectedIds
//             .map(id => lines.findIndex(l => l.id === id))
//             .sort((a, b) => a - b);
//
//         const firstIndex = indices[0];
//         const selectedLines = indices.map(i => lines[i]);
//
//         // Check if any selected lines are linked
//         const linkedLineIds = new Set<string>();
//         links.forEach(link => {
//             const relevantIds = type === 'source' ? link.sourceIds : link.targetIds;
//             relevantIds.forEach(id => {
//                 if (selectedIds.includes(id)) {
//                     linkedLineIds.add(id);
//                 }
//             });
//         });
//
//         if (linkedLineIds.size > 0) {
//             message.warning('Cannot merge lines that are part of links. Delete the links first.');
//             return;
//         }
//
//         // Create merged line
//         const mergedText = selectedLines.map(l => l.text).join(' ');
//         const mergedLineNumber = selectedLines.map(l => l.lineNumber).join('+');
//         const mergedComment = selectedLines
//             .map(l => l.comment)
//             .filter(Boolean)
//             .join(' | ');
//
//         const mergedLine: Line = {
//             id: `${type[0]}${Date.now()}`, // 's123' or 't123'
//             lineNumber: mergedLineNumber,
//             text: mergedText,
//             comment: mergedComment || undefined,
//             isFavorite: selectedLines.some(l => l.isFavorite),
//         };
//
//         // Create new lines array
//         const newLines = [
//             ...lines.slice(0, firstIndex),
//             mergedLine,
//             ...lines.slice(firstIndex + selectedIds.length),
//         ];
//
//         // Update state
//         if (type === 'source') {
//             updateState({ sourceLines: newLines });
//             setSelectedSourceIds([]);
//         } else {
//             updateState({ targetLines: newLines });
//             setSelectedTargetIds([]);
//         }
//
//         message.success(`Merged ${selectedIds.length} lines into one`);
//     };
    const mergeLines = (type: 'source' | 'target') => {
        const lines = type === 'source' ? sourceLines : targetLines;
        const selectedIds = type === 'source' ? selectedSourceIds : selectedTargetIds;

        if (selectedIds.length < 2) {
            message.warning('Please select at least 2 lines to merge');
            return;
        }

        if (!areConsecutive(lines, selectedIds)) {
            message.warning('Selected lines must be consecutive');
            return;
        }

        // Step 1: Get indices and sort
        const indices = selectedIds
            .map(id => lines.findIndex(l => l.id === id))
            .sort((a, b) => a - b);

        const firstIndex = indices[0];
        const lastIndex = indices[indices.length - 1];
        const selectedLines = indices.map(i => lines[i]);

        // Check if any selected lines are linked
        const linkedLineIds = new Set<string>();
        links.forEach(link => {
            const relevantIds = type === 'source' ? link.sourceIds : link.targetIds;
            relevantIds.forEach(id => {
                if (selectedIds.includes(id)) {
                    linkedLineIds.add(id);
                }
            });
        });

        if (linkedLineIds.size > 0) {
            message.warning('Merging will delete existing links. Proceeding with merge...');
        }

        // Step 2: Get the line numbers being merged (these will be removed)
        // const mergedLineNumbers = new Set(selectedLines.map(l => l.lineNumber));

        // Step 3: Create merged line
        const mergedText = selectedLines.map(l => l.text).join(' ');
        const mergedComment = selectedLines
            .map(l => l.comment)
            .filter(Boolean)
            .join(' | ');

        const mergedLine: Line = {
            id: `${type[0]}${Date.now()}`,
            lineNumber: '', // Will be set during reordering
            text: mergedText,
            comment: mergedComment || undefined,
            isFavorite: selectedLines.some(l => l.isFavorite),
        };

        // Step 4: Create new lines array (merged)
        const newLinesBeforeReorder = [
            ...lines.slice(0, firstIndex),      // Lines before merge
            mergedLine,                          // The merged line
            ...lines.slice(lastIndex + 1),      // Lines after merge
        ];

        // Step 5: Reorder all line numbers sequentially
        const prefix = type === 'source' ? 'sp' : 'tp';
        const reorderedLines = reorderLines(newLinesBeforeReorder, prefix);

        console.log("links", links, selectedIds, reorderedLines);

        // Step 6: Remove links that reference merged line numbers
        let newLinks = removeLinksReferencingLineNumbers(
            links,
            selectedIds,
            sourceLines,
            targetLines
        );
        console.log("new links", newLinks, selectedIds, reorderedLines);
        // Step 6: Update remaining links - map old IDs to new IDs for lines that weren't merged
        // Build the mapping for lines that exist in both old and new arrays
        const idMapping = new Map<string, string>();

        // Lines before merge point keep their content, get new IDs from reordered array
        lines.slice(0, firstIndex).forEach((oldLine, index) => {
            idMapping.set(resolveLineNumber(oldLine.id,sourceLines, targetLines), resolveLineNumber(reorderedLines[index].id, sourceLines, targetLines));
        });

        // Lines after merge point: their position shifts down
        // Old position: lastIndex + 1, lastIndex + 2, ...
        // New position: firstIndex + 1, firstIndex + 2, ...
        lines.slice(lastIndex + 1).forEach((oldLine, offsetIndex) => {
            const newPosition = firstIndex + 1 + offsetIndex;
            // console.log("new position", firstIndex, offsetIndex, newPosition,
            //     oldLine,
            //     oldLine.id, reorderedLines, reorderedLines[newPosition]);
            idMapping.set(resolveLineNumber(oldLine.id,sourceLines, targetLines), resolveLineNumber(reorderedLines[newPosition].id, reorderedLines, reorderedLines));
            // console.log("idmapping", idMapping);
        });
        console.log("new links after position change", lines, idMapping);
        // Update links with new IDs
        newLinks = newLinks.map(link => {
            if (type === 'source') {
                const newSourceIds = link.sourceIds.map(id => idMapping.get(id) || id);
                // console.log("new sourceIds", newSourceIds, idMapping);
                return { ...link, sourceIds: newSourceIds };
            } else {
                const newTargetIds = link.targetIds.map(id => idMapping.get(id) || id);
                return { ...link, targetIds: newTargetIds };
            }
        });

        console.log("new links after decrease", newLinks, selectedIds);
        // Update state
        if (type === 'source') {
            updateState({
                sourceLines: reorderedLines,
                links: newLinks
            });
            setSelectedSourceIds([]);
        } else {
            updateState({
                targetLines: reorderedLines,
                links: newLinks
            });
            setSelectedTargetIds([]);
        }

        const deletedLinksCount = links.length - newLinks.length;
        message.success(
            `Merged ${selectedIds.length} lines into one. ` +
            (deletedLinksCount > 0 ? `${deletedLinksCount} link(s) removed.` : '')
        );
    };
    //
    // const splitLine = (type: 'source' | 'target', lineId: string, cursorPosition: number) => {
    //     const lines = type === 'source' ? sourceLines : targetLines;
    //     const lineIndex = lines.findIndex(l => l.id === lineId);
    //
    //     if (lineIndex === -1) {
    //         message.error('Line not found');
    //         return;
    //     }
    //
    //     const line = lines[lineIndex];
    //
    //     // Check if this line is linked
    //     const isLinked = links.some(link => {
    //         const relevantIds = type === 'source' ? link.sourceIds : link.targetIds;
    //         return relevantIds.includes(lineId);
    //     });
    //
    //     if (isLinked) {
    //         message.warning('Cannot split a line that is part of a link. Delete the link first.');
    //         return;
    //     }
    //
    //     // Split text at cursor position
    //     const textBefore = line.text.slice(0, cursorPosition).trim();
    //     const textAfter = line.text.slice(cursorPosition).trim();
    //
    //     if (!textBefore || !textAfter) {
    //         message.warning('Cannot split at this position - both parts must have text');
    //         return;
    //     }
    //
    //     // Create two new lines
    //     const line1: Line = {
    //         id: `${type[0]}${Date.now()}a`,
    //         lineNumber: `${line.lineNumber}a`,
    //         text: textBefore,
    //         comment: line.comment ? `${line.comment} (part 1)` : undefined,
    //         isFavorite: line.isFavorite,
    //     };
    //
    //     const line2: Line = {
    //         id: `${type[0]}${Date.now()}b`,
    //         lineNumber: `${line.lineNumber}b`,
    //         text: textAfter,
    //         comment: line.comment ? `${line.comment} (part 2)` : undefined,
    //         isFavorite: line.isFavorite,
    //     };
    //
    //     // Create new lines array
    //     const newLines = [
    //         ...lines.slice(0, lineIndex),
    //         line1,
    //         line2,
    //         ...lines.slice(lineIndex + 1),
    //     ];
    //
    //     // Update state
    //     if (type === 'source') {
    //         updateState({ sourceLines: newLines });
    //     } else {
    //         updateState({ targetLines: newLines });
    //     }
    //
    //     message.success('Line split successfully');
    // };
    const splitLine = (type: 'source' | 'target', lineId: string, cursorPosition: number) => {
        const lines = type === 'source' ? sourceLines : targetLines;
        const lineIndex = lines.findIndex(l => l.id === lineId);
        const selectedIds = type === 'source' ? selectedSourceIds : selectedTargetIds;
        if (lineIndex === -1) {
            message.error('Line not found');
            return;
        }

        const line = lines[lineIndex];

        // Check if this line is linked
        const isLinked = links.some(link => {
            const relevantIds = type === 'source' ? link.sourceIds : link.targetIds;
            return relevantIds.includes(lineId);
        });

        if (isLinked) {
            message.warning('Splitting will delete existing links. Proceeding with split...');
        }

        // Split text at cursor position
        const textBefore = line.text.slice(0, cursorPosition).trim();
        const textAfter = line.text.slice(cursorPosition).trim();

        if (!textBefore || !textAfter) {
            message.warning('Cannot split at this position - both parts must have text');
            return;
        }

        // Step 1: Create two new lines
        const line1: Line = {
            id: `${type[0]}${Date.now()}a`,
            lineNumber: '', // Will be set during reordering
            text: textBefore,
            comment: line.comment ? `${line.comment} (part 1)` : undefined,
            isFavorite: line.isFavorite,
        };

        const line2: Line = {
            id: `${type[0]}${Date.now()}b`,
            lineNumber: '', // Will be set during reordering
            text: textAfter,
            comment: line.comment ? `${line.comment} (part 2)` : undefined,
            isFavorite: line.isFavorite,
        };

        // Step 2: Create new lines array (split)
        const newLinesBeforeReorder = [
            ...lines.slice(0, lineIndex),       // Lines before split
            line1,                               // First part
            line2,                               // Second part
            ...lines.slice(lineIndex + 1),      // Lines after split
        ];

        // Step 3: Reorder all line numbers sequentially
        const prefix = type === 'source' ? 'sp' : 'tp';
        const reorderedLines = reorderLines(newLinesBeforeReorder, prefix);

        // Step 4: Remove links that reference the split line
        // let newLinks = removeLinksReferencingLineNumbers(links,
        //     sourceLines,
        //     targetLines,
        //     [lineId]);

        let newLinks = removeLinksReferencingLineNumbers(
            links,
            selectedIds,
            sourceLines,
            targetLines
        );
        // Step 5: Update remaining links - map old IDs to new IDs
        const idMapping = new Map<string, string>();

        // Lines before split point keep their position
        lines.slice(0, lineIndex).forEach((oldLine, index) => {
            idMapping.set(oldLine.id, reorderedLines[index].id);
        });

        // Lines after split point: their position shifts up by 1
        // Old position: lineIndex + 1, lineIndex + 2, ...
        // New position: lineIndex + 2, lineIndex + 3, ... (because we added 2 lines, removed 1)
        lines.slice(lineIndex + 1).forEach((oldLine, offsetIndex) => {
            const newPosition = lineIndex + 2 + offsetIndex;
            // idMapping.set(oldLine.id, reorderedLines[newPosition].id);
            idMapping.set(resolveLineNumber(oldLine.id,sourceLines, targetLines), resolveLineNumber(reorderedLines[newPosition].id, reorderedLines, reorderedLines));
        });

        // Update links with new IDs
        newLinks = newLinks.map(link => {
            if (type === 'source') {
                const newSourceIds = link.sourceIds.map(id => idMapping.get(id) || id);
                return { ...link, sourceIds: newSourceIds };
            } else {
                const newTargetIds = link.targetIds.map(id => idMapping.get(id) || id);
                return { ...link, targetIds: newTargetIds };
            }
        });

        // Update state
        if (type === 'source') {
            updateState({
                sourceLines: reorderedLines,
                links: newLinks
            });
        } else {
            updateState({
                targetLines: reorderedLines,
                links: newLinks
            });
        }

        const deletedLinksCount = links.length - newLinks.length;
        message.success(
            'Line split successfully. ' +
            (deletedLinksCount > 0 ? `${deletedLinksCount} link(s) removed.` : '')
        );
    };

    const moveLine = (type: 'source' | 'target', lineId: string, direction: 'up' | 'down') => {
        const lines = type === 'source' ? sourceLines : targetLines;
        const lineIndex = lines.findIndex(l => l.id === lineId);

        if (lineIndex === -1) {
            message.error('Line not found');
            return;
        }

        // Check boundaries
        if (direction === 'up' && lineIndex === 0) {
            message.warning('Cannot move the first line up');
            return;
        }

        if (direction === 'down' && lineIndex === lines.length - 1) {
            message.warning('Cannot move the last line down');
            return;
        }

        const targetIndex = direction === 'up' ? lineIndex - 1 : lineIndex + 1;

        // Swap the lines
        const newLines = [...lines];
        [newLines[lineIndex], newLines[targetIndex]] = [newLines[targetIndex], newLines[lineIndex]];

        // Reorder line numbers sequentially
        const prefix = type === 'source' ? 'sp' : 'tp';
        const reorderedLines = reorderLines(newLines, prefix);

        // Update links - map old IDs to new IDs
        const idMapping = new Map<string, string>();
        lines.forEach((oldLine, index) => {
            const newLine = reorderedLines.find(l => l.text === oldLine.text);
            if (newLine) {
                idMapping.set(oldLine.id, newLine.id);
            }
        });

        const newLinks = links.map(link => {
            if (type === 'source') {
                const newSourceIds = link.sourceIds.map(id => idMapping.get(id) || id);
                return { ...link, sourceIds: newSourceIds };
            } else {
                const newTargetIds = link.targetIds.map(id => idMapping.get(id) || id);
                return { ...link, targetIds: newTargetIds };
            }
        });

        // Update state
        if (type === 'source') {
            updateState({
                sourceLines: reorderedLines,
                links: newLinks
            });
        } else {
            updateState({
                targetLines: reorderedLines,
                links: newLinks
            });
        }

        message.success(`Line moved ${direction} successfully`);
    };

    const moveLineUp = (type: 'source' | 'target', lineId: string) => {
        moveLine(type, lineId, 'up');
    };

    const moveLineDown = (type: 'source' | 'target', lineId: string) => {
        moveLine(type, lineId, 'down');
    };

    const updateLink =  (linkId, updates) => {
        const updatedLinks = links.map(link =>
            link.id === linkId
                ? {...link, ...updates}
                : link
        );

        updateState({
            links: updatedLinks
            // sourceLines will remain unchanged if not passed
        });
    }

    if (!initialState) return <div>Loading alignment…</div>;

    function indexByLineNumber(lines: any) {
        return new Map<any, any>(
            lines.map(line => [line.lineNumber, line])
        );
    }

    //
    // function buildAlignmentPairs(
    //     sourceLines: Line[],
    //     targetLines: Line[],
    //     links: Link[],
    //     separator: string = '_'
    // ): any[] {
    //     const sourceMap = indexByLineNumber(sourceLines);
    //     const targetMap = indexByLineNumber(targetLines);
    //
    //     return links.map(link => {
    //         const sourceText = link.sourceIds
    //             .map(id => sourceMap.get(id)?.text)
    //             .filter(Boolean)
    //             .join("\n");
    //
    //         const targetText = link.targetIds
    //             .map(id => targetMap.get(id)?.text)
    //             .filter(Boolean)
    //             .join("\n");
    //
    //         return {
    //             source: sourceText,
    //             target: targetText,
    //             sourceId: link.sourceIds.join(separator),
    //             targetId: link.targetIds.join(separator),
    //         };
    //     });
    // }

    function buildAlignmentPairs(
        sourceLines: Line[],
        targetLines: Line[],
        links: Link[],
        separator: string = '_'
    ): any[] {
        const sourceMap = indexByLineNumber(sourceLines);
        const targetMap = indexByLineNumber(targetLines);

        return links.map(link => {
            const sourceLinesForPair = link.sourceIds
                .map(id => sourceMap.get(id))
                .filter(Boolean);

            const targetLinesForPair = link.targetIds
                .map(id => targetMap.get(id))
                .filter(Boolean);

            return {
                sourceLines: sourceLinesForPair,
                targetLines: targetLinesForPair,
                sourceId: link.sourceIds.join(separator),
                targetId: link.targetIds.join(separator),
            };
        });
    }


    const runBatchAlignment = async () => {
        const pairs = buildAlignmentPairs(
            sourceLines,
            targetLines,
            links
        );

        console.log("pairs", pairs, documentId);
        if (!documentId) {
            console.error("documentId is missing from route params");
            return; // or handle the error appropriately
        }
        const results = await window.api.alignParagraphBatch(
            pairs,
            sourceMeta.language,
            targetMeta.language,
            documentId
        );

        console.log(results);
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50" onMouseMove={handleMouseMove}>
            <AlignmentHeader
                alignmentType={"para"}
                sourceMetadata={sourceMeta}
                targetMetadata={targetMeta}
                linkingMode={linkingMode}
                setLinkingMode={setLinkingMode}
                clickLinkingStep={clickLinkingStep}
                pendingSourceIds={pendingSourceIds}
                pendingTargetIds={pendingTargetIds}
                selectedSourceIds={selectedSourceIds}
                selectedTargetIds={selectedTargetIds}
                historyIndex={historyIndex}
                historyLength={history.length}
                undo={undo}
                redo={redo}
                cancelClickLinking={cancelClickLinking}
                setSelectedSourceIds={setSelectedSourceIds}
                setSelectedTargetIds={setSelectedTargetIds}
                onMetadataClick={() => setModals((m) => ({ ...m, metadata: true }))}
                onExport={handleExport}
                onAlignSentence={runBatchAlignment}
                fontSettings={fontSettings}
                setFontSettings={setFontSettings}
                onCreateLink={handleCreateManualLink}
                onMarkCompleted={null}
            />

            <div className="flex-1 flex overflow-hidden relative">
                <LinkCanvas
                    ref={svgRef}
                    links={links}
                    sourceLines={sourceLines}
                    targetLines={targetLines}
                    onLinkClick={(linkId) => {
                        setSelectedLinkForDetails(linkId);
                        setModals((m) => ({ ...m, linkDetails: true }));
                    }}
                    pendingSourceIds={pendingSourceIds}
                    pendingTargetIds={pendingTargetIds}
                    clickLinkingStep={clickLinkingStep}
                    linkingMode={linkingMode}
                    selectedSourceIds={selectedSourceIds}
                    selectedTargetIds={selectedTargetIds}
                    linkConfidence={linkFormState.confidence}
                    sourceContainerRef={sourceContainerRef}
                    targetContainerRef={targetContainerRef}
                />

                <SourcePanel
                    alignmentType={"para"}
                    ref={sourceContainerRef}
                    lines={sourceLines}
                    metadata={sourceMeta}
                    fontSettings={fontSettings}
                    links={links}
                    selectedIds={linkingMode === 'manual' ? selectedSourceIds : pendingSourceIds}
                    editingLine={editingLine}
                    linkingMode={linkingMode}
                    onLineClick={handleLineClick}
                    onEditLine={(id, text) => setEditingLine({ type: 'source', id, text })}
                    onSaveEdit={saveLineEdit}
                    onCancelEdit={() => setEditingLine(null)}
                    onToggleFavorite={(id) => toggleLineFavorite('source', id)}
                    onEditComment={(id, comment) => openEditModal('line', id, 'comment', comment)}
                    onEditLineNumber={(id, number) => openEditModal('line', id, 'lineNumber', number)}
                    onMergeLines={() => mergeLines('source')}
                    onSplitLine={(lineId, pos) => splitLine('source', lineId, pos)}
                    onMoveUp={(lineId) => moveLineUp('source', lineId)}
                    onMoveDown={(lineId) => moveLineDown('source', lineId)}
                />

                <TargetPanel
                    alignmentType={"para"}
                    ref={targetContainerRef}
                    lines={targetLines}
                    metadata={targetMeta}
                    fontSettings={fontSettings}
                    links={links}
                    selectedIds={linkingMode === 'manual' ? selectedTargetIds : pendingTargetIds}
                    editingLine={editingLine}
                    linkingMode={linkingMode}
                    onLineClick={handleLineClick}
                    onEditLine={(id, text) => setEditingLine({ type: 'target', id, text })}
                    onSaveEdit={saveLineEdit}
                    onCancelEdit={() => setEditingLine(null)}
                    onToggleFavorite={(id) => toggleLineFavorite('target', id)}
                    onEditComment={(id, comment) => openEditModal('line', id, 'comment', comment)}
                    onEditLineNumber={(id, number) => openEditModal('line', id, 'lineNumber', number)}
                    onMergeLines={() => mergeLines('target')}
                    onSplitLine={(lineId, pos) => splitLine('target', lineId, pos)}
                    onMoveUp={(lineId) => moveLineUp('target', lineId)}
                    onMoveDown={(lineId) => moveLineDown('target', lineId)}
                />
            </div>

            <ModalsContainer
                documentId={documentId}
                modals={modals}
                setModals={setModals}
                sourceMetadata={sourceMeta}
                setSourceMetadata={setSourceMeta}
                setTargetMetadata={setTargetMeta}
                targetMetadata={targetMeta}
                fontSettings={fontSettings}
                setFontSettings={setFontSettings}
                linkFormState={linkFormState}
                setLinkFormState={setLinkFormState}
                pendingSourceIds={pendingSourceIds}
                pendingTargetIds={pendingTargetIds}
                selectedSourceIds={selectedSourceIds}
                selectedTargetIds={selectedTargetIds}
                sourceLines={sourceLines}
                targetLines={targetLines}
                onConfirmQuickLink={confirmQuickLink}
                onCancelQuickLink={cancelClickLinking}
                onCreateLink={createLink}
                editingItem={editingItem}
                editValue={editValue}
                setEditValue={setEditValue}
                onSaveEdit={saveEdit}
                links={links}
                selectedLinkForDetails={selectedLinkForDetails}
                onCloseLinkDetails={() => setSelectedLinkForDetails(null)}
                onToggleLinkFavorite={toggleLinkFavorite}
                onDeleteLink={deleteLink}
                onUpdateLink={updateLink}
            />
        </div>
    );
};

export default ParaAlignmentPage;