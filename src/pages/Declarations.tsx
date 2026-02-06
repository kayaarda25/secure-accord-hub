import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DeclarationForm } from "@/components/declarations/DeclarationForm";
import {
  FileText,
  Plus,
  Download,
  Filter,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Inbox,
  Loader2,
} from "lucide-react";

// Telecom providers list
const TELECOM_PROVIDERS = [
  "Movicel",
  "Angola Telecom",
  "Unitel",
  "Africell",
  "SARA3COM",
  "Multitel",
  "Tchoca",
  "MS Telecom",
];

interface Declaration {
  id: string;
  declaration_number: string;
  country: string;
  declaration_type: string;
  period_start: string;
  period_end: string;
  status: string;
  total_mgi_balance: number;
  total_gia_balance: number;
  margin_held: number;
  submitted_at: string;
  submitted_by: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: FileText },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: AlertCircle },
};

export default function Declarations() {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const { permissions, isLoading: permissionsLoading } = useOrganizationPermissions();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDeclarations();
  }, []);

  const fetchDeclarations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("declarations")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setDeclarations(data || []);
    } catch (error) {
      console.error("Error fetching declarations:", error);
      toast.error("Failed to load declarations");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/,/g, "'");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const parseNumber = (str: string): number => {
    if (!str) return 0;
    return parseFloat(str.replace(/[^0-9.-]/g, "")) || 0;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace(/,/g, "'");
  };

  const handleFormSubmit = async (formData: any, totals: any) => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!formData.periodStart || !formData.periodEnd) {
      toast.error("Please select a period");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const insertData = {
        country: formData.country,
        declaration_type: formData.declarationType,
        period_start: formData.periodStart,
        period_end: formData.periodEnd,
        status: "submitted",
        mgi_incoming_revenue: JSON.parse(JSON.stringify(formData.mgiIncomingRevenue)),
        mgi_outgoing_cost: JSON.parse(JSON.stringify(formData.mgiOutgoingCost)),
        opex_mgi: parseNumber(formData.opexMgi),
        gia_outgoing_revenue: JSON.parse(JSON.stringify(formData.giaOutgoingRevenue)),
        gia_incoming_cost: JSON.parse(JSON.stringify(formData.giaIncomingCost)),
        opex_gia: parseNumber(formData.opexGia),
        grx_fiscalization: parseNumber(formData.grxFiscalization),
        network_management_system: parseNumber(formData.networkManagementSystem),
        margin_split_infosi: parseNumber(formData.marginSplitInfosi),
        margin_split_mgi: parseNumber(formData.marginSplitMgi),
        total_mgi_balance: totals.totalMgiBalance,
        total_gia_balance: totals.totalGiaBalance,
        margin_held: totals.marginHeld,
        notes: formData.notes || null,
        submitted_by: user.id,
        declaration_number: "",
      };

      const { data, error } = await supabase
        .from("declarations")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      await logAction("CREATE", "declarations", data.id);
      
      // Generate PDF
      generatePDF(formData, totals);
      
      toast.success("Declaration saved successfully");
      setShowForm(false);
      fetchDeclarations();
    } catch (error) {
      console.error("Error submitting declaration:", error);
      toast.error("Failed to save declaration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = (formData: any, totals: any) => {
    const periodDisplay = formData.periodStart && formData.periodEnd 
      ? `${formatDate(formData.periodStart)} - ${formatDate(formData.periodEnd)}`
      : "Not specified";

    // Calculate balances per provider for MGI
    const mgiBalances: Record<string, number> = {};
    TELECOM_PROVIDERS.forEach(provider => {
      const rev = parseNumber(formData.mgiIncomingRevenue[provider]?.usd || "0");
      const cst = parseNumber(formData.mgiOutgoingCost[provider]?.usd || "0");
      mgiBalances[provider] = rev - cst;
    });

    // Calculate balances per provider for GIA
    const giaBalances: Record<string, number> = {};
    TELECOM_PROVIDERS.forEach(provider => {
      const rev = parseNumber(formData.giaOutgoingRevenue[provider]?.usd || "0");
      const cst = parseNumber(formData.giaIncomingCost[provider]?.usd || "0");
      giaBalances[provider] = rev - cst;
    });

    const opexMgi = parseNumber(formData.opexMgi);
    const opexGia = parseNumber(formData.opexGia);
    const grxFiscalization = parseNumber(formData.grxFiscalization);
    const networkManagement = parseNumber(formData.networkManagementSystem);
    const marginSplitInfosiPercent = parseNumber(formData.marginSplitInfosi);
    const marginSplitMgiPercent = parseNumber(formData.marginSplitMgi);

    const mgiOutgoingWithOpex = totals.mgiOutgoingTotals.usd + opexMgi;
    const giaIncomingWithOpex = totals.giaIncomingTotals.usd + opexGia;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Declaration ${formData.declarationType} - ${formData.country}</title>
        <style>
          @page { margin: 15mm; size: A4; }
          * { box-sizing: border-box; }
          body { 
            font-family: Calibri, Arial, sans-serif; 
            font-size: 9pt; 
            color: #000; 
            padding: 0;
            margin: 0;
            line-height: 1.3;
          }
          
          /* Header */
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 15px;
            border-bottom: 0;
          }
          .header-left { }
          .header-left .country { 
            font-size: 14pt; 
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }
          .header-left .title { 
            font-size: 14pt; 
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }
          .header-left .period { 
            font-size: 14pt; 
            font-weight: bold;
            color: #000;
          }
          .logo { 
            text-align: right;
          }
          .logo img {
            height: 40px;
          }
          .logo-text {
            font-size: 24pt;
            font-weight: bold;
            color: #c9a227;
            font-style: italic;
          }
          
          /* Section titles */
          .section-title {
            font-weight: bold;
            font-size: 10pt;
            margin: 12px 0 8px 0;
            color: #000;
          }
          
          /* Tables */
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 0 0 2px 0;
            font-size: 9pt;
          }
          
          /* Blue header tables */
          .blue-header {
            background: #5b9bd5;
            color: #fff;
            font-weight: bold;
          }
          .blue-header td, .blue-header th {
            padding: 4px 8px;
            border: 1px solid #5b9bd5;
          }
          .blue-header .right { text-align: right; }
          
          /* Data rows */
          .data-row td {
            padding: 3px 8px;
            border: 1px solid #d9d9d9;
            background: #fff;
          }
          .data-row:nth-child(even) td {
            background: #f2f2f2;
          }
          .data-row .right { text-align: right; }
          
          /* Dark blue header for balance sections */
          .dark-header {
            background: #1f4e79;
            color: #fff;
            font-weight: bold;
          }
          .dark-header td, .dark-header th {
            padding: 4px 8px;
            border: 1px solid #1f4e79;
          }
          .dark-header .right { text-align: right; }
          
          /* Light blue background for balance data */
          .balance-row td {
            padding: 3px 8px;
            border: 1px solid #bdd7ee;
            background: #deeaf6;
          }
          .balance-row .right { text-align: right; }
          .balance-row .negative { color: #c00000; }
          
          /* Margin section */
          .margin-section {
            margin-top: 20px;
          }
          .margin-header {
            background: #1f4e79;
            color: #fff;
            font-weight: bold;
          }
          .margin-header td {
            padding: 4px 8px;
            border: 1px solid #1f4e79;
          }
          .margin-row td {
            padding: 3px 8px;
            border: 1px solid #d9d9d9;
            background: #fff;
          }
          .margin-row .right { text-align: right; font-weight: bold; }
          
          /* Split section */
          .split-header {
            background: #1f4e79;
            color: #fff;
            font-weight: bold;
          }
          .split-header td {
            padding: 4px 8px;
            border: 1px solid #1f4e79;
          }
          .split-row td {
            padding: 3px 8px;
            border: 1px solid #d9d9d9;
            background: #deeaf6;
          }
          .split-row .right { text-align: right; font-weight: bold; }
          
          .bold { font-weight: bold; }
          .negative { color: #c00000; }
          .small-gap { height: 8px; }
          
          .footer { 
            margin-top: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 8pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="country">${formData.country}</div>
            <div class="title">Declaration ${formData.declarationType}</div>
            <div class="period">${periodDisplay}</div>
          </div>
          <div class="logo">
            <span class="logo-text">mgi"</span>
          </div>
        </div>

        <div class="section-title">Traffic</div>
        <div class="section-title" style="margin-top:0;">Traffic and Monies held by MGI</div>
        
        <!-- MGI Incoming Revenue Table -->
        <table>
          <tr class="blue-header">
            <td>Revenue from international incoming traffic</td>
            <td class="right" style="width:80px;">${formatNumber(totals.mgiIncomingTotals.minutes)}</td>
            <td class="right" style="width:80px;">${formatNumber(totals.mgiIncomingTotals.usd)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const data = formData.mgiIncomingRevenue[provider];
            const minutes = parseNumber(data?.minutes || "0");
            const usd = parseNumber(data?.usd || "0");
            return `<tr class="data-row"><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
          }).join('')}
        </table>

        <!-- MGI Outgoing Cost Table -->
        <table>
          <tr class="blue-header">
            <td>Cost for international outgoing traffic PLUS OPEX</td>
            <td class="right" style="width:80px;">${formatNumber(totals.mgiOutgoingTotals.minutes)}</td>
            <td class="right" style="width:80px;">${formatNumber(mgiOutgoingWithOpex)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const data = formData.mgiOutgoingCost[provider];
            const minutes = parseNumber(data?.minutes || "0");
            const usd = parseNumber(data?.usd || "0");
            return `<tr class="data-row"><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
          }).join('')}
          <tr class="data-row"><td>OPEX mgi</td><td></td><td class="right">${formatNumber(opexMgi)}</td></tr>
        </table>

        <!-- MGI Balance Table -->
        <table>
          <tr class="dark-header">
            <td>Balance of revenue in MGI</td>
            <td style="width:80px;"></td>
            <td class="right" style="width:80px;">${totals.totalMgiBalance < 0 ? '<span class="negative">' + formatNumber(totals.totalMgiBalance) + '</span>' : formatNumber(totals.totalMgiBalance)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const balance = mgiBalances[provider] || 0;
            return `<tr class="balance-row"><td>${provider}</td><td></td><td class="right${balance < 0 ? ' negative' : ''}">${formatNumber(balance)}</td></tr>`;
          }).join('')}
          <tr class="balance-row"><td>OPEX mgi</td><td></td><td class="right negative">-${formatNumber(opexMgi)}</td></tr>
        </table>

        <div class="small-gap"></div>
        <div class="section-title">Traffic and Monies held by GIA</div>
        
        <!-- GIA Outgoing Revenue Table -->
        <table>
          <tr class="blue-header">
            <td>Revenue from international outgoing traffic</td>
            <td class="right" style="width:80px;">${formatNumber(totals.giaOutgoingTotals.minutes)}</td>
            <td class="right" style="width:80px;">${formatNumber(totals.giaOutgoingTotals.usd)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const data = formData.giaOutgoingRevenue[provider];
            const minutes = parseNumber(data?.minutes || "0");
            const usd = parseNumber(data?.usd || "0");
            return `<tr class="data-row"><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
          }).join('')}
        </table>

        <!-- GIA Incoming Cost Table -->
        <table>
          <tr class="blue-header">
            <td>Cost for international incoming traffic</td>
            <td class="right" style="width:80px;">${formatNumber(totals.giaIncomingTotals.minutes)}</td>
            <td class="right" style="width:80px;">${formatNumber(giaIncomingWithOpex)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const data = formData.giaIncomingCost[provider];
            const minutes = parseNumber(data?.minutes || "0");
            const usd = parseNumber(data?.usd || "0");
            return `<tr class="data-row"><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
          }).join('')}
          <tr class="data-row"><td>Opex GIA</td><td></td><td class="right">${formatNumber(opexGia)}</td></tr>
        </table>

        <!-- GIA Balance Table -->
        <table>
          <tr class="dark-header">
            <td>Balance of revenue in GIA</td>
            <td style="width:80px;"></td>
            <td class="right" style="width:80px;">${totals.totalGiaBalance < 0 ? '<span class="negative">' + formatNumber(totals.totalGiaBalance) + '</span>' : formatNumber(totals.totalGiaBalance)}</td>
          </tr>
          ${TELECOM_PROVIDERS.map(provider => {
            const balance = giaBalances[provider] || 0;
            return `<tr class="balance-row"><td>${provider}</td><td></td><td class="right${balance < 0 ? ' negative' : ''}">${formatNumber(balance)}</td></tr>`;
          }).join('')}
          <tr class="balance-row"><td>Opex GIA</td><td></td><td class="right negative">-${formatNumber(opexGia)}</td></tr>
        </table>

        <!-- Margin Section -->
        <div class="margin-section">
          <table>
            <tr class="margin-header">
              <td colspan="2">Margin held in both MGI & GIA</td>
              <td class="right" style="width:80px;">${formatNumber(totals.marginHeld)}</td>
            </tr>
            <tr class="margin-row">
              <td colspan="2">Total Revenue MGI & GIA</td>
              <td class="right">${formatNumber(totals.mgiIncomingTotals.usd + totals.giaOutgoingTotals.usd)}</td>
            </tr>
            <tr class="margin-row">
              <td colspan="2">Total cost for termination MGI & GIA</td>
              <td class="right">${formatNumber(totals.mgiOutgoingTotals.usd + opexMgi + totals.giaIncomingTotals.usd + opexGia)}</td>
            </tr>
            <tr class="margin-row">
              <td colspan="2">GRX Fiscalization</td>
              <td class="right">${formatNumber(grxFiscalization)}</td>
            </tr>
            <tr class="margin-row">
              <td colspan="2">Network Management System</td>
              <td class="right">${formatNumber(networkManagement)}</td>
            </tr>
          </table>
        </div>

        <!-- Margin Split Section -->
        <table style="margin-top:10px;">
          <tr class="split-header">
            <td colspan="3">Margin Split</td>
          </tr>
          <tr class="split-row">
            <td>INFOSI</td>
            <td class="right" style="width:50px;">${marginSplitInfosiPercent}%</td>
            <td class="right" style="width:80px;">${formatNumber(totals.infosiShare)}</td>
          </tr>
          <tr class="split-row">
            <td>mgi</td>
            <td class="right" style="width:50px;">${marginSplitMgiPercent}%</td>
            <td class="right" style="width:80px;">${formatNumber(totals.mgiShare)}</td>
          </tr>
        </table>

        <div class="footer">
          Generated on ${new Date().toLocaleDateString("en-GB")} | MGI Hub Declaration System
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const filteredDeclarations = declarations.filter((decl) => {
    const matchesSearch = 
      decl.declaration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      decl.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || decl.declaration_type === filterType;
    return matchesSearch && matchesType;
  });

  const pendingCount = declarations.filter((d) => d.status === "pending" || d.status === "draft").length;
  const submittedCount = declarations.filter((d) => d.status === "submitted").length;

  if (isLoading || permissionsLoading) {
    return (
      <Layout title="Declarations" subtitle="Traffic declarations and regulatory filings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  // Show form in full-screen mode
  if (showForm) {
    return (
      <DeclarationForm
        onSubmit={handleFormSubmit}
        onCancel={() => setShowForm(false)}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Access control - only MGI Media finance can view
  if (!permissions.canViewDeclarations) {
    return (
      <Layout title="Declarations" subtitle="Traffic declarations and regulatory filings">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Zugriff verweigert</h3>
            <p className="text-muted-foreground">
              Diese Funktion ist nur für den Finanzmanager von MGI Media verfügbar.
            </p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="Declarations" subtitle="Traffic declarations and regulatory filings">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{declarations.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-warning">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold text-primary">{submittedCount}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-success">
                  {declarations.filter((d) => d.status === "approved").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="GIA">GIA</SelectItem>
              <SelectItem value="MGI">MGI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowForm(true)} className="glow-gold">
            <Plus className="mr-2 h-4 w-4" />
            New Declaration
          </Button>
        </div>
      </div>

      {/* Declarations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Declarations</CardTitle>
          <CardDescription>
            {filteredDeclarations.length} declarations found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDeclarations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No declarations available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first declaration to get started.
              </p>
              <Button onClick={() => setShowForm(true)} className="glow-gold">
                <Plus className="mr-2 h-4 w-4" />
                New Declaration
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MGI Balance</TableHead>
                  <TableHead className="text-right">GIA Balance</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeclarations.map((decl) => {
                  const statusConfig = STATUS_CONFIG[decl.status] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={decl.id}>
                      <TableCell className="font-mono text-sm">{decl.declaration_number}</TableCell>
                      <TableCell>{decl.country}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{decl.declaration_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(decl.period_start)} - {formatDate(decl.period_end)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${decl.total_mgi_balance < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(decl.total_mgi_balance)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${decl.total_gia_balance < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(decl.total_gia_balance)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(decl.margin_held)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
