import {buildAlignmentPromptFromDB, llmCallWithRetry} from "../../utils/AlignUtils";
import {sendChatCompletion} from "../../utils/sendChatCompletion";
import {GaleChurchService} from "./GaleChurchService";
import {listPrompts} from "../../db/promptService";
import {AnchorService} from "./AnchorService";
import {WindowService} from "./WindowService";
import {EmbeddingService} from "./EmbeddingService";
import {AlignmentService} from "./alignservice";
import {DPMonotonicAligner} from "./DPMonotonicAligner";

export class SentenceAlignmentService {

    /**
     * Parse "sp4-s0" → { paragraph: 4, sentence: 0 }
     * Works for both "sp" (source) and "tp" (target) prefixes.
     */
    static parseId(id) {
        const m = id.match(/^(sp|tp)(\d+)-s(\d+)$/);
        if (!m) return null;
        return { prefix: m[1], paragraph: parseInt(m[2]), sentence: parseInt(m[3]) };
    }

    /**
     * Build a fast lookup: sentenceId → positional index in the flat array.
     */
    static buildIndexMap(sentences) {
        const map = new Map();
        sentences.forEach((s, i) => map.set(s.id, i));
        return map;
    }

    /**
     * Get the positional index of a sentence id within its array.
     */
    static idx(id, indexMap) {
        return indexMap.get(id) ?? Infinity;
    }

    /**
     * Return the minimum source-positional-index for an alignment.
     */
    static minSrcIdx(a, srcMap) {
        return Math.min(...a.sourceIds.map(id => this.idx(id, srcMap)));
    }

    /**
     * Return the minimum target-positional-index for an alignment.
     */
    static minTgtIdx(a, tgtMap) {
        return Math.min(...a.targetIds.map(id => this.idx(id, tgtMap)));
    }

    /**
     * Return the maximum target-positional-index for an alignment.
     */
    static maxTgtIdx(a, tgtMap) {
        return Math.max(...a.targetIds.map(id => this.idx(id, tgtMap)));
    }


    static async align(source, target, srcLang, tgtLang, tracker) {

        const llm = await this.hybridAlign(source, target, srcLang, tgtLang, tracker);
        console.log("llm align results", llm);

        if (llm?.length) return llm;

        return GaleChurchService.align(source, target);
    }

    // static async llmAlign(source, target, srcLang, tgtLang) {
    //     // const prompts = listPrompts();
    //     //
    //     // const { system, user } = await buildAlignmentPromptFromDB(
    //     //     srcLang,
    //     //     tgtLang,
    //     //     source,
    //     //     target,
    //     //     prompts,
    //     //     { taskType: "sentence_alignment" }
    //     // );
    //     //
    //     // const result = await llmCallWithRetry(async () => {
    //     //     const res = await sendChatCompletion({
    //     //         messages: [
    //     //             { role: "system", content: system },
    //     //             { role: "user", content: user },
    //     //         ],
    //     //         temperature: 0.1,
    //     //     });
    //     //     return res.content;
    //     // });
    //     //
    //     // return result?.alignments ?? null;
    //     // 1. Anchors
    //     const anchors = await AnchorService.buildHybrid(
    //         source,
    //         target,
    //         srcLang,
    //         tgtLang
    //     );
    //     console.log("anchor results", anchors);
    //     // 2. Windows
    //     const windows = WindowService.buildWindows(
    //         anchors,
    //         source,
    //         target
    //     );
    //
    //     // 3. Align windows (parallel)
    //     const rawAlignments = await this.alignWindows(
    //         windows,
    //         srcLang,
    //         tgtLang
    //     );
    //     console.log("llm align results", rawAlignments);
    //     // 4. Deduplicate
    //     return this.deduplicate(rawAlignments);
    // }
    // //
    // static async alignWindows(windows, srcLang, tgtLang, progressCallback) {
    //
    //     const prompts = listPrompts();
    //     const results = [];
    //
    //     const concurrency = 4;
    //     let current = 0;
    //
    //     const worker = async () => {
    //         while (true) {
    //             const idx = current++;
    //             if (idx >= windows.length) break;
    //
    //             const w = windows[idx];
    //
    //             try {
    //                 const { system, user } = await buildAlignmentPromptFromDB(
    //                     srcLang,
    //                     tgtLang,
    //                     w.sourceSlice,
    //                     w.targetSlice,
    //                     prompts,
    //                     { taskType: "sentence_alignment" }
    //                 );
    //
    //                 const result = await llmCallWithRetry(async () => {
    //                     console.log("system prompt for alignment", system);
    //                     console.log("user prompt for alignment", user);
    //                     const res = await sendChatCompletion({
    //                         messages: [
    //                             { role: "system", content: system },
    //                             { role: "user", content: user }
    //                         ],
    //                         temperature: 0.1
    //                     });
    //                     console.log("align results", res);
    //                     return res.content;
    //                 });
    //
    //
    //
    //                 if (result?.alignments) {
    //                     results.push(...result.alignments);
    //                 }
    //
    //             } catch (e) {
    //                 console.error("Window alignment failed", e);
    //             }
    //         }
    //     };
    //
    //     await Promise.all(
    //         Array.from({ length: concurrency }, () => worker())
    //     );
    //
    //     return results;
    // }

    static async alignWindowsWithNoProgress(
        windows,
        srcLang,
        tgtLang
    ) {
        const results = [];
        const concurrency = 4; // adjust: 2–8 depending on model/API limits

        let globalIndex = 0;

        const nextIndex = () => globalIndex++;

        const worker = async () => {
            while (true) {
                const idx = nextIndex();
                if (idx >= windows.length) break;

                const w = windows[idx];

                try {
                    const { system, user } =
                        await buildAlignmentPromptFromDB(
                            srcLang,
                            tgtLang,
                            w.sourceSlice,
                            w.targetSlice,
                            listPrompts(),
                            { taskType: "sentence_alignment" }
                        );

                    const result = await llmCallWithRetry(async () => {
                        const res = await sendChatCompletion({
                            messages: [
                                { role: "system", content: system },
                                { role: "user", content: user }
                            ],
                            temperature: 0.1
                        });

                        return res.content;
                    });

                    if (result?.alignments) {
                        console.log("system and user for refinement", system, user);
                        console.log("alignments for refine", result.alignments);
                        results.push(...result.alignments);
                    }

                } catch (e) {
                    console.error("Window alignment failed:", e);
                }
            }
        };

        await Promise.all(
            Array.from({ length: concurrency }, () => worker())
        );

        return results;
    }

