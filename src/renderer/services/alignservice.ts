import {db} from "../../db/db";
import {
    Alignment,
    AlignmentPair,
    AlignmentRecord,
    AlignmentResult, Line,
    Sentence,
    SentenceRecord
} from "../../types/alignment";
import {
    buildAlignmentPrompt,
    buildAlignmentPromptFromDB,
    buildSplitPrompt,
    buildSplitPromptFromDB,
    llmCallWithRetry
} from "../../utils/AlignUtils";
import {sendChatCompletion} from "../../utils/sendChatCompletion";
import {listPrompts} from "../../db/promptService";

export class AlignmentService {
    static getAppState(documentId: number) {
        /* =========================
           1. Paragraphs
        ========================= */
        const sourceParas = db
            .prepare(
                `
        SELECT id, para_index, content
        FROM paragraphs
        WHERE document_id = ? AND role = 'source'
        ORDER BY para_index
        `
            )
            .all(documentId)
            .map((p: any) => ({
                id: `s${p.id}`,
                lineNumber: `s${p.para_index}`,
                text: p.content,
                isFavorite: false,
            }));

        const targetParas = db
            .prepare(
                `
        SELECT id, para_index, content
        FROM paragraphs
        WHERE document_id = ? AND role = 'target'
        ORDER BY para_index
        `
            )
            .all(documentId)
            .map((p: any) => ({
                id: `t${p.id}`,
                lineNumber: `t${p.para_index}`,
                text: p.content,
                isFavorite: false,
            }));

        /* =========================
           2. Paragraph Alignments
        ========================= */
        const links = db
            .prepare(
                `
        SELECT *
        FROM para_alignments
        WHERE document_id = ?
        `
            )
            .all(documentId)
            .map((row: any, index: number) => ({
                id: `l${index + 1}`,
                sourceIds: JSON.parse(row.source_para_ids).map(
                    (id: number) => `s${id}`
                ),
                targetIds: JSON.parse(row.target_para_ids).map(
                    (id: number) => `t${id}`
                ),
                confidence: row.confidence,
                strategy: row.strategy,
                isFavorite: false,
            }));

        return {
            sourceParas,
            targetParas,
            links,
        };
    }

    static async alignParas(
        sourceParas,
        targetParas,
        srcLang: string,
        tgtLang: string
    ) {
        /* --------------------------------
           1️⃣ Split paragraphs → sentences (with structure)
        --------------------------------- */
        const sourceStructured = await this.splitParasToSentences(sourceParas, srcLang, "s");
        const targetStructured = await this.splitParasToSentences(targetParas, tgtLang, "t");

        console.log("Structured source", sourceStructured);
        console.log("Structured target", targetStructured);

        /* --------------------------------
           2️⃣ Flatten sentences
        --------------------------------- */
        const sourceSentences = sourceStructured.flatMap(p => p.sentences);
        const targetSentences = targetStructured.flatMap(p => p.sentences);


        /* --------------------------------
       1️⃣ Build anchors (hybrid)
    --------------------------------- */
        const anchors = await this.buildHybridAnchors(
            sourceSentences,
            targetSentences,
            srcLang,
            tgtLang
        );

        /* --------------------------------
           2️⃣ Adaptive windows
        --------------------------------- */
        const windows = this.buildAdaptiveWindows(
            anchors,
            sourceSentences,
            targetSentences
        );

        /* --------------------------------
           3️⃣ Align windows (parallel)
        --------------------------------- */
        const rawAlignments = await this.alignWithWindows(
            sourceSentences,
            targetSentences,
            srcLang,
            tgtLang
        );


        const finalAlignments = this.repairAlignments(
            rawAlignments,
            sourceSentences,
            targetSentences
        );

        if (!finalAlignments.length) {
            throw new Error("Sentence alignment failed");
        }

        // /* --------------------------------
        //    3️⃣ LLM sentence   alignment
        // --------------------------------- */
        // const prompts = listPrompts();
        //
        // const { system, user } = await buildAlignmentPromptFromDB(
        //     srcLang,
        //     tgtLang,
        //     sourceSentences,
        //     targetSentences,
        //     prompts,
        //     { taskType: "sentence_alignment" }
        // );
        //
        // const result = await llmCallWithRetry<{ alignments: any[] }>(
        //     async () => {
        //         const res = await sendChatCompletion({
        //             messages: [
        //                 { role: "system", content: system },
        //                 { role: "user", content: user },
        //             ],
        //             temperature: 0.1,
        //         });
        //         return res.content;
        //     }
        // );
        //
        // console.log("Sentence alignment result", result);
        //
        // if (!result?.alignments?.length) {
        //     throw new Error("Sentence alignment failed");
        // }
        //
        // /* --------------------------------
        //    4️⃣ Convert back to paragraph links (optional)
        // --------------------------------- */
        const paraLinks = this.buildParaLinksFromSentenceAlignment(
            finalAlignments,
            sourceSentences,
            targetSentences
        );

        return {
            sentenceAlignments: finalAlignments,
            paraLinks,
            sourceStructured,
            targetStructured
        };
    }


