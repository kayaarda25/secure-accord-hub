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
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
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

/**
 * Sanitize text for pdf-lib's WinAnsi encoding.
 * Replaces tabs, control chars, and unsupported Unicode with safe alternatives.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\t/g, "    ") // tabs → 4 spaces
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/[""]/g, '"')  // smart quotes
    .replace(/['']/g, "'")
    .replace(/–/g, "-")
    .replace(/—/g, " - ")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/\u00A0/g, " "); // non-breaking space
}

/**
 * Converts HTML to structured lines, preserving paragraph breaks and basic layout.
 */
function htmlToLines(html: string): string[] {
  // Insert double newlines for block elements to preserve paragraph spacing
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<td[^>]*>/gi, "    ")
    .replace(/<[^>]+>/g, "");

  // Decode HTML entities
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  text = textarea.value;

  // Sanitize for WinAnsi
  text = sanitizeText(text);

  // Split and preserve empty lines as paragraph separators
  const rawLines = text.split("\n");
  const result: string[] = [];
  let lastWasEmpty = false;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (!lastWasEmpty) {
        result.push(""); // paragraph break marker
        lastWasEmpty = true;
      }
    } else {
      result.push(trimmed);
      lastWasEmpty = false;
    }
  }

  return result;
}

/**
 * Renders text lines onto PDF pages with proper pagination.
 * Returns the pages and total page count.
 */
