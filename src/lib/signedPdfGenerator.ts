import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";

interface SignatureInfo {
  signerName: string;
  signedAt: string;
  signatureImage?: string | null; // base64 data URL or storage URL
  signatureInitials?: string | null; // text initials (prefixed with "text:" or plain)
  position?: string | null; // JSON string with xPercent, yPercent, page
}

interface SignedPdfOptions {
  documentName: string;
  documentFilePath: string; // path in the "documents" storage bucket
  signatures: SignatureInfo[];
}

/**
 * Fetches the original document as an ArrayBuffer from Supabase storage.
 */
async function fetchDocumentBytes(filePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage
    .from("documents")
    .download(filePath);
  if (error) throw new Error(`Could not download document: ${error.message}`);
  return await data.arrayBuffer();
}

/**
 * Fetches an image from a URL and returns it as a Uint8Array.
 */
async function fetchImageBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Converts a base64 data URL to a Uint8Array.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse position JSON string to get coordinates.
 */
function parsePosition(position?: string | null): { xPercent: number; yPercent: number; page: number } {
  if (!position) return { xPercent: 70, yPercent: 90, page: 1 };
  try {
    const parsed = JSON.parse(position);
    return {
      xPercent: parsed.xPercent ?? 70,
      yPercent: parsed.yPercent ?? 90,
      page: (parsed.page ?? 1) - 1, // Convert to 0-indexed
    };
  } catch {
    // Legacy string position - default to bottom right
    return { xPercent: 70, yPercent: 90, page: 0 };
  }
}

/**
 * Generates a signed PDF by embedding signatures onto the original document.
 * - For PDF documents: loads the PDF and stamps signatures directly onto it.
 * - For non-PDF documents: creates a new PDF with a note and the signatures.
 */
export async function generateSignedPdf(options: SignedPdfOptions): Promise<void> {
  const { documentName, documentFilePath, signatures } = options;

  const isPdf = documentFilePath.toLowerCase().endsWith(".pdf");

  let pdfDoc: PDFDocument;

  if (isPdf) {
    // Load the original PDF
    const docBytes = await fetchDocumentBytes(documentFilePath);
    pdfDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  } else {
    // For non-PDF files (Word etc.), create a new PDF with a note
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Header
    page.drawRectangle({
      x: 0, y: 792, width: 595, height: 50,
      color: rgb(0.1, 0.1, 0.18),
    });
    page.drawText("Signiertes Dokument", {
      x: 40, y: 810, size: 16, font: boldFont,
      color: rgb(0.83, 0.69, 0.33),
    });

    // Document info
    page.drawText(`Dokument: ${documentName}`, {
      x: 40, y: 750, size: 12, font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(
      "Das Originaldokument ist kein PDF. Die Signaturen sind unten angefügt.",
      { x: 40, y: 720, size: 10, font, color: rgb(0.4, 0.4, 0.4) }
    );
  }

  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Stamp each signature onto the document
  for (const sig of signatures) {
    const pos = parsePosition(sig.position);
    const pageIndex = Math.min(pos.page, pages.length - 1);
    const page = pages[Math.max(0, pageIndex)];
    const { width, height } = page.getSize();

    // Convert percentage to absolute coordinates
    // Note: PDF coordinate system has origin at bottom-left
    const x = (pos.xPercent / 100) * width;
    const y = height - (pos.yPercent / 100) * height; // Flip Y axis

    // Draw a light background box for the signature area
    const boxWidth = 160;
    const boxHeight = 60;
    page.drawRectangle({
      x: x - 10,
      y: y - 15,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1),
      opacity: 0.85,
      borderColor: rgb(0.83, 0.69, 0.33),
      borderWidth: 0.5,
    });

    // Draw signature image or text
    if (sig.signatureImage && !sig.signatureImage.startsWith("text:")) {
      try {
        let imageBytes: Uint8Array;
        if (sig.signatureImage.startsWith("data:image")) {
          imageBytes = dataUrlToBytes(sig.signatureImage);
        } else {
          imageBytes = await fetchImageBytes(sig.signatureImage);
        }

        // Try embedding as PNG, fallback to JPEG
        let embeddedImage;
        try {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } catch {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }

        const imgDims = embeddedImage.scaleToFit(120, 30);
        page.drawImage(embeddedImage, {
          x: x,
          y: y + 5,
          width: imgDims.width,
          height: imgDims.height,
        });
      } catch (err) {
        console.error("Could not embed signature image:", err);
        // Fallback: draw initials
        const initials = sig.signerName.split(" ").map(n => n[0]).join(".");
        page.drawText(initials, {
          x: x, y: y + 15, size: 18, font, color: rgb(0.1, 0.1, 0.1),
        });
      }
    } else {
      // Text-based signature (initials)
      const text = sig.signatureInitials
        || sig.signatureImage?.replace("text:", "")
        || sig.signerName.split(" ").map(n => n[0]).join(".");
      page.drawText(text, {
        x: x, y: y + 15, size: 18, font, color: rgb(0.1, 0.1, 0.1),
      });
    }

    // Draw signature line
    page.drawLine({
      start: { x: x, y: y + 2 },
      end: { x: x + 120, y: y + 2 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Draw signer name and date below signature
    const signedDate = new Date(sig.signedAt).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    page.drawText(`${sig.signerName} · ${signedDate}`, {
      x: x, y: y - 10, size: 7, font: helv, color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Add a small "digitally signed" footer on the last page
  const lastPage = pages[pages.length - 1];
  const { width: pw } = lastPage.getSize();
  lastPage.drawText(`Digitally signed · ${signatures.length} Signatur(en) · MGI Hub`, {
    x: pw / 2 - 80,
    y: 15,
    size: 6,
    font: helv,
    color: rgb(0.6, 0.6, 0.6),
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
