import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer, PageNumber, NumberFormat } from "docx";
import { saveAs } from "file-saver";

export interface ContractData {
  title: string;
  contractNumber?: string;
  date: string;
  partyA: {
    name: string;
    address: string;
    representative?: string;
  };
  partyB: {
    name: string;
    address: string;
    representative?: string;
  };
  terms: string[];
  value?: string;
  currency?: string;
  duration?: string;
  specialClauses?: string[];
}

export interface PaymentInstructionData {
  recipient: string;
  iban: string;
  bic?: string;
  bankName: string;
  amount: string;
  currency: string;
  reference: string;
  purpose: string;
  dueDate?: string;
  notes?: string;
}

export interface LetterheadConfig {
  companyName: string;
  subtitle: string;
  address: string;
  primaryColor: string;
  footerText: string;
}

const DEFAULT_LETTERHEAD: LetterheadConfig = {
  companyName: "MGI × AFRIKA",
  subtitle: "Government Cooperation Platform",
  address: "Zürich, Switzerland",
  primaryColor: "c97c5d",
  footerText: "Confidential",
};

// Global letterhead config that can be set before generating documents
let currentLetterhead: LetterheadConfig = { ...DEFAULT_LETTERHEAD };

export function setLetterheadConfig(config: Partial<LetterheadConfig>) {
  currentLetterhead = {
    ...DEFAULT_LETTERHEAD,
    ...config,
    primaryColor: (config.primaryColor || DEFAULT_LETTERHEAD.primaryColor).replace("#", ""),
  };
}

export function getLetterheadConfig(): LetterheadConfig {
  return currentLetterhead;
}

function createHeader(): Header {
  const config = currentLetterhead;
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: config.companyName,
            bold: true,
            size: 24,
            color: config.primaryColor,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: config.subtitle,
            size: 18,
            color: "666666",
            italics: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: {
          bottom: {
            color: config.primaryColor,
            size: 1,
            style: BorderStyle.SINGLE,
          },
        },
        children: [
          new TextRun({
            text: config.address,
            size: 16,
            color: "888888",
          }),
        ],
        spacing: { after: 400 },
      }),
    ],
  });
}

function createFooter(): Footer {
  const config = currentLetterhead;
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: {
            color: "cccccc",
            size: 1,
            style: BorderStyle.SINGLE,
          },
        },
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: `${config.companyName} | ${config.footerText}`,
            size: 16,
            color: "888888",
          }),
          new TextRun({
            text: "  |  Page ",
            size: 16,
            color: "888888",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            color: "888888",
          }),
          new TextRun({
            text: " of ",
            size: 16,
            color: "888888",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: "888888",
          }),
        ],
      }),
    ],
  });
}