    // static async splitParasToSentences(paras, lang, prefix: "s" | "t") {
    //     let globalIndex = 0;
    //
    //     const results = [];
    //
    //     for (let pIndex = 0; pIndex < paras.length; pIndex++) {
    //         const para = paras[pIndex];
    //
    //         const rawSentences = await this.llmSplitSentences(para.text, lang);
    //
    //         const sentences = rawSentences.map((s, sIndex) => ({
    //             id: `${prefix}${pIndex}-s${sIndex}`,
    //             text: s.text,
    //             paraId: pIndex,
    //             sentIndex: sIndex,
    //             order: globalIndex++
    //         }));
    //
    //         results.push({
    //             paraId: pIndex,
    //             sentences
    //         });
    //     }
    //
    //     return results;
    // }

    static async splitParasToSentences(
        paras,
        lang,
        prefix: "s" | "t",
        concurrency = 8
    ) {
        const results = new Array(paras.length);

        let current = 0;

        async function worker() {
            while (current < paras.length) {
                const pIndex = current++;
                const para = paras[pIndex];

                try {
                    const rawSentences = await AlignmentService.llmSplitSentences(
                        para.text,
                        lang
                    );

                    results[pIndex] = {
                        paraId: pIndex,
                        sentences: rawSentences.map((s, sIndex) => ({
                            id: `${prefix}${pIndex}-s${sIndex}`,
                            text: s.text,
                            paraId: pIndex,
                            sentIndex: sIndex,
                            order: 0 // assign later
                        }))
                    };
                } catch (err) {
                    console.error(`Split failed at para ${pIndex}`, err);

                    results[pIndex] = {
                        paraId: pIndex,
                        sentences: [
                            {
                                id: `${prefix}${pIndex}-s0`,
                                text: para.text,
                                paraId: pIndex,
                                sentIndex: 0,
                                order: 0
                            }
                        ]
                    };
                }
            }
        }

        await Promise.all(
            Array.from({length: concurrency}, () => worker())
        );

        /* --------------------------------
           ✅ Assign global order (SAFE)
        --------------------------------- */
        let order = 0;
        for (let i = 0; i < results.length; i++) {
            for (const s of results[i].sentences) {
                s.order = order++;
            }
        }

        return results;
    }

    static buildParaLinksFromSentenceAlignment(
        alignments,
        sourceSentences,
        targetSentences
    ) {
        const map = new Map();

        for (const a of alignments) {
            const sourceParaIds = new Set();
            const targetParaIds = new Set();

            a.sourceIds.forEach(id => {
                const s = sourceSentences.find(x => x.id === id);
                if (s) sourceParaIds.add(s.paraId);
            });

            a.targetIds.forEach(id => {
                const t = targetSentences.find(x => x.id === id);
                if (t) targetParaIds.add(t.paraId);
            });

            const key = JSON.stringify({
                s: [...sourceParaIds],
                t: [...targetParaIds]
            });

            if (!map.has(key)) {
                map.set(key, {
                    sourceParaIds: [...sourceParaIds],
                    targetParaIds: [...targetParaIds],
                    count: 0
                });
            }

            map.get(key).count++;
        }

        return Array.from(map.values());
    }


    // static alignParas(sourceParas, targetParas) {
    //   return this.gale_church_align(sourceParas, targetParas);
    // }