    static async alignWindows(
        windows,
        srcLang,
        tgtLang,
        progressCallback
    ) {
        const prompts = listPrompts();
        const results = [];

        const concurrency = 4;

        let completed = 0;
        const total = windows.length;

        // Optional lock-free counter update helper
        const reportProgress = () => {
            completed++;

            if (progressCallback) {
                progressCallback(completed, total);
            }
        };

        const worker = async () => {
            while (true) {

                // ⚠️ unsafe shared index but OK for work stealing pattern
                const idx = nextIndex();

                if (idx >= total) break;

                const w = windows[idx];

                try {
                    const { system, user } =
                        await buildAlignmentPromptFromDB(
                            srcLang,
                            tgtLang,
                            w.sourceSlice,
                            w.targetSlice,
                            listPrompts(),
                            { taskType: "sentence_alignment" }
                        );

                    const result = await llmCallWithRetry(async () => {
                        const res = await sendChatCompletion({
                            messages: [
                                { role: "system", content: system },
                                { role: "user", content: user }
                            ],
                            temperature: 0.1
                        });

                        return res.content;
                    });

                    if (result?.alignments) {
                        results.push(...result.alignments);
                    }

                } catch (e) {
                    console.error("Window alignment failed", e);
                } finally {
                    // ✅ ALWAYS report completion (success or fail)
                    reportProgress();
                }
            }
        };

        /* --------------------------------
           Safe shared index (work stealing)
        --------------------------------- */
        let globalIndex = 0;
        const nextIndex = () => globalIndex++;

        await Promise.all(
            Array.from({ length: concurrency }, () => worker())
        );

        return results;
    }


    /* =====================================
       4. CLEANUP
    ===================================== */

    static deduplicate(alignments) {
        const map = new Map();

        for (const a of alignments) {
            const key = JSON.stringify({
                s: a.sourceIds,
                t: a.targetIds
            });

            if (!map.has(key)) {
                map.set(key, a);
            }
        }

        return Array.from(map.values());
    }


    /* =====================================
    ENTRY
 ===================================== */
    // static async hybridAlign(source, target, srcLang, tgtLang) {
    //
    //     // 1. Embeddings
    //     const sourceEmb = await EmbeddingService.embedBatch(source);
    //     const targetEmb = await EmbeddingService.embedBatch(target);
    //
    //     // 2. Anchors
    //     const coarse = this.buildEmbeddingAnchors(sourceEmb, targetEmb);
    //     console.log('coarse anchor results', coarse);
    //     // const refined = await this.refineAnchorsLLM(source, target, coarse);
    //
    //     const anchors = coarse;
    //     // console.log('refined anchor results', anchors);
    //
    //     // 3. Windows
    //     const windows = WindowService.buildWindows(anchors, source, target);
    //
    //     // 4. Align windows (parallel)
    //     // const rawAlignments = await this.alignWindowsDP(
    //     //     windows,
    //     //     source,
    //     //     target,
    //     //     sourceEmb,
    //     //     targetEmb
    //     // );
    //
    //     const rawAlignments = await this.alignWindows(
    //         windows,
    //         srcLang,
    //         tgtLang
    //     );
    //     console.log('rawAlignments results', rawAlignments);
    //     return this.deduplicate(rawAlignments);
    // }

    static async hybridAlign(source, target, srcLang, tgtLang, tracker) {

     /* --------------------------------
           Progress model
        --------------------------------- */
        const totalWeight = 100;
        let progress = 0;

        tracker.update("aligning", progress, progress, totalWeight);



        const report = (delta) => {
            progress = Math.min(99, progress + delta); // avoid hitting 100 early
            if (tracker) {
                tracker.update("aligning", progress, progress, totalWeight);
            }
        };

        const MAX_WINDOW = 200;

        const overlap = this.computeDynamicOverlap(source.length, target.length) + 50;

        const windows = WindowService.buildHeuristicWindows(
            source,
            target,
            MAX_WINDOW,
            overlap
        );


        /* --------------------------------
   1. WINDOW ALIGNMENT (60%)
--------------------------------- */
        const totalWindows = windows.length;
        let completedWindows = 0;
        console.log("windows", windows);
        const rawAlignments = await this.alignWindows(
            windows,
            srcLang,
            tgtLang,
            () => {
                completedWindows++;

                const delta = (60 / totalWindows);
                report(delta);
            }
        );
        // Remove false many-to-many alignment
        // const groups = this.groupByAlignment(rawAlignments);
        // const refined = [];
        // const totalGroups = groups.length;
        // let completedGroups = 0;

        // for (const g of groups) {
        //     if (this.isSuspiciousManyToMany(g)) {
        //         const fixed = await this.refineManyToMany(
        //             g,
        //             srcLang,
        //             tgtLang
        //         );
        //         refined.push(...fixed);
        //     } else {
        //         refined.push(...g);
        //     }
        //
        //     completedGroups++;
        //
        //     const delta = totalGroups === 0 ? 0 : (20 / totalGroups);
        //     report(delta);
        // }



        // for (const g of groups) {
        //     if (this.isSuspiciousManyToMany(g)) {
        //         const fixed = await this.refineManyToMany(g, srcLang, tgtLang);
        //         refined.push(...fixed);
        //     } else {
        //         refined.push(...g);
        //     }
        // }

        const deduped = this.deduplicate(rawAlignments);
        const conflictsRound1 = this.resolveConflicts(deduped, source, target);
        // 3️⃣ 🔥 split fake many-to-many
        const totalSplit = deduped.length;
        let completedSplit = 0;
        const splited = await this.splitManyToMany(
            conflictsRound1,
            source,
            target,
            srcLang,
            tgtLang,
            () => {
                completedSplit++;

                const delta =
                    totalSplit === 0 ? 0 : (15 / totalSplit);

                report(delta);
            }
        );
        // 🔥 NEW STEP
        const finalAlignments = this.resolveConflicts(splited, source, target);
        report(5);

        /* --------------------------------
             FINALIZE
          --------------------------------- */
        tracker?.update("aligning", 100, 100, 100);

        return finalAlignments;
    }


