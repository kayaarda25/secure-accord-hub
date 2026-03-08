import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  TabStopPosition,
  TabStopType,
} from "docx";
import { saveAs } from "file-saver";

/* ─── Types ─── */
export interface PayslipData {
  companyName: string;
  companyAddress: string;
  employeeName: string;
  employeeAddress: string;
  ahvNumber: string;
  birthDate: string;
  maritalStatus: string;
  childrenCount: number;
  position: string;
  employmentType: string;
  employmentStart: string;
  month: number;
  year: number;
  grossSalary: number;
  ahvIvEoEmployee: number;
  ahvIvEoEmployer: number;
  alvEmployee: number;
  alvEmployer: number;
  bvgEmployee: number;
  bvgEmployer: number;
  uvgNbu: number;
  uvgBu: number;
  ktg: number;
  bankIban?: string;
}

export interface LohnausweisData extends PayslipData {
  monthsWorked: number;
  yearlyGross: number;
  yearlyAhv: number;
  yearlyAlv: number;
  yearlyBvg: number;
  yearlyUvg: number;
  yearlyKtg: number;
  yearlyNet: number;
}

/* ─── Helpers ─── */
const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const chf = (v: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(v);

const maritalLabels: Record<string, string> = {
  single: "Ledig",
  married: "Verheiratet",
  divorced: "Geschieden",
  widowed: "Verwitwet",
  separated: "Getrennt",
  registered_partnership: "Eingetragene Partnerschaft",
};

const employmentLabels: Record<string, string> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  temporary: "Temporär",
  intern: "Praktikum",
  freelance: "Freelance",
};

function noBorder() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function thinBorder() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  return { top: b, bottom: b, left: b, right: b };
}

function headerCell(text: string, width?: number) {
  return new TableCell({
    borders: thinBorder(),
    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, font: "Arial" })],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function valueCell(text: string, align: AlignmentType = AlignmentType.LEFT, width?: number) {
  return new TableCell({
    borders: thinBorder(),
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 18, font: "Arial" })],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function infoRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders: noBorder(),
        width: { size: 3400, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, size: 18, font: "Arial", color: "666666" })],
            spacing: { before: 20, after: 20 },
          }),
        ],
      }),
      new TableCell({
        borders: noBorder(),
        children: [
          new Paragraph({
            children: [new TextRun({ text: value, size: 18, font: "Arial" })],
            spacing: { before: 20, after: 20 },
          }),
        ],
      }),
    ],
  });
}

