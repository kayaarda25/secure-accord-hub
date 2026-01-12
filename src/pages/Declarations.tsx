import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Download,
  Filter,
  Search,
  Eye,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
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

interface ProviderData {
  minutes: string;
  usd: string;
}

interface DeclarationFormData {
  country: string;
  declarationType: string;
  periodStart: string;
  periodEnd: string;
  mgiIncomingRevenue: Record<string, ProviderData>;
  mgiOutgoingCost: Record<string, ProviderData>;
  opexMgi: string;
  giaOutgoingRevenue: Record<string, ProviderData>;
  giaIncomingCost: Record<string, ProviderData>;
  opexGia: string;
  grxFiscalization: string;
  networkManagementSystem: string;
  marginSplitInfosi: string;
  marginSplitMgi: string;
  notes: string;
}

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
  draft: { label: "Draft", variant: "secondary", icon: Edit },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: FileText },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: AlertCircle },
};

const createEmptyProviderData = (): Record<string, ProviderData> => {
  return Object.fromEntries(
    TELECOM_PROVIDERS.map(provider => [provider, { minutes: "", usd: "" }])
  );
};

export default function Declarations() {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<DeclarationFormData>({
    country: "Angola",
    declarationType: "GIA",
    periodStart: "",
    periodEnd: "",
    mgiIncomingRevenue: createEmptyProviderData(),
    mgiOutgoingCost: createEmptyProviderData(),
    opexMgi: "",
    giaOutgoingRevenue: createEmptyProviderData(),
    giaIncomingCost: createEmptyProviderData(),
    opexGia: "",
    grxFiscalization: "",
    networkManagementSystem: "",
    marginSplitInfosi: "30",
    marginSplitMgi: "70",
    notes: "",
  });

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

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/,/g, "'");
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num).replace(/,/g, "'");
  };

  const parseNumber = (str: string): number => {
    if (!str) return 0;
    return parseFloat(str.replace(/[^0-9.-]/g, "")) || 0;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const updateProviderData = (
    section: keyof Pick<DeclarationFormData, 'mgiIncomingRevenue' | 'mgiOutgoingCost' | 'giaOutgoingRevenue' | 'giaIncomingCost'>,
    provider: string,
    field: 'minutes' | 'usd',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [provider]: {
          ...prev[section][provider],
          [field]: value,
        },
      },
    }));
  };

  const calculateTotals = (data: Record<string, ProviderData>) => {
    let totalMinutes = 0;
    let totalUsd = 0;
    Object.values(data).forEach(p => {
      totalMinutes += parseNumber(p.minutes);
      totalUsd += parseNumber(p.usd);
    });
    return { minutes: totalMinutes, usd: totalUsd };
  };

  const mgiIncomingTotals = calculateTotals(formData.mgiIncomingRevenue);
  const mgiOutgoingTotals = calculateTotals(formData.mgiOutgoingCost);
  const giaOutgoingTotals = calculateTotals(formData.giaOutgoingRevenue);
  const giaIncomingTotals = calculateTotals(formData.giaIncomingCost);

  const calculateMgiBalance = () => {
    const balances: Record<string, number> = {};
    TELECOM_PROVIDERS.forEach(provider => {
      const revenue = parseNumber(formData.mgiIncomingRevenue[provider]?.usd || "0");
      const cost = parseNumber(formData.mgiOutgoingCost[provider]?.usd || "0");
      balances[provider] = revenue - cost;
    });
    return balances;
  };

  const calculateGiaBalance = () => {
    const balances: Record<string, number> = {};
    TELECOM_PROVIDERS.forEach(provider => {
      const revenue = parseNumber(formData.giaOutgoingRevenue[provider]?.usd || "0");
      const cost = parseNumber(formData.giaIncomingCost[provider]?.usd || "0");
      balances[provider] = revenue - cost;
    });
    return balances;
  };

  const mgiBalances = calculateMgiBalance();
  const giaBalances = calculateGiaBalance();

  const mgiOutgoingWithOpex = mgiOutgoingTotals.usd + parseNumber(formData.opexMgi);
  const giaIncomingWithOpex = giaIncomingTotals.usd + parseNumber(formData.opexGia);

  const totalMgiBalance = mgiIncomingTotals.usd - mgiOutgoingWithOpex;
  const totalGiaBalance = giaOutgoingTotals.usd - giaIncomingWithOpex;

  const marginHeld = totalMgiBalance + totalGiaBalance;
  const totalRevenue = mgiIncomingTotals.usd + giaOutgoingTotals.usd;
  const totalCost = mgiOutgoingWithOpex + giaIncomingWithOpex;
  const grxFiscalization = parseNumber(formData.grxFiscalization);
  const networkManagement = parseNumber(formData.networkManagementSystem);
  
  const marginSplitInfosiPercent = parseNumber(formData.marginSplitInfosi) / 100;
  const marginSplitMgiPercent = parseNumber(formData.marginSplitMgi) / 100;
  
  const marginToSplit = marginHeld - grxFiscalization - networkManagement;
  const infosiShare = marginToSplit * marginSplitInfosiPercent;
  const mgiShare = marginToSplit * marginSplitMgiPercent;

  const generatePDF = () => {
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
          .logo-text span {
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
            border: 1px solid #7ba3c9;
          }
          .summary-table th { 
            background: #5a8bb8; 
            color: white; 
            padding: 6px 8px; 
            text-align: left;
            font-weight: bold;
          }
          .summary-table th.right { text-align: right; }
          .summary-table td { 
            padding: 4px 8px; 
            border-bottom: 1px solid #ddd;
            background: #e8f0f6;
          }
          .summary-table td.right { text-align: right; }
          
          .margin-table {
            border: 1px solid #1a1a2e;
            margin-top: 20px;
          }
          .margin-table th { 
            background: #1a1a2e; 
            color: white; 
            padding: 6px 8px; 
            text-align: left;
          }
          .margin-table th.right { text-align: right; }
          .margin-table td { 
            padding: 4px 8px; 
            border-bottom: 1px solid #ddd;
          }
          .margin-table td.right { text-align: right; font-weight: bold; }
          
          .highlight-yellow { background: #ffff00 !important; }
          
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
            <div class="logo-text">mgi<span>"</span></div>
          </div>
        </div>

        <div class="section-title">Traffic</div>
        <table>
          <tr>
            <td style="width: 60%"></td>
            <td style="width: 20%; font-weight: bold;">Minutes</td>
            <td style="width: 20%; font-weight: bold;">USD</td>
          </tr>
        </table>

        <div class="section-title">Traffic and Monies held by MGI</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Revenue from international incoming traffic</th>
              <th class="right">${formatNumber(mgiIncomingTotals.minutes)}</th>
              <th class="right">${formatNumber(mgiIncomingTotals.usd)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.mgiIncomingRevenue[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right">${formatNumber(minutes)}</td>
                <td class="right">${formatNumber(usd)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>Cost for international outgoing traffic PLUS OPEX</th>
              <th class="right">${formatNumber(mgiOutgoingTotals.minutes)}</th>
              <th class="right">${formatNumber(mgiOutgoingWithOpex)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.mgiOutgoingCost[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right">${formatNumber(minutes)}</td>
                <td class="right">${formatNumber(usd)}</td>
              </tr>`;
            }).join('')}
            ${parseNumber(formData.opexMgi) > 0 ? `<tr>
              <td style="padding-left: 20px;">OPEX mgi</td>
              <td class="right"></td>
              <td class="right">${formatNumber(parseNumber(formData.opexMgi))}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Balance of revenue in MGI</th>
              <th class="right"></th>
              <th class="right">${formatNumber(totalMgiBalance)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const balance = mgiBalances[provider];
              if (balance === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right"></td>
                <td class="right ${balance < 0 ? 'negative' : ''}">${formatNumber(balance)}</td>
              </tr>`;
            }).join('')}
            ${parseNumber(formData.opexMgi) > 0 ? `<tr>
              <td style="padding-left: 20px;">OPEX mgi</td>
              <td class="right"></td>
              <td class="right negative">-${formatNumber(parseNumber(formData.opexMgi))}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <div class="section-title">Traffic and Monies held by GIA</div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>Revenue from international outgoing traffic</th>
              <th class="right">${formatNumber(giaOutgoingTotals.minutes)}</th>
              <th class="right">${formatNumber(giaOutgoingTotals.usd)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.giaOutgoingRevenue[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right">${formatNumber(minutes)}</td>
                <td class="right">${formatNumber(usd)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>Cost for international incoming traffic</th>
              <th class="right">${formatNumber(giaIncomingTotals.minutes)}</th>
              <th class="right">${formatNumber(giaIncomingWithOpex)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const data = formData.giaIncomingCost[provider];
              const minutes = parseNumber(data?.minutes || "0");
              const usd = parseNumber(data?.usd || "0");
              if (minutes === 0 && usd === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right">${formatNumber(minutes)}</td>
                <td class="right">${formatNumber(usd)}</td>
              </tr>`;
            }).join('')}
            ${parseNumber(formData.opexGia) > 0 ? `<tr>
              <td style="padding-left: 20px;">Opex GIA (Mail Seny ${formatDate(formData.periodEnd)})</td>
              <td class="right"></td>
              <td class="right">${formatNumber(parseNumber(formData.opexGia))}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Balance of revenue in GIA</th>
              <th class="right"></th>
              <th class="right">${formatNumber(totalGiaBalance)}</th>
            </tr>
          </thead>
          <tbody>
            ${TELECOM_PROVIDERS.map(provider => {
              const balance = giaBalances[provider];
              if (balance === 0) return '';
              return `<tr>
                <td style="padding-left: 20px;">${provider}</td>
                <td class="right"></td>
                <td class="right ${balance < 0 ? 'negative' : ''}">${formatNumber(balance)}</td>
              </tr>`;
            }).join('')}
            ${parseNumber(formData.opexGia) > 0 ? `<tr>
              <td style="padding-left: 20px;">Opex GIA</td>
              <td class="right"></td>
              <td class="right negative">-${formatNumber(parseNumber(formData.opexGia))}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <table class="margin-table">
          <thead>
            <tr>
              <th>Margin held in both MGI & GIA</th>
              <th class="right">${formatNumber(marginHeld)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Revenue MGI & GIA</td>
              <td class="right">${formatNumber(totalRevenue)}</td>
            </tr>
            <tr>
              <td>Total cost for termination MGI & GIA</td>
              <td class="right">${formatNumber(totalCost)}</td>
            </tr>
            <tr>
              <td>GRX Fiscalization</td>
              <td class="right">${formatNumber(grxFiscalization)}</td>
            </tr>
            <tr>
              <td>Network Management System</td>
              <td class="right">${formatNumber(networkManagement)}</td>
            </tr>
          </tbody>
        </table>

        <table class="margin-table">
          <thead>
            <tr>
              <th>Margin Split</th>
              <th></th>
              <th class="right"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>INFOSI</td>
              <td class="highlight-yellow" style="width: 60px; text-align: center;">${formData.marginSplitInfosi}%</td>
              <td class="right">${formatNumber(infosiShare)}</td>
            </tr>
            <tr>
              <td>mgi</td>
              <td class="highlight-yellow" style="width: 60px; text-align: center;">${formData.marginSplitMgi}%</td>
              <td class="right">${formatNumber(mgiShare)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString("en-GB")}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        total_mgi_balance: totalMgiBalance,
        total_gia_balance: totalGiaBalance,
        margin_held: marginHeld,
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
      generatePDF();
      
      toast.success("Declaration saved successfully");
      
      // Reset form
      setFormData({
        country: "Angola",
        declarationType: "GIA",
        periodStart: "",
        periodEnd: "",
        mgiIncomingRevenue: createEmptyProviderData(),
        mgiOutgoingCost: createEmptyProviderData(),
        opexMgi: "",
        giaOutgoingRevenue: createEmptyProviderData(),
        giaIncomingCost: createEmptyProviderData(),
        opexGia: "",
        grxFiscalization: "",
        networkManagementSystem: "",
        marginSplitInfosi: "30",
        marginSplitMgi: "70",
        notes: "",
      });
      
      setCreateDialogOpen(false);
      fetchDeclarations();
    } catch (error) {
      console.error("Error submitting declaration:", error);
      toast.error("Failed to save declaration");
    } finally {
      setIsSubmitting(false);
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

  const renderProviderInputs = (
    section: keyof Pick<DeclarationFormData, 'mgiIncomingRevenue' | 'mgiOutgoingCost' | 'giaOutgoingRevenue' | 'giaIncomingCost'>,
    title: string
  ) => (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{title}</Label>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-1/3">Provider</TableHead>
              <TableHead className="text-right">Minutes</TableHead>
              <TableHead className="text-right">USD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TELECOM_PROVIDERS.map(provider => (
              <TableRow key={provider}>
                <TableCell className="font-medium text-sm py-2">{provider}</TableCell>
                <TableCell className="py-1">
                  <Input
                    type="text"
                    placeholder="0"
                    className="text-right h-8"
                    value={formData[section][provider]?.minutes || ""}
                    onChange={(e) => updateProviderData(section, provider, 'minutes', e.target.value)}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    type="text"
                    placeholder="0"
                    className="text-right h-8"
                    value={formData[section][provider]?.usd || ""}
                    onChange={(e) => updateProviderData(section, provider, 'usd', e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Layout title="Declarations" subtitle="Traffic declarations and regulatory filings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
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
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="glow-gold">
                <Plus className="mr-2 h-4 w-4" />
                New Declaration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Declaration</DialogTitle>
                <DialogDescription>
                  Enter traffic data for telecom providers
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select 
                      value={formData.country} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, country: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Angola">Angola</SelectItem>
                        <SelectItem value="Uganda">Uganda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={formData.declarationType} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, declarationType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GIA">GIA</SelectItem>
                        <SelectItem value="MGI">MGI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Period Start</Label>
                    <Input 
                      type="date" 
                      value={formData.periodStart}
                      onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Period End</Label>
                    <Input 
                      type="date" 
                      value={formData.periodEnd}
                      onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                    />
                  </div>
                </div>

                {/* MGI Section */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold text-lg">Traffic and Monies held by MGI</h3>
                  
                  {renderProviderInputs('mgiIncomingRevenue', 'Revenue from international incoming traffic')}
                  
                  {renderProviderInputs('mgiOutgoingCost', 'Cost for international outgoing traffic')}
                  
                  <div className="flex items-center gap-4">
                    <Label className="w-1/3">OPEX MGI</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      className="text-right"
                      value={formData.opexMgi}
                      onChange={(e) => setFormData(prev => ({ ...prev, opexMgi: e.target.value }))}
                    />
                  </div>
                  
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="font-semibold">Balance of revenue in MGI: <span className={totalMgiBalance < 0 ? 'text-destructive' : 'text-success'}>{formatCurrency(totalMgiBalance)}</span></p>
                  </div>
                </div>

                {/* GIA Section */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h3 className="font-semibold text-lg">Traffic and Monies held by GIA</h3>
                  
                  {renderProviderInputs('giaOutgoingRevenue', 'Revenue from international outgoing traffic')}
                  
                  {renderProviderInputs('giaIncomingCost', 'Cost for international incoming traffic')}
                  
                  <div className="flex items-center gap-4">
                    <Label className="w-1/3">OPEX GIA</Label>
                    <Input
                      type="text"
                      placeholder="0"
                      className="text-right"
                      value={formData.opexGia}
                      onChange={(e) => setFormData(prev => ({ ...prev, opexGia: e.target.value }))}
                    />
                  </div>
                  
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="font-semibold">Balance of revenue in GIA: <span className={totalGiaBalance < 0 ? 'text-destructive' : 'text-success'}>{formatCurrency(totalGiaBalance)}</span></p>
                  </div>
                </div>

                {/* Margin Section */}
                <div className="space-y-4 p-4 bg-accent/10 rounded-lg border border-accent/30">
                  <h3 className="font-semibold text-lg">Margin Calculation</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-sm text-muted-foreground">Margin held in both MGI & GIA</p>
                      <p className="text-xl font-bold">{formatCurrency(marginHeld)}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>GRX Fiscalization</Label>
                      <Input
                        type="text"
                        placeholder="0"
                        className="text-right"
                        value={formData.grxFiscalization}
                        onChange={(e) => setFormData(prev => ({ ...prev, grxFiscalization: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Network Management System</Label>
                      <Input
                        type="text"
                        placeholder="0"
                        className="text-right"
                        value={formData.networkManagementSystem}
                        onChange={(e) => setFormData(prev => ({ ...prev, networkManagementSystem: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>INFOSI Split (%)</Label>
                      <Input
                        type="text"
                        className="text-right"
                        value={formData.marginSplitInfosi}
                        onChange={(e) => setFormData(prev => ({ ...prev, marginSplitInfosi: e.target.value }))}
                      />
                      <p className="text-sm text-muted-foreground text-right">{formatCurrency(infosiShare)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>MGI Split (%)</Label>
                      <Input
                        type="text"
                        className="text-right"
                        value={formData.marginSplitMgi}
                        onChange={(e) => setFormData(prev => ({ ...prev, marginSplitMgi: e.target.value }))}
                      />
                      <p className="text-sm text-muted-foreground text-right">{formatCurrency(mgiShare)}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="glow-gold">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Save & Generate PDF
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
              <Button onClick={() => setCreateDialogOpen(true)} className="glow-gold">
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