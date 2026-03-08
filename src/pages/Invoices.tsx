import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BexioConnectionCard } from "@/components/invoices/BexioConnectionCard";
import { InvoiceApprovalDialog } from "@/components/invoices/InvoiceApprovalDialog";
import { useMultiBexio } from "@/hooks/useMultiBexio";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Download,
  Filter,
  Search,
  Eye,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Inbox,
  Loader2,
  CheckCheck,
  Upload,
  Sparkles,
} from "lucide-react";

function useStatusConfig() {
  const { t } = useLanguage();
  return {
    pending_review: { label: t("invoices.status.pendingReview"), variant: "secondary" as const, icon: Clock },
    first_approval: { label: t("invoices.status.firstApproval"), variant: "outline" as const, icon: FileText },
    approved: { label: t("invoices.status.approved"), variant: "default" as const, icon: CheckCircle },
    rejected: { label: t("invoices.status.rejected"), variant: "destructive" as const, icon: AlertCircle },
    paid: { label: t("invoices.status.paid"), variant: "default" as const, icon: CheckCircle },
  };
}

export default function Invoices() {
  const { t, language } = useLanguage();
  const statusConfig = useStatusConfig();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [invoiceType, setInvoiceType] = useState<string>("creditor");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accounts, selectedAccountId } = useMultiBexio();

  // Form state - extended for AI extraction
  const [formData, setFormData] = useState({
    vendor_name: "",
    vendor_address: "",
    vendor_iban: "",
    vendor_vat_number: "",
    invoice_number: "",
    payment_reference: "",
    notes: "",
    amount: "",
    vat_amount: "",
    vat_rate: "",
    currency: "CHF",
    invoice_date: "",
    due_date: "",
    document_path: "",
    document_name: "",
  });

  // Fetch invoices from database
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["creditor-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditor_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Scan invoice with AI
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const { data, error } = await supabase.functions.invoke("scan-invoice", {
        body: formDataUpload,
      });

      if (error) throw error;

      if (data?.data) {
        const extracted = data.data;
        setFormData({
          vendor_name: extracted.vendor_name || "",
          vendor_address: extracted.vendor_address || "",
          vendor_iban: extracted.vendor_iban || "",
          vendor_vat_number: extracted.vendor_vat_number || "",
          invoice_number: extracted.invoice_number || "",
          payment_reference: extracted.payment_reference || "",
          notes: extracted.notes || "",
          amount: extracted.amount ? String(extracted.amount) : "",
          vat_amount: extracted.vat_amount ? String(extracted.vat_amount) : "",
          vat_rate: extracted.vat_rate ? String(extracted.vat_rate) : "",
          currency: extracted.currency || "CHF",
          invoice_date: extracted.invoice_date || "",
          due_date: extracted.due_date || "",
          document_path: data.document_path || "",
          document_name: data.document_name || file.name,
        });

        toast({
          title: t("invoices.scanSuccess"),
          description: t("invoices.scanSuccessDesc"),
        });
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        title: t("invoices.scanError"),
        description: error.message || t("invoices.scanErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetForm = () => {
    setFormData({
      vendor_name: "",
      vendor_address: "",
      vendor_iban: "",
      vendor_vat_number: "",
      invoice_number: "",
      payment_reference: "",
      notes: "",
      amount: "",
      vat_amount: "",
      vat_rate: "",
      currency: "CHF",
      invoice_date: "",
      due_date: "",
      document_path: "",
      document_name: "",
    });
  };

  // Create invoice mutation
  const createInvoice = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from("creditor_invoices")
        .insert({
          vendor_name: data.vendor_name,
          vendor_address: data.vendor_address || null,
          vendor_iban: data.vendor_iban || null,
          vendor_vat_number: data.vendor_vat_number || null,
          invoice_number: data.invoice_number || null,
          payment_reference: data.payment_reference || null,
          notes: data.notes || null,
          amount: parseFloat(data.amount) || 0,
          vat_amount: parseFloat(data.vat_amount) || 0,
          vat_rate: parseFloat(data.vat_rate) || 0,
          currency: data.currency,
          invoice_date: data.invoice_date || null,
          due_date: data.due_date || null,
          document_path: data.document_path || null,
          document_name: data.document_name || null,
          status: "pending_review",
          invoice_type: invoiceType,
          bexio_account_id: selectedAccountId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditor-invoices"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: t("invoices.created"),
        description: t("invoices.createdDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("invoices.createError"),
        variant: "destructive",
      });
    },
  });

  const localeMap: Record<string, string> = { de: "de-CH", en: "en-US", fr: "fr-FR", pt: "pt-PT" };

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat(localeMap[language] || "de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(localeMap[language] || "de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredInvoices = invoices.filter((inv: any) => {
    const matchesSearch = 
      inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    const matchesTab = activeTab === "all" || 
      (activeTab === "incoming" && (inv.invoice_type === "creditor" || !inv.invoice_type)) ||
      (activeTab === "outgoing" && inv.invoice_type === "debitor");
    return matchesSearch && matchesStatus && matchesTab;
  });

  const totalIncoming = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const overdueCount = invoices.filter((i) => 
    i.due_date && new Date(i.due_date) < new Date() && i.status !== "paid"
  ).length;
  const pendingAmount = invoices
    .filter((i) => i.status === "pending_review" || i.status === "first_approval")
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const handleSubmit = () => {
    if (!formData.vendor_name || !formData.amount) {
      toast({
        title: t("common.error"),
        description: t("invoices.validationError"),
        variant: "destructive",
      });
      return;
    }
    createInvoice.mutate(formData);
  };

  return (
    <Layout title={t("page.invoices.title")} subtitle={t("page.invoices.subtitle")}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("invoices.count")}</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("invoices.totalAmount")}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalIncoming)}</p>
              </div>
              <ArrowDownLeft className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("invoices.open")}</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(pendingAmount)}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("invoices.overdue")}</p>
                <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bexio Integration Card */}
      <div className="mb-6">
        <BexioConnectionCard />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            {t("invoices.creditors")}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            {t("invoices.debitors")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") + "..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("invoices.allStatus")}</SelectItem>
              <SelectItem value="pending_review">{t("invoices.status.pendingReview")}</SelectItem>
              <SelectItem value="first_approval">{t("invoices.status.firstApproval")}</SelectItem>
              <SelectItem value="approved">{t("invoices.status.approved")}</SelectItem>
              <SelectItem value="paid">{t("invoices.status.paid")}</SelectItem>
              <SelectItem value="rejected">{t("invoices.status.rejected")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t("common.export")}
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("invoices.newInvoice")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {invoiceType === "creditor" ? t("invoices.newCreditorInvoice") : t("invoices.newDebitorInvoice")}
                </DialogTitle>
                <DialogDescription>
                  {t("invoices.uploadOrManual")}
                </DialogDescription>
              </DialogHeader>

              {/* Invoice Type Selector */}
              <div className="flex gap-2 mb-2">
                <Button
                  variant={invoiceType === "creditor" ? "default" : "outline"}
                  size="sm"
                  type="button"
                  onClick={() => setInvoiceType("creditor")}
                >
                  <ArrowDownLeft className="h-4 w-4 mr-1" />
                  {t("invoices.creditor")}
                </Button>
                <Button
                  variant={invoiceType === "debitor" ? "default" : "outline"}
                  size="sm"
                  type="button"
                  onClick={() => setInvoiceType("debitor")}
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  {t("invoices.debitor")}
                </Button>
              </div>
              
              {/* AI Upload Section */}
              <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <div className="text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <h4 className="font-medium mb-1">{t("invoices.aiRecognition")}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("invoices.aiRecognitionDesc")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("invoices.analyzing")}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {t("invoices.uploadInvoice")}
                      </>
                    )}
                  </Button>
                  {formData.document_name && (
                    <p className="mt-2 text-sm text-green-600 flex items-center justify-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      {formData.document_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {/* Vendor Section */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">{t("invoices.vendor")}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>{t("invoices.company")} *</Label>
                      <Input 
                        placeholder={t("invoices.companyName")}
                        value={formData.vendor_name}
                        onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>{t("invoices.address")}</Label>
                      <Input 
                        placeholder={t("invoices.addressPlaceholder")}
                        value={formData.vendor_address}
                        onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input 
                        placeholder="CH..." 
                        value={formData.vendor_iban}
                        onChange={(e) => setFormData({ ...formData, vendor_iban: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.vatNumber")}</Label>
                      <Input 
                        placeholder="CHE-..." 
                        value={formData.vendor_vat_number}
                        onChange={(e) => setFormData({ ...formData, vendor_vat_number: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Invoice Details */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">{t("invoices.details")}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("invoices.invoiceNumber")}</Label>
                      <Input 
                        placeholder={t("invoices.invoiceNumberPlaceholder")}
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.paymentReference")}</Label>
                      <Input 
                        placeholder={t("invoices.paymentReferencePlaceholder")}
                        value={formData.payment_reference}
                        onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.invoiceDate")}</Label>
                      <Input 
                        type="date" 
                        value={formData.invoice_date}
                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.dueDate")}</Label>
                      <Input 
                        type="date" 
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Amount Section */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">{t("invoices.amounts")}</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>{t("common.amount")} *</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("common.currency")}</Label>
                      <Select 
                        value={formData.currency} 
                        onValueChange={(v) => setFormData({ ...formData, currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.currency")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.vatAmount")}</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formData.vat_amount}
                        onChange={(e) => setFormData({ ...formData, vat_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoices.vatRate")}</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        placeholder="8.1" 
                        value={formData.vat_rate}
                        onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>{t("common.description")}</Label>
                  <Textarea 
                    placeholder={t("invoices.descriptionPlaceholder")}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSubmit} disabled={createInvoice.isPending || isScanning}>
                  {createInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            {t("invoices.invoices")}
          </CardTitle>
          <CardDescription>
            {filteredInvoices.length} {t("invoices.invoicesFound")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t("invoices.noInvoices")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("invoices.noInvoicesDesc")}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("invoices.newInvoice")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.number")}</TableHead>
                  <TableHead>{t("invoices.vendor")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead>{t("invoices.dueDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const sc = statusConfig[inv.status as keyof typeof statusConfig] || statusConfig.pending_review;
                  const StatusIcon = sc.icon;
                  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid";
                  
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">
                        {inv.invoice_number || "-"}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{inv.vendor_name}</p>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {inv.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {formatDate(inv.due_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(inv.amount) || 0, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setApprovalDialogOpen(true);
                          }}
                        >
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

      {/* Approval Dialog */}
      <InvoiceApprovalDialog
        invoice={selectedInvoice}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
      />
    </Layout>
  );
}
