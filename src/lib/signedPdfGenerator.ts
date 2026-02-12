import jsPDF from "jspdf";

interface SignatureInfo {
  signerName: string;
  signedAt: string;
  signatureImage?: string | null;
  signatureInitials?: string | null;
  position?: string | null;
}

interface SignedPdfOptions {
  documentName: string;
  signatures: SignatureInfo[];
}

const getPositionLabel = (position?: string | null) => {
  switch (position) {
    case "top-left": return "Oben Links";
    case "top-center": return "Oben Mitte";
    case "top-right": return "Oben Rechts";
    case "bottom-left": return "Unten Links";
    case "bottom-center": return "Unten Mitte";
    case "bottom-right": return "Unten Rechts";
    default: return "Standard";
  }
};

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function generateSignedPdf(options: SignedPdfOptions): Promise<void> {
  const { documentName, signatures } = options;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 25;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Header
  doc.setFillColor(26, 26, 46); // Dark header
  doc.rect(0, 0, pageWidth, 45, "F");

  doc.setTextColor(212, 175, 55); // Gold
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Signaturprotokoll", margin, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text("Digital Signature Certificate", margin, 30);

  doc.setTextColor(212, 175, 55);
  doc.setFontSize(8);
  const dateStr = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Erstellt: ${dateStr}`, margin, 38);

  y = 55;

  // Document Info Box
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 25, 2, 2, "S");

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text("Dokument:", margin + 5, y + 8);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(documentName, margin + 5, y + 16);
  doc.setFont("helvetica", "normal");

  y += 35;

  // Signature count
  const signedCount = signatures.length;
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(`Signaturen (${signedCount})`, margin, y);
  y += 3;

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 40, y);
  y += 10;

  // Signatures
  for (let i = 0; i < signatures.length; i++) {
    const sig = signatures[i];

    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    // Signature box
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 45, 2, 2, "FD");

    // Green check indicator
    doc.setFillColor(34, 197, 94);
    doc.circle(margin + 8, y + 8, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("✓", margin + 6.5, y + 9.5);

    // Signer name
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(sig.signerName, margin + 15, y + 10);

    // Signed date
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const signedDate = new Date(sig.signedAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Signiert am: ${signedDate}`, margin + 15, y + 17);

    // Position label
    if (sig.position) {
      doc.text(`Position: ${getPositionLabel(sig.position)}`, margin + 15, y + 23);
    }

    // Signature rendering
    const sigX = margin + 15;
    const sigY = y + 27;

    if (sig.signatureImage) {
      try {
        const base64 = await loadImageAsBase64(sig.signatureImage);
        if (base64) {
          doc.addImage(base64, "PNG", sigX, sigY, 40, 14);
        }
      } catch {
        // Fallback to initials
        doc.setFontSize(18);
        doc.setTextColor(30, 30, 30);
        doc.setFont("courier", "italic");
        doc.text(sig.signerName.split(" ").map(n => n[0]).join("."), sigX, sigY + 10);
      }
    } else if (sig.signatureInitials) {
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.setFont("courier", "italic");
      doc.text(sig.signatureInitials, sigX, sigY + 10);
    } else {
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.setFont("courier", "italic");
      doc.text(sig.signerName.split(" ").map(n => n[0]).join("."), sigX, sigY + 10);
    }

    // Divider line under signature
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(sigX, sigY + 14, sigX + 50, sigY + 14);

    doc.setFont("helvetica", "normal");

    y += 52;
  }

  // Footer
  y = Math.max(y + 10, 260);
  if (y > 270) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Dieses Signaturprotokoll wurde digital erstellt und bestätigt die oben aufgeführten Signaturen.", margin, y);
  doc.text("MGI Hub • Digital Signature Certificate", margin, y + 5);

  // Save
  const safeName = documentName.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-_]/g, "").trim();
  doc.save(`${safeName}_signiert.pdf`);
}
