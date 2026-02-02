import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useExport } from "@/hooks/useExport";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { supabase } from "@/integrations/supabase/client";
import { ExportMenu } from "@/components/export/ExportMenu";
import { ExpenseNotesDialog } from "@/components/opex/ExpenseNotesDialog";
import { OpexOverviewChart } from "@/components/opex/OpexOverviewChart";
import {
  Receipt,
  Plus,
  Filter,
  Download,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  MoreHorizontal,
  FileText,
  Eye,
  ChevronRight,
  Loader2,
  Trash2,
  MessageSquare,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  country: string | null;
  budget_annual: number;
  budget_used: number;
}

interface OpexExpense {
  id: string;
  expense_number: string;
  title: string;
  description: string | null;
  cost_center_id: string;
  amount: number;
  currency: string;
  expense_date: string;
  status: string;
  submitted_at: string;
  category?: string;
  cost_center?: CostCenter;
}

export default function Opex() {
  const { user, profile, hasAnyRole } = useAuth();
  const { permissions, isLoading: permissionsLoading } = useOrganizationPermissions();
  const isGatewayUser = permissions.isGateway;
  const { logAction } = useAuditLog();
  const { isExporting, exportToCSV, exportToExcel, exportToPDF } = useExport();
  const [expenses, setExpenses] = useState<OpexExpense[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedExpenseForNotes, setSelectedExpenseForNotes] = useState<OpexExpense | null>(null);

  // Expense categories without emojis
  const expenseCategories = [
    { value: "salaries", label: "Salaries & Wages" },
    { value: "rent", label: "Rent & Lease" },
    { value: "insurance", label: "Insurance" },
    { value: "transportation", label: "Transportation" },
    { value: "it", label: "IT & Technology" },
    { value: "utilities", label: "Utilities" },
    { value: "maintenance", label: "Maintenance" },
    { value: "marketing", label: "Marketing & Ads" },
    { value: "training", label: "Training & Education" },
    { value: "office", label: "Office Supplies" },
    { value: "communication", label: "Communication" },
    { value: "other", label: "Other" },
  ];

  // Form state for bulk entry
  const [formData, setFormData] = useState({
    cost_center_id: "",
    currency: "CHF",
    period: new Date().toISOString().slice(0, 7), // YYYY-MM format
    description: "",
    expenses: Object.fromEntries(expenseCategories.map(c => [c.value, ""])) as Record<string, string>,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = hasAnyRole(["finance", "management"]);

  useEffect(() => {
    if (!user || permissionsLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, permissionsLoading, permissions.orgType]);

  const getCostCenterDisplayCode = (code?: string) => {
    if (!code) return "N/A";
    if (isGatewayUser && (code.startsWith("MGIM") || code.startsWith("MGIC"))) {
      return code.replace(/^MGIM/, "MGI").replace(/^MGIC/, "MGI");
    }
    return code;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch expenses
      const { data: expensesData } = await supabase
        .from("opex_expenses")
        .select("*, cost_center:cost_centers(*)")
        .order("submitted_at", { ascending: false });

      if (expensesData) {
        setExpenses(expensesData as unknown as OpexExpense[]);
      }

      // Fetch cost centers
      const { data: costCentersData } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("is_active", true);

      if (costCentersData) {
        // Filter cost centers based on user's organization - only Allgemein
        let filtered = costCentersData as CostCenter[];
        if (permissions.orgType === "mgi_media") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("MGIM") && cc.name.toLowerCase().includes("allgemein")
          );
        } else if (permissions.orgType === "mgi_communications") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("MGIC") && cc.name.toLowerCase().includes("allgemein")
          );
        } else if (permissions.orgType === "gateway") {
          filtered = filtered.filter(
            (cc) => cc.code.startsWith("GW") && cc.name.toLowerCase().includes("allgemein")
          );
        }
        setCostCenters(filtered);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get or create OPEX folder in document explorer
  const getOrCreateOpexFolder = async (): Promise<string | null> => {
    if (!user) return null;
    
    // Check if OPEX folder exists
    const { data: existingFolder } = await supabase
      .from("document_folders")
      .select("id")
      .eq("name", "OPEX")
      .maybeSingle();
    
    if (existingFolder) {
      return existingFolder.id;
    }
    
    // Create OPEX folder
    const { data: newFolder, error } = await supabase
      .from("document_folders")
      .insert({
        name: "OPEX",
        created_by: user.id,
        color: "#c9a227",
        icon: "receipt",
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("Error creating OPEX folder:", error);
      return null;
    }
    
    return newFolder.id;
  };

  // Save OPEX document to explorer as DOCX
  const saveOpexToExplorer = async (
    submittedExpenses: { category: string; label: string; amount: number }[],
    costCenter: CostCenter | undefined,
    total: number,
    expenseNumbers: string[]
  ) => {
    if (!user) return;

    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = await import("docx");

      const selectedPeriod = formData.period;
      const periodDate = new Date(selectedPeriod + "-01");
      const monthName = periodDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      const fileName = `OPEX_${costCenter?.code || "NA"}_${selectedPeriod}.docx`;

      // Create table rows for expenses
      const expenseRows = submittedExpenses.map(exp => 
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: exp.label })] })],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ 
                children: [new TextRun({ text: formatCurrency(exp.amount, formData.currency) })],
                alignment: AlignmentType.RIGHT,
              })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      );

      // Add total row
      const totalRow = new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Gesamt", bold: true })],
            })],
            shading: { fill: "C9A227" },
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: formatCurrency(total, formData.currency), bold: true })],
              alignment: AlignmentType.RIGHT,
            })],
            shading: { fill: "C9A227" },
          }),
        ],
      });

      // Create the document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: "OPEX Report", bold: true, size: 48 })],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [new TextRun({ text: monthName, size: 28, color: "666666" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Kostenstelle: ", bold: true }),
                new TextRun({ text: `${costCenter?.code || "N/A"} - ${costCenter?.name || "N/A"}` }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Land: ", bold: true }),
                new TextRun({ text: costCenter?.country || "N/A" }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Währung: ", bold: true }),
                new TextRun({ text: formData.currency }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Erstellt am: ", bold: true }),
                new TextRun({ text: new Date().toLocaleDateString("de-DE") }),
              ],
              spacing: { after: 300 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: "Kategorie", bold: true, color: "FFFFFF" })],
                      })],
                      shading: { fill: "1A1A2E" },
                    }),
                    new TableCell({
                      children: [new Paragraph({ 
                        children: [new TextRun({ text: "Betrag", bold: true, color: "FFFFFF" })],
                        alignment: AlignmentType.RIGHT,
                      })],
                      shading: { fill: "1A1A2E" },
                    }),
                  ],
                }),
                ...expenseRows,
                totalRow,
              ],
            }),
            ...(formData.description ? [
              new Paragraph({
                children: [
                  new TextRun({ text: "Notizen: ", bold: true }),
                  new TextRun({ text: formData.description }),
                ],
                spacing: { before: 300 },
              }),
            ] : []),
            new Paragraph({
              children: [
                new TextRun({ text: "Ausgabennummern: ", bold: true }),
                new TextRun({ text: expenseNumbers.join(", ") }),
              ],
              spacing: { before: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Automatisch generiert am ${new Date().toLocaleString("de-DE")}`, size: 20, color: "999999" })],
              spacing: { before: 400 },
              alignment: AlignmentType.CENTER,
            }),
          ],
        }],
      });

      // Generate blob
      const blob = await Packer.toBlob(doc);
      const filePath = `${user.id}/opex/${Date.now()}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, blob, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      
      if (uploadError) {
        console.error("Error uploading OPEX document:", uploadError);
        return;
      }

      // Get or create OPEX folder
      const folderId = await getOrCreateOpexFolder();

      // Create document entry
      const { error: docError } = await supabase
        .from("documents")
        .insert({
          name: `OPEX Report ${monthName} - ${costCenter?.name || ""}`,
          type: "report",
          file_path: filePath,
          file_size: blob.size,
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          uploaded_by: user.id,
          organization_id: profile?.organization_id || null,
          folder_id: folderId,
          description: `OPEX Ausgaben für ${monthName}. Kostenstelle: ${costCenter?.code}. Gesamt: ${formatCurrency(total, formData.currency)}`,
        });

      if (docError) {
        console.error("Error creating document entry:", docError);
      }
    } catch (error) {
      console.error("Error generating OPEX document:", error);
    }
  };

  const generatePDF = (submittedExpenses: { category: string; label: string; amount: number }[], costCenter: CostCenter | undefined, total: number) => {
    const selectedPeriod = formData.period;
    const periodDate = new Date(selectedPeriod + "-01");
    const monthName = periodDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OPEX Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a227; padding-bottom: 20px; }
          .header h1 { color: #1a1a2e; margin: 0; }
          .header p { color: #666; margin: 10px 0 0; }
          .info { margin-bottom: 30px; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .info-label { color: #666; }
          .info-value { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #1a1a2e; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #f9f9f9; }
          .total { background: #c9a227 !important; color: white; font-weight: bold; }
          .amount { text-align: right; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>OPEX Report</h1>
          <p>${monthName}</p>
        </div>
        <div class="info">
          <div class="info-row">
            <span class="info-label">Cost Center:</span>
            <span class="info-value">${costCenter?.code || "N/A"} - ${costCenter?.name || "N/A"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Country:</span>
            <span class="info-value">${costCenter?.country || "N/A"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Currency:</span>
            <span class="info-value">${formData.currency}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created on:</span>
            <span class="info-value">${new Date().toLocaleDateString("en-US")}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${submittedExpenses.map(exp => `
              <tr>
                <td>${exp.label}</td>
                <td class="amount">${formatCurrency(exp.amount, formData.currency)}</td>
              </tr>
            `).join("")}
            <tr class="total">
              <td>Total</td>
              <td class="amount">${formatCurrency(total, formData.currency)}</td>
            </tr>
          </tbody>
        </table>
        ${formData.description ? `<p><strong>Notes:</strong> ${formData.description}</p>` : ""}
        <div class="footer">
          <p>Automatically generated on ${new Date().toLocaleString("en-US")}</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Get all non-empty expenses
    const nonEmptyExpenses = expenseCategories
      .filter(cat => formData.expenses[cat.value] && parseFloat(formData.expenses[cat.value]) > 0)
      .map(cat => ({
        category: cat.value,
        label: cat.label,
        amount: parseFloat(formData.expenses[cat.value])
      }));

    if (nonEmptyExpenses.length === 0) {
      alert("Please enter at least one amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      // For Gateway users, expenses are auto-approved
      const expenseStatus = isGatewayUser ? "approved_finance" : "pending";
      const approvalFields = isGatewayUser ? {
        finance_approver_id: user.id,
        finance_approved_at: new Date().toISOString(),
      } : {};

      // Insert all expenses
      const insertPromises = nonEmptyExpenses.map(exp => 
        supabase
          .from("opex_expenses")
          .insert({
            title: `${exp.label} - ${formData.period}`,
            description: formData.description || null,
            cost_center_id: formData.cost_center_id,
            category: exp.category,
            amount: exp.amount,
            currency: formData.currency,
            submitted_by: user.id,
            expense_number: "",
            status: expenseStatus,
            ...approvalFields,
          })
          .select()
          .single()
      );

      const results = await Promise.all(insertPromises);
      
      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error("Error saving some expenses");
      }

      // Collect expense numbers and log all created expenses
      const expenseNumbers: string[] = [];
      for (const result of results) {
        if (result.data) {
          await logAction("CREATE", "opex_expenses", result.data.id);
          if (result.data.expense_number) {
            expenseNumbers.push(result.data.expense_number);
          }
        }
      }

      // Calculate total
      const total = nonEmptyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const costCenter = costCenters.find(cc => cc.id === formData.cost_center_id);

      // Save document to explorer
      await saveOpexToExplorer(nonEmptyExpenses, costCenter, total, expenseNumbers);

      // Generate PDF for printing
      generatePDF(nonEmptyExpenses, costCenter, total);

      // Reset form
      setFormData({
        cost_center_id: "",
        currency: "CHF",
        period: new Date().toISOString().slice(0, 7),
        description: "",
        expenses: Object.fromEntries(expenseCategories.map(c => [c.value, ""])),
      });
      setSelectedFile(null);
      setShowNewExpense(false);
      fetchData();
    } catch (error) {
      console.error("Error submitting expenses:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (expenseId: string, stage: "supervisor" | "finance") => {
    if (!user) return;

    try {
      const updateData = stage === "supervisor" 
        ? {
            status: "approved_supervisor" as const,
            supervisor_id: user.id,
            supervisor_approved_at: new Date().toISOString(),
          }
        : {
            status: "approved_finance" as const,
            finance_approver_id: user.id,
            finance_approved_at: new Date().toISOString(),
          };

      await supabase
        .from("opex_expenses")
        .update(updateData)
        .eq("id", expenseId);

      await logAction("APPROVE", "opex_expenses", expenseId, null, updateData);
      fetchData();
    } catch (error) {
      console.error("Error approving expense:", error);
    }
  };

  const handleReject = async (expenseId: string, reason: string) => {
    if (!user) return;

    try {
      await supabase
        .from("opex_expenses")
        .update({
          status: "rejected",
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", expenseId);

      await logAction("REJECT", "opex_expenses", expenseId);
      fetchData();
    } catch (error) {
      console.error("Error rejecting expense:", error);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("opex_expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;

      await logAction("DELETE", "opex_expenses", expenseId);
      setDeleteExpenseId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting expense:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-warning">
            <Clock size={12} />
            Pending
          </span>
        );
      case "approved_supervisor":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-info">
            <CheckCircle size={12} />
            Supervisor OK
          </span>
        );
      case "approved_finance":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-success">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded status-critical">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculate totals
  const totalPending = expenses
    .filter((e) => e.status === "pending" || e.status === "approved_supervisor")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses
    .filter((e) => e.status === "approved_finance")
    .reduce((sum, e) => sum + e.amount, 0);

  if (isLoading) {
    return (
      <Layout title="OPEX" subtitle="Operating Expenses Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="OPEX" subtitle="Operating Expenses Management">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground hover:bg-muted/80 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <select className="px-4 py-2 bg-muted rounded-lg text-sm font-medium text-foreground border-0 focus:ring-2 focus:ring-accent">
            <option>All Status</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu
            onExportCSV={() => exportToCSV(
              expenses.map(e => ({
                expense_number: e.expense_number,
                title: e.title,
                cost_center: e.cost_center?.code || "N/A",
                amount: e.amount,
                currency: e.currency,
                status: e.status,
                date: formatDate(e.submitted_at),
              })),
              [
                { key: "expense_number", label: "Nr." },
                { key: "title", label: "Titel" },
                { key: "cost_center", label: "Kostenstelle" },
                { key: "amount", label: "Betrag" },
                { key: "currency", label: "Währung" },
                { key: "status", label: "Status" },
                { key: "date", label: "Datum" },
              ],
              { filename: "opex-export", title: "OPEX Ausgaben" }
            )}
            onExportExcel={() => exportToExcel(
              expenses.map(e => ({
                expense_number: e.expense_number,
                title: e.title,
                cost_center: e.cost_center?.code || "N/A",
                amount: e.amount,
                currency: e.currency,
                status: e.status,
                date: formatDate(e.submitted_at),
              })),
              [
                { key: "expense_number", label: "Nr." },
                { key: "title", label: "Titel" },
                { key: "cost_center", label: "Kostenstelle" },
                { key: "amount", label: "Betrag" },
                { key: "currency", label: "Währung" },
                { key: "status", label: "Status" },
                { key: "date", label: "Datum" },
              ],
              { filename: "opex-export", title: "OPEX Ausgaben" }
            )}
            onExportPDF={() => exportToPDF(
              expenses.map(e => ({
                expense_number: e.expense_number,
                title: e.title,
                cost_center: e.cost_center?.code || "N/A",
                amount: formatCurrency(e.amount, e.currency),
                status: e.status,
                date: formatDate(e.submitted_at),
              })),
              [
                { key: "expense_number", label: "Nr." },
                { key: "title", label: "Titel" },
                { key: "cost_center", label: "Kostenstelle" },
                { key: "amount", label: "Betrag" },
                { key: "status", label: "Status" },
                { key: "date", label: "Datum" },
              ],
              { filename: "opex-export", title: "OPEX Ausgaben", subtitle: `Stand: ${new Date().toLocaleDateString("de-DE")}` }
            )}
            isExporting={isExporting}
            disabled={expenses.length === 0}
          />
          <button
            onClick={() => setShowNewExpense(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2 glow-gold"
          >
            <Plus size={16} />
            New Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Pending"
          value={formatCurrency(totalPending)}
          changeLabel={`${expenses.filter((e) => e.status === "pending").length} requests`}
          icon={<Clock size={20} className="text-warning" />}
          variant="warning"
        />
        <MetricCard
          title="Approved (Month)"
          value={formatCurrency(totalApproved)}
          changeLabel={`${expenses.filter((e) => e.status === "approved_finance").length} expenses`}
          icon={<CheckCircle size={20} className="text-success" />}
          variant="success"
        />
        <MetricCard
          title="Organizations"
          value={isGatewayUser ? "2" : "3"}
          changeLabel="Active organizations"
          icon={<Receipt size={20} className="text-muted-foreground" />}
        />
        <MetricCard
          title="Budget Used"
          value="68%"
          changeLabel="YTD"
          icon={<Receipt size={20} className="text-accent" />}
          variant="accent"
        />
      </div>

      {/* Organization Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(() => {
          // Aggregate cost centers by organization
          const orgData = [
            {
              id: 'mgi-media',
              name: 'MGI Media',
              code: 'MGI M',
              color: 'text-blue-500',
            },
            {
              id: 'mgi-communications',
              name: 'MGI Communications',
              code: 'MGI C',
              color: 'text-purple-500',
            },
            {
              id: 'gateway',
              name: 'Gateway',
              code: 'GW',
              color: 'text-accent',
            },
          ];

          // Check if current user is from Gateway (should see combined MGI view)
          // Using state variable set from organization type

          const displayOrgs = isGatewayUser
            ? [
                {
                  id: 'mgi-combined',
                  name: 'MGI',
                  code: 'MGI',
                  color: 'text-blue-500',
                  budgetAnnual: costCenters
                    .filter(cc => cc.code.startsWith('MGIM') || cc.code.startsWith('MGIC'))
                    .reduce((sum, cc) => sum + (cc.budget_annual || 0), 0),
                  budgetUsed: costCenters
                    .filter(cc => cc.code.startsWith('MGIM') || cc.code.startsWith('MGIC'))
                    .reduce((sum, cc) => sum + (cc.budget_used || 0), 0),
                },
                {
                  id: 'gateway',
                  name: 'Gateway',
                  code: 'GW',
                  color: 'text-accent',
                  budgetAnnual: costCenters
                    .filter(cc => cc.code.startsWith('GW'))
                    .reduce((sum, cc) => sum + (cc.budget_annual || 0), 0),
                  budgetUsed: costCenters
                    .filter(cc => cc.code.startsWith('GW'))
                    .reduce((sum, cc) => sum + (cc.budget_used || 0), 0),
                },
              ]
            : orgData.map(org => {
                const prefix = org.id === 'mgi-media' ? 'MGIM' : org.id === 'mgi-communications' ? 'MGIC' : 'GW';
                const orgCostCenters = costCenters.filter(cc => cc.code.startsWith(prefix));
                return {
                  ...org,
                  budgetAnnual: orgCostCenters.reduce((sum, cc) => sum + (cc.budget_annual || 0), 0),
                  budgetUsed: orgCostCenters.reduce((sum, cc) => sum + (cc.budget_used || 0), 0),
                };
              });

          return displayOrgs.map((org, index) => {
            const usagePercent = org.budgetAnnual > 0
              ? Math.round((org.budgetUsed / org.budgetAnnual) * 100)
              : 0;
            return (
              <div
                key={org.id}
                className="card-state p-4 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="badge-gold">{org.code}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-2">{org.name}</p>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 90
                        ? "bg-destructive"
                        : usagePercent > 70
                        ? "bg-warning"
                        : "bg-success"
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatCurrency(org.budgetUsed)}
                  </span>
                  <span className="text-foreground font-medium">{usagePercent}%</span>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* OPEX Overview Chart */}
      <div className="mb-6">
        <OpexOverviewChart expenses={expenses} expenseCategories={expenseCategories} />
      </div>

      {/* Expenses Table */}
      <div className="card-state">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">OPEX Requests</h3>
          <span className="text-sm text-muted-foreground">
            {expenses.length} expenses
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Expense
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Cost Center
                </th>
                <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr
                  key={expense.id}
                  className="table-row-state animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {expense.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.expense_number} • {formatDate(expense.submitted_at)}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="badge-gold">
                      {getCostCenterDisplayCode(expense.cost_center?.code)}
                    </span>
                  </td>
                  <td className="p-4">{getStatusBadge(expense.status)}</td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      {canApprove && expense.status === "pending" && (
                        <button
                          onClick={() => handleApprove(expense.id, "supervisor")}
                          className="p-2 rounded hover:bg-success/10 text-success transition-colors"
                          title="Approve (Supervisor)"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canApprove && expense.status === "approved_supervisor" && (
                        <button
                          onClick={() => handleApprove(expense.id, "finance")}
                          className="p-2 rounded hover:bg-success/10 text-success transition-colors"
                          title="Approve (Finance)"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {canApprove && (expense.status === "pending" || expense.status === "approved_supervisor") && (
                        <button
                          onClick={() => handleReject(expense.id, "Rejected")}
                          className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                          title="Reject"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setSelectedExpenseForNotes(expense);
                          setNotesDialogOpen(true);
                        }}
                        className="p-2 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                        title="Kommentare"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteExpenseId(expense.id)}
                        className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No OPEX expenses available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Expense Modal */}
      {showNewExpense && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="card-state w-full max-w-3xl p-6 animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              OPEX Submission
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter all monthly operating expenses. A report will be generated after submission.
            </p>
            <form onSubmit={handleSubmitExpense} className="space-y-6">
              {/* Period and Cost Center */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Period *
                  </label>
                  <input
                    type="month"
                    value={formData.period}
                    onChange={(e) =>
                      setFormData({ ...formData, period: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Organization *
                  </label>
                  <select
                    value={formData.cost_center_id}
                    onChange={(e) =>
                      setFormData({ ...formData, cost_center_id: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  >
                    <option value="">Select organization</option>
                    {costCenters.map(cc => {
                      // Determine org label based on cost center code
                      const orgLabel = (cc.code.startsWith('MGIM') || cc.code.startsWith('MGIC'))
                        ? (isGatewayUser ? 'MGI' : (cc.code.startsWith('MGIM') ? 'MGI Media' : 'MGI Communications'))
                        : 'Gateway';
                      return (
                        <option key={cc.id} value={cc.id}>
                          {orgLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="CHF">CHF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="UGX">UGX</option>
                  </select>
                </div>
              </div>

              {/* All expense categories as input fields */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Operating Expenses by Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {expenseCategories.map((cat) => (
                    <div key={cat.value} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                      <span className="text-sm font-medium text-foreground flex-1 min-w-[140px]">
                        {cat.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.expenses[cat.value]}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              expenses: {
                                ...formData.expenses,
                                [cat.value]: e.target.value
                              }
                            })
                          }
                          className="w-32 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="0.00"
                        />
                        <span className="text-xs text-muted-foreground w-10">{formData.currency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/30">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-accent">
                    {formatCurrency(
                      Object.values(formData.expenses).reduce((sum, val) => sum + (parseFloat(val) || 0), 0),
                      formData.currency
                    )}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Notes
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  rows={2}
                  placeholder="Additional notes for this submission..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewExpense(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.cost_center_id}
                  className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <Download size={16} />
                  Submit & Generate Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ausgabe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Ausgabe wird permanent gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseId && handleDelete(deleteExpenseId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes Dialog */}
      {selectedExpenseForNotes && (
        <ExpenseNotesDialog
          open={notesDialogOpen}
          onOpenChange={(open) => {
            setNotesDialogOpen(open);
            if (!open) setSelectedExpenseForNotes(null);
          }}
          expenseId={selectedExpenseForNotes.id}
          expenseTitle={selectedExpenseForNotes.title}
        />
      )}
    </Layout>
  );
}
