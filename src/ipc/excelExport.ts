import ExcelJS from "exceljs";

export interface ExcelAlignmentData {
  sourceMeta: Record<string, unknown>;
  targetMeta: Record<string, unknown>;
  sourceLines: Array<{ id: string; text: string }>;
  targetLines: Array<{ id: string; text: string }>;
  links: Array<{
    sourceIds: string[];
    targetIds: string[];
    confidence?: number;
    strategy?: string;
  }>;
  documentTitle?: string;
}

// ---- helpers ----

function parseJson(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [val];
    } catch {
      return [val];
    }
  }
  return [String(val)];
}

function fmtMeta(val: unknown): string {
  if (val == null) return "";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.join(", ") : val;
    } catch {
      return val;
    }
  }
  return String(val);
}

// ---- styling constants ----

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2563EB" }, // blue-600
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 12,
};

const LABEL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEFF6FF" }, // blue-50
};
const LABEL_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF1E40AF" }, // blue-900
  size: 10,
};

const VALUE_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FF1F2937" }, // gray-800
  size: 10,
};

const COL_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" }, // gray-100
};
const COL_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF374151" }, // gray-700
  size: 10,
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF9FAFB" }, // gray-50
};

// ---- sheet builder ----

function addDocumentSheet(
  workbook: ExcelJS.Workbook,
  data: ExcelAlignmentData,
  sheetName: string
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Column widths
  sheet.getColumn(1).width = 18; // label column
  sheet.getColumn(2).width = 50; // value / source text column
  sheet.getColumn(3).width = 50; // target text column
  sheet.getColumn(4).width = 14; // confidence
  sheet.getColumn(5).width = 16; // strategy

  const { sourceMeta, targetMeta, sourceLines, targetLines, links } = data;

  // ---- Build metadata rows ----
  const metaFields: Array<{ label: string; source: unknown; target: unknown }> = [
    { label: "Title", source: sourceMeta.title, target: targetMeta.title },
    { label: "Language", source: sourceMeta.language, target: targetMeta.language },
    { label: "Domain", source: sourceMeta.domain, target: targetMeta.domain },
    { label: "Source", source: sourceMeta.source, target: targetMeta.source },
    { label: "Publisher", source: sourceMeta.publisher, target: targetMeta.publisher },
    { label: "Publish Date", source: sourceMeta.publish_date || sourceMeta.publishDate, target: targetMeta.publish_date || targetMeta.publishDate },
    { label: "Authors", source: sourceMeta.authors, target: targetMeta.authors },
    { label: "Translators", source: sourceMeta.translators, target: targetMeta.translators },
    { label: "Keywords", source: sourceMeta.keywords, target: targetMeta.keywords },
    { label: "DOI", source: sourceMeta.doi, target: targetMeta.doi },
    { label: "ISBN", source: sourceMeta.isbn, target: targetMeta.isbn },
    { label: "Country", source: sourceMeta.country, target: targetMeta.country },
    { label: "License", source: sourceMeta.license, target: targetMeta.license },
    { label: "URL", source: sourceMeta.url, target: targetMeta.url },
  ];

  let rowIdx = 1;

  // Metadata section header
  sheet.mergeCells(rowIdx, 1, rowIdx, 5);
  const titleCell = sheet.getCell(rowIdx, 1);
  titleCell.value = "Document Metadata";
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(rowIdx).height = 28;
  // Apply border to merged header
  for (let c = 1; c <= 5; c++) {
    sheet.getCell(rowIdx, c).border = BORDER;
  }
  rowIdx++;

  // Blank row
  rowIdx++;

  // Metadata sub-header
  sheet.mergeCells(rowIdx, 1, rowIdx, 2);
  const srcHdr = sheet.getCell(rowIdx, 1);
  srcHdr.value = "SOURCE";
  srcHdr.font = { bold: true, color: { argb: "FF2563EB" }, size: 10 };
  srcHdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  srcHdr.alignment = { horizontal: "center" };

  sheet.mergeCells(rowIdx, 3, rowIdx, 5);
  const tgtHdr = sheet.getCell(rowIdx, 3);
  tgtHdr.value = "TARGET";
  tgtHdr.font = { bold: true, color: { argb: "FF059669" }, size: 10 };
  tgtHdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
  tgtHdr.alignment = { horizontal: "center" };

  for (let c = 1; c <= 5; c++) {
    sheet.getCell(rowIdx, c).border = BORDER;
  }
  rowIdx++;

  // Metadata rows
  for (const field of metaFields) {
    const srcVal = fmtMeta(field.source);
    const tgtVal = fmtMeta(field.target);
    if (!srcVal && !tgtVal) continue;

    // Label (col 1)
    const labelCell = sheet.getCell(rowIdx, 1);
    labelCell.value = field.label;
    labelCell.font = LABEL_FONT;
    labelCell.fill = LABEL_FILL;
    labelCell.border = BORDER;

    // Source value (col 2)
    const srcCell = sheet.getCell(rowIdx, 2);
    srcCell.value = srcVal || "—";
    srcCell.font = VALUE_FONT;
    srcCell.border = BORDER;

    // Target value (cols 3-5 merged)
    sheet.mergeCells(rowIdx, 3, rowIdx, 5);
    const tgtCell = sheet.getCell(rowIdx, 3);
    tgtCell.value = tgtVal || "—";
    tgtCell.font = VALUE_FONT;
    tgtCell.border = BORDER;
    for (let c = 4; c <= 5; c++) {
      sheet.getCell(rowIdx, c).border = BORDER;
    }

    rowIdx++;
  }

  // Blank separator
  rowIdx++;

  // ---- Build aligned segments ----
  // Resolve aligned pairs from links + lines
  const srcMap = new Map<string, string>();
  for (const l of sourceLines) srcMap.set(l.id, l.text);
  const tgtMap = new Map<string, string>();
  for (const l of targetLines) tgtMap.set(l.id, l.text);

  interface SegmentRow {
    sourceText: string;
    targetText: string;
    confidence: number | null;
    strategy: string | null;
  }
  const segments: SegmentRow[] = [];
  for (const link of links) {
    const srcTexts = (link.sourceIds || []).map((id) => srcMap.get(id) || "").filter(Boolean);
    const tgtTexts = (link.targetIds || []).map((id) => tgtMap.get(id) || "").filter(Boolean);
    if (srcTexts.length === 0 && tgtTexts.length === 0) continue;
    segments.push({
      sourceText: srcTexts.join(" "),
      targetText: tgtTexts.join(" "),
      confidence: link.confidence ?? null,
      strategy: link.strategy || null,
    });
  }

  // Column headers for segments
  const colHeaders = ["Source Text", "Target Text", "Confidence", "Strategy"];
  const colHeaderRow = rowIdx;
  for (let c = 0; c < colHeaders.length; c++) {
    // Source text spans cols 1-2, target text spans 3-4, confidence col 5, strategy col 5...
    // Actually let me use a cleaner column layout:
    // Col 1: Source Text, Col 2: Target Text, Col 3: Confidence, Col 4: Strategy, Col 5: empty/notes
    const colMap = [1, 2, 3, 4]; // map to columns
    const cell = sheet.getCell(rowIdx, colMap[c]);
    cell.value = colHeaders[c];
    cell.font = COL_HEADER_FONT;
    cell.fill = COL_HEADER_FILL;
    cell.border = BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  // Border for col 5
  sheet.getCell(rowIdx, 5).border = BORDER;
  sheet.getRow(rowIdx).height = 22;
  rowIdx++;

  // Data rows
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isAlt = i % 2 === 1;

    const srcCell = sheet.getCell(rowIdx, 1);
    srcCell.value = seg.sourceText;
    srcCell.font = { ...VALUE_FONT, size: 10 };
    srcCell.alignment = { wrapText: true, vertical: "top" };
    srcCell.border = BORDER;
    if (isAlt) srcCell.fill = ALT_ROW_FILL;

    const tgtCell = sheet.getCell(rowIdx, 2);
    tgtCell.value = seg.targetText;
    tgtCell.font = { ...VALUE_FONT, size: 10 };
    tgtCell.alignment = { wrapText: true, vertical: "top" };
    tgtCell.border = BORDER;
    if (isAlt) tgtCell.fill = ALT_ROW_FILL;

    const confCell = sheet.getCell(rowIdx, 3);
    confCell.value = seg.confidence != null ? seg.confidence : "—";
    if (seg.confidence != null) {
      confCell.numFmt = "0.00";
    }
    confCell.font = { ...VALUE_FONT, size: 10 };
    confCell.alignment = { horizontal: "center", vertical: "top" };
    confCell.border = BORDER;
    if (isAlt) confCell.fill = ALT_ROW_FILL;

    const stratCell = sheet.getCell(rowIdx, 4);
    stratCell.value = seg.strategy || "—";
    stratCell.font = { ...VALUE_FONT, size: 10 };
    stratCell.alignment = { horizontal: "center", vertical: "top" };
    stratCell.border = BORDER;
    if (isAlt) stratCell.fill = ALT_ROW_FILL;

    const emptyCell = sheet.getCell(rowIdx, 5);
    emptyCell.border = BORDER;
    if (isAlt) emptyCell.fill = ALT_ROW_FILL;

    // Auto-fit row height based on content
    const maxLen = Math.max(seg.sourceText.length, seg.targetText.length);
    if (maxLen > 80) {
      sheet.getRow(rowIdx).height = Math.min(120, 20 + Math.floor(maxLen / 40) * 15);
    }

    rowIdx++;
  }

  // Column widths for data
  sheet.getColumn(1).width = 55;
  sheet.getColumn(2).width = 55;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 10;

  // Freeze pane below metadata and headers
  sheet.views = [
    {
      state: "frozen",
      ySplit: colHeaderRow,
    },
  ];
}

// ---- public API ----

export async function generateSingleDocumentWorkbook(
  data: ExcelAlignmentData
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LATA";

  const sheetName = sanitizeSheetName(data.documentTitle || "Alignment");
  addDocumentSheet(workbook, data, sheetName);

  return workbook;
}

export async function generateProjectWorkbook(
  projectTitle: string,
  documents: ExcelAlignmentData[]
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LATA";

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const defaultName = `Document ${i + 1}`;
    const docTitle = doc.documentTitle || defaultName;
    const sheetName = sanitizeSheetName(docTitle);
    addDocumentSheet(workbook, doc, sheetName);
  }

  return workbook;
}

function sanitizeSheetName(name: string): string {
  // Excel sheet names: max 31 chars, cannot contain [ ] : * ? / \
  return name
    .replace(/[\[\]:*?/\\]/g, "_")
    .substring(0, 31);
}
