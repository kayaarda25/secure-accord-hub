import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer, PageNumber, NumberFormat, TabStopType, TabStopPosition } from "docx";
import { saveAs } from "file-saver";
import { LABELS, type DocLanguage, type ContractType } from "./legalTermsLibrary";

export interface ContractData {
  title: string;
  contractNumber?: string;
  date: string;
  language: DocLanguage;
  contractType: ContractType;
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
  preamble?: string;
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
  language?: DocLanguage;
}

export interface EmptyDocumentData {
  title: string;
  recipient?: string;
  location?: string;
  content: string;
  date: string;
  language?: DocLanguage;
}

export interface ProtocolTopic {
  topic: string;
  notes: string;
}

export interface MeetingProtocolData {
  title: string;
  date: string;
  location: string;
  attendees: string[];
  topics: ProtocolTopic[];
  decisions?: string;
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
  primaryColor: "000000",
  footerText: "Confidential",
};

let currentLetterhead: LetterheadConfig = { ...DEFAULT_LETTERHEAD };

export function setLetterheadConfig(config: Partial<LetterheadConfig>) {
  currentLetterhead = {
    ...DEFAULT_LETTERHEAD,
    ...config,
    primaryColor: "000000", // Always black for legal documents
  };
}

export function getLetterheadConfig(): LetterheadConfig {
  return currentLetterhead;
}

// Classic black & white legal header
function createHeader(): Header {
  const config = currentLetterhead;
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: config.companyName.toUpperCase(),
            bold: true,
            size: 22,
            color: "000000",
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: config.subtitle,
            size: 18,
            color: "444444",
            font: "Times New Roman",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        border: {
          bottom: {
            color: "000000",
            size: 6,
            style: BorderStyle.SINGLE,
          },
        },
        children: [
          new TextRun({
            text: config.address,
            size: 16,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
        spacing: { after: 300 },
      }),
    ],
  });
}

function createFooter(lang: DocLanguage = "de"): Footer {
  const config = currentLetterhead;
  const l = LABELS[lang];
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: {
            color: "000000",
            size: 3,
            style: BorderStyle.SINGLE,
          },
        },
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: `${config.companyName}  |  ${l.confidential}  |  ${l.page} `,
            size: 14,
            color: "666666",
            font: "Times New Roman",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 14,
            color: "666666",
            font: "Times New Roman",
          }),
          new TextRun({
            text: ` ${l.of} `,
            size: 14,
            color: "666666",
            font: "Times New Roman",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 14,
            color: "666666",
            font: "Times New Roman",
          }),
        ],
      }),
    ],
  });
}

// Helper: create a numbered article paragraph with title and body
function createArticleParagraph(index: number, text: string, lang: DocLanguage): Paragraph[] {
  const parts = text.split("\n");
  const title = parts[0];
  const body = parts.slice(1).join("\n").trim();
  
  const paragraphs: Paragraph[] = [];
  
  // Article heading
  const articleLabel = lang === "de" ? "Artikel" : lang === "en" ? "Article" : lang === "fr" ? "Article" : "Artigo";
  paragraphs.push(
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: `${articleLabel} ${index} – ${title}`,
          bold: true,
          size: 22,
          color: "000000",
          font: "Times New Roman",
        }),
      ],
    })
  );

  // Article body
  if (body) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: body,
            size: 22,
            color: "000000",
            font: "Times New Roman",
          }),
        ],
        indent: { left: 0 },
      })
    );
  }

  return paragraphs;
}

