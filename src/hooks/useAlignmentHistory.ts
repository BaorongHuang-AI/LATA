import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import type { AppState, Line, Link } from '../types/alignment';

interface UseAlignmentHistoryReturn {
    history: AppState[];
    historyIndex: number;
    saveToHistory: (newState: AppState) => void;
    undo: () => void;
    redo: () => void;
    currentState: AppState | null;
    historyReady: boolean;
}
export const useAlignmentHistory = (
    documentId: string | undefined,
    initialState: AppState | null,
    alignmentType: string,
): UseAlignmentHistoryReturn => {

    const [history, setHistory] = useState<AppState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    /* ===============================
       Seed history ONCE
    =============================== */
    useEffect(() => {
        if (!initialState) return;

        setHistory([initialState]);
        setHistoryIndex(0);

        if (documentId) {
            window.api.saveHistoryState(
                Number(documentId),
                initialState,
                "init",
                alignmentType
            );
        }
    }, [initialState, documentId]);

    /* ===============================
       Save new history entry
    =============================== */
    const saveToHistory = useCallback(
        (newState: AppState) => {
            setHistory((prev) => {
                const trimmed = prev.slice(0, historyIndex + 1);
                trimmed.push(newState);

                if (trimmed.length > 50) trimmed.shift();
                return trimmed;
            });

            setHistoryIndex((prev) => {
                const next = prev + 1;
                return next >= 50 ? 49 : next;
            });


            if (!currentState) {
                console.warn('saveToHistory called before history was seeded');
                return;
            }

            const linesChanged =
                JSON.stringify(newState.sourceLines) !==
                JSON.stringify(currentState.sourceLines) ||
                JSON.stringify(newState.targetLines) !==
                JSON.stringify(currentState.targetLines);

            // 🔹 Compare links
            const linksChanged =
                JSON.stringify(newState.links) !==
                JSON.stringify(currentState.links);

            let saveType: "lines" | "links" | null = null;
            if (linesChanged) saveType = "lines";
            else if (linksChanged) saveType = "links";

            // No meaningful changes → skip
            if (!saveType) return;

            console.log("save type", saveType, newState);


            // 🔥 Persist snapshot
            if (documentId) {
                if (saveType === "lines") {
                    window.api.saveHistoryState(Number(documentId), newState, "edit", alignmentType);
                } else if (saveType === "links") {
                    console.log("update states", newState);
                    window.api.saveLinks(Number(documentId), newState, "align", alignmentType);
                }
                // window.api.saveHistoryState(
                //     documentId,
                //     newState,
                //     "edit"
                // );
            }
        },
        [historyIndex, documentId]
    );

    /* ===============================
       Undo
    =============================== */
    const undo = useCallback(() => {
        if (historyIndex <= 0) {
            message.info("Nothing to undo");
            return;
        }

        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);

        if (documentId) {
            window.api.saveHistoryState(
                Number(documentId),
                history[nextIndex],
                "undo",
                alignmentType
            );
        }

        message.success("Undo successful");
    }, [historyIndex, history, documentId]);

    /* ===============================
       Redo
    =============================== */
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) {
            message.info("Nothing to redo");
            return;
        }

        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);

        if (documentId) {
            window.api.saveHistoryState(
                Number(documentId),
                history[nextIndex],
                "redo",
                alignmentType
            );
        }

        message.success("Redo successful");
    }, [historyIndex, history, documentId]);

    const currentState =
        historyIndex >= 0 ? history[historyIndex] : null;

    const historyReady = historyIndex >= 0;

    return {
        history,
        historyIndex,
        saveToHistory,
        undo,
        redo,
        currentState,
        historyReady,
    };
};