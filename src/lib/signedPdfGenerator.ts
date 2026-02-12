import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import mammoth from "mammoth";

interface SignatureInfo {
  signerName: string;
  signedAt: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  position?: string | null;
}

interface SignedPdfOptions {
  documentName: string;
  documentFilePath: string;
  signatures: SignatureInfo[];
}

/** A text segment with optional bold flag */
interface TextSegment {
  text: string;
  bold: boolean;
}

/** A parsed block from HTML */
interface ContentBlock {
  type: "paragraph" | "heading" | "line"; // line = horizontal rule / signature line
  segments: TextSegment[];
  spacingBefore?: number;
  spacingAfter?: number;
}

async function fetchDocumentBytes(filePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(filePath);
  if (error) throw new Error(`Could not download document: ${error.message}`);
  return await data.arrayBuffer();
}

async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Uint8Array(await blob.arrayBuffer());
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function parsePosition(position?: string | null): { xPercent: number; yPercent: number; page: number } {
  if (!position) return { xPercent: 70, yPercent: 90, page: 1 };
  try {
    const parsed = JSON.parse(position);
    return {
      xPercent: parsed.xPercent ?? 70,
      yPercent: parsed.yPercent ?? 90,
      page: (parsed.page ?? 1) - 1,
    };
  } catch {
    return { xPercent: 70, yPercent: 90, page: 0 };
  }
}

/** Sanitize text for pdf-lib WinAnsi encoding */
function sanitize(text: string): string {
  return text
    .replace(/\t/g, "    ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[""]/g, '"')
    .replace(/[''‚]/g, "'")
    .replace(/–/g, "-")
    .replace(/—/g, " - ")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00C0-\u00FF\u0100-\u017F]/g, ""); // keep latin extended
}

/**
 * Parse mammoth HTML into structured content blocks with bold/normal segments.
 */
function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Split into block-level elements
  // First, normalize: replace <br> with newline markers
  let processed = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, '<p class="__hr__"></p>');

  // Extract block elements (p, h1-h6, div, li, tr)
  const blockRegex = /<(p|h[1-6]|div|li|tr)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  let lastIndex = 0;

  while ((match = blockRegex.exec(processed)) !== null) {
    // Check for any text between blocks
    const between = processed.substring(lastIndex, match.index).trim();
    if (between) {
      const segments = parseInlineSegments(between);
      if (segments.length > 0 && segments.some(s => s.text.trim())) {
        blocks.push({ type: "paragraph", segments, spacingAfter: 4 });
      }
    }
    lastIndex = match.index + match[0].length;

    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const innerHtml = match[3];

    // Check for HR marker
    if (attrs.includes("__hr__")) {
      blocks.push({ type: "line", segments: [], spacingBefore: 6, spacingAfter: 6 });
      continue;
    }

    const isHeading = tag.startsWith("h");
    const segments = parseInlineSegments(innerHtml);

    if (segments.length === 0 || !segments.some(s => s.text.trim())) {
      // Empty paragraph = extra spacing
      blocks.push({ type: "paragraph", segments: [{ text: "", bold: false }], spacingAfter: 8 });
      continue;
    }

    if (isHeading) {
      // Make all heading segments bold
      blocks.push({
        type: "heading",
        segments: segments.map(s => ({ ...s, bold: true })),
        spacingBefore: 12,
        spacingAfter: 6,
      });
    } else {
      blocks.push({
        type: "paragraph",
        segments,
        spacingBefore: 2,
        spacingAfter: 4,
      });
    }
  }

  // Remaining text after last block
  const remaining = processed.substring(lastIndex).trim();
  if (remaining) {
    const segments = parseInlineSegments(remaining);
    if (segments.length > 0 && segments.some(s => s.text.trim())) {
      blocks.push({ type: "paragraph", segments, spacingAfter: 4 });
    }
  }

  return blocks;
}

/**
 * Parse inline HTML to extract bold/normal text segments.
 */