    static gale_church_align(sourceParas, targetParas) {
        const S = sourceParas.length;
        const T = targetParas.length;

        const len = (p) => p.text.length;

        // --- Model parameters (tunable) ---
        const VAR_PER_CHAR = 6.8;   // classic Gale–Church constant
        const PRIOR_PENALTY = {
            "1-1": 0,
            "1-2": 1.2,
            "2-1": 1.2,
            "2-2": 2.0,
        };

        // --- Normal distribution negative log likelihood ---
        function gcCost(srcLen, tgtLen) {
            const mean = srcLen;
            const variance = VAR_PER_CHAR * Math.max(srcLen, 1);
            const diff = tgtLen - mean;

            return (diff * diff) / (2 * variance);
        }

        // --- DP tables ---
        const dp = Array.from({length: S + 1}, () =>
            Array(T + 1).fill(Infinity)
        );
        const back = Array.from({length: S + 1}, () =>
            Array(T + 1).fill(null)
        );

        dp[0][0] = 0;

        // --- DP ---
        for (let i = 0; i <= S; i++) {
            for (let j = 0; j <= T; j++) {
                if (dp[i][j] === Infinity) continue;

                // 1–1
                if (i < S && j < T) {
                    const cost =
                        dp[i][j] +
                        gcCost(len(sourceParas[i]), len(targetParas[j])) +
                        PRIOR_PENALTY["1-1"];
                    if (cost < dp[i + 1][j + 1]) {
                        dp[i + 1][j + 1] = cost;
                        back[i + 1][j + 1] = {type: "1-1"};
                    }
                }

                // 1–2
                if (i < S && j + 1 < T) {
                    const cost =
                        dp[i][j] +
                        gcCost(
                            len(sourceParas[i]),
                            len(targetParas[j]) + len(targetParas[j + 1])
                        ) +
                        PRIOR_PENALTY["1-2"];
                    if (cost < dp[i + 1][j + 2]) {
                        dp[i + 1][j + 2] = cost;
                        back[i + 1][j + 2] = {type: "1-2"};
                    }
                }

                // 2–1
                if (i + 1 < S && j < T) {
                    const cost =
                        dp[i][j] +
                        gcCost(
                            len(sourceParas[i]) + len(sourceParas[i + 1]),
                            len(targetParas[j])
                        ) +
                        PRIOR_PENALTY["2-1"];
                    if (cost < dp[i + 2][j + 1]) {
                        dp[i + 2][j + 1] = cost;
                        back[i + 2][j + 1] = {type: "2-1"};
                    }
                }

                // 2–2
                if (i + 1 < S && j + 1 < T) {
                    const cost =
                        dp[i][j] +
                        gcCost(
                            len(sourceParas[i]) + len(sourceParas[i + 1]),
                            len(targetParas[j]) + len(targetParas[j + 1])
                        ) +
                        PRIOR_PENALTY["2-2"];
                    if (cost < dp[i + 2][j + 2]) {
                        dp[i + 2][j + 2] = cost;
                        back[i + 2][j + 2] = {type: "2-2"};
                    }
                }
            }
        }

        // --- Backtrace ---
        let i = S;
        let j = T;
        const rawAlignments = [];

        while (i > 0 || j > 0) {
            const step = back[i][j];
            if (!step) break;

            rawAlignments.push({i, j, type: step.type});

            if (step.type === "1-1") {
                i -= 1;
                j -= 1;
            } else if (step.type === "1-2") {
                i -= 1;
                j -= 2;
            } else if (step.type === "2-1") {
                i -= 2;
                j -= 1;
            } else if (step.type === "2-2") {
                i -= 2;
                j -= 2;
            }
        }

        rawAlignments.reverse();

        // --- Confidence calibration ---
        function calibrate(cost) {
            // Logistic transform of cost
            return 1 / (1 + Math.exp(cost - 1.5));
        }

        // --- Build final output ---
        const results = [];
        let si = 0;
        let ti = 0;

        for (const a of rawAlignments) {
            let sIds = [];
            let tIds = [];

            if (a.type.startsWith("1")) {
                sIds.push(sourceParas[si].id);
            } else {
                sIds.push(sourceParas[si].id, sourceParas[si + 1].id);
            }

            if (a.type.endsWith("1")) {
                tIds.push(targetParas[ti].id);
            } else {
                tIds.push(targetParas[ti].id, targetParas[ti + 1].id);
            }

            const srcLen = sIds.reduce((n, id) => {
                return n + len(sourceParas.find(p => p.id === id));
            }, 0);

            const tgtLen = tIds.reduce((n, id) => {
                return n + len(targetParas.find(p => p.id === id));
            }, 0);

            const cost = gcCost(srcLen, tgtLen);

            results.push({
                sourceParaIds: sIds,
                targetParaIds: tIds,
                confidence: calibrate(cost),
                strategy: `align-gale-church`,
                status: "pending",
            });

            si += sIds.length;
            ti += tIds.length;
        }

        return results;
    }


    // static async alignSentences(sourcePara,
    //                             targetPara,
    //                             srcLang: string,
    //                             tgtLang: string,
    //                             modelId: string,
    //                             documentId,
    //                             sourceParagraphId,
    //                             targetParagraphId
    //                             ) {
    //     return this.alignParagraph(
    //         sourcePara,
    //         targetPara,
    //         srcLang,
    //         tgtLang,
    //         modelId,
    //         documentId,
    //         sourceParagraphId,
    //         targetParagraphId,
    //     );
    // }


    //  static async  alignParagraph(
    //     sourcePara: string,
    //     targetPara: string,
    //     srcLang: string,
    //     tgtLang: string,
    //     modelId: string
    // ): Promise<AlignmentResult> {
    //
    //     const sourceSentences = await this.llmSplitSentences(
    //         sourcePara,
    //         srcLang,
    //         modelId
    //     );
    //
    //     const targetSentences = await this.llmSplitSentences(
    //         targetPara,
    //         tgtLang,
    //         modelId
    //     );
    //
    //     //save to database, with documentID
    //
    //
    //     console.log("source sentences after LLM splitting", sourceSentences);
    //      console.log("target sentences  after LLM splitting", targetSentences);
    //
    //     const alignments = await this.llmAlignSentences(
    //         sourceSentences,
    //         targetSentences,
    //         srcLang,
    //         tgtLang,
    //         modelId
    //     );
    //
    //     if (alignments) {
    //         return {
    //             sourceSentences,
    //             targetSentences,
    //             alignments,
    //             strategy: "llm",
    //         };
    //     }
    //
    //     return {
    //         sourceSentences,
    //         targetSentences,
    //         alignments: this.galeChurchAlign(
    //             sourceSentences,
    //             targetSentences
    //         ),
    //         strategy: "gale-church",
    //     };
    // }

