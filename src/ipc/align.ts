import { ipcMain } from "electron";
import {AlignmentService} from "../renderer/services/alignservice";
import {splitIntoParagraphs} from "../utils/AlignUtils";
import {saveParaAlignments, saveParagraphs} from "../db/paragraphs";
import {v4 as uuidv4} from "uuid";
import {db} from "../db/db";
import {Line, Link, LLMSettings} from "../types/alignment";
import {getLLMSettings, loadDefaultModel, saveLLMSettings} from "../db/llmSettings";
import {AlignmentPipelineService} from "../renderer/services/AlignmentPipelineService";
import {SentenceAlignmentService} from "../renderer/services/SentenceAlignmentService";
import dbService from "../database/database.service";
import {sendChatCompletion} from "../utils/sendChatCompletion";
const { contextBridge, ipcRenderer } = require("electron");
//
// ipcMain.handle("align:paragraphs", async (_, payload) => {
//
//     const { documentId, sourceText, targetText } = payload;
//     const tx = db.transaction(() => {
//         /* --------------------------------
//            1. Update document status FIRST
//         --------------------------------- */
//         db.prepare(`
//           UPDATE documents
//           SET status = ?, updated_at = CURRENT_TIMESTAMP
//           WHERE id = ?
//         `).run("pending-para", documentId);
//
//         /* --------------------------------
//            2. Split paragraphs
//         --------------------------------- */
//         const sourceParas = splitIntoParagraphs(sourceText);
//         const targetParas = splitIntoParagraphs(targetText);
//
//         const sourceIndexToId = saveParagraphs(
//             documentId, "source", sourceParas
//         );
//         const targetIndexToId = saveParagraphs(
//             documentId, "target", targetParas
//         );
//
//         // 4️⃣ Align (INDEX-BASED)
//         const paraLinks = AlignmentService.alignParas(
//             sourceParas,
//             targetParas
//         );
//
//         // 5️⃣ Save alignments (INDEX + DB IDs)
//         saveParaAlignments(
//             documentId,
//             paraLinks,
//             sourceIndexToId,
//             targetIndexToId
//         );
//
//         return paraLinks.length;
//     });
//
//     const alignmentCount = tx();
//
//     return {
//         status: "pending-para",
//         alignmentCount,
//     };
// });

// ipcMain.handle("align:paragraphs", async (_, payload) => {
//     const { documentId, sourceText, targetText, srcLang, tgtLang } = payload;
//
//     const tx = db.transaction(async () => {
//
//         /* --------------------------------
//            1. Update status
//         --------------------------------- */
//         db.prepare(`
//           UPDATE documents
//           SET status = ?, updated_at = CURRENT_TIMESTAMP
//           WHERE id = ?
//         `).run("processing", documentId);
//
//         /* --------------------------------
//            2. Split paragraphs
//         --------------------------------- */
//         const sourceParas = splitIntoParagraphs(sourceText);
//         const targetParas = splitIntoParagraphs(targetText);
//
//         const sourceIndexToId = saveParagraphs(
//             documentId, "source", sourceParas
//         );
//         const targetIndexToId = saveParagraphs(
//             documentId, "target", targetParas
//         );
//
//         /* --------------------------------
//            3. LLM Paragraph Alignment
//         --------------------------------- */
//         const paraLinks = await AlignmentService.alignParas(
//             sourceParas,
//             targetParas,
//             srcLang,
//             tgtLang
//         );
//
//         /* --------------------------------
//            4. Save paragraph alignments
//         --------------------------------- */
//         saveParaAlignments(
//             documentId,
//             paraLinks,
//             sourceIndexToId,
//             targetIndexToId
//         );
//
//         /* --------------------------------
//            5. Build pairs for sentence alignment
//         --------------------------------- */
//         const pairs = paraLinks.map((link) => {
//             const sourceLines = link.sourceParaIds.map(id =>
//                 sourceParas.find(p => p.id === id)
//             );
//
//             const targetLines = link.targetParaIds.map(id =>
//                 targetParas.find(p => p.id === id)
//             );
//
//             return {
//                 sourceId: link.sourceParaIds.join(","),
//                 targetId: link.targetParaIds.join(","),
//                 sourceLines,
//                 targetLines,
//             };
//         });
//
//         /* --------------------------------
//            6. Batch sentence alignment
//         --------------------------------- */
//         await AlignmentService.alignParagraphBatch(
//             pairs,
//             srcLang,
//             tgtLang,
//             String(documentId)
//         );
//
//         /* --------------------------------
//            7. Final status
//         --------------------------------- */
//         db.prepare(`
//           UPDATE documents
//           SET status = ?, updated_at = CURRENT_TIMESTAMP
//           WHERE id = ?
//         `).run("pending-sent", documentId);
//
//         return paraLinks.length;
//     });
//
//     const alignmentCount = await tx();
//
//     return {
//         status: "completed",
//         alignmentCount,
//     };
// });

ipcMain.handle("align:paragraphs", async (event, payload) => {
    return AlignmentPipelineService.run(event, payload);
});

ipcMain.handle("alignment:getState", (_e, documentId: number) => {
    return AlignmentService.getAppState(documentId);
});