export async function generateContractDocx(data: ContractData): Promise<void> {
  const doc = new Document({
    sections: [
      {
        headers: {
          default: createHeader(),
        },
        footers: {
          default: createFooter(),
        },
        children: [
          // Title
          new Paragraph({
            text: data.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          
          // Contract Number & Date
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `Vertragsnummer: ${data.contractNumber || "---"} | Datum: ${data.date}`,
                size: 20,
                color: "666666",
              }),
            ],
          }),

          // Parties Section
          new Paragraph({
            text: "VERTRAGSPARTEIEN",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),

          // Party A
          new Paragraph({
            children: [
              new TextRun({ text: "Partei A: ", bold: true }),
              new TextRun({ text: data.partyA.name }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Adresse: ", bold: true }),
              new TextRun({ text: data.partyA.address }),
            ],
          }),
          ...(data.partyA.representative ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Vertreter: ", bold: true }),
                new TextRun({ text: data.partyA.representative }),
              ],
              spacing: { after: 200 },
            }),
          ] : [new Paragraph({ text: "", spacing: { after: 200 } })]),

          // Party B
          new Paragraph({
            children: [
              new TextRun({ text: "Partei B: ", bold: true }),
              new TextRun({ text: data.partyB.name }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Adresse: ", bold: true }),
              new TextRun({ text: data.partyB.address }),
            ],
          }),
          ...(data.partyB.representative ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Vertreter: ", bold: true }),
                new TextRun({ text: data.partyB.representative }),
              ],
              spacing: { after: 300 },
            }),
          ] : [new Paragraph({ text: "", spacing: { after: 300 } })]),

          // Contract Terms
          new Paragraph({
            text: "VERTRAGSBEDINGUNGEN",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),

          ...data.terms.map((term, index) => 
            new Paragraph({
              children: [
                new TextRun({ text: `${index + 1}. `, bold: true }),
                new TextRun({ text: term }),
              ],
              spacing: { after: 100 },
            })
          ),

          // Value & Duration
          ...(data.value ? [
            new Paragraph({
              text: "VERTRAGSWERT",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Betrag: ${data.value} ${data.currency || "CHF"}` }),
              ],
            }),
          ] : []),

          ...(data.duration ? [
            new Paragraph({
              children: [
                new TextRun({ text: `Laufzeit: ${data.duration}` }),
              ],
              spacing: { after: 200 },
            }),
          ] : []),

          // Special Clauses
          ...(data.specialClauses && data.specialClauses.length > 0 ? [
            new Paragraph({
              text: "BESONDERE KLAUSELN",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),
            ...data.specialClauses.map(clause => 
              new Paragraph({
                children: [
                  new TextRun({ text: "• ", bold: true }),
                  new TextRun({ text: clause }),
                ],
                spacing: { after: 100 },
              })
            ),
          ] : []),

          // Signature Section
          new Paragraph({
            text: "UNTERSCHRIFTEN",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 600, after: 300 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({ text: "", spacing: { after: 600 } }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "_".repeat(30) }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: data.partyA.name, bold: true }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Datum: ________________", size: 18 }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({ text: "", spacing: { after: 600 } }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "_".repeat(30) }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: data.partyB.name, bold: true }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Datum: ________________", size: 18 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.title.replace(/\s+/g, "_")}_${data.date}.docx`);
}

export async function generatePaymentInstructionDocx(data: PaymentInstructionData): Promise<void> {
  const doc = new Document({
    sections: [
      {
        headers: {
          default: createHeader(),
        },
        footers: {
          default: createFooter(),
        },
        children: [
          new Paragraph({
            text: "ZAHLUNGSANWEISUNG",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          }),

          new Paragraph({
            text: "PAYMENT INSTRUCTION",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "PAYMENT INSTRUCTION",
                size: 20,
                color: "888888",
                italics: true,
              }),
            ],
          }),

          // Notes/Description text above the table
          ...(data.notes ? data.notes.split('\n').filter(line => line.trim()).map((line, index, arr) => 
            new Paragraph({
              children: [
                new TextRun({ text: line, size: 22 }),
              ],
              spacing: { before: index === 0 ? 200 : 80, after: index === arr.length - 1 ? 300 : 80 },
            })
          ) : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow("Empfänger / Beneficiary:", data.recipient),
              createTableRow("IBAN:", data.iban),
              ...(data.bic ? [createTableRow("BIC/SWIFT:", data.bic)] : []),
              createTableRow("Bank:", data.bankName),
              createTableRow("Betrag / Amount:", `${data.amount} ${data.currency}`),
              createTableRow("Verwendungszweck / Reference:", data.reference),
              createTableRow("Zweck / Purpose:", data.purpose),
              ...(data.dueDate ? [createTableRow("Fälligkeitsdatum / Due Date:", data.dueDate)] : []),
            ],
          }),

          new Paragraph({
            text: "",
            spacing: { before: 400, after: 200 },
          }),

          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: "Autorisiert durch / Authorized by:",
                bold: true,
              }),
            ],
            spacing: { before: 400 },
          }),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          new Paragraph({
            children: [
              new TextRun({ text: "_".repeat(40) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Unterschrift / Signature", size: 18, color: "888888" }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 200 } }),

          new Paragraph({
            children: [
              new TextRun({ text: "_".repeat(40) }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Datum / Date", size: 18, color: "888888" }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Payment_Instruction_${data.reference}_${new Date().toISOString().split("T")[0]}.docx`);
}

function createTableRow(label: string, value: string, isMultiline: boolean = false): TableRow {
  // Split value by newlines for multiline support
  const lines = isMultiline ? value.split('\n').filter(line => line.trim()) : [value];
  
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { fill: "f5f5f5" },
        verticalAlign: "top" as const,
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 22 }),
            ],
            spacing: { before: 100, after: 100 },
          }),
        ],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        verticalAlign: "top" as const,
        children: lines.map((line, index) => 
          new Paragraph({
            children: [
              new TextRun({ text: line, size: 22 }),
            ],
            spacing: { before: index === 0 ? 100 : 50, after: index === lines.length - 1 ? 100 : 50 },
          })
        ),
      }),
    ],
  });
}