    // static async alignParagraph(
    //     sourcePara: string,
    //     targetPara: string,
    //     srcLang: string,
    //     tgtLang: string,
    //     modelId: string,
    //     documentId: string,
    //     sourceParagraphId: string,
    //     targetParagraphId: string,
    //     sourceLines: Line[],
    //     targetLines: Line[],
    // ): Promise<AlignmentResult> {
    //     // Split sentences using LLM
    //     const sourceSentences = await this.llmSplitSentences(
    //         sourcePara,
    //         srcLang,
    //         modelId
    //     );
    //
    //     const targetSentences = await this.llmSplitSentences(
    //         targetPara,
    //         tgtLang,
    //         modelId
    //     );
    //
    //     console.log('Source sentences after LLM splitting:', sourceSentences);
    //     console.log('Target sentences after LLM splitting:', targetSentences);
    //
    //     // Map sentences back to original line IDs
    //     const sourceSentencesWithLineIds = this.mapSentencesToLines(
    //         sourceSentences,
    //         sourceLines
    //     );
    //     const targetSentencesWithLineIds = this.mapSentencesToLines(
    //         targetSentences,
    //         targetLines
    //     );
    //
    //     // Save sentences to database
    //     const { sourceKeys, targetKeys } = await this.saveSentences(
    //         documentId,
    //         sourceParagraphId,
    //         targetParagraphId,
    //         sourceSentencesWithLineIds,
    //         targetSentencesWithLineIds,
    //     );
    //
    //     console.log('Saved sentences with keys:', { sourceKeys, targetKeys });
    //
    //     // Perform alignment
    //     let alignments: Alignment[];
    //     let strategy: 'llm' | 'gale-church';
    //
    //     const llmAlignments = await this.llmAlignSentences(
    //         sourceSentences,
    //         targetSentences,
    //         srcLang,
    //         tgtLang,
    //         modelId
    //     );
    //
    //     if (llmAlignments && llmAlignments.length > 0) {
    //         alignments = llmAlignments;
    //         strategy = 'llm';
    //     } else {
    //         alignments = this.galeChurchAlign(sourceSentences, targetSentences);
    //         strategy = 'gale-church';
    //     }
    //
    //     // Save alignments to database
    //     await this.saveAlignments(
    //         documentId,
    //         sourceParagraphId,
    //         targetParagraphId,
    //         alignments,
    //         sourceKeys,
    //         targetKeys,
    //         strategy
    //     );
    //
    //     console.log(`Saved ${alignments.length} alignments using ${strategy} strategy`);
    //
    //     return {
    //         sourceSentences: sourceSentencesWithLineIds,
    //         targetSentences: targetSentencesWithLineIds,
    //         alignments,
    //         strategy,
    //     };
    // }


    static async alignParagraph(
        sourcePara: string,
        targetPara: string,
        srcLang: string,
        tgtLang: string,
        documentId: string,
        sourceParagraphId: string,
        targetParagraphId: string,
        sourceLines: Line[],
        targetLines: Line[],
    ): Promise<any> {
        // Split sentences using LLM - returns Sentence[] with just text
        const sourceSentencesRaw = await this.llmSplitSentences(
            sourcePara,
            srcLang,
        );

        const targetSentencesRaw = await this.llmSplitSentences(
            targetPara,
            tgtLang,
        );

        console.log('Source sentences after LLM splitting:', sourceSentencesRaw);
        console.log('Target sentences after LLM splitting:', targetSentencesRaw);

        // Map sentences back to original line IDs and assign proper IDs
        const sourceSentences = this.mapSentencesToLines(
            sourceSentencesRaw,
            sourceLines
        );
        const targetSentences = this.mapSentencesToLines(
            targetSentencesRaw,
            targetLines
        );

        console.log("source after mapping", sourceSentences);
        console.log("target after mapping", targetSentences);

        // Save sentences to database
        const {sourceKeys, targetKeys} = await this.saveSentences(
            documentId,
            sourceParagraphId,
            targetParagraphId,
            sourceSentences,
            targetSentences,
        );

        console.log('Saved sentences with keys:', {sourceKeys, targetKeys});

        // Perform alignment (extract just text for alignment algorithms)
        let alignments: Alignment[];
        let strategy: 'align-llm' | 'align-gale-church';

        const llmAlignments = await this.llmAlignSentences(
            sourceSentences,
            targetSentences,
            srcLang,
            tgtLang,
        );

        if (llmAlignments && llmAlignments.length > 0) {
            alignments = llmAlignments;
            strategy = 'align-llm';
        } else {
            alignments = this.galeChurchAlign(
                sourceSentences,
                targetSentences
            );
            strategy = 'align-gale-church';
        }

        console.log("alignments results", alignments);

        // Save alignments to database
        await this.saveAlignments(
            documentId,
            sourceParagraphId,
            targetParagraphId,
            alignments,
            sourceKeys,
            targetKeys,
            strategy
        );

        console.log(`Saved ${alignments.length} alignments using ${strategy} strategy`);

        return {
            sourceSentences,
            targetSentences,
            alignments,
            strategy,
        };
    }

// Helper method to map sentences back to their original line IDs
// and assign IDs in format: lineId-sentenceIndex
    static mapSentencesToLines(sentences: Sentence[], lines: Line[]): Sentence[] {
        const fullText = lines.map(line => line.text).join("\n");
        let currentPosition = 0;

        return sentences.map((sentence, sentenceIndex) => {
            const sentenceStart = fullText.indexOf(sentence.text, currentPosition);
            const sentenceEnd = sentenceStart + sentence.text.length;
            currentPosition = sentenceEnd;

            // Find which lines this sentence spans
            let charCount = 0;
            const lineIds = [];

            for (const line of lines) {
                const lineStart = charCount;
                const lineEnd = charCount + line.text.length + 1; // +1 for newline

                // Check if sentence overlaps with this line
                if (sentenceStart < lineEnd && sentenceEnd > lineStart) {
                    lineIds.push(line.lineNumber);
                }

                charCount = lineEnd;
                if (charCount > sentenceEnd) break;
            }

            // Use the first line ID as the primary line for this sentence
            // Format: lineId-sentenceIndex
            const primaryLineId = lineIds[0] || lines[0]?.lineNumber || 'unknown';

            return {
                id: `${primaryLineId}-s${sentenceIndex}`,
                text: sentence.text,
            };
        });
    }

