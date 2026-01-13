import { useState } from "react";

interface ExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = <T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; label: string }[],
    options: ExportOptions
  ) => {
    setIsExporting(true);
    try {
      const headers = columns.map((col) => col.label).join(",");
      const rows = data.map((row) =>
        columns
          .map((col) => {
            const value = row[col.key];
            // Escape commas and quotes in values
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? "";
          })
          .join(",")
      );

      const csv = [headers, ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${options.filename}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = <T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; label: string }[],
    options: ExportOptions
  ) => {
    setIsExporting(true);
    try {
      // Create XML-based Excel format
      const headers = columns.map((col) => `<th>${escapeXml(col.label)}</th>`).join("");
      const rows = data
        .map(
          (row) =>
            "<tr>" +
            columns
              .map((col) => {
                const value = row[col.key];
                return `<td>${escapeXml(String(value ?? ""))}</td>`;
              })
              .join("") +
            "</tr>"
        )
        .join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
          <Styles>
            <Style ss:ID="Header">
              <Font ss:Bold="1"/>
              <Interior ss:Color="#C9A227" ss:Pattern="Solid"/>
            </Style>
          </Styles>
          <Worksheet ss:Name="${escapeXml(options.title || "Data")}">
            <Table>
              <Row ss:StyleID="Header">${headers}</Row>
              ${rows}
            </Table>
          </Worksheet>
        </Workbook>`;

      const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
      downloadBlob(blob, `${options.filename}.xls`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = <T extends Record<string, unknown>>(
    data: T[],
    columns: { key: keyof T; label: string }[],
    options: ExportOptions
  ) => {
    setIsExporting(true);
    try {
      const headers = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");
      const rows = data
        .map(
          (row) =>
            "<tr>" +
            columns
              .map((col) => {
                const value = row[col.key];
                return `<td>${escapeHtml(String(value ?? ""))}</td>`;
              })
              .join("") +
            "</tr>"
        )
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(options.title || options.filename)}</title>
          <style>
            @page { margin: 1cm; }
            body { font-family: Arial, sans-serif; color: #333; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #c9a227; padding-bottom: 15px; }
            .header h1 { color: #1a1a2e; margin: 0 0 5px; font-size: 24px; }
            .header p { color: #666; margin: 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
            td { padding: 8px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) { background: #f9f9f9; }
            .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${escapeHtml(options.title || options.filename)}</h1>
            ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ""}
          </div>
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="footer">
            <p>Erstellt am ${new Date().toLocaleString("de-DE")}</p>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportToCSV,
    exportToExcel,
    exportToPDF,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