// PDF generation using browser print
export function generateContractPdf(data: ContractData): void {
  const config = currentLetterhead;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blockiert. Bitte erlauben Sie Popups für diese Seite.");
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .header { text-align: right; border-bottom: 2px solid #${config.primaryColor}; padding-bottom: 1rem; margin-bottom: 2rem; }
    .header h1 { color: #${config.primaryColor}; margin: 0; font-size: 1.5rem; }
    .header p { margin: 0.2rem 0; color: #666; font-size: 0.9rem; }
    .title { text-align: center; margin: 2rem 0; }
    .title h2 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .meta { text-align: center; color: #666; margin-bottom: 2rem; }
    h3 { color: #${config.primaryColor}; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-top: 2rem; }
    .party { margin-bottom: 1rem; }
    .party strong { display: inline-block; width: 100px; }
    .terms ol { margin-left: 1.5rem; }
    .terms li { margin-bottom: 0.5rem; }
    .signatures { display: flex; justify-content: space-between; margin-top: 4rem; }
    .signature-box { width: 45%; text-align: center; }
    .signature-line { border-top: 1px solid #333; margin-top: 3rem; padding-top: 0.5rem; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #888; border-top: 1px solid #ddd; padding-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.companyName}</h1>
    <p><em>${config.subtitle}</em></p>
    <p>${config.address}</p>
  </div>
  
  <div class="title">
    <h2>${data.title}</h2>
  </div>
  <div class="meta">
    Vertragsnummer: ${data.contractNumber || "---"} | Datum: ${data.date}
  </div>

  <h3>VERTRAGSPARTEIEN</h3>
  <div class="party">
    <p><strong>Partei A:</strong> ${data.partyA.name}</p>
    <p><strong>Adresse:</strong> ${data.partyA.address}</p>
    ${data.partyA.representative ? `<p><strong>Vertreter:</strong> ${data.partyA.representative}</p>` : ""}
  </div>
  <div class="party">
    <p><strong>Partei B:</strong> ${data.partyB.name}</p>
    <p><strong>Adresse:</strong> ${data.partyB.address}</p>
    ${data.partyB.representative ? `<p><strong>Vertreter:</strong> ${data.partyB.representative}</p>` : ""}
  </div>

  <h3>VERTRAGSBEDINGUNGEN</h3>
  <div class="terms">
    <ol>
      ${data.terms.map(term => `<li>${term}</li>`).join("")}
    </ol>
  </div>

  ${data.value ? `
  <h3>VERTRAGSWERT</h3>
  <p>Betrag: ${data.value} ${data.currency || "CHF"}</p>
  ` : ""}

  ${data.duration ? `<p>Laufzeit: ${data.duration}</p>` : ""}

  ${data.specialClauses && data.specialClauses.length > 0 ? `
  <h3>BESONDERE KLAUSELN</h3>
  <ul>
    ${data.specialClauses.map(c => `<li>${c}</li>`).join("")}
  </ul>
  ` : ""}

  <h3>UNTERSCHRIFTEN</h3>
  <div class="signatures">
    <div class="signature-box">
      <div class="signature-line">
        <strong>${data.partyA.name}</strong><br>
        <small>Datum: ________________</small>
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line">
        <strong>${data.partyB.name}</strong><br>
        <small>Datum: ________________</small>
      </div>
    </div>
  </div>

  <div class="footer">
    ${config.companyName} | ${config.footerText}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function generatePaymentInstructionPdf(data: PaymentInstructionData): void {
  const config = currentLetterhead;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blockiert. Bitte erlauben Sie Popups für diese Seite.");
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Zahlungsanweisung - ${data.reference}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .header { text-align: right; border-bottom: 2px solid #${config.primaryColor}; padding-bottom: 1rem; margin-bottom: 2rem; }
    .header h1 { color: #${config.primaryColor}; margin: 0; font-size: 1.5rem; }
    .header p { margin: 0.2rem 0; color: #666; font-size: 0.9rem; }
    .title { text-align: center; margin: 2rem 0; }
    .title h2 { font-size: 1.8rem; margin-bottom: 0.3rem; }
    .title p { color: #888; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
    th, td { padding: 0.8rem; text-align: left; border: 1px solid #ddd; }
    th { background: #f5f5f5; width: 35%; font-weight: 600; }
    .signature-section { margin-top: 3rem; }
    .signature-section h4 { margin-bottom: 2rem; }
    .signature-line { border-top: 1px solid #333; width: 50%; margin-top: 3rem; padding-top: 0.5rem; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 0.8rem; color: #888; border-top: 1px solid #ddd; padding-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.companyName}</h1>
    <p><em>${config.subtitle}</em></p>
    <p>${config.address}</p>
  </div>
  
  <div class="title">
    <h2>ZAHLUNGSANWEISUNG</h2>
    <p>PAYMENT INSTRUCTION</p>
  </div>

  ${data.notes ? `<div class="notes-section" style="margin: 1.5rem 0; white-space: pre-wrap; line-height: 1.6;">${data.notes}</div>` : ""}

  <table>
    <tr><th>Empfänger / Beneficiary</th><td>${data.recipient}</td></tr>
    <tr><th>IBAN</th><td>${data.iban}</td></tr>
    ${data.bic ? `<tr><th>BIC/SWIFT</th><td>${data.bic}</td></tr>` : ""}
    <tr><th>Bank</th><td>${data.bankName}</td></tr>
    <tr><th>Betrag / Amount</th><td><strong>${data.amount} ${data.currency}</strong></td></tr>
    <tr><th>Verwendungszweck / Reference</th><td>${data.reference}</td></tr>
    <tr><th>Zweck / Purpose</th><td>${data.purpose}</td></tr>
    ${data.dueDate ? `<tr><th>Fälligkeitsdatum / Due Date</th><td>${data.dueDate}</td></tr>` : ""}
  </table>

  <div class="signature-section">
    <h4>Autorisiert durch / Authorized by:</h4>
    <div class="signature-line">
      Unterschrift / Signature
    </div>
    <br><br>
    <div class="signature-line">
      Datum / Date
    </div>
  </div>

  <div class="footer">
    ${config.companyName} | ${config.footerText}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