    static galeChurchAlign(
        source: Sentence[],
        target: Sentence[]
    ): Alignment[] {
        const alignments: Alignment[] = [];

        let i = 0;
        let j = 0;

        while (i < source.length && j < target.length) {
            alignments.push({
                sourceIds: [source[i].id],
                targetIds: [target[j].id],
                confidence: 0.6,
                explanation: "Length-based fallback alignment",
            });
            i++;
            j++;
        }

        return alignments;
    }

    static async llmSplitSentences(
        paragraph: string,
        language: string,
    ): Promise<Sentence[]> {
        const prompts = listPrompts();
        const {system, user} = await buildSplitPromptFromDB(paragraph, language, prompts);
        console.log("split sentences", system, user);

        let result;

        try {
            result = await llmCallWithRetry<{ sentences: Sentence[] }>(
                async () => {
                    const res = await sendChatCompletion({
                        messages: [
                            {role: "system", content: system},
                            {role: "user", content: user},
                        ],
                    });

                    console.log("res", res);

                    const content = res?.content;

                    if (!content) {
                        throw new Error("Empty LLM response");
                    }

                    return content;
                }
            );
        } catch (err) {
            console.error("Sentence splitting error:", err);
            throw err; // or fallback
        }
        /* --------------------------------
              ✅ Fallback 1: Empty or invalid result
           --------------------------------- */
        if (!result || !result.sentences || result.sentences.length === 0) {
            console.warn("⚠️ Using fallback sentence split (single sentence)");

            return [
                {
                    id: "s1",
                    text: paragraph
                }
            ];
        }

        /* --------------------------------
           ✅ Fallback 2: Clean malformed sentences
        --------------------------------- */
        const cleaned = result.sentences
            .map((s, idx) => ({
                id: s.id || `s${idx + 1}`,
                text: (s.text || "").trim()
            }))
            .filter(s => s.text.length > 0);

        if (cleaned.length === 0) {
            return [
                {
                    id: "s1",
                    text: paragraph
                }
            ];
        }

        return cleaned;
        // console.log("sentence align results", result);
        // return result.sentences;
    }

    static async llmAlignSentences(
        source: Sentence[],
        target: Sentence[],
        srcLang: string,
        tgtLang: string,
    ): Promise<Alignment[] | null> {
        const prompts = listPrompts();
        const {system, user} = await buildAlignmentPromptFromDB(
            srcLang,
            tgtLang,
            source,
            target,
            prompts,
            {taskType: "sentence_alignment"}
        );

        const result = await llmCallWithRetry<{ alignments: Alignment[] }>(
            async () => {
                const res = await sendChatCompletion({
                    messages: [
                        {role: "system", content: system},
                        {role: "user", content: user},
                    ],
                    temperature: 0.1,
                });
                return res.content;
            }
        );

        return result?.alignments ?? null;
    }


    static async alignParagraphBatch(
        pairs: {
            sourceId: string;
            targetId: string;
            sourceLines: Line[];
            targetLines: Line[];
        }[],
        srcLang: string,
        tgtLang: string,
        documentId: string,
    ) {
        console.log("align doc with id", documentId);
        const results: AlignmentResult[] = [];

        for (const pair of pairs) {
            // Join lines to create paragraph text
            const sourceText = pair.sourceLines.map(line => line.text).join("\n");
            const targetText = pair.targetLines.map(line => line.text).join("\n");

            results.push(
                await this.alignParagraph(
                    sourceText,
                    targetText,
                    srcLang,
                    tgtLang,
                    documentId,
                    pair.sourceId,
                    pair.targetId,
                    pair.sourceLines,
                    pair.targetLines,
                )
            );
        }


        return results;
    }

    static generateSentenceKey(paragraphId: string, sentenceIndex: number): string {
        return `${paragraphId}-s${sentenceIndex}`;
    }