function parseInlineSegments(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match <strong>, <b>, <em> tags for bold; rest is normal
  const inlineRegex = /<(strong|b)>([\s\S]*?)<\/\1>/gi;
  let lastIdx = 0;
  let m;

  while ((m = inlineRegex.exec(html)) !== null) {
    // Text before this bold segment
    if (m.index > lastIdx) {
      const before = stripTags(html.substring(lastIdx, m.index));
      if (before) segments.push({ text: before, bold: false });
    }
    const boldText = stripTags(m[2]);
    if (boldText) segments.push({ text: boldText, bold: true });
    lastIdx = m.index + m[0].length;
  }

  // Remaining text
  if (lastIdx < html.length) {
    const rest = stripTags(html.substring(lastIdx));
    if (rest) segments.push({ text: rest, bold: false });
  }

  return segments;
}

function stripTags(html: string): string {
  // Decode entities
  const temp = document.createElement("div");
  temp.innerHTML = html.replace(/<[^>]+>/g, "");
  return sanitize(temp.textContent || "");
}

/**
 * Render parsed blocks onto PDF pages with proper bold/normal fonts and pagination.
 */
function renderBlocksToPages(
  pdfDoc: PDFDocument,
  blocks: ContentBlock[],
  normalFont: PDFFont,
  boldFont: PDFFont,
): PDFPage[] {
  const pageWidth = 595; // A4
  const pageHeight = 842;
  const marginLeft = 60;
  const marginRight = 60;
  const marginTop = 60;
  const marginBottom = 60;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const normalSize = 10;
  const headingSize = 14;
  const lineHeight = 14;
  const headingLineHeight = 18;

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(page);
  let y = pageHeight - marginTop;

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(page);
    y = pageHeight - marginTop;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < marginBottom) newPage();
  };

  for (const block of blocks) {
    const isHeading = block.type === "heading";
    const fontSize = isHeading ? headingSize : normalSize;
    const lh = isHeading ? headingLineHeight : lineHeight;

    // Spacing before
    if (block.spacingBefore) {
      y -= block.spacingBefore;
      if (y < marginBottom) newPage();
    }

    // Horizontal rule
    if (block.type === "line") {
      ensureSpace(10);
      page.drawLine({
        start: { x: marginLeft, y },
        end: { x: marginLeft + 200, y },
        thickness: 0.5,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 10;
      continue;
    }

    // Empty paragraph = spacing
    if (block.segments.length === 1 && !block.segments[0].text.trim()) {
      y -= 8;
      if (y < marginBottom) newPage();
      continue;
    }

    // Word-wrap segments across lines
    // Flatten all segments into words with their bold flag
    const words: { word: string; bold: boolean }[] = [];
    for (const seg of block.segments) {
      const segWords = seg.text.split(/\s+/).filter(Boolean);
      for (const w of segWords) {
        words.push({ word: w, bold: seg.bold });
      }
    }

    // Build lines by word-wrapping
    const lines: { word: string; bold: boolean }[][] = [];
    let currentLine: { word: string; bold: boolean }[] = [];
    let currentWidth = 0;

    for (const w of words) {
      const font = w.bold ? boldFont : normalFont;
      let wordWidth: number;
      try {
        wordWidth = font.widthOfTextAtSize(w.word, fontSize);
      } catch {
        continue; // skip unencodable
      }
      const spaceWidth = currentLine.length > 0 ? normalFont.widthOfTextAtSize(" ", fontSize) : 0;

      if (currentWidth + spaceWidth + wordWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [w];
        currentWidth = wordWidth;
      } else {
        currentLine.push(w);
        currentWidth += spaceWidth + wordWidth;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // Draw each line
    for (const lineWords of lines) {
      ensureSpace(lh);

      let x = marginLeft;
      for (let i = 0; i < lineWords.length; i++) {
        const w = lineWords[i];
        const font = w.bold ? boldFont : normalFont;
        const prefix = i > 0 ? " " : "";
        const drawText = prefix + w.word;

        try {
          page.drawText(drawText, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.08, 0.08, 0.08),
          });
          x += font.widthOfTextAtSize(drawText, fontSize);
        } catch {
          // skip unencodable characters
        }
      }
      y -= lh;
    }

    // Spacing after
    if (block.spacingAfter) {
      y -= block.spacingAfter;
    }
  }

  return pages;
}

async function stampSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  sig: SignatureInfo,
  pos: { xPercent: number; yPercent: number },
  courierFont: PDFFont,
  helvFont: PDFFont,
) {
  const { width, height } = page.getSize();
  const x = Math.max(10, Math.min((pos.xPercent / 100) * width, width - 170));
  const y = Math.max(30, height - Math.min((pos.yPercent / 100) * height, height - 10));

  page.drawRectangle({
    x: x - 10, y: y - 15, width: 160, height: 60,
    color: rgb(1, 1, 1), opacity: 0.92,
    borderColor: rgb(0.83, 0.69, 0.33), borderWidth: 0.5,
  });

  const sigImage = sig.signatureImage;
  const isTextSig = !sigImage || sigImage.toLowerCase().startsWith("text:");

  if (!isTextSig && sigImage) {
    try {
      let imageBytes: Uint8Array;
      if (sigImage.startsWith("data:image")) {
        imageBytes = dataUrlToBytes(sigImage);
      } else {
        imageBytes = await fetchImageBytes(sigImage);
      }
      let embedded;
      try { embedded = await pdfDoc.embedPng(imageBytes); }
      catch { embedded = await pdfDoc.embedJpg(imageBytes); }
      const dims = embedded.scaleToFit(120, 30);
      page.drawImage(embedded, { x, y: y + 5, width: dims.width, height: dims.height });
    } catch {
      const initials = sig.signerName.split(" ").map(n => n[0]).join(".");
      page.drawText(sanitize(initials), { x, y: y + 15, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1) });
    }
  } else {
    const text = sig.signatureInitials
      || (sigImage ? sigImage.replace(/^text:/i, "") : null)
      || sig.signerName.split(" ").map(n => n[0]).join(".");
    page.drawText(sanitize(text), { x, y: y + 15, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1) });
  }

  page.drawLine({ start: { x, y: y + 2 }, end: { x: x + 120, y: y + 2 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });

  const signedDate = new Date(sig.signedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  page.drawText(sanitize(`${sig.signerName} - ${signedDate}`), { x, y: y - 10, size: 7, font: helvFont, color: rgb(0.4, 0.4, 0.4) });
}

export async function generateSignedPdf(options: SignedPdfOptions): Promise<void> {
  const { documentName, documentFilePath, signatures } = options;
  const isPdf = documentFilePath.toLowerCase().endsWith(".pdf");
  const isWord = /\.(docx?)$/i.test(documentFilePath);

  let pdfDoc: PDFDocument;

  if (isPdf) {
    const docBytes = await fetchDocumentBytes(documentFilePath);
    pdfDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  } else if (isWord) {
    const docBytes = await fetchDocumentBytes(documentFilePath);
    const result = await mammoth.convertToHtml({ arrayBuffer: docBytes });
    const blocks = parseHtmlToBlocks(result.value);

    pdfDoc = await PDFDocument.create();
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    renderBlocksToPages(pdfDoc, blocks, normalFont, boldFont);
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(sanitize(`Dokument: ${documentName}`), { x: 40, y: 750, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    page.drawText("Dateiformat wird nicht direkt unterstuetzt.", { x: 40, y: 720, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  }

  const pages = pdfDoc.getPages();
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const sig of signatures) {
    const pos = parsePosition(sig.position);
    const pageIndex = Math.min(pos.page, pages.length - 1);
    const page = pages[Math.max(0, pageIndex)];
    await stampSignature(pdfDoc, page, sig, pos, courierFont, helv);
  }

  // Footer
  const lastPage = pages[pages.length - 1];
  const { width: pw } = lastPage.getSize();
  lastPage.drawText(sanitize(`Digitally signed - ${signatures.length} Signatur(en) - MGI Hub`), {
    x: pw / 2 - 80, y: 15, size: 6, font: helv, color: rgb(0.6, 0.6, 0.6),
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const safeName = documentName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_]/g, "").trim();
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}_signiert.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