// Save a new align task
ipcMain.handle("aligner:saveTask", async (_event, payload) => {
    try {
        const projectId = uuidv4();

        const stmt = db.prepare(`
            INSERT INTO align_tasks 
            (uuid, title, source_language, target_language, domain, source_text, target_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            projectId,
            payload.sourceMeta.title,
            payload.sourceMeta.language,
            payload.targetMeta.language,
            payload.sourceMeta.domain || "",
            payload.sourceText,
            payload.targetText
        );

        // Return saved project ID
        return { success: true, projectId };
    } catch (err) {
        console.error("Failed to save align task:", err);
        return { success: false, error: (err as Error).message };
    }
});

// Fetch all align tasks
ipcMain.handle("aligner:getTasks", async () => {
    try {
        const rows = db.prepare(`SELECT * FROM align_tasks ORDER BY created_at DESC`).all();
        return { success: true, tasks: rows };
    } catch (err) {
        console.error(err);
        return { success: false, error: (err as Error).message };
    }
});


ipcMain.handle(
    "alignment:getParaState",
    (_event, documentId: number) => {

        /* -----------------------------
           1. Load paragraphs
        ------------------------------ */
        const paras = db.prepare(`
      SELECT id, side, para_index, text, isFavorite, comment 
      FROM document_paragraphs
      WHERE document_id = ?
      ORDER BY side, para_index
    `).all(documentId);

        const sourceLines = [];
        const targetLines = [];

        for (const p of paras) {
            const line = {
                id: `${p.side[0]}${p.id}`,         // s12 / t9
                lineNumber: `${p.side[0]}p${p.para_index}`,
                text: p.text,
                isFavorite: p.isFavorite,
                comment: p.comment,
            };

            if (p.side === "source") sourceLines.push(line);
            else targetLines.push(line);
        }

        /* -----------------------------
           2. Load alignments
        ------------------------------ */
        const alignments = db.prepare(`
      SELECT *
      FROM paragraph_alignments
      WHERE document_id = ?
      ORDER BY id
    `).all(documentId);

        const links = alignments.map((a) => ({
            id: `${a.id}`,
            sourceIds: JSON.parse(a.source_para_ids).map(
                (pid: string) => `${pid}`
            ),
            targetIds: JSON.parse(a.target_para_ids).map(
                (pid: string) => `${pid}`
            ),
            confidence: a.confidence,
            strategy: a.strategy ?? "",
            isFavorite: a.isFavorite,
            comment: a.comment,
        }));




        /* -----------------------------
      3. Load metadata
   ------------------------------ */
        const rawMetas = db.prepare(`
      SELECT *
      FROM document_metadata
      WHERE document_id = ?
    `).all(documentId);

        const parseMeta = (row: any) => {
            if (!row) return null;

            return {
                id: row.id,
                title: row.title,
                source: row.source,
                publisher: row.publisher,
                documentType: row.documentType,
                publishDate: row.publish_date,

                language: row.language,
                originalLanguage: row.original_language,
                domain: row.domain,

                authors: row.authors ? JSON.parse(row.authors) : [],
                translators: row.translators ? JSON.parse(row.translators) : [],
                editors: row.editors ? JSON.parse(row.editors) : [],
                contributors: row.contributors ? JSON.parse(row.contributors) : [],

                doi: row.doi,
                isbn: row.isbn,
                volume: row.volume,
                issue: row.issue,
                pageRange: row.page_range,
                edition: row.edition,

                url: row.url,
                country: row.country,

                copyrightHolder: row.copyright_holder,
                license: row.license,
                accessLevel: row.access_level,

                keywords: row.keywords ? JSON.parse(row.keywords) : [],
                notes: row.notes,

                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        };

        const sourceMeta = parseMeta(
            rawMetas.find((m: any) => m.metadata_type === "source")
        );

        const targetMeta = parseMeta(
            rawMetas.find((m: any) => m.metadata_type === "target")
        );

        // console.log("align state", sourceLines, targetLines, links);
        /* -----------------------------
           3. Final state
        ------------------------------ */
        return {
            sourceLines,
            targetLines,
            links,
            sourceMeta,
            targetMeta,
        };
    }
);


function compareSentenceKey(a: string, b: string) {
    const parse = (key: string) => {
        // sp1-s0 → side=s, para=1, sent=0
        const match = key.match(/^([st])p(\d+)-s(\d+)$/);
        if (!match) return { para: 0, sent: 0 };

        return {
            para: Number(match[2]),
            sent: Number(match[3]),
        };
    };

    const A = parse(a);
    const B = parse(b);

    if (A.para !== B.para) return A.para - B.para;
    return A.sent - B.sent;
}



ipcMain.handle(
    "alignment:getAlignState",
    (_event, documentId: number, alignmentType: string) => {
        if (alignmentType == "para") {

            /* -----------------------------
               1. Load paragraphs
            ------------------------------ */
            const paras = db.prepare(`
      SELECT id, side, para_index, text, isFavorite, comment 
      FROM document_paragraphs
      WHERE document_id = ?
      ORDER BY side, para_index
    `).all(documentId);

            const sourceLines = [];
            const targetLines = [];

            for (const p of paras) {
                const line = {
                    id: `${p.side[0]}${p.id}`,         // s12 / t9
                    lineNumber: `${p.side[0]}p${p.para_index}`,
                    text: p.text,
                    isFavorite: p.isFavorite,
                    comment: p.comment,
                };

                if (p.side === "source") sourceLines.push(line);
                else targetLines.push(line);
            }

            /* -----------------------------
               2. Load alignments
            ------------------------------ */
            const alignments = db.prepare(`
      SELECT *
      FROM paragraph_alignments
      WHERE document_id = ?
      ORDER BY id
    `).all(documentId);

            const links = alignments.map((a) => ({
                id: `${a.id}`,
                sourceIds: JSON.parse(a.source_para_ids).map(
                    (pid: string) => `${pid}`
                ),
                targetIds: JSON.parse(a.target_para_ids).map(
                    (pid: string) => `${pid}`
                ),
                confidence: a.confidence,
                strategy: a.strategy ?? "",
                isFavorite: a.isFavorite,
                comment: a.comment,
            }));


            /* -----------------------------
          3. Load metadata
       ------------------------------ */
            const rawMetas = db.prepare(`
      SELECT *
      FROM document_metadata
      WHERE document_id = ?
    `).all(documentId);

            const parseMeta = (row: any) => {
                if (!row) return null;

                return {
                    id: row.id,
                    title: row.title,
                    source: row.source,
                    publisher: row.publisher,
                    documentType: row.documentType,
                    publishDate: row.publish_date,

                    language: row.language,
                    originalLanguage: row.original_language,
                    domain: row.domain,

                    authors: row.authors ? JSON.parse(row.authors) : [],
                    translators: row.translators ? JSON.parse(row.translators) : [],
                    editors: row.editors ? JSON.parse(row.editors) : [],
                    contributors: row.contributors ? JSON.parse(row.contributors) : [],

                    doi: row.doi,
                    isbn: row.isbn,
                    volume: row.volume,
                    issue: row.issue,
                    pageRange: row.page_range,
                    edition: row.edition,

                    url: row.url,
                    country: row.country,

                    copyrightHolder: row.copyright_holder,
                    license: row.license,
                    accessLevel: row.access_level,

                    keywords: row.keywords ? JSON.parse(row.keywords) : [],
                    notes: row.notes,

                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                };
            };

            const sourceMeta = parseMeta(
                rawMetas.find((m: any) => m.metadata_type === "source")
            );

            const targetMeta = parseMeta(
                rawMetas.find((m: any) => m.metadata_type === "target")
            );

            // console.log("align state", sourceLines, targetLines, links);
            /* -----------------------------
               3. Final state
            ------------------------------ */
            sourceLines.sort((a, b) =>
                compareSentenceKey(a.lineNumber, b.lineNumber)
            );

            targetLines.sort((a, b) =>
                compareSentenceKey(a.lineNumber, b.lineNumber)
            );
            return {
                sourceLines,
                targetLines,
                links,
                sourceMeta,
                targetMeta,
            };
        }
        else{
            /* -----------------------------
             1. Load paragraphs
          ------------------------------ */
            const sents = db.prepare(`
      SELECT id, side, sentence_index, sentence_key, text, isFavorite, comment 
      FROM document_sentences
      WHERE document_id = ?
      ORDER BY side, sentence_index
    `).all(documentId);

            let sourceLines = [];
            let targetLines = [];

            for (const p of sents) {
                const line = {
                    id: p.sentence_key,         // s12 / t9
                    lineNumber: p.sentence_key,
                    text: p.text,
                    isFavorite: p.isFavorite,
                    comment: p.comment,
                };

                if (p.side === "source") sourceLines.push(line);
                else targetLines.push(line);
            }

            /* -----------------------------
               2. Load alignments
            ------------------------------ */
            const alignments = db.prepare(`
                  SELECT *
                  FROM sentence_alignments
                  WHERE document_id = ?
                  ORDER BY id
                `).all(documentId);

            const links = alignments.map((a) => ({
                id: `${a.id}`,
                sourceIds: JSON.parse(a.source_sentence_keys).map(
                    (pid: string) => `${pid}`
                ),
                targetIds: JSON.parse(a.target_sentence_keys).map(
                    (pid: string) => `${pid}`
                ),
                confidence: a.confidence,
                strategy: a.strategy ?? "",
                isFavorite: a.isFavorite,
                comment: a.comment,
            }));


            /* -----------------------------
          3. Load metadata
       ------------------------------ */
            const rawMetas = db.prepare(`
      SELECT *
      FROM document_metadata
      WHERE document_id = ?
    `).all(documentId);

            const parseMeta = (row: any) => {
                if (!row) return null;

                return {
                    id: row.id,
                    title: row.title,
                    source: row.source,
                    publisher: row.publisher,
                    documentType: row.documentType,
                    publishDate: row.publish_date,

                    language: row.language,
                    originalLanguage: row.original_language,
                    domain: row.domain,

                    authors: row.authors ? JSON.parse(row.authors) : [],
                    translators: row.translators ? JSON.parse(row.translators) : [],
                    editors: row.editors ? JSON.parse(row.editors) : [],
                    contributors: row.contributors ? JSON.parse(row.contributors) : [],

                    doi: row.doi,
                    isbn: row.isbn,
                    volume: row.volume,
                    issue: row.issue,
                    pageRange: row.page_range,
                    edition: row.edition,

                    url: row.url,
                    country: row.country,

                    copyrightHolder: row.copyright_holder,
                    license: row.license,
                    accessLevel: row.access_level,

                    keywords: row.keywords ? JSON.parse(row.keywords) : [],
                    notes: row.notes,

                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                };
            };

            const sourceMeta = parseMeta(
                rawMetas.find((m: any) => m.metadata_type === "source")
            );

            const targetMeta = parseMeta(
                rawMetas.find((m: any) => m.metadata_type === "target")
            );


            /* -----------------------------
               3. Final state
            ------------------------------ */
            sourceLines = sourceLines.sort((a, b) =>
                compareSentenceKey(a.lineNumber, b.lineNumber)
            );

            targetLines = targetLines.sort((a, b) =>
                compareSentenceKey(a.lineNumber, b.lineNumber)
            );
            console.log("align state", sourceLines, targetLines, links);
            return {
                sourceLines,
                targetLines,
                links,
                sourceMeta,
                targetMeta,
            };
        }
    }
);


ipcMain.handle(
    "alignment:saveHistoryState",
    (_event, documentId: number, state: any, action = "edit", alignmentType) => {
        if(alignmentType == "para") {
            const tx = db.transaction(() => {

                /* -----------------------------
                   1. Determine next version
                ------------------------------ */
                const {maxVersion} = db.prepare(`
        SELECT MAX(version) AS maxVersion
        FROM document_sentalign_history
        WHERE document_id = ?
      `).get(documentId) ?? {maxVersion: -1};

                const version = (maxVersion ?? -1) + 1;

                /* -----------------------------
                   2. Insert history snapshot
                ------------------------------ */
                db.prepare(`
        INSERT INTO document_sentalign_history
          (document_id, version, snapshot, action)
        VALUES (?, ?, ?, ?)
      `).run(
                    documentId,
                    version,
                    JSON.stringify(state),
                    action
                );

                if (action === 'init') {

                } else {
                    persistParagraphs(documentId, state.sourceLines, "source");
                    persistParagraphs(documentId, state.targetLines, "target");

                    /* -----------------------------
                       5. Persist CURRENT alignments
                    ------------------------------ */
                    persistAlignments(documentId, state.links, alignmentType);
                }
            });

            tx();
            return {ok: true};
        }else{
            const tx = db.transaction(() => {

                /* -----------------------------
                   1. Determine next version
                ------------------------------ */
                const {maxVersion} = db.prepare(`
        SELECT MAX(version) AS maxVersion
        FROM document_sentalign_history
        WHERE document_id = ?
      `).get(documentId) ?? {maxVersion: -1};

                const version = (maxVersion ?? -1) + 1;

                /* -----------------------------
                   2. Insert history snapshot
                ------------------------------ */
                db.prepare(`
        INSERT INTO document_sentalign_history
          (document_id, version, snapshot, action)
        VALUES (?, ?, ?, ?)
      `).run(
                    documentId,
                    version,
                    JSON.stringify(state),
                    action
                );

                if (action === 'init') {

                } else {
                    console.log("start persist sent", state)
                    persistSentences(documentId, state.sourceLines, "source");
                    persistSentences(documentId, state.targetLines, "target");
                    console.log("start persist links")
                    /* -----------------------------
                       5. Persist CURRENT alignments
                    ------------------------------ */
                    persistAlignments(documentId, state.links, "sent");
                }
            });

            tx();
            return {ok: true};
        }
    }
);

function upsertMetadata(
    documentId: number,
    type: "source" | "target",
    meta: any
) {
    if (!meta) return;

    db.prepare(`
    INSERT INTO document_metadata (
      document_id, metadata_type,
      title, source, publisher, documentType, publish_date,
      language, original_language, domain,
      authors, translators, editors, contributors,
      doi, isbn, volume, issue, page_range, edition,
      url, country,
      copyright_holder, license, access_level,
      keywords, notes,
      updated_at
    )
    VALUES (
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(document_id, metadata_type)
    DO UPDATE SET
      title=excluded.title,
      source=excluded.source,
      publisher=excluded.publisher,
      documentType=excluded.documentType,
      publish_date=excluded.publish_date,
      language=excluded.language,
      original_language=excluded.original_language,
      domain=excluded.domain,
      authors=excluded.authors,
      translators=excluded.translators,
      editors=excluded.editors,
      contributors=excluded.contributors,
      doi=excluded.doi,
      isbn=excluded.isbn,
      volume=excluded.volume,
      issue=excluded.issue,
      page_range=excluded.page_range,
      edition=excluded.edition,
      url=excluded.url,
      country=excluded.country,
      copyright_holder=excluded.copyright_holder,
      license=excluded.license,
      access_level=excluded.access_level,
      keywords=excluded.keywords,
      notes=excluded.notes,
      updated_at=CURRENT_TIMESTAMP
  `).run(
        documentId,
        type,
        meta.title,
        meta.source,
        meta.publisher,
        meta.documentType,
        meta.publishDate,
        meta.language,
        meta.originalLanguage,
        meta.domain,
        JSON.stringify(meta.authors ?? []),
        JSON.stringify(meta.translators ?? []),
        JSON.stringify(meta.editors ?? []),
        JSON.stringify(meta.contributors ?? []),
        meta.doi,
        meta.isbn,
        meta.volume,
        meta.issue,
        meta.pageRange,
        meta.edition,
        meta.url,
        meta.country,
        meta.copyrightHolder,
        meta.license,
        meta.accessLevel,
        JSON.stringify(meta.keywords ?? []),
        meta.notes
    );
}

function persistParagraphs(
    documentId: number,
    lines: any[],
    side: "source" | "target"
) {
    db.prepare(`
    DELETE FROM document_paragraphs
    WHERE document_id = ? AND side = ?
  `).run(documentId, side);

    const stmt = db.prepare(`
    INSERT INTO document_paragraphs
      (document_id, side, para_index, text, comment, isFavorite)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        stmt.run(
            documentId,
            side,
            i,
            l.text,
            l.comment ?? null,
            l.isFavorite ? 1 : 0
        );
    }
}




function persistSentences(
    documentId: number,
    lines: any[],
    side: "source" | "target"
) {
    db.prepare(`
    DELETE FROM document_sentences
    WHERE document_id = ? AND side = ?
  `).run(documentId, side);

    const stmt = db.prepare(`
    INSERT INTO document_sentences
      (document_id, paragraph_id, side, sentence_index, sentence_key, text, comment, isFavorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        stmt.run(
            documentId,
            l.paragraph_id,
            side,
            i,
            l.lineNumber,
            l.text,
            l.comment ?? null,
            l.isFavorite ? 1 : 0
        );
    }
}

function persistAlignments(documentId: number, links: any[], documentType) {
    console.log("persist alignment", documentId, links, documentType)

  //   db.prepare(`
  //   DELETE FROM paragraph_alignments
  //   WHERE document_id = ?
  // `).run(documentId);

    if(documentType == "para") {
        db.prepare(`
    DELETE FROM paragraph_alignments
    WHERE document_id = ? 
  `).run(documentId);

        const stmt = db.prepare(`
    INSERT INTO paragraph_alignments (
      document_id,
      source_indices,
      target_indices,
      source_para_ids,
      target_para_ids,
      source_count,
      target_count,
      confidence,
      strategy,
      status,
      comment,
      isFavorite
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

        for (const l of links) {
            stmt.run(
                documentId,
                JSON.stringify(l.sourceIndices ?? []),
                JSON.stringify(l.targetIndices ?? []),
                JSON.stringify(l.sourceIds),
                JSON.stringify(l.targetIds),
                l.sourceIds.length,
                l.targetIds.length,
                l.confidence,
                l.strategy,
                l.status ?? "pending",
                l.comment ?? null,
                l.isFavorite ? 1 : 0
            );
        }
    }else{
        db.prepare(`
    DELETE FROM sentence_alignments
    WHERE document_id = ? 
  `).run(documentId);

        const stmt = db.prepare(`
  INSERT INTO sentence_alignments (
    document_id,
    paragraph_alignment_id,
    source_paragraph_id,
    target_paragraph_id,
    source_sentence_keys,
    target_sentence_keys,
    source_count,
    target_count,
    confidence,
    strategy,
    status,
    comment,
    explanation,
    isFavorite
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
        const safe = (v) => (v === undefined ? null : v);
        for (const alignment of links) {
            console.log("sent alignment", alignment);
            if(alignment.source_sentence_keys == null || alignment.source_sentence_keys.length == 0){
                alignment.source_sentence_keys = alignment.sourceIds;
                alignment.target_sentence_keys = alignment.targetIds;
            }
            stmt.run(
                documentId,
                safe(alignment.paragraphAlignmentId),
                JSON.stringify(alignment.sourceIds ?? []),
                JSON.stringify(alignment.targetIds ?? []),
                JSON.stringify(alignment.source_sentence_keys ?? []),
                JSON.stringify(alignment.target_sentence_keys ?? []),
                (alignment.source_sentence_keys ?? []).length,
                (alignment.target_sentence_keys ?? []).length,
                safe(alignment.confidence),
                safe(alignment.strategy),
                safe(alignment.status ?? "pending"),
                safe(alignment.comment),
                safe(alignment.explanation),
                alignment.isFavorite ? 1 : 0
            );
        }
    }
}
ipcMain.handle(
    "update-document-metadata",
    async (_event, { documentId, sourceMeta, targetMeta }) => {
        if (!documentId) throw new Error("documentId required");

        const upsert = (metadataType: "source" | "target", meta: any) => {
            // Convert arrays to JSON strings if needed
            const convertJson = (value: any) =>
                Array.isArray(value) ? JSON.stringify(value) : value;

            db.prepare(`
        INSERT INTO document_metadata (
          document_id,
          metadata_type,
          title,
          source,
          publisher,
          documentType,
          publish_date,
          language,
          original_language,
          domain,
          authors,
          translators,
          editors,
          contributors,
          doi,
          isbn,
          volume,
          issue,
          page_range,
          edition,
          url,
          country,
          copyright_holder,
          license,
          access_level,
          keywords,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @document_id, @metadata_type, @title, @source, @publisher, @documentType, @publish_date,
          @language, @original_language, @domain, @authors, @translators, @editors,
          @contributors, @doi, @isbn, @volume, @issue, @page_range, @edition,
          @url, @country, @copyright_holder, @license, @access_level,
          @keywords, @notes,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(document_id, metadata_type)
        DO UPDATE SET
          title = excluded.title,
          source = excluded.source,
          publisher = excluded.publisher,
          documentType = excluded.documentType,
          publish_date = excluded.publish_date,
          language = excluded.language,
          original_language = excluded.original_language,
          domain = excluded.domain,
          authors = excluded.authors,
          translators = excluded.translators,
          editors = excluded.editors,
          contributors = excluded.contributors,
          doi = excluded.doi,
          isbn = excluded.isbn,
          volume = excluded.volume,
          issue = excluded.issue,
          page_range = excluded.page_range,
          edition = excluded.edition,
          url = excluded.url,
          country = excluded.country,
          copyright_holder = excluded.copyright_holder,
          license = excluded.license,
          access_level = excluded.access_level,
          keywords = excluded.keywords,
          notes = excluded.notes,
          updated_at = CURRENT_TIMESTAMP
      `).run({
                document_id: documentId,
                metadata_type: metadataType,
                title: meta.title || null,
                source: meta.source || null,
                publisher: meta.publisher || null,
                documentType: meta.documentType || null,
                publish_date: meta.publish_date || null,
                language: meta.language || null,
                original_language: meta.original_language || null,
                domain: meta.domain || null,
                authors: convertJson(meta.authors),
                translators: convertJson(meta.translators),
                editors: convertJson(meta.editors),
                contributors: convertJson(meta.contributors),
                doi: meta.doi || null,
                isbn: meta.isbn || null,
                volume: meta.volume || null,
                issue: meta.issue || null,
                page_range: meta.page_range || null,
                edition: meta.edition || null,
                url: meta.url || null,
                country: meta.country || null,
                copyright_holder: meta.copyright_holder || null,
                license: meta.license || null,
                access_level: meta.access_level || null,
                keywords: convertJson(meta.keywords),
                notes: meta.notes || null,
            });
        };

        if (sourceMeta) upsert("source", sourceMeta);
        if (targetMeta) upsert("target", targetMeta);

        return { ok: true };
    }
);

ipcMain.handle(
    "alignment:saveParagraphLinks",
    async (_event, documentId: any, state: any, action = "align") => {
        const { maxVersion } = db.prepare(`
        SELECT MAX(version) AS maxVersion
        FROM document_paraalign_history
        WHERE document_id = ?
      `).get(documentId) ?? { maxVersion: -1 };

        const version = (maxVersion ?? -1) + 1;

        /* -----------------------------
           2. Insert history snapshot
        ------------------------------ */
        db.prepare(`
        INSERT INTO document_paraalign_history
          (document_id, version, snapshot, action)
        VALUES (?, ?, ?, ?)
      `).run(
            documentId,
            version,
            JSON.stringify(state),
            action
        );

        const tx = db.transaction(() => {
            persistAlignments(documentId, state.links, "para");
        });
        tx();
        return { ok: true };
    }
);


ipcMain.handle(
    "alignment:saveLinks",
    async (_event, documentId: any, state: any, action = "align", documentType) => {
        console.log("save links state", state, documentType);

        if (documentType == 'para') {
            const {maxVersion} = db.prepare(`
        SELECT MAX(version) AS maxVersion
        FROM document_sentalign_history
        WHERE document_id = ?
      `).get(documentId) ?? {maxVersion: -1};

            const version = (maxVersion ?? -1) + 1;

            /* -----------------------------
               2. Insert history snapshot
            ------------------------------ */
            db.prepare(`
        INSERT INTO document_sentalign_history
          (document_id, version, snapshot, action)
        VALUES (?, ?, ?, ?)
      `).run(
                documentId,
                version,
                JSON.stringify(state),
                action
            );

            const tx = db.transaction(() => {
                persistAlignments(documentId, state.links, documentType);
            });
            tx();
            return {ok: true};
        }else{
            const {maxVersion} = db.prepare(`
        SELECT MAX(version) AS maxVersion
        FROM document_sentalign_history
        WHERE document_id = ?
      `).get(documentId) ?? {maxVersion: -1};

            const version = (maxVersion ?? -1) + 1;

            /* -----------------------------
               2. Insert history snapshot
            ------------------------------ */
            db.prepare(`
        INSERT INTO document_sentalign_history
          (document_id, version, snapshot, action)
        VALUES (?, ?, ?, ?)
      `).run(
                documentId,
                version,
                JSON.stringify(state),
                action
            );

            const tx = db.transaction(() => {
                persistAlignments(documentId, state.links, documentType);
            });
            tx();
            return {ok: true};
        }
    }
);


ipcMain.handle("llm:getSettings", () => {
    return getLLMSettings();
});

ipcMain.handle(
    "llm:saveSettings",
    (_, settings: LLMSettings) => {
        saveLLMSettings(settings);
    }
);


ipcMain.handle(
    "align:paragraph-batch",
    async (
        _event,
        payload: any
    ) => {
        const { pairs, srcLang, tgtLang, documentId } = payload;
        console.log("aligned payload", payload);

        // ✅ Load default model ONLY here
        // const defaultModel = loadDefaultModel();
        // const modelId =
        //     payload.modelOverride ??
        //     settings.defaultModel;

        const results = await AlignmentService.alignParagraphBatch(
            pairs,
            srcLang,
            tgtLang,
            documentId
        );
        markDocumentWithStatus(documentId, "pending-sent");
        return results;

    }
);


ipcMain.handle("get-document-status", async (_, documentId) => {
    const doc = await dbService.getDocument(documentId);
    return doc?.status || "unknown";
});

ipcMain.handle("alignment:markCompleted", async (_event, documentId: number) => {
    if (!documentId) {
        throw new Error("documentId is required");
    }

    try {
        const result = markDocumentWithStatus(documentId, "completed");
        return { success: true, data: result };
    } catch (err: any) {
        console.error("Failed to mark alignment completed:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle("get-document-alignments", async (_, docId: number) => {
    try {
        // ================= 1. LOAD SENTENCES =================
        const sentences = db.prepare(`
            SELECT *
            FROM document_sentences
            WHERE document_id = ?
        `).all(docId);

        // ================= 2. LOAD ALIGNMENTS =================
        const alignmentsRaw = db.prepare(`
            SELECT *
            FROM sentence_alignments
            WHERE document_id = ?
        `).all(docId);

        const alignments = alignmentsRaw.map((a: any) => ({
            ...a,
            sourceKeys: JSON.parse(a.source_sentence_keys || "[]"),
            targetKeys: JSON.parse(a.target_sentence_keys || "[]"),
        }));

        // ================= 3. UNION-FIND FOR MERGING =================
        const parent: Record<string, string> = {};

        function find(x: string): string {
            if (!parent[x]) parent[x] = x;
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        }

        function union(a: string, b: string) {
            const pa = find(a);
            const pb = find(b);
            if (pa !== pb) parent[pb] = pa;
        }

        // initialize all sentence nodes
        for (const s of sentences) {
            parent[s.sentence_key] = s.sentence_key;
        }

        // connect aligned sentences
        for (const a of alignments) {
            const keys = [
                ...a.sourceKeys,
                ...a.targetKeys,
            ];

            for (let i = 1; i < keys.length; i++) {
                union(keys[0], keys[i]);
            }
        }

        // ================= 4. BUILD GROUPS =================
        const groups: Record<string, any> = {};

        for (const s of sentences) {
            const root = find(s.sentence_key);

            if (!groups[root]) {
                groups[root] = {
                    id: root,
                    sentences: [],
                    alignments: [],
                };
            }

            groups[root].sentences.push(s);
        }

        // ================= 5. ATTACH ALIGNMENTS TO GROUPS =================
        for (const a of alignments) {
            const allKeys = [...a.sourceKeys, ...a.targetKeys];

            const root = find(allKeys[0]);

            if (!groups[root]) continue;

            groups[root].alignments.push(a);
        }

        // ================= 6. SPLIT INTO SOURCE/TARGET =================
        const result = Object.values(groups).map((g: any) => {
            const sourceSentences = g.sentences
                .filter((s: any) => s.side === "source")
                .sort((a: any, b: any) => a.sentence_index - b.sentence_index);

            const targetSentences = g.sentences
                .filter((s: any) => s.side === "target")
                .sort((a: any, b: any) => a.sentence_index - b.sentence_index);

            return {
                id: g.id,
                sourceSentences,
                targetSentences,
                alignments: g.alignments,
            };
        });

        console.log("merged results", result);

        // optional stable ordering
        return result.sort((a: any, b: any) =>
            a.id.localeCompare(b.id)
        );

    } catch (err) {
        console.error("get-document-alignments error", err);
        return [];
    }
});

// =====================
// Word Alignment Handlers
// =====================

function persistWords(documentId: number, sentenceKey: string, side: string, words: Line[]) {
    db.prepare(`
        DELETE FROM document_words
        WHERE document_id = ? AND sentence_key = ? AND side = ?
    `).run(documentId, sentenceKey, side);

    const stmt = db.prepare(`
        INSERT INTO document_words
            (document_id, sentence_key, side, word_index, word_key, text, comment, is_favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        stmt.run(
            documentId,
            sentenceKey,
            side,
            i,
            w.lineNumber,
            w.text,
            w.comment ?? null,
            w.isFavorite ? 1 : 0
        );
    }
}

function persistWordAlignments(documentId: number, sourceSentenceKey: string, targetSentenceKey: string, links: Link[]) {
    db.prepare(`
        DELETE FROM word_alignments
        WHERE document_id = ? AND source_sentence_key = ? AND target_sentence_key = ?
    `).run(documentId, sourceSentenceKey, targetSentenceKey);

    const stmt = db.prepare(`
        INSERT INTO word_alignments (
            document_id, source_sentence_key, target_sentence_key,
            source_word_keys, target_word_keys,
            source_count, target_count,
            confidence, strategy, comment, is_favorite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const link of links) {
        stmt.run(
            documentId,
            sourceSentenceKey,
            targetSentenceKey,
            JSON.stringify(link.sourceIds),
            JSON.stringify(link.targetIds),
            link.sourceIds.length,
            link.targetIds.length,
            link.confidence ?? null,
            link.strategy ?? null,
            link.comment ?? null,
            link.isFavorite ? 1 : 0
        );
    }
}

ipcMain.handle("word:getState", (_e, documentId: number, sourceKey: string, targetKey: string) => {
    const sourceWords = db.prepare(`
        SELECT * FROM document_words
        WHERE document_id = ? AND sentence_key = ? AND side = 'source'
        ORDER BY word_index
    `).all(documentId, sourceKey);

    const targetWords = db.prepare(`
        SELECT * FROM document_words
        WHERE document_id = ? AND sentence_key = ? AND side = 'target'
        ORDER BY word_index
    `).all(documentId, targetKey);

    const sourceLines: Line[] = sourceWords.map((w: any) => ({
        id: w.word_key,
        lineNumber: w.word_key,
        text: w.text,
        comment: w.comment,
        isFavorite: !!w.is_favorite,
    }));

    const targetLines: Line[] = targetWords.map((w: any) => ({
        id: w.word_key,
        lineNumber: w.word_key,
        text: w.text,
        comment: w.comment,
        isFavorite: !!w.is_favorite,
    }));

    const alignments = db.prepare(`
        SELECT * FROM word_alignments
        WHERE document_id = ? AND source_sentence_key = ? AND target_sentence_key = ?
        ORDER BY id
    `).all(documentId, sourceKey, targetKey);

    const wordLinks: Link[] = alignments.map((a: any) => ({
        id: `w${a.id}`,
        sourceIds: JSON.parse(a.source_word_keys),
        targetIds: JSON.parse(a.target_word_keys),
        confidence: a.confidence,
        strategy: a.strategy ?? "",
        comment: a.comment,
        isFavorite: !!a.is_favorite,
    }));

    return { sourceWords: sourceLines, targetWords: targetLines, wordLinks };
});

ipcMain.handle("word:saveState", (_e, documentId: number, sourceKey: string, targetKey: string, state: any) => {
    const tx = db.transaction(() => {
        persistWords(documentId, sourceKey, "source", state.sourceWords);
        persistWords(documentId, targetKey, "target", state.targetWords);
        persistWordAlignments(documentId, sourceKey, targetKey, state.wordLinks);
    });
    tx();
    return { ok: true };
});

ipcMain.handle("word:checkExists", (_e, documentId: number) => {
    const rows = db.prepare(`
        SELECT DISTINCT sentence_key FROM document_words
        WHERE document_id = ?
    `).all(documentId);

    return rows.map((r: any) => r.sentence_key);
});

ipcMain.handle("word:segmentAndAlign", async (_e, payload: {
    sourceText: string, targetText: string,
    srcLang: string, tgtLang: string,
    documentId: number, sourceKey: string, targetKey: string
}) => {
    const { sourceText, targetText, srcLang, tgtLang, documentId, sourceKey, targetKey } = payload;

    const promptRow = db.prepare(`
        SELECT * FROM llm_prompts
        WHERE task_type = 'word_segmentation_alignment' AND is_active = 1
        LIMIT 1
    `).get() as any;

    if (!promptRow) {
        throw new Error("No active word_segmentation_alignment prompt found");
    }


    const systemPrompt = promptRow.system_prompt || "";
    const userPrompt = promptRow.user_prompt
        .replace(/\{\{sourceLanguage\}\}/g, srcLang)
        .replace(/\{\{targetLanguage\}\}/g, tgtLang)
        .replace(/\{\{sourceSentence\}\}/g, sourceText)
        .replace(/\{\{targetSentence\}\}/g, targetText);

    console.log(systemPrompt, userPrompt, "word alignment");
    const response = await sendChatCompletion({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: promptRow.temperature ?? 0.2,
        maxTokens: promptRow.max_tokens ?? 20000,
        responseFormat: 'json_object',
    });
    console.log("response",response);
    const content = response?.content;
    if (!content) {
        throw new Error("Empty response from LLM");
    }

    // Try to extract JSON from the response — handles raw JSON, markdown code blocks, etc.
    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch {
        // Strip markdown code fences if present
        const cleaned = content
            .replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1')
            .trim();
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Fall back to regex extraction
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in LLM response");
            }
            parsed = JSON.parse(jsonMatch[0]);
        }
    }

    // Build index maps from LLM word IDs to array positions
    // The prompt template uses "w0", "w1", ... for both sides
    const srcIdToIndex = new Map<string, number>();
    (parsed.sourceWords || []).forEach((w: any, i: number) => {
        if (w.id) srcIdToIndex.set(w.id, i);
        else srcIdToIndex.set(`w${i}`, i); // fallback: positional ID
    });

    const tgtIdToIndex = new Map<string, number>();
    (parsed.targetWords || []).forEach((w: any, i: number) => {
        if (w.id) tgtIdToIndex.set(w.id, i);
        else tgtIdToIndex.set(`w${i}`, i);
    });

    const sourceWords: Line[] = (parsed.sourceWords || []).map((w: any, i: number) => ({
        id: `sw${i}`,
        lineNumber: `sw${i}`,
        text: w.text,
    }));

    const targetWords: Line[] = (parsed.targetWords || []).map((w: any, i: number) => ({
        id: `tw${i}`,
        lineNumber: `tw${i}`,
        text: w.text,
    }));

    // Translate LLM alignment IDs → our generated sw{N} / tw{N} IDs
    const translateSourceId = (llmId: string): string => {
        const idx = srcIdToIndex.get(llmId);
        return idx !== undefined ? `sw${idx}` : llmId;
    };
    const translateTargetId = (llmId: string): string => {
        const idx = tgtIdToIndex.get(llmId);
        return idx !== undefined ? `tw${idx}` : llmId;
    };

    const wordLinks: Link[] = (parsed.alignments || []).map((a: any, i: number) => ({
        id: `wl${Date.now()}${i}`,
        sourceIds: (a.sourceIds || []).map(translateSourceId),
        targetIds: (a.targetIds || []).map(translateTargetId),
        confidence: a.confidence ?? 0.8,
        strategy: "llm",
    }));

    // Persist results into database
    if (documentId && sourceKey && targetKey) {
        const tx = db.transaction(() => {
            persistWords(documentId, sourceKey, "source", sourceWords);
            persistWords(documentId, targetKey, "target", targetWords);
            persistWordAlignments(documentId, sourceKey, targetKey, wordLinks);
        });
        tx();
    }

    return { sourceWords, targetWords, wordLinks };
});

ipcMain.handle("align:realign", async (_event, payload: {
    sourceSentences: { id: string; text: string }[];
    targetSentences: { id: string; text: string }[];
    srcLang: string;
    tgtLang: string;
}) => {
    const { sourceSentences, targetSentences, srcLang, tgtLang } = payload;
    return SentenceAlignmentService.monotonicAlignBlock(
        sourceSentences,
        targetSentences,
        srcLang,
        tgtLang,
    );
});

export function markDocumentWithStatus(documentId: number, status: string): boolean {
    const stmt = db.prepare(`
    UPDATE documents
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

    const result = stmt.run(status, documentId);

    // returns true if a row was updated
    return result.changes > 0;
}