    static enforceMonotonicity(alignments, sourceSentences, targetSentences) {
        const srcMap = this.buildIndexMap(sourceSentences);
        const tgtMap = this.buildIndexMap(targetSentences);

        // Sort by source position
        const sorted = [...alignments].sort((a, b) => {
            const sa = this.minSrcIdx(a, srcMap);
            const sb = this.minSrcIdx(b, srcMap);
            if (sa !== sb) return sa - sb;
            return this.minTgtIdx(a, tgtMap) - this.minTgtIdx(b, tgtMap);
        });

        if (sorted.length === 0) return [];

        // Extract target-start indices for LIS
        const tgtStarts = sorted.map(a => this.minTgtIdx(a, tgtMap));

        // Compute LIS indices (patience sorting)
        const lisIndices = this.longestIncreasingSubsequenceIndices(tgtStarts);

        const lisSet = new Set(lisIndices);
        const kept = sorted.filter((_, i) => lisSet.has(i));

        const dropped = sorted.length - kept.length;
        if (dropped > 0) {
            console.log(`Monotonicity: dropped ${dropped} backward-jumping alignment(s).`);
        }

        return kept;
    }

    /**
     * Returns the *indices* of elements forming the longest
     * non-decreasing subsequence.  (We allow equal values so that
     * many-to-one on the target side is fine.)
     */
    static longestIncreasingSubsequenceIndices(arr) {
        const n = arr.length;
        if (n === 0) return [];

        // tails[i] = smallest tail value for increasing subsequence of length i+1
        const tails = [];
        const tailIndices = [];   // actual index in arr for each tail
        const prev = new Array(n).fill(-1);

        for (let i = 0; i < n; i++) {
            const val = arr[i];

            // Binary search: find first tail > val  (we allow equal, so strictly greater)
            let lo = 0, hi = tails.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (tails[mid] <= val) lo = mid + 1;
                else hi = mid;
            }

            tails[lo] = val;
            tailIndices[lo] = i;

            if (lo > 0) {
                prev[i] = tailIndices[lo - 1];
            }
        }