/* ─── Lohnabrechnung (Monthly Payslip) ─── */
export async function generatePayslip(data: PayslipData): Promise<void> {
  const employeeDeductions = data.ahvIvEoEmployee + data.alvEmployee + data.bvgEmployee + data.uvgNbu;
  const employerCosts = data.ahvIvEoEmployer + data.alvEmployer + data.bvgEmployer + data.uvgBu + data.ktg;
  const netSalary = data.grossSalary - employeeDeductions;

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 800, left: 1200, right: 1200 },
          },
        },
        children: [
          // Company header
          new Paragraph({
            children: [new TextRun({ text: data.companyName, bold: true, size: 28, font: "Arial" })],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: data.companyAddress, size: 16, font: "Arial", color: "666666" })],
            spacing: { after: 300 },
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `LOHNABRECHNUNG`,
                bold: true,
                size: 32,
                font: "Arial",
              }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${monthNames[data.month - 1]} ${data.year}`,
                size: 24,
                font: "Arial",
                color: "444444",
              }),
            ],
            spacing: { after: 300 },
          }),

          // Employee info table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow("Mitarbeiter:", data.employeeName),
              infoRow("Adresse:", data.employeeAddress || "—"),
              infoRow("AHV-Nr.:", data.ahvNumber || "—"),
              infoRow("Geburtsdatum:", data.birthDate || "—"),
              infoRow("Zivilstand:", maritalLabels[data.maritalStatus] || data.maritalStatus || "—"),
              infoRow("Kinder:", String(data.childrenCount)),
              infoRow("Position:", data.position || "—"),
              infoRow("Beschäftigung:", employmentLabels[data.employmentType] || data.employmentType || "—"),
              infoRow("Eintritt:", data.employmentStart || "—"),
            ],
          }),

          new Paragraph({ spacing: { before: 300, after: 100 } }),

          // Salary table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header
              new TableRow({
                children: [
                  headerCell("Bezeichnung", 5500),
                  headerCell("Betrag", 2500),
                ],
              }),
              // Gross salary
              new TableRow({
                children: [
                  valueCell("Bruttolohn"),
                  valueCell(chf(data.grossSalary), AlignmentType.RIGHT),
                ],
              }),
              // Separator
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    columnSpan: 2,
                    shading: { type: ShadingType.SOLID, color: "F8F8F8" },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Abzüge Arbeitnehmer", bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
              // Deductions
              new TableRow({
                children: [
                  valueCell("AHV/IV/EO (5.3%)"),
                  valueCell(`-${chf(data.ahvIvEoEmployee)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("ALV (1.1%)"),
                  valueCell(`-${chf(data.alvEmployee)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("BVG Arbeitnehmer"),
                  valueCell(`-${chf(data.bvgEmployee)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("UVG/NBU"),
                  valueCell(`-${chf(data.uvgNbu)}`, AlignmentType.RIGHT),
                ],
              }),
              // Total deductions
              new TableRow({
                children: [
                  headerCell("Total Abzüge"),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: `-${chf(employeeDeductions)}`, bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
              // Net salary
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "E8F5E9" },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "NETTOLOHN", bold: true, size: 20, font: "Arial" })],
                        spacing: { before: 60, after: 60 },
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "E8F5E9" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: chf(netSalary), bold: true, size: 22, font: "Arial" })],
                        spacing: { before: 60, after: 60 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // Employer costs section
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    columnSpan: 2,
                    shading: { type: ShadingType.SOLID, color: "F8F8F8" },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Arbeitgeberbeiträge (informativ)", bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("AHV/IV/EO Arbeitgeber (5.3%)", AlignmentType.LEFT, 5500),
                  valueCell(chf(data.ahvIvEoEmployer), AlignmentType.RIGHT, 2500),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("ALV Arbeitgeber (1.1%)"),
                  valueCell(chf(data.alvEmployer), AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("BVG Arbeitgeber"),
                  valueCell(chf(data.bvgEmployer), AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("UVG/BU"),
                  valueCell(chf(data.uvgBu), AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("KTG (100% AG)"),
                  valueCell(chf(data.ktg), AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  headerCell("Total AG-Beiträge"),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: chf(employerCosts), bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // Payment info
          ...(data.bankIban
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Auszahlung auf: ", size: 18, font: "Arial", color: "666666" }),
                    new TextRun({ text: data.bankIban, size: 18, font: "Arial" }),
                  ],
                  spacing: { before: 100 },
                }),
              ]
            : []),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `Erstellt am ${new Date().toLocaleDateString("de-CH")} – Dieses Dokument wurde elektronisch erstellt und ist ohne Unterschrift gültig.`,
                size: 14,
                font: "Arial",
                color: "999999",
                italics: true,
              }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Lohnabrechnung_${data.employeeName.replace(/\s+/g, "_")}_${monthNames[data.month - 1]}_${data.year}.docx`);
}

/* ─── Lohnausweis (Annual Salary Certificate) ─── */
export async function generateLohnausweis(data: LohnausweisData): Promise<void> {
  const yearlyEmployeeDeductions = data.yearlyAhv + data.yearlyAlv + data.yearlyBvg + data.yearlyUvg;

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 800, left: 1200, right: 1200 },
          },
        },
        children: [
          // Company header
          new Paragraph({
            children: [new TextRun({ text: data.companyName, bold: true, size: 28, font: "Arial" })],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: data.companyAddress, size: 16, font: "Arial", color: "666666" })],
            spacing: { after: 300 },
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "LOHNAUSWEIS",
                bold: true,
                size: 36,
                font: "Arial",
              }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Steuerjahr ${data.year}`,
                size: 24,
                font: "Arial",
                color: "444444",
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "(gemäss Wegleitung zum Ausfüllen des Lohnausweises / der Rentenbescheinigung)",
                size: 16,
                font: "Arial",
                color: "888888",
                italics: true,
              }),
            ],
            spacing: { after: 300 },
          }),

          // Employee info
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoRow("AHV-Nr.:", data.ahvNumber || "—"),
              infoRow("Name, Vorname:", data.employeeName),
              infoRow("Geburtsdatum:", data.birthDate || "—"),
              infoRow("Adresse:", data.employeeAddress || "—"),
              infoRow("Eintritt:", data.employmentStart || "—"),
              infoRow("Beschäftigungsgrad:", employmentLabels[data.employmentType] || "—"),
            ],
          }),

          new Paragraph({ spacing: { before: 300, after: 100 } }),

          // Salary overview table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell("Ziffer"),
                  headerCell("Bezeichnung"),
                  headerCell("Betrag CHF"),
                ],
              }),
              // Section 1 – Lohn
              new TableRow({
                children: [
                  valueCell("1."),
                  valueCell("Bruttolohn (inkl. Zulagen)"),
                  valueCell(chf(data.yearlyGross), AlignmentType.RIGHT),
                ],
              }),
              // Section 2 – Gehaltsnebenleistungen
              new TableRow({
                children: [
                  valueCell("2."),
                  valueCell("Gehaltsnebenleistungen"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 3 – Unregelmässige Leistungen
              new TableRow({
                children: [
                  valueCell("3."),
                  valueCell("Unregelmässige Leistungen"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 4 – Kapitalleistungen
              new TableRow({
                children: [
                  valueCell("4."),
                  valueCell("Kapitalleistungen"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 5 – Beteiligungsrechte
              new TableRow({
                children: [
                  valueCell("5."),
                  valueCell("Beteiligungsrechte (Art. 17a-d DBG)"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 6 – Verwaltungsratsentschädigung
              new TableRow({
                children: [
                  valueCell("6."),
                  valueCell("Verwaltungsratsentschädigungen"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 7 – Andere Leistungen
              new TableRow({
                children: [
                  valueCell("7."),
                  valueCell("Andere Leistungen"),
                  valueCell(chf(0), AlignmentType.RIGHT),
                ],
              }),
              // Section 8 – Brutto total
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
                    children: [new Paragraph({ children: [new TextRun({ text: "8.", bold: true, size: 18, font: "Arial" })], spacing: { before: 40, after: 40 } })],
                  }),
                  headerCell("Bruttolohn total"),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: chf(data.yearlyGross), bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // Deductions
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    columnSpan: 2,
                    shading: { type: ShadingType.SOLID, color: "F8F8F8" },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Beiträge des Arbeitnehmers (Abzüge)", bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("AHV/IV/EO-Beiträge", AlignmentType.LEFT, 5500),
                  valueCell(`-${chf(data.yearlyAhv)}`, AlignmentType.RIGHT, 2500),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("ALV-Beiträge"),
                  valueCell(`-${chf(data.yearlyAlv)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("BVG-Beiträge (2. Säule)"),
                  valueCell(`-${chf(data.yearlyBvg)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  valueCell("UVG/NBU-Beiträge"),
                  valueCell(`-${chf(data.yearlyUvg)}`, AlignmentType.RIGHT),
                ],
              }),
              new TableRow({
                children: [
                  headerCell("Total Abzüge"),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "F0F0F0" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: `-${chf(yearlyEmployeeDeductions)}`, bold: true, size: 18, font: "Arial" })],
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                  }),
                ],
              }),
              // Net
              new TableRow({
                children: [
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "E8F5E9" },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Nettolohn (Ziffer 11)", bold: true, size: 20, font: "Arial" })],
                        spacing: { before: 60, after: 60 },
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: thinBorder(),
                    shading: { type: ShadingType.SOLID, color: "E8F5E9" },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: chf(data.yearlyNet), bold: true, size: 22, font: "Arial" })],
                        spacing: { before: 60, after: 60 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 300 } }),

          // Certification
          new Paragraph({
            children: [
              new TextRun({ text: "Bescheinigung des Arbeitgebers", bold: true, size: 20, font: "Arial" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Wir bestätigen, dass die vorstehenden Angaben mit unseren Unterlagen übereinstimmen und nach bestem Wissen und Gewissen erstellt wurden.",
                size: 18,
                font: "Arial",
              }),
            ],
            spacing: { after: 200 },
          }),

          // Signature lines
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: noBorder(),
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ spacing: { before: 600 } }),
                      new Paragraph({
                        children: [new TextRun({ text: "____________________________", size: 18, font: "Arial" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: "Ort, Datum", size: 16, font: "Arial", color: "666666" })],
                        spacing: { before: 40 },
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: noBorder(),
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ spacing: { before: 600 } }),
                      new Paragraph({
                        children: [new TextRun({ text: "____________________________", size: 18, font: "Arial" })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: "Unterschrift Arbeitgeber", size: 16, font: "Arial", color: "666666" })],
                        spacing: { before: 40 },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `Erstellt am ${new Date().toLocaleDateString("de-CH")} – ${data.companyName}`,
                size: 14,
                font: "Arial",
                color: "999999",
                italics: true,
              }),
            ],
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Lohnausweis_${data.employeeName.replace(/\s+/g, "_")}_${data.year}.docx`);
}
