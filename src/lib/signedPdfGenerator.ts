import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";

interface SignatureInfo {
  signerName: string;
  signedAt: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  position?: string | null;
  comment?: string | null;
}

interface SignedPdfOptions {
  documentName: string;
  documentFilePath: string;
  signatures: SignatureInfo[];
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

function parsePosition(position?: string | null): { xPercent: number; yPercent: number; page: number; commentXPercent?: number; commentYPercent?: number } {
  if (!position) return { xPercent: 70, yPercent: 90, page: 1 };
  try {
    const parsed = JSON.parse(position);
    return {
      xPercent: parsed.xPercent ?? 70,
      yPercent: parsed.yPercent ?? 90,
      page: (parsed.page ?? 1) - 1,
      commentXPercent: parsed.commentXPercent,
      commentYPercent: parsed.commentYPercent,
    };
  } catch {
    return { xPercent: 70, yPercent: 90, page: 0 };
  }
}

function sanitize(text: string): string {
  return text
    .replace(/\t/g, "    ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/–/g, "-")
    .replace(/—/g, " - ")
    .replace(/…/g, "...")
    .replace(/\u00A0/g, " ");
}

/**
 * Convert a Word document to PDF via the backend edge function (ConvertAPI).
 */
async function convertWordToPdf(filePath: string): Promise<ArrayBuffer> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/convert-docx-to-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ filePath }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`Conversion failed: ${err.error || response.statusText}`);
  }

  const result = await response.json();
  if (!result.pdfBase64) throw new Error("No PDF data returned");

  // Decode base64 to ArrayBuffer
  const binaryString = atob(result.pdfBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
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
  // xPercent/yPercent represent the center of the signature box in the overlay
  // PDF coordinate system: (0,0) is bottom-left, Y increases upward
  // Overlay coordinate system: (0,0) is top-left, Y increases downward
  // So we convert: pdf_y = height - (yPercent/100 * height) - offset for box center
  const x = Math.max(10, Math.min((pos.xPercent / 100) * width - 80, width - 170));
  const y = Math.max(30, Math.min(height - (pos.yPercent / 100) * height, height - 10));

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
      const dims = embedded.scaleToFit(140, 40);
      page.drawImage(embedded, { x, y, width: dims.width, height: dims.height });
    } catch {
      const initials = sig.signerName.split(" ").map(n => n[0]).join(".");
      page.drawText(sanitize(initials), { x, y, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1) });
    }
  } else {
    const text = sig.signatureInitials
      || (sigImage ? sigImage.replace(/^text:/i, "") : null)
      || sig.signerName.split(" ").map(n => n[0]).join(".");
    page.drawText(sanitize(text), { x, y, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1) });
  }
}

export async function generateSignedPdf(options: SignedPdfOptions): Promise<void> {
  const { documentName, documentFilePath, signatures } = options;
  const isPdf = documentFilePath.toLowerCase().endsWith(".pdf");
  const isWord = /\.(docx?)$/i.test(documentFilePath);

  let pdfDoc: PDFDocument;

  if (isPdf) {
    // Load existing PDF directly
    const docBytes = await fetchDocumentBytes(documentFilePath);
    pdfDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  } else if (isWord) {
    // Convert Word → PDF via ConvertAPI (pixel-perfect conversion)
    const pdfBytes = await convertWordToPdf(documentFilePath);
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } else {
    // Unsupported format fallback
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

  // Stamp each signature and optional comment text
  for (const sig of signatures) {
    const pos = parsePosition(sig.position);
    const pageIndex = Math.min(pos.page, pages.length - 1);
    const page = pages[Math.max(0, pageIndex)];
    await stampSignature(pdfDoc, page, sig, pos, courierFont, helv);

    // Stamp comment text at its own position if available
    if (sig.comment && pos.commentXPercent != null && pos.commentYPercent != null) {
      const { width, height } = page.getSize();
      const cx = Math.max(10, Math.min((pos.commentXPercent / 100) * width - 40, width - 200));
      const cy = Math.max(15, Math.min(height - (pos.commentYPercent / 100) * height, height - 10));
      page.drawText(sanitize(sig.comment), { x: cx, y: cy, size: 10, font: helv, color: rgb(0.1, 0.1, 0.1) });
    }
  }

  // Footer on last page
  const lastPage = pages[pages.length - 1];
  const { width: pw } = lastPage.getSize();
  lastPage.drawText(sanitize(`Digitally signed - ${signatures.length} Signatur(en) - MGI Hub`), {
    x: pw / 2 - 80, y: 15, size: 6, font: helv, color: rgb(0.6, 0.6, 0.6),
  });

  // Save and download using file-saver (works in sandboxed iframes)
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const safeName = documentName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s\-_]/g, "").trim();
  saveAs(blob, `${safeName}_signiert.pdf`);
}
