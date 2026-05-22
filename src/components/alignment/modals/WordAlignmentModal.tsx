import React, { useEffect, useState, useRef } from "react";
import { Modal, Button, message, Spin } from "antd";
import { AlignmentTable } from "../AlignmentTable";
import type { Line, Link, FontSettings } from "../../../types/alignment";

interface WordAlignmentModalProps {
    visible: boolean;
    documentId: number;
    sourceSentenceKey: string;
    targetSentenceKey: string;
    sourceText: string;
    targetText: string;
    srcLang: string;
    tgtLang: string;
    fontSettings: FontSettings;
    onClose: () => void;
    onSaved: () => void;
}

const reorderLines = (lines: Line[], prefix: string): Line[] => {
    return lines.map((line, index) => ({
        ...line,
        id: `${prefix}${index}`,
        lineNumber: `${prefix}${index}`,
    }));
};

const WordAlignmentModal: React.FC<WordAlignmentModalProps> = ({
    visible,
    documentId,
    sourceSentenceKey,
    targetSentenceKey,
    sourceText,
    targetText,
    srcLang,
    tgtLang,
    fontSettings,
    onClose,
    onSaved,
}) => {
    const [sourceWords, setSourceWords] = useState<Line[]>([]);
    const [targetWords, setTargetWords] = useState<Line[]>([]);
    const [wordLinks, setWordLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(false);
    const [alignLoading, setAlignLoading] = useState(false);
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
    const [editingLine, setEditingLine] = useState<{
        type: "source" | "target";
        id: string;
        text: string;
    } | null>(null);
    const [processing, setProcessing] = useState(false);

    // Show processing on state changes
    const lastChangeRef = useRef(0);
    useEffect(() => {
        const now = Date.now();
        if (now - lastChangeRef.current < 100) return; // skip rapid initial changes
        lastChangeRef.current = now;
        setProcessing(true);
        const timer = setTimeout(() => setProcessing(false), 400);
        return () => clearTimeout(timer);
    }, [sourceWords, targetWords, wordLinks]);

    useEffect(() => {
        if (!visible || !documentId) return;

        setLoading(true);
        window.api
            .getWordAlignmentState(documentId, sourceSentenceKey, targetSentenceKey)
            .then((res) => {
                if (res.sourceWords?.length > 0 || res.targetWords?.length > 0) {
                    setSourceWords(res.sourceWords);
                    setTargetWords(res.targetWords);
                    setWordLinks(res.wordLinks);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [visible, documentId, sourceSentenceKey, targetSentenceKey]);

    const handleAutoAlign = async () => {
        const models = await window.api.getLLMModels();
        if (!models || models.length === 0) {
            message.warning('No LLM model configured. Please go to Settings > LLMs to configure a model before running word alignment.');
            return;
        }

        setAlignLoading(true);
        try {
            const result = await window.api.segmentAndAlignWords({
                sourceText,
                targetText,
                srcLang,
                tgtLang,
                documentId,
                sourceKey: sourceSentenceKey,
                targetKey: targetSentenceKey,
            });
            setSourceWords(result.sourceWords);
            setTargetWords(result.targetWords);
            setWordLinks(result.wordLinks);
            setSelectedSourceIds([]);
            setSelectedTargetIds([]);
            message.success("Word segmentation and alignment complete");
        } catch (e: any) {
            const msg = (e?.message || String(e)).replace(/^\[api\] /, '');
            console.error("Word alignment failed:", msg);
            message.error(`Word alignment failed: ${msg}`);
        } finally {
            setAlignLoading(false);
        }
    };

    const handleLineClick = (type: "source" | "target", id: string) => {
        if (type === "source") {
            setSelectedSourceIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
        } else {
            setSelectedTargetIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
        }
    };

    const handleSaveEdit = () => {
        if (!editingLine) return;
        if (editingLine.type === "source") {
            setSourceWords((prev) =>
                prev.map((w) =>
                    w.id === editingLine.id ? { ...w, text: editingLine.text } : w
                )
            );
        } else {
            setTargetWords((prev) =>
                prev.map((w) =>
                    w.id === editingLine.id ? { ...w, text: editingLine.text } : w
                )
            );
        }
        setEditingLine(null);
    };

    const handleToggleFavorite = (type: "source" | "target", id: string) => {
        if (type === "source") {
            setSourceWords((prev) =>
                prev.map((w) => (w.id === id ? { ...w, isFavorite: !w.isFavorite } : w))
            );
        } else {
            setTargetWords((prev) =>
                prev.map((w) => (w.id === id ? { ...w, isFavorite: !w.isFavorite } : w))
            );
        }
    };

    const handleEditComment = (type: "source" | "target", id: string) => {
        const comment = prompt("Enter comment:");
        if (comment === null) return;
        if (type === "source") {
            setSourceWords((prev) =>
                prev.map((w) => (w.id === id ? { ...w, comment } : w))
            );
        } else {
            setTargetWords((prev) =>
                prev.map((w) => (w.id === id ? { ...w, comment } : w))
            );
        }
    };

    const handleCreateLink = () => {
        if (selectedSourceIds.length === 0 || selectedTargetIds.length === 0) {
            message.warning("Select at least one source word and one target word");
            return;
        }
        const newLink: Link = {
            id: `wl${Date.now()}`,
            sourceIds: [...selectedSourceIds],
            targetIds: [...selectedTargetIds],
            confidence: 0.9,
            strategy: "manual",
        };
        setWordLinks((prev) => [...prev, newLink]);
        setSelectedSourceIds([]);
        setSelectedTargetIds([]);
        message.success("Link created");
    };

    const handleDeleteLink = (linkId: string) => {
        setWordLinks((prev) => prev.filter((l) => l.id !== linkId));
    };

    const handleMergeLines = (type: "source" | "target") => {
        const lines = type === "source" ? sourceWords : targetWords;
        const selectedIds = type === "source" ? selectedSourceIds : selectedTargetIds;

        if (selectedIds.length < 2) {
            message.warning("Select at least 2 words to merge");
            return;
        }

        const indices = selectedIds
            .map((id) => lines.findIndex((l) => l.id === id))
            .sort((a, b) => a - b);

        const isConsecutive = indices.every(
            (v, i) => i === 0 || v === indices[i - 1] + 1
        );
        if (!isConsecutive) {
            message.warning("Selected words must be consecutive");
            return;
        }

        const firstIndex = indices[0];
        const lastIndex = indices[indices.length - 1];
        const selectedLines = indices.map((i) => lines[i]);

        const mergedText = selectedLines.map((l) => l.text).join(" ");
        const mergedComment = selectedLines
            .map((l) => l.comment)
            .filter(Boolean)
            .join(" | ");

        const mergedLine: Line = {
            id: "",
            lineNumber: "",
            text: mergedText,
            comment: mergedComment || undefined,
            isFavorite: selectedLines.some((l) => l.isFavorite),
        };

        const newLines = [
            ...lines.slice(0, firstIndex),
            mergedLine,
            ...lines.slice(lastIndex + 1),
        ];

        const prefix = type === "source" ? "sw" : "tw";
        const reordered = reorderLines(newLines, prefix);

        // Update links referencing merged IDs
        const mergedIds = new Set(selectedIds);
        const newLinks = wordLinks
            .map((link) => {
                const idMapping = new Map<string, string>();
                lines.slice(0, firstIndex).forEach((oldLine, idx) => {
                    idMapping.set(oldLine.id, reordered[idx].id);
                });
                lines.slice(lastIndex + 1).forEach((oldLine, offsetIdx) => {
                    idMapping.set(oldLine.id, reordered[firstIndex + 1 + offsetIdx].id);
                });

                if (type === "source") {
                    if (link.sourceIds.some((id) => mergedIds.has(id))) return null;
                    const newSourceIds = link.sourceIds.map((id) => idMapping.get(id) || id);
                    return { ...link, sourceIds: newSourceIds };
                } else {
                    if (link.targetIds.some((id) => mergedIds.has(id))) return null;
                    const newTargetIds = link.targetIds.map((id) => idMapping.get(id) || id);
                    return { ...link, targetIds: newTargetIds };
                }
            })
            .filter(Boolean) as Link[];

        if (type === "source") {
            setSourceWords(reordered);
            setSelectedSourceIds([]);
        } else {
            setTargetWords(reordered);
            setSelectedTargetIds([]);
        }
        setWordLinks(newLinks);
        message.success(`Merged ${selectedIds.length} words into one`);
    };

    const handleSplitLine = (type: "source" | "target", lineId: string, cursorPosition: number) => {
        const lines = type === "source" ? sourceWords : targetWords;
        const lineIndex = lines.findIndex((l) => l.id === lineId);

        if (lineIndex === -1) return;
        const line = lines[lineIndex];

        const textBefore = line.text.slice(0, cursorPosition).trim();
        const textAfter = line.text.slice(cursorPosition).trim();

        if (!textBefore || !textAfter) {
            message.warning("Cannot split at this position - both parts must have text");
            return;
        }

        const line1: Line = { id: "", lineNumber: "", text: textBefore, isFavorite: line.isFavorite };
        const line2: Line = { id: "", lineNumber: "", text: textAfter, isFavorite: line.isFavorite };

        const newLines = [
            ...lines.slice(0, lineIndex),
            line1,
            line2,
            ...lines.slice(lineIndex + 1),
        ];

        const prefix = type === "source" ? "sw" : "tw";
        const reordered = reorderLines(newLines, prefix);

        const idMapping = new Map<string, string>();
        lines.slice(0, lineIndex).forEach((oldLine, idx) => {
            idMapping.set(oldLine.id, reordered[idx].id);
        });
        lines.slice(lineIndex + 1).forEach((oldLine, offsetIdx) => {
            idMapping.set(oldLine.id, reordered[lineIndex + 2 + offsetIdx].id);
        });

        const newLinks = wordLinks
            .map((link) => {
                if (type === "source") {
                    if (link.sourceIds.includes(lineId)) return null;
                    const newSourceIds = link.sourceIds.map((id) => idMapping.get(id) || id);
                    return { ...link, sourceIds: newSourceIds };
                } else {
                    if (link.targetIds.includes(lineId)) return null;
                    const newTargetIds = link.targetIds.map((id) => idMapping.get(id) || id);
                    return { ...link, targetIds: newTargetIds };
                }
            })
            .filter(Boolean) as Link[];

        if (type === "source") {
            setSourceWords(reordered);
        } else {
            setTargetWords(reordered);
        }
        setWordLinks(newLinks);
        message.success("Word split successfully");
    };

    const handleMoveLine = (type: "source" | "target", lineId: string, direction: "up" | "down") => {
        const lines = type === "source" ? sourceWords : targetWords;
        const lineIndex = lines.findIndex((l) => l.id === lineId);

        if (lineIndex === -1) return;
        if (direction === "up" && lineIndex === 0) return;
        if (direction === "down" && lineIndex === lines.length - 1) return;

        const targetIndex = direction === "up" ? lineIndex - 1 : lineIndex + 1;
        const newLines = [...lines];
        [newLines[lineIndex], newLines[targetIndex]] = [newLines[targetIndex], newLines[lineIndex]];

        const prefix = type === "source" ? "sw" : "tw";
        const reordered = reorderLines(newLines, prefix);

        const idMapping = new Map<string, string>();
        lines.forEach((oldLine, idx) => {
            const newLine = reordered.find((l) => l.text === oldLine.text);
            if (newLine) idMapping.set(oldLine.id, newLine.id);
        });

        const newLinks = wordLinks.map((link) => {
            if (type === "source") {
                return { ...link, sourceIds: link.sourceIds.map((id) => idMapping.get(id) || id) };
            } else {
                return { ...link, targetIds: link.targetIds.map((id) => idMapping.get(id) || id) };
            }
        });

        if (type === "source") {
            setSourceWords(reordered);
        } else {
            setTargetWords(reordered);
        }
        setWordLinks(newLinks);
    };

    const handleDeleteLine = (type: "source" | "target", lineId: string) => {
        const lines = type === "source" ? sourceWords : targetWords;
        if (lines.length <= 1) {
            message.warning("Cannot delete the only remaining cell.");
            return;
        }
        const newLinks = wordLinks.filter((link) => {
            const ids = type === "source" ? link.sourceIds : link.targetIds;
            return !ids.includes(lineId);
        });
        const newLines = lines.filter((l) => l.id !== lineId);
        const prefix = type === "source" ? "sw" : "tw";
        const reordered = reorderLines(newLines, prefix);
        const idMapping = new Map<string, string>();
        lines.forEach((old) => {
            if (old.id === lineId) return;
            const match = reordered.find((l) => l.text === old.text);
            if (match) idMapping.set(old.id, match.id);
        });
        const updatedLinks = newLinks.map((link) => {
            if (type === "source") {
                return { ...link, sourceIds: link.sourceIds.map((id) => idMapping.get(id) || id) };
            } else {
                return { ...link, targetIds: link.targetIds.map((id) => idMapping.get(id) || id) };
            }
        });
        if (type === "source") setSourceWords(reordered);
        else setTargetWords(reordered);
        setWordLinks(updatedLinks);
        message.success("Cell deleted");
    };

    const handleInsertLineBelow = (type: "source" | "target", lineId: string) => {
        const lines = type === "source" ? sourceWords : targetWords;
        const idx = lines.findIndex((l) => l.id === lineId);
        if (idx === -1) return;
        const newLine: Line = { id: `${type[0]}${Date.now()}`, lineNumber: "", text: "", isFavorite: false };
        const newLines = [...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)];
        const prefix = type === "source" ? "sw" : "tw";
        const reordered = reorderLines(newLines, prefix);
        const idMapping = new Map<string, string>();
        lines.forEach((old) => {
            const match = reordered.find((l) => l.text === old.text);
            if (match) idMapping.set(old.id, match.id);
        });
        const updatedLinks = wordLinks.map((link) => {
            if (type === "source") {
                return { ...link, sourceIds: link.sourceIds.map((id) => idMapping.get(id) || id) };
            } else {
                return { ...link, targetIds: link.targetIds.map((id) => idMapping.get(id) || id) };
            }
        });
        if (type === "source") setSourceWords(reordered);
        else setTargetWords(reordered);
        setWordLinks(updatedLinks);
        message.success("Empty cell inserted below");
    };

    const handleSave = async () => {
        try {
            await window.api.saveWordAlignment(documentId, sourceSentenceKey, targetSentenceKey, {
                sourceWords,
                targetWords,
                wordLinks,
            });
            message.success("Word alignment saved");
            onSaved();
            onClose();
        } catch (e) {
            console.error(e);
            message.error("Failed to save word alignment");
        }
    };

    return (
        <Modal
            open={visible}
            title="Word Alignment"
            width={1200}
            destroyOnClose
            onCancel={onClose}
            footer={
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Button
                        onClick={handleAutoAlign}
                        loading={alignLoading}
                        type="default"
                    >
                        Auto-Align Words
                    </Button>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button onClick={onClose}>Close</Button>
                        <Button
                            type="primary"
                            onClick={handleSave}
                            style={{
                                backgroundColor: '#1677ff',
                                borderColor: '#1677ff',
                                color: '#fff',
                            }}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            }
        >
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                    <strong>Source:</strong> {sourceText}
                </div>
                <div style={{ fontSize: 13, color: "#666" }}>
                    <strong>Target:</strong> {targetText}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                    <Spin />
                </div>
            ) : sourceWords.length > 0 || targetWords.length > 0 ? (
                <>
                    {selectedSourceIds.length > 0 && selectedTargetIds.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            <Button
                                size="small"
                                type="primary"
                                onClick={handleCreateLink}
                                style={{
                                    backgroundColor: '#1677ff',
                                    borderColor: '#1677ff',
                                    color: '#fff',
                                }}
                            >
                                Link Selected Words
                            </Button>
                        </div>
                    )}
                    <AlignmentTable
                        alignmentType="word"
                        sourceLines={sourceWords}
                        targetLines={targetWords}
                        links={wordLinks}
                        sourceMeta={null}
                        targetMeta={null}
                        fontSettings={fontSettings}
                        linkingMode="manual"
                        selectedSourceIds={selectedSourceIds}
                        selectedTargetIds={selectedTargetIds}
                        pendingSourceIds={[]}
                        pendingTargetIds={[]}
                        editingLine={editingLine}
                        onLineClick={handleLineClick}
                        onEditLine={(type, id, text) => setEditingLine({ type, id, text })}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingLine(null)}
                        onToggleFavorite={handleToggleFavorite}
                        onEditComment={handleEditComment}
                        onEditLineNumber={() => {}}
                        onMergeLines={handleMergeLines}
                        onSplitLine={handleSplitLine}
                        onMoveUp={(type, id) => handleMoveLine(type, id, "up")}
                        onMoveDown={(type, id) => handleMoveLine(type, id, "down")}
                        onDeleteLine={handleDeleteLine}
                        onInsertLineBelow={handleInsertLineBelow}
                        processing={processing}
                        onLinkClick={(linkId) => {
                            const link = wordLinks.find((l) => l.id === linkId);
                            if (link && window.confirm("Delete this link?")) {
                                handleDeleteLink(linkId);
                            }
                        }}
                    />
                </>
            ) : (
                <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                    Click "Auto-Align Words" to segment and align using LLM.
                </div>
            )}
        </Modal>
    );
};

export default WordAlignmentModal;
