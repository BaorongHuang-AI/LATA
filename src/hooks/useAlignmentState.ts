// src/hooks/useAlignmentState.ts
import { useState, useEffect } from 'react';
import type { Line, Link, AlignmentMetadata, FontSettings, AppState } from '../types/alignment';
import {DocumentMetadata} from "../utils/AlignUtils";
export const useAlignmentState = (alignmentType: string, documentId?: string) => {
    const [initialSourceLines, setInitialSourceLines] = useState<Line[]>([]);
    const [initialTargetLines, setInitialTargetLines] = useState<Line[]>([]);
    const [initialLinks, setInitialLinks] = useState<Link[]>([]);

    const [sourceMeta, setSourceMeta] = useState<DocumentMetadata | null>(null);
    const [targetMeta, setTargetMeta] = useState<DocumentMetadata | null>(null);

    const [fontSettings, setFontSettings] = useState<FontSettings>({
        sourceFontFamily: "system-ui, -apple-system, sans-serif",
        targetFontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 16,
    });

    const [initialState, setInitialState] = useState<AppState | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log("documentId", documentId);
        if (!documentId) return;

        setLoading(true);
        window.api
            .getAlignmentState(Number(documentId), alignmentType)
            .then((state: AppState) => {
                console.log("initial state", state);
                setInitialSourceLines(state.sourceLines);
                setInitialTargetLines(state.targetLines);
                setInitialLinks(state.links);

                setSourceMeta(state.sourceMeta ?? null);
                setTargetMeta(state.targetMeta ?? null);

                setInitialState(state);
            })
            .finally(() => setLoading(false));
    }, [documentId]);

    return {
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
        loading,
    };
};