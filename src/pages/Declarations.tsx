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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Declaration ${formData.declarationType} - ${formData.country}</title>
        <style>
          @page { margin: 20mm; size: A4; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 10px; 
            color: #333; 
            padding: 0;
            margin: 0;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .header-left h1 { 
            font-size: 18px; 
            margin: 0 0 5px 0;
            color: #1a1a2e;
          }
          .header-left h2 { 
            font-size: 14px; 
            margin: 0 0 5px 0;
            color: #1a1a2e;
            font-weight: bold;
          }
          .header-left p { 
            font-size: 11px; 
            margin: 0;
            color: #666;
          }
          .logo { 
            text-align: right;
          }
          .logo-text {
            font-size: 28px;
            font-weight: bold;
            color: #c9a227;
          }
          
          .section-title {
            font-weight: bold;
            font-size: 11px;
            margin: 15px 0 5px 0;
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 5px 0 15px 0;
            font-size: 9px;
          }
          
          .data-table {
            border: 1px solid #7ba3c9;
          }
          .data-table th { 
            background: #7ba3c9; 
            color: white; 
            padding: 6px 8px; 
            text-align: left;
            font-weight: bold;
            font-size: 9px;
          }
          .data-table th.right { text-align: right; }
          .data-table td { 
            padding: 4px 8px; 
            border-bottom: 1px solid #ddd;
            background: white;
          }
          .data-table td.right { text-align: right; }
          .data-table tr:nth-child(even) td { background: #f5f8fb; }
          
          .summary-table {
            border: 1px solid #1a1a2e;
            margin-top: 20px;
          }
          .summary-table th { 
            background: #1a1a2e; 
            color: white; 
            padding: 6px 8px; 
            text-align: left;
          }
          .summary-table th.right { text-align: right; }
          .summary-table td { 
            padding: 4px 8px; 
            border-bottom: 1px solid #ddd;
          }
          .summary-table td.right { text-align: right; font-weight: bold; }
          
          .bold { font-weight: bold; }
          .negative { color: #c00; }
          
          .footer { 
            margin-top: 30px; 
            text-align: center; 
            color: #666; 
            font-size: 9px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>${formData.country}</h1>
            <h2>Declaration ${formData.declarationType}</h2>
            <p>${periodDisplay}</p>
          </div>
          <div class="logo">
            <div class="logo-text">mgi"</div>
          </div>
        </div>

        <div class="section-title">Traffic and Monies held by MGI</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Revenue from international incoming traffic</th>
              <th class="right">${formatNumber(totals.mgiIncomingTotals.minutes)}</th>
              <th class="right">${formatNumber(totals.mgiIncomingTotals.usd)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.mgiIncomingRevenue[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>Cost for international outgoing traffic PLUS OPEX</th>
              <th class="right">${formatNumber(totals.mgiOutgoingTotals.minutes)}</th>
              <th class="right">${formatNumber(totals.mgiOutgoingTotals.usd + parseNumber(formData.opexMgi))}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.mgiOutgoingCost[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
            }).join('')}
            ${parseNumber(formData.opexMgi) > 0 ? `<tr><td>OPEX mgi</td><td></td><td class="right">${formatNumber(parseNumber(formData.opexMgi))}</td></tr>` : ''}
          </tbody>
        </table>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Balance of revenue in MGI</th>
              <th></th>
              <th class="right ${totals.totalMgiBalance < 0 ? 'negative' : ''}">${formatNumber(totals.totalMgiBalance)}</th>
            </tr>
          </thead>
        </table>

        <div class="section-title">Traffic and Monies held by GIA</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Revenue from international outgoing traffic</th>
              <th class="right">${formatNumber(totals.giaOutgoingTotals.minutes)}</th>
              <th class="right">${formatNumber(totals.giaOutgoingTotals.usd)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.giaOutgoingRevenue[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>Cost for international incoming traffic</th>
              <th class="right">${formatNumber(totals.giaIncomingTotals.minutes)}</th>
              <th class="right">${formatNumber(totals.giaIncomingTotals.usd + parseNumber(formData.opexGia))}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.giaIncomingCost[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr><td>${provider}</td><td class="right">${formatNumber(minutes)}</td><td class="right">${formatNumber(usd)}</td></tr>`;
            }).join('')}
            ${parseNumber(formData.opexGia) > 0 ? `<tr><td>Opex GIA</td><td></td><td class="right">${formatNumber(parseNumber(formData.opexGia))}</td></tr>` : ''}
          </tbody>
        </table>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Balance of revenue in GIA</th>
              <th></th>
              <th class="right ${totals.totalGiaBalance < 0 ? 'negative' : ''}">${formatNumber(totals.totalGiaBalance)}</th>
            </tr>
          </thead>
        </table>

        <table class="summary-table" style="margin-top: 30px;">
          <thead>
            <tr>
              <th colspan="2">Margin Summary</th>
              <th class="right">USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="2">Margin held in both MGI & GIA</td>
              <td class="right bold">${formatNumber(totals.marginHeld)}</td>
            </tr>
            <tr>
              <td colspan="2">GRX Fiscalization</td>
              <td class="right">${formatNumber(parseNumber(formData.grxFiscalization))}</td>
            </tr>
            <tr>
              <td colspan="2">Network Management System</td>
              <td class="right">${formatNumber(parseNumber(formData.networkManagementSystem))}</td>
            </tr>
            <tr>
              <td colspan="2">INFOSI Share (${formData.marginSplitInfosi}%)</td>
              <td class="right">${formatNumber(totals.infosiShare)}</td>
            </tr>
            <tr>
              <td colspan="2">MGI Share (${formData.marginSplitMgi}%)</td>
              <td class="right">${formatNumber(totals.mgiShare)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString("en-GB")} | MGI Hub Declaration System</p>
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