        // Reconstruct
        const result = [];
        let idx = tailIndices[tails.length - 1];
        while (idx !== -1) {
            result.push(idx);
            idx = prev[idx];
        }
        result.reverse();
        return result;
    }

    static async splitManyToMany(
        alignments,
        source,
        target,
        srcLang,
        tgtLang,
        progressCallback
    ) {
        const result = [];

        // ── Step 1: Separate passthrough vs needs-refinement ──
        const passthrough = [];          // alignments we keep as-is
        const toRefine = [];             // alignments we need to refine
        const sliceMap = new Map();      // sliceKey → { slice, originalAlignments[] }

        const srcMap = new Map(source.map((s, i) => [s.id, i]));
        const tgtMap = new Map(target.map((t, i) => [t.id, i]));

        for (const a of alignments) {
            if (!this.shouldSplitManyToMany(a)) {
                passthrough.push(a);
                continue;
            }

            const slice = this.extractSlice(a, source, target);
            if (!slice) {
                passthrough.push(a);
                continue;
            }

            // Key by the actual range boundaries
            const key = `${slice.sStart}:${slice.sEnd}|${slice.tStart}:${slice.tEnd}`;

            if (sliceMap.has(key)) {
                // Same slice already queued — just track the original alignment
                sliceMap.get(key).originalAlignments.push(a);
            } else {
                sliceMap.set(key, {
                    slice,
                    originalAlignments: [a]
                });
            }
        }

        console.log(
            `splitManyToMany: ${passthrough.length} passthrough, ` +
            `${sliceMap.size} unique slices (from ${alignments.length - passthrough.length} candidates)`
        );

        // ── Step 2: Merge overlapping slices ──
        // Adjacent/overlapping slices should be merged to avoid conflicting results
        const mergedSlices = this.mergeOverlappingSlices(
            [...sliceMap.values()],
            source,
            target
        );

        console.log(`After merge: ${mergedSlices.length} non-overlapping slices`);

        // ── Step 3: Refine each unique slice ONCE ──
        const sliceResults = new Map(); // sliceKey → refined alignments

        for (const { slice, key, originalAlignments } of mergedSlices) {
            console.log(`Refining slice src[${slice.sStart}..${slice.sEnd - 1}] ↔ tgt[${slice.tStart}..${slice.tEnd - 1}]`);

            const refined = await this.refineBlock(
                // Build a synthetic alignment that covers the full merged range
                {
                    sourceIds: slice.sourceSlice.map(s => s.id),
                    targetIds: slice.targetSlice.map(t => t.id)
                },
                source,
                target,
                srcLang,
                tgtLang
            );

            if (refined && refined.length > 0) {
                sliceResults.set(key, refined);
            } else {
                // Refinement failed — keep originals
                sliceResults.set(key, originalAlignments);
            }

            if (progressCallback) {
                progressCallback();
            }
        }

        // ── Step 4: Assemble results in order ──
        // Collect all alignments, then sort by source position
        const allRefined = [];
        for (const [, refined] of sliceResults) {
            allRefined.push(...refined);
        }

        // Combine and sort
        const combined = [...passthrough, ...allRefined];
        combined.sort((a, b) => {
            const aIdx = Math.min(...a.sourceIds.map(id => srcMap.get(id) ?? Infinity));
            const bIdx = Math.min(...b.sourceIds.map(id => srcMap.get(id) ?? Infinity));
            return aIdx - bIdx;
        });

        return combined;
    }

    /**
     * Merge overlapping/adjacent slices so we don't send conflicting
     * refinement requests for overlapping ranges.
     */
    static mergeOverlappingSlices(sliceEntries, source, target) {
        if (sliceEntries.length <= 1) {
            return sliceEntries.map(e => ({
                slice: e.slice,
                key: `${e.slice.sStart}:${e.slice.sEnd}|${e.slice.tStart}:${e.slice.tEnd}`,
                originalAlignments: e.originalAlignments
            }));
        }

        // Sort by sStart, then tStart
        const sorted = [...sliceEntries].sort(
            (a, b) => a.slice.sStart - b.slice.sStart || a.slice.tStart - b.slice.tStart
        );

        const merged = [];
        let curr = {
            sStart: sorted[0].slice.sStart,
            sEnd:   sorted[0].slice.sEnd,
            tStart: sorted[0].slice.tStart,
            tEnd:   sorted[0].slice.tEnd,
            originalAlignments: [...sorted[0].originalAlignments]
        };

        for (let i = 1; i < sorted.length; i++) {
            const s = sorted[i].slice;

            // Overlapping if source OR target ranges overlap/touch
            const srcOverlaps = s.sStart <= curr.sEnd;
            const tgtOverlaps = s.tStart <= curr.tEnd;

            if (srcOverlaps || tgtOverlaps) {
                // Merge
                curr.sStart = Math.min(curr.sStart, s.sStart);
                curr.sEnd   = Math.max(curr.sEnd,   s.sEnd);
                curr.tStart = Math.min(curr.tStart, s.tStart);
                curr.tEnd   = Math.max(curr.tEnd,   s.tEnd);
                curr.originalAlignments.push(...sorted[i].originalAlignments);
            } else {
                // Finalize current, start new
                merged.push(curr);
                curr = {
                    sStart: s.sStart,
                    sEnd:   s.sEnd,
                    tStart: s.tStart,
                    tEnd:   s.tEnd,
                    originalAlignments: [...sorted[i].originalAlignments]
                };
            }
        }
        merged.push(curr);

        // Rebuild slice objects with actual sentence data
        return merged.map(m => {
            const slice = {
                sStart: m.sStart,
                sEnd:   m.sEnd,
                tStart: m.tStart,
                tEnd:   m.tEnd,
                sourceSlice: source.slice(m.sStart, m.sEnd),
                targetSlice: target.slice(m.tStart, m.tEnd)
            };
            const key = `${m.sStart}:${m.sEnd}|${m.tStart}:${m.tEnd}`;
            return { slice, key, originalAlignments: m.originalAlignments };
        });
    }


    // static async splitManyToMany(
    //     alignments,
    //     source,
    //     target,
    //     srcLang,
    //     tgtLang,
    //     progressCallback
    // ) {
    //     const result = [];
    //
    //     for (const a of alignments) {
    //
    //         if (this.shouldSplitManyToMany(a)) {
    //             console.log("should be refined", a);
    //
    //             const refined = await this.refineBlock(
    //                 a,
    //                 source,
    //                 target,
    //                 srcLang,
    //                 tgtLang
    //             );
    //             if(refined.length > 0){
    //                 result.push(...refined);
    //             }else{
    //                 result.push(a);
    //             }
    //
    //
    //             if (progressCallback) {
    //                 progressCallback();
    //             }
    //
    //         } else {
    //             result.push(a);
    //         }
    //     }
    //
    //     return result;
    // }

    static shouldSplitManyToMany(a) {
        const s = a.sourceIds?.length || 0;
        const t = a.targetIds?.length || 0;

        // suspicious patterns
        return (
            (s >= 2 && t >= 3) ||
            (s >= 3 && t >= 2)
        );
    }

    static async refineBlock(a, source, target, srcLang, tgtLang) {

        const slice = this.extractSlice(a, source, target);
        console.log("refinded slice", slice);

        return await this.alignWindowsWithNoProgress(
            [{
                ...slice,
                meta: {
                    type: "mn-refinement",
                    forceOneToOne: true,
                    discourageGrouping: true
                }
            }],
            srcLang,
            tgtLang,
            // {
            //     temperature: 0,
            //     bias: "1-1",
            //     maxGroupSize: 2 // 🔥 key constraint
            // }
        );
    }



    static extractSlice(a, source, target) {
        // Build ID → flat-index maps
        const srcIndex = new Map(source.map((s, i) => [s.id, i]));
        const tgtIndex = new Map(target.map((t, i) => [t.id, i]));

        // Resolve each ID to its real position in the flat array
        const sIdx = a.sourceIds.map(id => srcIndex.get(id));
        const tIdx = a.targetIds.map(id => tgtIndex.get(id));

        // Guard against undefined lookups
        if (sIdx.includes(undefined) || tIdx.includes(undefined)) {
            console.error("extractSlice: ID not found in source/target arrays", {
                sourceIds: a.sourceIds,
                targetIds: a.targetIds,
                missingSrc: a.sourceIds.filter(id => !srcIndex.has(id)),
                missTgt: a.targetIds.filter(id => !tgtIndex.has(id))
            });
            return null;
        }

        const sStart = Math.min(...sIdx);
        const sEnd   = Math.max(...sIdx) + 1;

        const tStart = Math.min(...tIdx);
        const tEnd   = Math.max(...tIdx) + 1;

        return {
            sStart,
            sEnd,
            tStart,
            tEnd,
            sourceSlice: source.slice(sStart, sEnd),
            targetSlice: target.slice(tStart, tEnd)
        };
    }

    /**
     * Build a two-way index: which alignments claim each source/target ID.
     */
    static buildConflictIndex(alignments) {
        const sourceMap = new Map(); // sourceId → Set<alignmentIndex>
        const targetMap = new Map(); // targetId → Set<alignmentIndex>

        for (let i = 0; i < alignments.length; i++) {
            const a = alignments[i];
            for (const s of a.sourceIds ?? []) {
                if (!sourceMap.has(s)) sourceMap.set(s, new Set());
                sourceMap.get(s).add(i);
            }
            for (const t of a.targetIds ?? []) {
                if (!targetMap.has(t)) targetMap.set(t, new Set());
                targetMap.get(t).add(i);
            }
        }

        return { sourceMap, targetMap };
    }

    /**
     * Score an alignment for conflict resolution.
     * Higher = better.
     */
    static scoreAlignment(a, srcIndex, tgtIndex) {
        let score = 0;

        const srcLen = a.sourceIds?.length || 1;
        const tgtLen = a.targetIds?.length || 1;

        // 1. Prefer balanced alignments (1:1 > 3:1)
        score -= Math.abs(srcLen - tgtLen) * 2;

        // 2. Prefer smaller total span (fewer segments = more precise)
        score -= (srcLen + tgtLen) * 0.5;

        // 3. Meta-type bonuses
        const metaType = a.meta?.type || "";
        if (metaType.includes("anchor"))    score += 3;
        if (metaType === "heuristic")       score += 1;
        if (metaType === "gap-fill")        score += 0.5;

        // 4. Confidence from LLM
        score += (a.confidence || a.score || 0);

        // 5. Penalize diagonal distance (source pos vs target pos)
        //    Use flat index maps instead of parsing IDs
        if (srcIndex && tgtIndex && a.sourceIds?.length && a.targetIds?.length) {
            const sPositions = a.sourceIds
                .map(id => srcIndex.get(id))
                .filter(i => i !== undefined);
            const tPositions = a.targetIds
                .map(id => tgtIndex.get(id))
                .filter(i => i !== undefined);

            if (sPositions.length && tPositions.length) {
                const sMid = (Math.min(...sPositions) + Math.max(...sPositions)) / 2;
                const tMid = (Math.min(...tPositions) + Math.max(...tPositions)) / 2;
                score -= Math.abs(sMid - tMid) * 0.1;
            }
        }

        return score;
    }

    /**
     * Resolve all conflicts: source-side, target-side, and duplicates.
     * Greedy approach: pick highest-scored alignments first,
     * then remove anything that conflicts with them.
     */
    static resolveConflicts(alignments, sourceSentences, targetSentences) {
        if (!alignments.length) return [];

        // ── Build flat-index maps for proper distance calculation ──
        const srcIndex = sourceSentences
            ? new Map(sourceSentences.map((s, i) => [s.id, i]))
            : null;
        const tgtIndex = targetSentences
            ? new Map(targetSentences.map((t, i) => [t.id, i]))
            : null;

        // ── Score every alignment ──
        const scored = alignments.map((a, i) => ({
            index: i,
            alignment: a,
            score: this.scoreAlignment(a, srcIndex, tgtIndex)
        }));

        // ── Sort descending by score (best first) ──
        scored.sort((a, b) => b.score - a.score);

        // ── Greedy selection ──
        const usedSources = new Set();
        const usedTargets = new Set();
        const resolved = [];

        for (const { alignment: a, score } of scored) {
            // Check: does this alignment conflict with anything already selected?
            const srcConflict = (a.sourceIds ?? []).some(id => usedSources.has(id));
            const tgtConflict = (a.targetIds ?? []).some(id => usedTargets.has(id));

            if (srcConflict || tgtConflict) {
                // Skip — a better-scored alignment already claimed these segments
                continue;
            }

            // Accept this alignment
            resolved.push(a);
            for (const s of a.sourceIds ?? []) usedSources.add(s);
            for (const t of a.targetIds ?? []) usedTargets.add(t);
        }

        // ── Sort output by source position ──
        if (srcIndex) {
            resolved.sort((a, b) => {
                const aMin = Math.min(
                    ...(a.sourceIds ?? []).map(id => srcIndex.get(id) ?? Infinity)
                );
                const bMin = Math.min(
                    ...(b.sourceIds ?? []).map(id => srcIndex.get(id) ?? Infinity)
                );
                return aMin - bMin;
            });
        }

        return resolved;
    }


    static groupByAlignment(rawAlignments) {
        const groups = [];
        let current = null;

        for (const a of rawAlignments) {
            if (!current) {
                current = [a];
                continue;
            }

            const prev = current[current.length - 1];

            const isContiguous =
                a.sourceStart <= prev.sourceEnd + 1 &&
                a.targetStart <= prev.targetEnd + 1;

            if (isContiguous) {
                current.push(a);
            } else {
                groups.push(current);
                current = [a];
            }
        }

        if (current) groups.push(current);

        return groups;
    }


    static isSuspiciousManyToMany(group) {
        const srcSpan =
            group[group.length - 1].sourceEnd - group[0].sourceStart;

        const tgtSpan =
            group[group.length - 1].targetEnd - group[0].targetStart;

        const srcCount = new Set(
            group.flatMap(g =>
                Array.from({ length: g.sourceEnd - g.sourceStart + 1 },
                    (_, i) => g.sourceStart + i)
            )
        ).size;

        const tgtCount = new Set(
            group.flatMap(g =>
                Array.from({ length: g.targetEnd - g.targetStart + 1 },
                    (_, i) => g.targetStart + i)
            )
        ).size;

        // 🔥 heuristic: long spans but linear structure
        const looksLinear =
            Math.abs(srcCount - tgtCount) < Math.min(srcCount, tgtCount) * 0.2;

        const tooLarge = srcCount > 1 && tgtCount > 1;

        return looksLinear && tooLarge;
    }

    //
    // static async refineManyToMany(group, srcLang, tgtLang) {
    //     const sourceSlice = group.flatMap(g =>
    //         g.sourceSlice ?? []
    //     );
    //
    //     const targetSlice = group.flatMap(g =>
    //         g.targetSlice ?? []
    //     );
    //
    //     // 🔥 force re-alignment with stricter prompt
    //     return await this.alignWindowsWithNoProgress(
    //         [{
    //             sStart: 0,
    //             sEnd: sourceSlice.length,
    //             tStart: 0,
    //             tEnd: targetSlice.length,
    //             sourceSlice,
    //             targetSlice,
    //             meta: { type: "refinement-pass" }
    //         }],
    //         srcLang,
    //         tgtLang,
    //
    //         // {
    //         //     strictOneToOneBias: true,
    //         //     discourageMerging: true
    //         // }
    //     );
    // }

    static computeDynamicOverlap(sourceLen, targetLen) {

        const ratio = targetLen / Math.max(1, sourceLen);

        // base overlap scales with window size (200 max window)
        let overlap = Math.round(0.05 * 200); // baseline = 10

        // adjust based on imbalance
        if (ratio > 1.5) {
            // target significantly longer → more fragmentation risk
            overlap += Math.round(0.1 * 200); // +20
        } else if (ratio < 0.7) {
            // target shorter → compressing risk
            overlap += Math.round(0.05 * 200); // +10
        }

        // clamp for safety
        overlap = Math.max(5, Math.min(overlap, 60));

        return overlap;
    }

    /* =====================================
       EMBEDDINGS
    ===================================== */

    static async embedAll(sentences) {
        return Promise.all(
            sentences.map(s => this.getEmbedding(s.text))
        );
    }

    static async getEmbedding(text: string): Promise<number[]> {
        // const res = await openai.embeddings.create({
        //     model: "text-embedding-3-small",
        //     input: text
        // });
        //
        // return res.data[0].embedding;
        return null;
    }

    static cosine(a, b) {
        let dot = 0, na = 0, nb = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }

        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
    }

    /* =====================================
       1. EMBEDDING ANCHORS
    ===================================== */

    static buildEmbeddingAnchors(sourceEmb, targetEmb, step = 10) {

        const anchors = [];

        for (let i = 0; i < sourceEmb.length; i += step) {

            let best = -1;
            let bestScore = -Infinity;

            for (let j = 0; j < targetEmb.length; j++) {
                const sim = this.cosine(sourceEmb[i], targetEmb[j]);

                if (sim > bestScore) {
                    bestScore = sim;
                    best = j;
                }
            }

            if (bestScore > 0.75) {
                anchors.push({
                    sIndex: i,
                    tIndex: best,
                    confidence: bestScore
                });
            }
        }

        anchors.push({
            sIndex: sourceEmb.length - 1,
            tIndex: targetEmb.length - 1
        });

        return anchors;
    }

    /* =====================================
       2. LLM REFINEMENT (SPARSE)
    ===================================== */

    static async refineAnchorsLLM(source, target, coarse) {

        const refined = [];

        for (let i = 0; i < coarse.length - 1; i++) {

            const a1 = coarse[i];
            const a2 = coarse[i + 1];

            const sSlice = source.slice(a1.sIndex, a2.sIndex + 1);
            const tSlice = target.slice(a1.tIndex, a2.tIndex + 1);

            if (sSlice.length < 5) continue;

            const anchors = await this.extractAnchorsLLM(sSlice, tSlice);

            for (const a of anchors) {
                if ((a.confidence ?? 0) < 0.7) continue;

                refined.push({
                    sIndex: a.sourceIndex + a1.sIndex,
                    tIndex: a.targetIndex + a1.tIndex
                });
            }
        }

        return refined;
    }

    static async extractAnchorsLLM(sourceSlice, targetSlice) {

        const system = `
Find strong alignment anchors only.
Return sparse matches.

JSON:
{ "anchors": [ { "sourceIndex": number, "targetIndex": number, "confidence": number } ] }
`;

        const user = `
Source:
${sourceSlice.map((s, i) => `[${i}] ${s.text}`).join("\n")}

Target:
${targetSlice.map((t, i) => `[${i}] ${t.text}`).join("\n")}
`;

        const res = await llmCallWithRetry(async () => {
            const r = await sendChatCompletion({
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user }
                ],
                temperature: 0
            });
            return r.content;
        });

        return res?.anchors ?? [];
    }

    static mergeAnchors(a, b) {
        const map = new Map();

        [...a, ...b].forEach(x => {
            map.set(`${x.sIndex}-${x.tIndex}`, x);
        });

        return Array.from(map.values())
            .sort((x, y) => x.sIndex - y.sIndex);
    }

    /* =====================================
       3. WINDOWS
    ===================================== */

    static buildWindows(anchors, source, target) {

        const windows = [];

        for (let i = 0; i < anchors.length - 1; i++) {

            const a1 = anchors[i];
            const a2 = anchors[i + 1];

            const sLen = a2.sIndex - a1.sIndex;
            const tLen = a2.tIndex - a1.tIndex;

            const avg = (sLen + tLen) / 2;

            let size;
            if (avg < 10) size = 5;
            else if (avg < 30) size = 10;
            else if (avg < 80) size = 20;
            else size = 30;

            windows.push({
                sStart: Math.max(0, a1.sIndex - size),
                sEnd: Math.min(source.length, a2.sIndex + size),
                tStart: Math.max(0, a1.tIndex - size),
                tEnd: Math.min(target.length, a2.tIndex + size)
            });
        }

        return windows;
    }

    /* =====================================
       4. ALIGN WINDOWS (DP + MULTI)
    ===================================== */

    static async alignWindowsDP(windows, source, target, sourceEmb, targetEmb) {

        const results = [];

        const concurrency = 4;
        let current = 0;

        const worker = async () => {
            while (true) {
                const idx = current++;
                if (idx >= windows.length) break;

                const w = windows[idx];

                const sEmb = sourceEmb.slice(w.sStart, w.sEnd);
                const tEmb = targetEmb.slice(w.tStart, w.tEnd);

                const aligned = this.dpAlign(sEmb, tEmb);

                for (const a of aligned) {
                    results.push({
                        sourceIds: a.s.map(i => source[i + w.sStart].id),
                        targetIds: a.t.map(j => target[j + w.tStart].id),
                        confidence: 0.8
                    });
                }
            }
        };

        await Promise.all(
            Array.from({ length: concurrency }, () => worker())
        );

        return results;
    }

    /* =====================================
       DP ALIGNMENT (FULL SOTA)
    ===================================== */

    static dpAlign(sourceEmb, targetEmb) {

        const S = sourceEmb.length;
        const T = targetEmb.length;

        const dp = Array.from({ length: S + 1 },
            () => Array(T + 1).fill(-Infinity)
        );

        const back = Array.from({ length: S + 1 },
            () => Array(T + 1).fill(null)
        );

        dp[0][0] = 0;

        const sim = (i, j) =>
            this.cosine(sourceEmb[i], targetEmb[j]);

        const simMerge = (sIdxs, tIdxs) => {
            let total = 0;
            for (const i of sIdxs) {
                for (const j of tIdxs) {
                    total += sim(i, j);
                }
            }
            return total / (sIdxs.length * tIdxs.length);
        };

        const P = {
            "1-1": 0,
            "1-2": 0.15,
            "2-1": 0.15,
            "2-2": 0.25,
            "1-0": 0.6,
            "0-1": 0.6
        };

        for (let i = 0; i <= S; i++) {
            for (let j = 0; j <= T; j++) {

                if (dp[i][j] === -Infinity) continue;

                if (i < S && j < T) {
                    const score = dp[i][j] + sim(i, j);
                    if (score > dp[i + 1][j + 1]) {
                        dp[i + 1][j + 1] = score;
                        back[i + 1][j + 1] = { type: "1-1" };
                    }
                }

                if (i < S && j + 1 < T) {
                    const score = dp[i][j] +
                        simMerge([i], [j, j + 1]) - P["1-2"];

                    if (score > dp[i + 1][j + 2]) {
                        dp[i + 1][j + 2] = score;
                        back[i + 1][j + 2] = { type: "1-2" };
                    }
                }

                if (i + 1 < S && j < T) {
                    const score = dp[i][j] +
                        simMerge([i, i + 1], [j]) - P["2-1"];

                    if (score > dp[i + 2][j + 1]) {
                        dp[i + 2][j + 1] = score;
                        back[i + 2][j + 1] = { type: "2-1" };
                    }
                }

                if (i + 1 < S && j + 1 < T) {
                    const score = dp[i][j] +
                        simMerge([i, i + 1], [j, j + 1]) - P["2-2"];

                    if (score > dp[i + 2][j + 2]) {
                        dp[i + 2][j + 2] = score;
                        back[i + 2][j + 2] = { type: "2-2" };
                    }
                }

                if (i < S) {
                    const score = dp[i][j] - P["1-0"];
                    if (score > dp[i + 1][j]) {
                        dp[i + 1][j] = score;
                        back[i + 1][j] = { type: "1-0" };
                    }
                }

                if (j < T) {
                    const score = dp[i][j] - P["0-1"];
                    if (score > dp[i][j + 1]) {
                        dp[i][j + 1] = score;
                        back[i][j + 1] = { type: "0-1" };
                    }
                }
            }
        }

        const result = [];
        let i = S, j = T;

        while (i > 0 || j > 0) {
            const step = back[i][j];
            if (!step) break;

            switch (step.type) {
                case "1-1":
                    result.push({ s: [i - 1], t: [j - 1] });
                    i--; j--; break;
                case "1-2":
                    result.push({ s: [i - 1], t: [j - 2, j - 1] });
                    i--; j -= 2; break;
                case "2-1":
                    result.push({ s: [i - 2, i - 1], t: [j - 1] });
                    i -= 2; j--; break;
                case "2-2":
                    result.push({ s: [i - 2, i - 1], t: [j - 2, j - 1] });
                    i -= 2; j -= 2; break;
                case "1-0":
                    result.push({ s: [i - 1], t: [] });
                    i--; break;
                case "0-1":
                    result.push({ s: [], t: [j - 1] });
                    j--; break;
            }
        }

        return result.reverse();
    }

    static mergeOverlaps(alignments) {
        alignments.sort((a, b) => a.sStart - b.sStart);

        const merged = [];

        for (const curr of alignments) {
            const prev = merged[merged.length - 1];

            if (
                prev &&
                curr.sStart <= prev.sEnd &&
                curr.tStart <= prev.tEnd
            ) {
                // merge
                prev.sEnd = Math.max(prev.sEnd, curr.sEnd);
                prev.tEnd = Math.max(prev.tEnd, curr.tEnd);
            } else {
                merged.push({ ...curr });
            }
        }

        return merged;
    }


    static async repairWithHybrid(
        alignments,
        source,
        target,
        srcLang,
        tgtLang
    ) {
        const gaps = this.findUnalignedWindows(alignments, source, target);
        const repaired = [];

        for (const w of gaps) {

            const sourceSlice = source.slice(w.sStart, w.sEnd + 1);
            const targetSlice = target.slice(w.tStart, w.tEnd + 1);

            const sLen = sourceSlice.length;
            const tLen = targetSlice.length;

            const ratio = tLen / Math.max(1, sLen);
            if (ratio > 5 || ratio < 0.2) continue;

            // =========================
            // ✅ Rule 1: simple merge
            // =========================
            if (sLen === 1 && tLen > 1) {
                repaired.push({
                    sourceIds: [sourceSlice[0].id],
                    targetIds: targetSlice.map(t => t.id),
                    confidence: 0.9,
                    explanation: "1-to-many merge (gap repair)"
                });
                continue;
            }

            if (tLen === 1 && sLen > 1) {
                repaired.push({
                    sourceIds: sourceSlice.map(s => s.id),
                    targetIds: [targetSlice[0].id],
                    confidence: 0.9,
                    explanation: "many-to-1 merge (gap repair)"
                });
                continue;
            }

            // =========================
            // ✅ Rule 2: huge gap → LLM
            // =========================
            if (sLen + tLen >= 30) {
                const aligned = await this.monotonicAlignBlock(
                    sourceSlice,
                    targetSlice,
                    srcLang,
                    tgtLang
                );

                repaired.push(...aligned);
                continue;
            }

            // =========================
            // ✅ Rule 3: DP fallback
            // =========================
            const aligned = DPMonotonicAligner.align(
                sourceSlice,
                targetSlice
            );

            repaired.push(...aligned);
        }

        let merged = [...alignments, ...repaired];

        merged = this.deduplicate(merged);
        merged = this.mergeOverlaps(merged);

        return merged;
    }


    static removeNullAlignments(alignments) {
        return alignments.filter(a =>
            Array.isArray(a.sourceIds) &&
            Array.isArray(a.targetIds) &&
            a.sourceIds.length > 0 &&
            a.targetIds.length > 0
        );
    }


    static findCoverageGaps(alignments, source, target) {

        const srcMap = new Map(source.map((s, i) => [s.id, i]));
        const tgtMap = new Map(target.map((t, i) => [t.id, i]));

        const srcCovered = new Array(source.length).fill(false);
        const tgtCovered = new Array(target.length).fill(false);

        for (const a of alignments) {
            for (const sid of a.sourceIds) {
                const i = srcMap.get(sid);
                if (typeof i === "number") {
                    srcCovered[i] = true;
                }
            }
            for (const tid of a.targetIds) {
                const j = tgtMap.get(tid);
                if (typeof j === "number") {
                    tgtCovered[j] = true;
                }
            }
        }

        const gaps = [];

        // 🔥 detect TARGET gaps (your main issue)
        let j = 0;
        while (j < target.length) {
            if (!tgtCovered[j]) {
                const start = j;
                while (j < target.length && !tgtCovered[j]) j++;
                const end = j - 1;

                gaps.push({
                    type: "target_gap",
                    tStart: start,
                    tEnd: end
                });
            }
            j++;
        }

        // 🔥 detect SOURCE gaps too
        let i = 0;
        while (i < source.length) {
            if (!srcCovered[i]) {
                const start = i;
                while (i < source.length && !srcCovered[i]) i++;
                const end = i - 1;

                gaps.push({
                    type: "source_gap",
                    sStart: start,
                    sEnd: end
                });
            }
            i++;
        }

        return gaps;
    }

    static attachUncoveredSentences(alignments, source, target) {

        const srcMap = new Map(source.map((s, i) => [s.id, i]));
        const tgtMap = new Map(target.map((t, i) => [t.id, i]));

        // Build coverage
        const srcCovered = new Array(source.length).fill(false);
        const tgtCovered = new Array(target.length).fill(false);

        for (const a of alignments) {
            for (const sid of a.sourceIds) {
                const i = srcMap.get(sid);
                if (typeof i === "number") {
                    srcCovered[i] = true;
                }
            }
            for (const tid of a.targetIds) {
                const j = tgtMap.get(tid);
                if (typeof j === "number") {
                    tgtCovered[j] = true;
                }
            }
        }

        // 🔥 Fix target gaps
        for (let j = 0; j < target.length; j++) {
            if (!tgtCovered[j]) {

                // find nearest alignment
                let best = null;
                let bestDist = Infinity;

                for (const a of alignments) {
                    const indices = a.targetIds.map(id => tgtMap.get(id));
                    const min = Math.min(...indices);
                    const max = Math.max(...indices);

                    const dist = Math.min(
                        Math.abs(j - min),
                        Math.abs(j - max)
                    );

                    if (dist < bestDist) {
                        bestDist = dist;
                        best = a;
                    }
                }

                if (best) {
                    best.targetIds.push(target[j].id);
                    best.explanation = (best.explanation || "") + " +attached target";
                }
            }
        }

        // 🔥 Fix source gaps (same idea)
        for (let i = 0; i < source.length; i++) {
            if (!srcCovered[i]) {

                let best = null;
                let bestDist = Infinity;

                for (const a of alignments) {
                    const indices = a.sourceIds.map(id => srcMap.get(id));
                    const min = Math.min(...indices);
                    const max = Math.max(...indices);

                    const dist = Math.min(
                        Math.abs(i - min),
                        Math.abs(i - max)
                    );

                    if (dist < bestDist) {
                        bestDist = dist;
                        best = a;
                    }
                }

                if (best) {
                    best.sourceIds.push(source[i].id);
                    best.explanation = (best.explanation || "") + " +attached source";
                }
            }
        }

        return alignments;
    }

    static async monotonicAlignBlock(
        sourceSlice,
        targetSlice,
        srcLang,
        tgtLang
    ) {

        const system = `
You are a professional sentence alignment system.

STRICT RULES (VERY IMPORTANT):
1. Alignment MUST be monotonic.
2. Do NOT reorder sentences.
3. If source sentence i aligns to target j,
   then source i+1 can ONLY align to j or later.
4. NEVER create crossing alignments.
5. Preserve original order strictly.

SEGMENTATION RULES:
6. Do NOT merge everything into one alignment.
7. Prefer small, meaningful groups (1-1, 1-2, 2-1).
8. Split into multiple alignments whenever possible.
9. Maintain paragraph-level structure.

QUALITY RULES:
10. Every source sentence should be aligned if possible.
11. Avoid skipping large chunks.
12. Align based on semantic meaning, not just position.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "alignments": [
    {
      "sourceIds": ["s1"],
      "targetIds": ["t1"],
      "confidence": 0.0,
      "explanation": "short reason"
    }
  ]
}

DO NOT output anything except valid JSON.
`;

        const user = `
Source language: ${srcLang}
Target language: ${tgtLang}

Source sentences:
${sourceSlice.map(s => `${s.id}: ${s.text}`).join("\n")}

Target sentences:
${targetSlice.map(t => `${t.id}: ${t.text}`).join("\n")}
`;

        console.log("aligned prompt mono tonic", system, user);
        let response;
        try {
             response = await llmCallWithRetry(async () => {
                const r = await sendChatCompletion({
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: user }
                    ],
                    temperature: 0,
                    responseFormat: 'json_object',
                });
                // llmCallWithRetry does JSON.parse, but some models still wrap in markdown.
                // Return the raw content wrapped so JSON.parse works; if it fails,
                // strip markdown fences and try again so llmCallWithRetry can succeed.
                const raw = r.content;
                try {
                    JSON.parse(raw);
                    return raw;
                } catch {
                    const cleaned = raw
                        .replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1')
                        .trim();
                    return cleaned;
                }
            });
        } catch (err) {
            const msg = err?.message || String(err);
            console.error("monotonicAlignBlock: LLM call failed", msg);
            throw new Error(`Realign LLM call failed: ${msg}`);
        }

        if (!response || !response.alignments || !Array.isArray(response.alignments)) {
            console.warn("monotonicAlignBlock: invalid or null response from LLM", response);
            throw new Error("LLM returned no alignments for realignment");
        }

        console.log("aligned results mono tonic", response);

        // =========================
        // 🔒 Post-validation (VERY IMPORTANT)
        // =========================
        const finalResults =  this.validateMonotonicOutput(response.alignments, sourceSlice, targetSlice);
        console.log("final results after validation", finalResults);
        return finalResults;
    }


    static validateMonotonicOutput(alignments, sourceSlice, targetSlice) {

        const srcIndex = new Map(sourceSlice.map((s, i) => [s.id, i]));
        const tgtIndex = new Map(targetSlice.map((t, i) => [t.id, i]));

        let lastSrc = -1;
        let lastTgt = -1;

        const valid = [];

        for (const a of alignments) {

            const sIdx = a.sourceIds.map(id => srcIndex.get(id)).filter(i => i !== undefined);
            const tIdx = a.targetIds.map(id => tgtIndex.get(id)).filter(i => i !== undefined);

            if (sIdx.length === 0 || tIdx.length === 0) continue;

            const sMin = Math.min(...sIdx);
            const tMin = Math.min(...tIdx);

            // 🚫 enforce monotonic order
            if (sMin < lastSrc || tMin < lastTgt) {
                continue;
            }

            lastSrc = Math.max(...sIdx);
            lastTgt = Math.max(...tIdx);

            valid.push({
                sourceIds: a.sourceIds,
                targetIds: a.targetIds,
                confidence: a.confidence ?? 0.7,
                explanation: a.explanation || "monotonic alignment"
            });
        }

        return valid;
    }

    static findUnalignedWindows(alignments, source, target) {
        const srcMap = this.buildIndexMap(source);
        const tgtMap = this.buildIndexMap(target);

        const srcCovered = new Array(source.length).fill(false);
        const tgtCovered = new Array(target.length).fill(false);

        for (const a of alignments) {
            for (const id of a.sourceIds) {
                srcCovered[srcMap.get(id)] = true;
            }
            for (const id of a.targetIds) {
                tgtCovered[tgtMap.get(id)] = true;
            }
        }

        const windows = [];
        let i = 0, j = 0;

        while (i < source.length && j < target.length) {

            while (i < source.length && srcCovered[i]) i++;
            while (j < target.length && tgtCovered[j]) j++;

            if (i >= source.length || j >= target.length) break;

            const sStart = i;
            const tStart = j;

            while (i < source.length && !srcCovered[i]) i++;
            while (j < target.length && !tgtCovered[j]) j++;

            const sEnd = i - 1;
            const tEnd = j - 1;

            windows.push({ sStart, sEnd, tStart, tEnd });
        }

        return windows;
    }

    // /* =====================================
    //    FINAL CLEANUP
    // ===================================== */
    //
    // static deduplicate(arr) {
    //     const map = new Map();
    //
    //     for (const a of arr) {
    //         const key = JSON.stringify(a);
    //         if (!map.has(key)) map.set(key, a);
    //     }
    //
    //     return Array.from(map.values());
    // }
}