function renderTextToPages(
  pdfDoc: PDFDocument,
  lines: string[],
  font: PDFFont,
  boldFont: PDFFont,
  documentName: string
): PDFPage[] {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const lineHeight = 13;
  const paragraphSpacing = 10;
  const maxWidth = pageWidth - 2 * margin;
  const fontSize = 9.5;
  const pages: PDFPage[] = [];

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let y = pageHeight - margin;

  // Document title
  const safeTitle = sanitizeText(documentName);
  currentPage.drawText(safeTitle, {
    x: margin,
    y,
    size: 13,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 22;

  // Separator
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;

  const startNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(currentPage);
    y = pageHeight - margin;
  };

  for (const line of lines) {
    // Empty line = paragraph break
    if (line === "") {
      y -= paragraphSpacing;
      if (y < margin + 20) startNewPage();
      continue;
    }

    // Word wrap
    const words = line.split(" ");
    let currentLine = "";

    for (const word of words) {
      const safeWord = sanitizeText(word);
      const testLine = currentLine ? `${currentLine} ${safeWord}` : safeWord;

      let textWidth: number;
      try {
        textWidth = font.widthOfTextAtSize(testLine, fontSize);
      } catch {
        // If encoding fails, skip this word
        continue;
      }

      if (textWidth > maxWidth && currentLine) {
        if (y < margin + 20) startNewPage();
        try {
          currentPage.drawText(currentLine, {
            x: margin, y, size: fontSize, font, color: rgb(0.12, 0.12, 0.12),
          });
        } catch {
          // skip unencodable line
        }
        y -= lineHeight;
        currentLine = safeWord;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < margin + 20) startNewPage();
      try {
        currentPage.drawText(currentLine, {
          x: margin, y, size: fontSize, font, color: rgb(0.12, 0.12, 0.12),
        });
      } catch {
        // skip unencodable line
      }
      y -= lineHeight;
    }
  }

  return pages;
}

/**
 * Stamps a signature onto a specific page at the given position.
 */
async function stampSignature(
  pdfDoc: PDFDocument,
  page: PDFPage,
  sig: SignatureInfo,
  pos: { xPercent: number; yPercent: number },
  courierFont: PDFFont,
  helvFont: PDFFont,
) {
  const { width, height } = page.getSize();

  // Clamp position to keep signature within page bounds
  const x = Math.max(10, Math.min((pos.xPercent / 100) * width, width - 170));
  const y = Math.max(30, height - Math.min((pos.yPercent / 100) * height, height - 10));

  // Background box
  page.drawRectangle({
    x: x - 10,
    y: y - 15,
    width: 160,
    height: 60,
    color: rgb(1, 1, 1),
    opacity: 0.92,
    borderColor: rgb(0.83, 0.69, 0.33),
    borderWidth: 0.5,
  });

  const sigImage = sig.signatureImage;
  const isTextSignature = !sigImage || sigImage.toLowerCase().startsWith("text:");

  if (!isTextSignature && sigImage) {
    try {
      let imageBytes: Uint8Array;
      if (sigImage.startsWith("data:image")) {
        imageBytes = dataUrlToBytes(sigImage);
      } else {
        imageBytes = await fetchImageBytes(sigImage);
      }

      let embeddedImage;
      try {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
      } catch {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
      }

      const imgDims = embeddedImage.scaleToFit(120, 30);
      page.drawImage(embeddedImage, {
        x, y: y + 5,
        width: imgDims.width,
        height: imgDims.height,
      });
    } catch (err) {
      console.error("Could not embed signature image:", err);
      const initials = sig.signerName.split(" ").map(n => n[0]).join(".");
      page.drawText(sanitizeText(initials), {
        x, y: y + 15, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1),
      });
    }
  } else {
    const text = sig.signatureInitials
      || (sigImage ? sigImage.replace(/^text:/i, "") : null)
      || sig.signerName.split(" ").map(n => n[0]).join(".");
    page.drawText(sanitizeText(text), {
      x, y: y + 15, size: 18, font: courierFont, color: rgb(0.1, 0.1, 0.1),
    });
  }

  // Signature line
  page.drawLine({
    start: { x, y: y + 2 },
    end: { x: x + 120, y: y + 2 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Signer info
  const signedDate = new Date(sig.signedAt).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  page.drawText(sanitizeText(`${sig.signerName} · ${signedDate}`), {
    x, y: y - 10, size: 7, font: helvFont, color: rgb(0.4, 0.4, 0.4),
  });
}

export async function generateSignedPdf(options: SignedPdfOptions): Promise<void> {
  const { documentName, documentFilePath, signatures } = options;

  const isPdf = documentFilePath.toLowerCase().endsWith(".pdf");
  const isWord = documentFilePath.toLowerCase().endsWith(".docx") || documentFilePath.toLowerCase().endsWith(".doc");

  let pdfDoc: PDFDocument;

  if (isPdf) {
    const docBytes = await fetchDocumentBytes(documentFilePath);
    pdfDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  } else if (isWord) {
    const docBytes = await fetchDocumentBytes(documentFilePath);
    const result = await mammoth.convertToHtml({ arrayBuffer: docBytes });
    const htmlContent = result.value;
    const textLines = htmlToLines(htmlContent);

    pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    renderTextToPages(pdfDoc, textLines, font, boldFont, documentName);
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(sanitizeText(`Dokument: ${documentName}`), {
      x: 40, y: 750, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText("Dateiformat wird nicht direkt unterstuetzt.", {
      x: 40, y: 720, size: 10, font, color: rgb(0.4, 0.4, 0.4),
    });
  }

  const pages = pdfDoc.getPages();
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Stamp each signature
  for (const sig of signatures) {
    const pos = parsePosition(sig.position);
    const pageIndex = Math.min(pos.page, pages.length - 1);
    const page = pages[Math.max(0, pageIndex)];

    await stampSignature(pdfDoc, page, sig, pos, courierFont, helv);
  }

  // Footer on last page
  const lastPage = pages[pages.length - 1];
  const { width: pw } = lastPage.getSize();
  lastPage.drawText(sanitizeText(`Digitally signed · ${signatures.length} Signatur(en) · MGI Hub`), {
    x: pw / 2 - 80, y: 15, size: 6, font: helv, color: rgb(0.6, 0.6, 0.6),
  });

  // Save and download
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