    /**
     * Save sentences to database
     */
    static async saveSentences(
        documentId: string,
        sourceParagraphIds: string,
        targetParagraphIds: string,
        sourceSentences: Sentence[],
        targetSentences: Sentence[]
    ): Promise<{
        sourceKeys: string[];
        targetKeys: string[];
    }> {
        const insertStmt = db.prepare(`
      INSERT INTO document_sentences 
        (document_id, paragraph_id, side, sentence_index, sentence_key, text)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        const sourceKeys: string[] = [];
        const targetKeys: string[] = [];

        // Use transaction for better performance
        const saveAll = db.transaction(() => {
            // Save source sentences
            sourceSentences.forEach((sent, index) => {
                const sentenceKey = this.generateSentenceKey(sourceParagraphIds, index);
                insertStmt.run(
                    documentId,
                    sourceParagraphIds,
                    'source',
                    index,
                    sentenceKey,
                    sent.text
                );
                sourceKeys.push(sentenceKey);
            });

            // Save target sentences
            targetSentences.forEach((sent, index) => {
                const sentenceKey = this.generateSentenceKey(targetParagraphIds, index);
                insertStmt.run(
                    documentId,
                    targetParagraphIds,
                    'target',
                    index,
                    sentenceKey,
                    sent.text
                );
                targetKeys.push(sentenceKey);
            });
        });

        saveAll();

        return {sourceKeys, targetKeys};
    }

    /**
     * Save alignment links to database
     */
    static async saveAlignments(
        documentId: string,
        sourceParagraphId: string,
        targetParagraphId: string,
        alignments: Alignment[],
        sourceKeys: string[],
        targetKeys: string[],
        strategy: string
    ): Promise<void> {
        const insertStmt = db.prepare(`
      INSERT INTO sentence_alignments 
        (document_id, source_paragraph_id, target_paragraph_id, 
         source_sentence_keys, target_sentence_keys, confidence, explanation, strategy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        strategy = `${strategy}`

        const saveAll = db.transaction(() => {
            alignments.forEach((alignment) => {
                // Map indices to sentence keys
                // const sourceSentenceKeys = alignment.sourceIds.map(idx => sourceKeys[idx]);
                // const targetSentenceKeys = alignment.targetIds.map(idx => targetKeys[idx]);

                insertStmt.run(
                    documentId,
                    sourceParagraphId,
                    targetParagraphId,
                    JSON.stringify(alignment.sourceIds),
                    JSON.stringify(alignment.targetIds),
                    alignment.confidence || null,
                    alignment.explanation || null,
                    strategy
                );
            });
        });

        saveAll();
    }

    /**
     * Retrieve sentences for a specific paragraph
     */
    static getSentencesByParagraph(paragraphId: number, side: 'source' | 'target'): SentenceRecord[] {
        const stmt = db.prepare(`
      SELECT * FROM document_sentences
      WHERE paragraph_id = ? AND side = ?
      ORDER BY sentence_index ASC
    `);

        return stmt.all(paragraphId, side) as SentenceRecord[];
    }

    /**
     * Retrieve sentences for both paragraphs
     */
    static getSentencesForAlignment(
        sourceParagraphId: number,
        targetParagraphId: number
    ): {
        source: SentenceRecord[];
        target: SentenceRecord[];
    } {
        return {
            source: this.getSentencesByParagraph(sourceParagraphId, 'source'),
            target: this.getSentencesByParagraph(targetParagraphId, 'target')
        };
    }

    /**
     * Retrieve alignments for a paragraph pair
     */
    static getAlignments(
        sourceParagraphId: number,
        targetParagraphId: number
    ): AlignmentRecord[] {
        const stmt = db.prepare(`
      SELECT * FROM sentence_alignments
      WHERE source_paragraph_id = ? AND target_paragraph_id = ?
      ORDER BY id ASC
    `);

        return stmt.all(sourceParagraphId, targetParagraphId) as AlignmentRecord[];
    }

    /**
     * Get all alignments for a document
     */
    static getDocumentAlignments(documentId: number): AlignmentRecord[] {
        const stmt = db.prepare(`
      SELECT * FROM sentence_alignments
      WHERE document_id = ?
      ORDER BY id ASC
    `);

        return stmt.all(documentId) as AlignmentRecord[];
    }

    /**
     * Delete sentences for a specific paragraph
     */
    static deleteParagraphSentences(paragraphId: number, side: 'source' | 'target'): void {
        db.prepare(`
      DELETE FROM document_sentences
      WHERE paragraph_id = ? AND side = ?
    `).run(paragraphId, side);
    }

    /**
     * Delete alignments for a paragraph pair
     */
    static deleteAlignments(sourceParagraphId: number, targetParagraphId: number): void {
        db.prepare(`
      DELETE FROM sentence_alignments
      WHERE source_paragraph_id = ? AND target_paragraph_id = ?
    `).run(sourceParagraphId, targetParagraphId);
    }

    /**
     * Delete all data for a paragraph pair
     */
    static deleteParagraphPairData(
        sourceParagraphId: number,
        targetParagraphId: number
    ): void {
        const deleteTransaction = db.transaction(() => {
            // Delete alignments first
            this.deleteAlignments(sourceParagraphId, targetParagraphId);

            // Delete sentences
            this.deleteParagraphSentences(sourceParagraphId, 'source');
            this.deleteParagraphSentences(targetParagraphId, 'target');
        });

        deleteTransaction();
    }

    /**
     * Get sentence by key
     */
    static getSentenceByKey(sentenceKey: string): SentenceRecord | undefined {
        const stmt = db.prepare(`
      SELECT * FROM document_sentences
      WHERE sentence_key = ?
    `);

        return stmt.get(sentenceKey) as SentenceRecord | undefined;
    }

    /**
     * Get multiple sentences by keys
     */
    static getSentencesByKeys(sentenceKeys: string[]): SentenceRecord[] {
        if (sentenceKeys.length === 0) return [];

        const placeholders = sentenceKeys.map(() => '?').join(',');
        const stmt = db.prepare(`
      SELECT * FROM document_sentences
      WHERE sentence_key IN (${placeholders})
      ORDER BY sentence_index ASC
    `);

        return stmt.all(...sentenceKeys) as SentenceRecord[];
    }


    static buildAnchors(sourceSentences, targetSentences, step = 20) {
        const anchors = [];

        const minLen = Math.min(sourceSentences.length, targetSentences.length);

        for (let i = 0; i < minLen; i += step) {
            anchors.push({
                sIndex: i,
                tIndex: Math.floor(i * (targetSentences.length / sourceSentences.length))
            });
        }

        // ensure last anchor
        anchors.push({
            sIndex: sourceSentences.length - 1,
            tIndex: targetSentences.length - 1
        });

        return anchors;
    }

    static buildWindows(anchors, sourceSentences, targetSentences, windowSize = 20) {
        const windows = [];

        for (let i = 0; i < anchors.length - 1; i++) {
            const a1 = anchors[i];
            const a2 = anchors[i + 1];

            const sStart = Math.max(0, a1.sIndex - windowSize);
            const sEnd = Math.min(sourceSentences.length, a2.sIndex + windowSize);

            const tStart = Math.max(0, a1.tIndex - windowSize);
            const tEnd = Math.min(targetSentences.length, a2.tIndex + windowSize);

            windows.push({
                sStart,
                sEnd,
                tStart,
                tEnd,
                sourceSlice: sourceSentences.slice(sStart, sEnd),
                targetSlice: targetSentences.slice(tStart, tEnd)
            });
        }

        return windows;
    }

    static async alignWindow(window, srcLang, tgtLang, prompts) {
        const {system, user} = await buildAlignmentPromptFromDB(
            srcLang,
            tgtLang,
            window.sourceSlice,
            window.targetSlice,
            prompts,
            {taskType: "sentence_alignment"}
        );

        const result = await llmCallWithRetry<{ alignments: any[] }>(
            async () => {
                const res = await sendChatCompletion({
                    messages: [
                        {role: "system", content: system},
                        {role: "user", content: user},
                    ],
                    temperature: 0.1,
                });

                const content = res.content;
                if (!content) throw new Error("Empty LLM response");

                return content;
            }
        );

        if (!result?.alignments) return [];

        // 🔥 shift indices back to global
        return result.alignments.map(a => ({
            sourceIds: a.sourceIds.map(id => id), // already string IDs
            targetIds: a.targetIds.map(id => id),
            confidence: a.confidence ?? 0.8
        }));
    }

    static async alignWithWindows(
        sourceSentences,
        targetSentences,
        srcLang,
        tgtLang
    ) {
        const prompts = listPrompts();

        // const anchors = this.buildAnchors(sourceSentences, targetSentences);
        const anchors = await this.buildHybridAnchors(
            sourceSentences,
            targetSentences,
            srcLang,
            tgtLang
        );
        const windows = this.buildWindows(anchors, sourceSentences, targetSentences);

        const concurrency = 4;
        let current = 0;
        const results = [];

        async function worker() {
            while (current < windows.length) {
                const idx = current++;
                const w = windows[idx];

                try {
                    const aligned = await AlignmentService.alignWindow(
                        w,
                        srcLang,
                        tgtLang,
                        prompts
                    );

                    results.push(...aligned);
                } catch (err) {
                    console.error("Window alignment failed", err);
                }
            }
        }

        await Promise.all(
            Array.from({length: concurrency}, () => worker())
        );

        return results;
    }

    static deduplicateAlignments(alignments) {
        const seen = new Set();
        const result = [];

        for (const a of alignments) {
            const key = JSON.stringify({
                s: a.sourceIds,
                t: a.targetIds
            });

            if (!seen.has(key)) {
                seen.add(key);
                result.push(a);
            }
        }

        return result;
    }

    static buildCoarseAnchors(source, target, step = 20) {
        const anchors = [];

        const ratio = target.length / source.length;

        for (let i = 0; i < source.length; i += step) {
            anchors.push({
                sIndex: i,
                tIndex: Math.floor(i * ratio)
            });
        }

        // ensure last anchor
        anchors.push({
            sIndex: source.length - 1,
            tIndex: target.length - 1
        });

        return anchors;
    }

    static buildAnchorPrompt(sourceSlice, targetSlice) {
                const system = `
        You are an alignment assistant.
        
        Find high-confidence anchor matches between source and target sentences.
        
        Rules:
        - Only return strong matches
        - Maintain order
        - Do NOT align everything
        - Anchors should be sparse and reliable
        
        Return JSON:
        {
          "anchors": [
            { "sourceIndex": number, "targetIndex": number, "confidence": number }
          ]
        }
        `;

                const user = `
        Source:
        ${sourceSlice.map((s, i) => `[${i}] ${s.text}`).join("\n")}
        
        Target:
        ${targetSlice.map((t, i) => `[${i}] ${t.text}`).join("\n")}
        `;

                return {system, user};
    }


    static async extractAnchorsLLM(sourceSlice, targetSlice) {
        const {system, user} = this.buildAnchorPrompt(sourceSlice, targetSlice);

        try {
            const result = await llmCallWithRetry<{ anchors: any[] }>(
                async () => {
                    const res = await sendChatCompletion({
                        messages: [
                            {role: "system", content: system},
                            {role: "user", content: user},
                        ],
                        temperature: 0.0,
                    });

                    const content = res.content;
                    if (!content) throw new Error("Empty LLM response");

                    return content;
                }
            );

            return result?.anchors || [];
        } catch (e) {
            console.error("Anchor LLM failed", e);
            return [];
        }
    }


    static async refineAnchorsWithLLM(
        coarseAnchors,
        source,
        target,
        srcLang,
        tgtLang
    ) {
        const refined = [];

        for (let i = 0; i < coarseAnchors.length - 1; i++) {
            const a1 = coarseAnchors[i];
            const a2 = coarseAnchors[i + 1];

            const sSlice = source.slice(a1.sIndex, a2.sIndex + 1);
            const tSlice = target.slice(a1.tIndex, a2.tIndex + 1);

            // skip tiny segments
            if (sSlice.length < 3 || tSlice.length < 3) continue;

            const localAnchors = await this.extractAnchorsLLM(sSlice, tSlice);

            for (const a of localAnchors) {
                if ((a.confidence ?? 0) < 0.7) continue; // 🔥 filter weak

                refined.push({
                    sIndex: a.sourceIndex + a1.sIndex,
                    tIndex: a.targetIndex + a1.tIndex,
                    confidence: a.confidence
                });
            }
        }

        return refined;
    }

    static mergeAnchors(coarse, refined) {
        const map = new Map();

        function add(a) {
            const key = `${a.sIndex}-${a.tIndex}`;
            if (!map.has(key)) {
                map.set(key, a);
            }
        }

        coarse.forEach(add);
        refined.forEach(add);

        return Array.from(map.values())
            .sort((a, b) => a.sIndex - b.sIndex);
    }

    static async buildHybridAnchors(
        sourceSentences,
        targetSentences,
        srcLang,
        tgtLang
    ) {
        console.log("⚡ Building coarse anchors...");
        const coarse = this.buildCoarseAnchors(sourceSentences, targetSentences);

        console.log("🤖 Refining anchors with LLM...");
        const refined = await this.refineAnchorsWithLLM(
            coarse,
            sourceSentences,
            targetSentences,
            srcLang,
            tgtLang
        );

        const merged = this.mergeAnchors(coarse, refined);

        console.log("✅ Final anchors:", merged);

        return merged;
    }

    static buildAdaptiveWindows(
        anchors,
        sourceSentences,
        targetSentences
    ) {
        const windows = [];

        for (let i = 0; i < anchors.length - 1; i++) {
            const a1 = anchors[i];
            const a2 = anchors[i + 1];

            const sLen = a2.sIndex - a1.sIndex;
            const tLen = a2.tIndex - a1.tIndex;

            /* --------------------------------
               🔥 Adaptive window size
            --------------------------------- */
            const avgLen = (sLen + tLen) / 2;

            let windowSize;
            if (avgLen < 10) windowSize = 5;
            else if (avgLen < 30) windowSize = 10;
            else if (avgLen < 80) windowSize = 20;
            else windowSize = 30;

            /* --------------------------------
               🔥 Ratio-aware expansion
            --------------------------------- */
            const ratio = tLen / (sLen || 1);

            const sStart = Math.max(0, a1.sIndex - windowSize);
            const sEnd = Math.min(sourceSentences.length, a2.sIndex + windowSize);

            const tStart = Math.max(0, a1.tIndex - Math.floor(windowSize * ratio));
            const tEnd = Math.min(targetSentences.length, a2.tIndex + Math.floor(windowSize * ratio));

            windows.push({
                sStart,
                sEnd,
                tStart,
                tEnd,
                sourceSlice: sourceSentences.slice(sStart, sEnd),
                targetSlice: targetSentences.slice(tStart, tEnd),
            });
        }

        return windows;
    }

    static repairAlignments(
        alignments,
        sourceSentences,
        targetSentences
    ) {
        console.log("🔧 Running alignment repair...");

        let result = alignments;

        result = this.mergeDuplicateAlignments(result);

        result = this.repairMissingAlignments(
            result,
            sourceSentences,
            targetSentences
        );

        return result;
    }

    static mergeDuplicateAlignments(alignments) {
        const map = new Map();

        for (const a of alignments) {
            const key = JSON.stringify({
                s: [...a.sourceIds].sort(),
                t: [...a.targetIds].sort()
            });

            if (!map.has(key)) {
                map.set(key, a);
            } else {
                // keep higher confidence
                const existing = map.get(key);
                if ((a.confidence ?? 0) > (existing.confidence ?? 0)) {
                    map.set(key, a);
                }
            }
        }

        return Array.from(map.values());
    }

    static repairMissingAlignments(
        alignments,
        sourceSentences,
        targetSentences
    ) {
        const { missingSource, missingTarget } =
            this.detectAlignmentIssues(alignments, sourceSentences, targetSentences);

        const repaired = [...alignments];

        for (const s of missingSource) {
            // find nearest target
            const closest = targetSentences.reduce((best, t) => {
                const dist = Math.abs(t.order - s.order);
                return dist < best.dist ? { t, dist } : best;
            }, { t: null, dist: Infinity });

            if (closest.t) {
                repaired.push({
                    sourceIds: [s.id],
                    targetIds: [closest.t.id],
                    confidence: 0.5,
                    strategy: "repair-nearest"
                });
            }
        }

        return repaired;
    }

    static detectAlignmentIssues(alignments, sourceSentences, targetSentences) {
        const usedSource = new Set();
        const usedTarget = new Set();

        for (const a of alignments) {
            a.sourceIds.forEach(id => usedSource.add(id));
            a.targetIds.forEach(id => usedTarget.add(id));
        }

        const missingSource = sourceSentences
            .filter(s => !usedSource.has(s.id));

        const missingTarget = targetSentences
            .filter(t => !usedTarget.has(t.id));

        return {
            missingSource,
            missingTarget
        };
    }

}