export async function generateContractDocx(data: ContractData): Promise<void> {
  const lang = data.language || "de";
  const l = LABELS[lang];

  const doc = new Document({
    sections: [
      {
        headers: { default: createHeader() },
        footers: { default: createFooter(lang) },
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 120 },
            children: [
              new TextRun({
                text: data.title.toUpperCase(),
                bold: true,
                size: 32,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          // Decorative line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "─".repeat(60),
                size: 16,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          // Contract Number & Date
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: data.contractNumber ? `Nr. ${data.contractNumber}  |  ${data.date}` : data.date,
                size: 20,
                color: "444444",
                font: "Times New Roman",
              }),
            ],
          }),

          // Preamble
          ...(data.preamble ? [
            new Paragraph({
              spacing: { before: 200, after: 300 },
              children: [
                new TextRun({
                  text: data.preamble,
                  size: 22,
                  color: "000000",
                  font: "Times New Roman",
                  italics: true,
                }),
              ],
            }),
          ] : []),

          // Parties Section
          new Paragraph({
            spacing: { before: 300, after: 200 },
            border: {
              bottom: { color: "000000", size: 3, style: BorderStyle.SINGLE },
            },
            children: [
              new TextRun({
                text: l.parties,
                bold: true,
                size: 24,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          // Party A
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({ text: `${l.partyA}: `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: data.partyA.name, size: 22, font: "Times New Roman" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${l.address}: `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: data.partyA.address, size: 22, font: "Times New Roman" }),
            ],
          }),
          ...(data.partyA.representative ? [
            new Paragraph({
              spacing: { after: 200 },
              children: [
                new TextRun({ text: `${l.representative}: `, bold: true, size: 22, font: "Times New Roman" }),
                new TextRun({ text: data.partyA.representative, size: 22, font: "Times New Roman" }),
              ],
            }),
          ] : [new Paragraph({ text: "", spacing: { after: 200 } })]),

          // Party B
          new Paragraph({
            children: [
              new TextRun({ text: `${l.partyB}: `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: data.partyB.name, size: 22, font: "Times New Roman" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${l.address}: `, bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: data.partyB.address, size: 22, font: "Times New Roman" }),
            ],
          }),
          ...(data.partyB.representative ? [
            new Paragraph({
              spacing: { after: 300 },
              children: [
                new TextRun({ text: `${l.representative}: `, bold: true, size: 22, font: "Times New Roman" }),
                new TextRun({ text: data.partyB.representative, size: 22, font: "Times New Roman" }),
              ],
            }),
          ] : [new Paragraph({ text: "", spacing: { after: 300 } })]),

          // Contract Terms
          new Paragraph({
            spacing: { before: 300, after: 200 },
            border: {
              bottom: { color: "000000", size: 3, style: BorderStyle.SINGLE },
            },
            children: [
              new TextRun({
                text: l.terms,
                bold: true,
                size: 24,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          ...data.terms.flatMap((term, index) => 
            createArticleParagraph(index + 1, term, lang)
          ),

          // Value & Duration
          ...(data.value ? [
            new Paragraph({
              spacing: { before: 400, after: 200 },
              border: {
                bottom: { color: "000000", size: 3, style: BorderStyle.SINGLE },
              },
              children: [
                new TextRun({
                  text: l.contractValue,
                  bold: true,
                  size: 24,
                  color: "000000",
                  font: "Times New Roman",
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `${data.value} ${data.currency || "CHF"}`, size: 22, font: "Times New Roman" }),
              ],
            }),
          ] : []),

          ...(data.duration ? [
            new Paragraph({
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({ text: `${l.duration}: `, bold: true, size: 22, font: "Times New Roman" }),
                new TextRun({ text: data.duration, size: 22, font: "Times New Roman" }),
              ],
            }),
          ] : []),

          // Special Clauses
          ...(data.specialClauses && data.specialClauses.length > 0 ? [
            new Paragraph({
              spacing: { before: 400, after: 200 },
              border: {
                bottom: { color: "000000", size: 3, style: BorderStyle.SINGLE },
              },
              children: [
                new TextRun({
                  text: l.specialClauses,
                  bold: true,
                  size: 24,
                  color: "000000",
                  font: "Times New Roman",
                }),
              ],
            }),
            ...data.specialClauses.map(clause => 
              new Paragraph({
                children: [
                  new TextRun({ text: "— ", size: 22, font: "Times New Roman" }),
                  new TextRun({ text: clause, size: 22, font: "Times New Roman" }),
                ],
                spacing: { after: 100 },
              })
            ),
          ] : []),

          // Signature Section
          new Paragraph({
            spacing: { before: 600, after: 300 },
            border: {
              bottom: { color: "000000", size: 3, style: BorderStyle.SINGLE },
            },
            children: [
              new TextRun({
                text: l.signatures,
                bold: true,
                size: 24,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
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
                      new Paragraph({ text: "", spacing: { after: 800 } }),
                      new Paragraph({
                        children: [new TextRun({ text: "_".repeat(30), font: "Times New Roman" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: data.partyA.name, bold: true, size: 20, font: "Times New Roman" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: `${l.date}: ________________`, size: 18, color: "666666", font: "Times New Roman" })],
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
                      new Paragraph({ text: "", spacing: { after: 800 } }),
                      new Paragraph({
                        children: [new TextRun({ text: "_".repeat(30), font: "Times New Roman" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: data.partyB.name, bold: true, size: 20, font: "Times New Roman" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: `${l.date}: ________________`, size: 18, color: "666666", font: "Times New Roman" })],
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
  const lang = data.language || "de";
  const l = LABELS[lang];

  const doc = new Document({
    sections: [
      {
        headers: { default: createHeader() },
        footers: { default: createFooter(lang) },
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 120 },
            children: [
              new TextRun({
                text: l.paymentInstruction,
                bold: true,
                size: 32,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "─".repeat(60),
                size: 16,
                color: "000000",
                font: "Times New Roman",
              }),
            ],
          }),

          // Notes/Description text above the table
          ...(data.notes ? data.notes.split('\n').filter(line => line.trim()).map((line, index, arr) => 
            new Paragraph({
              children: [
                new TextRun({ text: line, size: 22, font: "Times New Roman" }),
              ],
              spacing: { before: index === 0 ? 200 : 80, after: index === arr.length - 1 ? 300 : 80 },
            })
          ) : []),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createLegalTableRow(`${l.beneficiary}:`, data.recipient),
              createLegalTableRow("IBAN:", data.iban),
              ...(data.bic ? [createLegalTableRow("BIC/SWIFT:", data.bic)] : []),
              createLegalTableRow(`${l.bank}:`, data.bankName),
              createLegalTableRow(`${l.amount}:`, `${data.amount} ${data.currency}`),
              createLegalTableRow(`${l.reference}:`, data.reference),
              createLegalTableRow(`${l.purpose}:`, data.purpose),
              ...(data.dueDate ? [createLegalTableRow(`${l.dueDate}:`, data.dueDate)] : []),
            ],
          }),

          new Paragraph({ text: "", spacing: { before: 400 } }),

          new Paragraph({
            children: [
              new TextRun({ text: `${l.authorizedBy}:`, bold: true, size: 22, font: "Times New Roman" }),
            ],
            spacing: { before: 400 },
          }),

          new Paragraph({ text: "", spacing: { after: 600 } }),

          new Paragraph({
            children: [new TextRun({ text: "_".repeat(40), font: "Times New Roman" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: l.signature, size: 18, color: "666666", font: "Times New Roman" })],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          new Paragraph({
            children: [new TextRun({ text: "_".repeat(40), font: "Times New Roman" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: l.date, size: 18, color: "666666", font: "Times New Roman" })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Payment_Instruction_${data.reference}_${new Date().toISOString().split("T")[0]}.docx`);
}

function createLegalTableRow(label: string, value: string): TableRow {
  const lines = value.split('\n').filter(line => line.trim());
  
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { fill: "f0f0f0" },
        verticalAlign: "top" as const,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          left: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          right: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 22, font: "Times New Roman" }),
            ],
            spacing: { before: 100, after: 100 },
          }),
        ],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        verticalAlign: "top" as const,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          left: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
          right: { style: BorderStyle.SINGLE, size: 2, color: "cccccc" },
        },
        children: lines.map((line, index) => 
          new Paragraph({
            children: [
              new TextRun({ text: line, size: 22, font: "Times New Roman" }),
            ],
            spacing: { before: index === 0 ? 100 : 50, after: index === lines.length - 1 ? 100 : 50 },
          })
        ),
      }),
    ],
  });
}

// PDF generation - Classic black & white legal style
export function generateContractPdf(data: ContractData): void {
  const lang = data.language || "de";
  const l = LABELS[lang];
  const config = currentLetterhead;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked.");
    return;
  }

  const termsHtml = data.terms.map((term, index) => {
    const parts = term.split("\n");
    const title = parts[0];
    const body = parts.slice(1).join("<br>");
    const articleLabel = lang === "de" ? "Artikel" : lang === "en" ? "Article" : lang === "fr" ? "Article" : "Artigo";
    return `
      <div class="article">
        <h4>${articleLabel} ${index + 1} – ${title}</h4>
        ${body ? `<p>${body}</p>` : ""}
      </div>
    `;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    @page { margin: 2.5cm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', 'Georgia', serif; line-height: 1.7; color: #000; font-size: 11pt; }
    .header { border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
    .header h1 { margin: 0; font-size: 12pt; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
    .header p { margin: 0.1rem 0; color: #444; font-size: 9pt; }
    .title { text-align: center; margin: 2rem 0 0.5rem; }
    .title h2 { font-size: 16pt; margin: 0; text-transform: uppercase; letter-spacing: 3px; font-weight: bold; }
    .divider { text-align: center; color: #000; margin-bottom: 0.5rem; font-size: 8pt; letter-spacing: 4px; }
    .meta { text-align: center; color: #444; margin-bottom: 2rem; font-size: 10pt; }
    .preamble { font-style: italic; margin-bottom: 2rem; text-align: justify; }
    .section-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 0.3rem; margin-top: 2rem; margin-bottom: 1rem; letter-spacing: 1px; }
    .party p { margin: 0.15rem 0; }
    .party strong { display: inline-block; min-width: 140px; }
    .article { margin-bottom: 1.2rem; }
    .article h4 { margin: 0 0 0.3rem; font-size: 11pt; font-weight: bold; }
    .article p { margin: 0; text-align: justify; }
    .signatures { display: flex; justify-content: space-between; margin-top: 4rem; }
    .sig-box { width: 44%; }
    .sig-line { border-top: 1px solid #000; margin-top: 4rem; padding-top: 0.3rem; }
    .sig-line strong { display: block; font-size: 10pt; }
    .sig-line small { color: #666; font-size: 9pt; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #000; padding-top: 0.3rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.companyName}</h1>
    <p>${config.subtitle}</p>
    <p>${config.address}</p>
  </div>
  
  <div class="title"><h2>${data.title}</h2></div>
  <div class="divider">${"─".repeat(40)}</div>
  <div class="meta">${data.contractNumber ? `Nr. ${data.contractNumber}  |  ` : ""}${data.date}</div>

  ${data.preamble ? `<div class="preamble">${data.preamble}</div>` : ""}

  <div class="section-title">${l.parties}</div>
  <div class="party">
    <p><strong>${l.partyA}:</strong> ${data.partyA.name}</p>
    <p><strong>${l.address}:</strong> ${data.partyA.address}</p>
    ${data.partyA.representative ? `<p><strong>${l.representative}:</strong> ${data.partyA.representative}</p>` : ""}
  </div>
  <br>
  <div class="party">
    <p><strong>${l.partyB}:</strong> ${data.partyB.name}</p>
    <p><strong>${l.address}:</strong> ${data.partyB.address}</p>
    ${data.partyB.representative ? `<p><strong>${l.representative}:</strong> ${data.partyB.representative}</p>` : ""}
  </div>

  <div class="section-title">${l.terms}</div>
  ${termsHtml}

  ${data.value ? `
  <div class="section-title">${l.contractValue}</div>
  <p>${data.value} ${data.currency || "CHF"}</p>
  ` : ""}

  ${data.duration ? `<p><strong>${l.duration}:</strong> ${data.duration}</p>` : ""}

  ${data.specialClauses && data.specialClauses.length > 0 ? `
  <div class="section-title">${l.specialClauses}</div>
  ${data.specialClauses.map(c => `<p>— ${c}</p>`).join("")}
  ` : ""}

  <div class="section-title">${l.signatures}</div>
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line">
        <strong>${data.partyA.name}</strong>
        <small>${l.date}: ________________</small>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line">
        <strong>${data.partyB.name}</strong>
        <small>${l.date}: ________________</small>
      </div>
    </div>
  </div>

  <div class="footer">${config.companyName}  |  ${l.confidential}</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function generatePaymentInstructionPdf(data: PaymentInstructionData): void {
  const lang = data.language || "de";
  const l = LABELS[lang];
  const config = currentLetterhead;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked.");
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${l.paymentInstruction}</title>
  <style>
    @page { margin: 2.5cm; }
    body { font-family: 'Times New Roman', 'Georgia', serif; line-height: 1.7; color: #000; font-size: 11pt; }
    .header { border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
    .header h1 { margin: 0; font-size: 12pt; letter-spacing: 2px; text-transform: uppercase; }
    .header p { margin: 0.1rem 0; color: #444; font-size: 9pt; }
    .title { text-align: center; margin: 2rem 0 0.5rem; }
    .title h2 { font-size: 16pt; text-transform: uppercase; letter-spacing: 3px; }
    .divider { text-align: center; margin-bottom: 1.5rem; font-size: 8pt; letter-spacing: 4px; }
    .notes { margin: 1.5rem 0; white-space: pre-wrap; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    th, td { padding: 0.6rem 0.8rem; text-align: left; border: 1px solid #ccc; font-size: 11pt; }
    th { background: #f0f0f0; width: 35%; font-weight: bold; }
    .sig-section { margin-top: 3rem; }
    .sig-line { border-top: 1px solid #000; width: 50%; margin-top: 3rem; padding-top: 0.3rem; color: #666; font-size: 9pt; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #000; padding-top: 0.3rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.companyName}</h1>
    <p>${config.subtitle}</p>
    <p>${config.address}</p>
  </div>
  
  <div class="title"><h2>${l.paymentInstruction}</h2></div>
  <div class="divider">${"─".repeat(40)}</div>

  ${data.notes ? `<div class="notes">${data.notes}</div>` : ""}

  <table>
    <tr><th>${l.beneficiary}</th><td>${data.recipient}</td></tr>
    <tr><th>IBAN</th><td>${data.iban}</td></tr>
    ${data.bic ? `<tr><th>BIC/SWIFT</th><td>${data.bic}</td></tr>` : ""}
    <tr><th>${l.bank}</th><td>${data.bankName}</td></tr>
    <tr><th>${l.amount}</th><td><strong>${data.amount} ${data.currency}</strong></td></tr>
    <tr><th>${l.reference}</th><td>${data.reference}</td></tr>
    <tr><th>${l.purpose}</th><td>${data.purpose}</td></tr>
    ${data.dueDate ? `<tr><th>${l.dueDate}</th><td>${data.dueDate}</td></tr>` : ""}
  </table>

  <div class="sig-section">
    <p><strong>${l.authorizedBy}:</strong></p>
    <div class="sig-line">${l.signature}</div>
    <br><br>
    <div class="sig-line">${l.date}</div>
  </div>

  <div class="footer">${config.companyName}  |  ${l.confidential}</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Empty document generation - Black & white legal style
export async function generateEmptyDocumentDocx(data: EmptyDocumentData): Promise<void> {
  const lang = data.language || "de";
  const contentParagraphs = data.content.split('\n').map(line => 
    new Paragraph({
      children: [
        new TextRun({ text: line || " ", size: 22, font: "Times New Roman" }),
      ],
      spacing: { after: 120 },
    })
  );

  const recipientParagraphs = data.recipient ? data.recipient.split('\n').map(line => 
    new Paragraph({
      children: [
        new TextRun({ text: line, size: 22, font: "Times New Roman" }),
      ],
      spacing: { after: 40 },
    })
  ) : [];

  const l = LABELS[lang];

  const doc = new Document({
    sections: [
      {
        headers: { default: createHeader() },
        footers: { default: createFooter(lang) },
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          ...(recipientParagraphs.length > 0 ? [
            ...recipientParagraphs,
            new Paragraph({ text: "", spacing: { after: 400 } }),
          ] : []),

          new Paragraph({
            children: [
              new TextRun({
                text: data.title,
                bold: true,
                size: 28,
                font: "Times New Roman",
              }),
            ],
            spacing: { before: 200, after: 80 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: data.location ? `${data.location}, ${data.date}` : data.date,
                size: 22,
                color: "444444",
                font: "Times New Roman",
              }),
            ],
            spacing: { after: 400 },
          }),

          ...contentParagraphs,

          new Paragraph({ text: "", spacing: { before: 600 } }),
          new Paragraph({
            children: [new TextRun({ text: "_".repeat(40), font: "Times New Roman" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: l.signature, size: 18, color: "666666", font: "Times New Roman" })],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "_".repeat(40), font: "Times New Roman" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: l.date, size: 18, color: "666666", font: "Times New Roman" })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.title.replace(/\s+/g, "_")}_${data.date}.docx`);
}

export function generateEmptyDocumentPdf(data: EmptyDocumentData): void {
  const lang = data.language || "de";
  const l = LABELS[lang];
  const config = currentLetterhead;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked.");
    return;
  }

  const formattedContent = data.content
    .split('\n')
    .map(line => `<p style="margin: 0.3rem 0;">${line || '&nbsp;'}</p>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    @page { margin: 2.5cm; }
    body { font-family: 'Times New Roman', 'Georgia', serif; line-height: 1.7; color: #000; font-size: 11pt; }
    .header { border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
    .header h1 { margin: 0; font-size: 12pt; letter-spacing: 2px; text-transform: uppercase; }
    .header p { margin: 0.1rem 0; color: #444; font-size: 9pt; }
    .recipient p { margin: 0.1rem 0; }
    .title h2 { font-size: 13pt; margin: 0; font-weight: bold; }
    .meta { color: #444; margin-bottom: 1.5rem; font-size: 10pt; }
    .content { margin: 1.5rem 0; text-align: justify; }
    .sig-line { border-top: 1px solid #000; width: 50%; margin-top: 3rem; padding-top: 0.3rem; color: #666; font-size: 9pt; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #000; padding-top: 0.3rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.companyName}</h1>
    <p>${config.subtitle}</p>
    <p>${config.address}</p>
  </div>

  ${data.recipient ? `<div class="recipient">${data.recipient.split('\n').map(line => `<p>${line}</p>`).join('')}</div><br>` : ''}
  
  <div class="title"><h2>${data.title}</h2></div>
  <div class="meta">${data.location ? `${data.location}, ${data.date}` : data.date}</div>

  <div class="content">${formattedContent}</div>

  <div class="sig-line">${l.signature}</div>
  <br><br>
  <div class="sig-line">${l.date}</div>

  <div class="footer">${config.companyName}  |  ${l.confidential}</div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Meeting Protocol (MoM) - kept as-is (separate styling)
export async function generateMeetingProtocolDocx(data: MeetingProtocolData): Promise<Blob> {
  const primaryColor = "000000";
  const lineColor = "cccccc";
  
  const topicSections = data.topics.flatMap((topic) => {
    const sections: Paragraph[] = [];
    
    if (topic.topic.trim()) {
      sections.push(
        new Paragraph({
          border: {
            bottom: { color: lineColor, style: BorderStyle.SINGLE, size: 6 },
          },
          children: [
            new TextRun({
              text: topic.topic.toUpperCase(),
              bold: true,
              size: 22,
              color: primaryColor,
              smallCaps: true,
              font: "Times New Roman",
            }),
          ],
          spacing: { before: 400, after: 200 },
        })
      );
      
      if (topic.notes.trim()) {
        const noteLines = topic.notes.split('\n').filter(n => n.trim());
        noteLines.forEach(note => {
          const colonIndex = note.indexOf(':');
          if (colonIndex > 0 && colonIndex < 60) {
            const title = note.substring(0, colonIndex + 1);
            const description = note.substring(colonIndex + 1).trim();
            
            sections.push(
              new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: "● ", size: 22, font: "Times New Roman" }),
                  new TextRun({ text: title, bold: true, size: 22, font: "Times New Roman" }),
                ],
                spacing: { before: 150, after: 50 },
              })
            );
            
            if (description) {
              sections.push(
                new Paragraph({
                  indent: { left: 720 },
                  children: [
                    new TextRun({ text: description, size: 22, font: "Times New Roman" }),
                  ],
                  spacing: { after: 100 },
                })
              );
            }
          } else {
            sections.push(
              new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: "● ", size: 22, font: "Times New Roman" }),
                  new TextRun({ text: note.trim(), bold: true, size: 22, font: "Times New Roman" }),
                ],
                spacing: { before: 150, after: 100 },
              })
            );
          }
        });
      }
    }
    
    return sections;
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 12, color: primaryColor },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Date: ", bold: true, smallCaps: true, size: 20, font: "Times New Roman" }),
                          new TextRun({ text: data.date, size: 20, font: "Times New Roman" }),
                        ],
                        spacing: { before: 100, after: 100 },
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 12, color: primaryColor },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Location: ", bold: true, smallCaps: true, size: 20, font: "Times New Roman" }),
                          new TextRun({ text: data.location || "N/A", size: 20, font: "Times New Roman" }),
                        ],
                        spacing: { before: 100, after: 100 },
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 12, color: primaryColor },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Subject: ", bold: true, smallCaps: true, size: 20, font: "Times New Roman" }),
                          new TextRun({ text: data.title, size: 20, font: "Times New Roman" }),
                        ],
                        spacing: { before: 100, after: 100 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 200 } }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: lineColor },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Attendees:",
                            bold: true,
                            smallCaps: true,
                            size: 20,
                            color: primaryColor,
                            font: "Times New Roman",
                          }),
                        ],
                        spacing: { before: 100, after: 50 },
                      }),
                      ...data.attendees.slice(0, Math.ceil(data.attendees.length / 2)).map(attendee =>
                        new Paragraph({
                          children: [new TextRun({ text: attendee, size: 20, font: "Times New Roman" })],
                          spacing: { after: 30 },
                        })
                      ),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: lineColor },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "", size: 20 })],
                        spacing: { before: 100, after: 50 },
                      }),
                      ...data.attendees.slice(Math.ceil(data.attendees.length / 2)).map(attendee =>
                        new Paragraph({
                          children: [new TextRun({ text: attendee, size: 20, font: "Times New Roman" })],
                          spacing: { after: 30 },
                        })
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 300 } }),

          ...topicSections,

          ...(data.decisions?.trim() ? [
            new Paragraph({
              border: {
                bottom: { color: lineColor, style: BorderStyle.SINGLE, size: 6 },
              },
              children: [
                new TextRun({
                  text: "DECISIONS",
                  bold: true,
                  size: 22,
                  color: primaryColor,
                  smallCaps: true,
                  font: "Times New Roman",
                }),
              ],
              spacing: { before: 400, after: 200 },
            }),
            ...data.decisions.split('\n').filter(d => d.trim()).map(decision => 
              new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: "● ", size: 22, font: "Times New Roman" }),
                  new TextRun({ text: decision.trim(), size: 22, font: "Times New Roman" }),
                ],
                spacing: { after: 80 },
              })
            ),
          ] : []),

          new Paragraph({
            border: {
              bottom: { color: primaryColor, style: BorderStyle.SINGLE, size: 12 },
            },
            spacing: { before: 400 },
            children: [],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

export async function downloadMeetingProtocol(data: MeetingProtocolData): Promise<void> {
  const blob = await generateMeetingProtocolDocx(data);
  const filename = `${data.date}_MoM_${data.title.replace(/\s+/g, "_")}.docx`;
  saveAs(blob, filename);
}
