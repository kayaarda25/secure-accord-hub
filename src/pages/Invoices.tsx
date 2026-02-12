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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  pending_review: { label: "Prüfung", variant: "secondary", icon: Clock },
  first_approval: { label: "1. Freigabe", variant: "outline", icon: FileText },
  approved: { label: "Freigegeben", variant: "default", icon: CheckCircle },
  rejected: { label: "Abgelehnt", variant: "destructive", icon: AlertCircle },
  paid: { label: "Bezahlt", variant: "default", icon: CheckCircle },
};

export default function Invoices() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          title: "Rechnung erkannt",
          description: "Die KI hat alle Daten extrahiert. Bitte überprüfen Sie die Angaben.",
        });
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        title: "Fehler beim Scannen",
        description: error.message || "Die Rechnung konnte nicht analysiert werden.",
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
        title: "Rechnung erstellt",
        description: "Die Kreditorenrechnung wurde erfolgreich angelegt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Rechnung konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    // For now, all are "incoming" (creditor invoices)
    const matchesTab = activeTab === "all" || activeTab === "incoming";
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
        title: "Fehler",
        description: "Bitte Lieferant und Betrag eingeben.",
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
                <p className="text-sm text-muted-foreground">Anzahl</p>
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
                <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
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
                <p className="text-sm text-muted-foreground">Offen</p>
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
                <p className="text-sm text-muted-foreground">Überfällig</p>
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
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Eingehend
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="pending_review">Prüfung</SelectItem>
              <SelectItem value="first_approval">1. Freigabe</SelectItem>
              <SelectItem value="approved">Freigegeben</SelectItem>
              <SelectItem value="paid">Bezahlt</SelectItem>
              <SelectItem value="rejected">Abgelehnt</SelectItem>
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Neue Rechnung
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neue Kreditorenrechnung</DialogTitle>
                <DialogDescription>
                  Laden Sie eine Rechnung hoch für automatische KI-Erkennung oder erfassen Sie manuell
                </DialogDescription>
              </DialogHeader>
              
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
                  <h4 className="font-medium mb-1">KI-Rechnungserkennung</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Laden Sie ein Bild oder PDF hoch - die KI extrahiert alle Daten automatisch
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Wird analysiert...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Rechnung hochladen
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
                  <h4 className="font-medium text-sm text-muted-foreground">Lieferant</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Firma *</Label>
                      <Input 
                        placeholder="Firmenname" 
                        value={formData.vendor_name}
                        onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Adresse</Label>
                      <Input 
                        placeholder="Strasse, PLZ Ort" 
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
                      <Label>UID/MwSt-Nr.</Label>
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
                  <h4 className="font-medium text-sm text-muted-foreground">Rechnungsdetails</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Rechnungsnummer</Label>
                      <Input 
                        placeholder="z.B. INV-2025-001" 
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Zahlungsreferenz</Label>
                      <Input 
                        placeholder="ESR/QR-Referenz" 
                        value={formData.payment_reference}
                        onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rechnungsdatum</Label>
                      <Input 
                        type="date" 
                        value={formData.invoice_date}
                        onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fälligkeitsdatum</Label>
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
                  <h4 className="font-medium text-sm text-muted-foreground">Beträge</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Betrag *</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Währung</Label>
                      <Select 
                        value={formData.currency} 
                        onValueChange={(v) => setFormData({ ...formData, currency: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Währung" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>MwSt-Betrag</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        value={formData.vat_amount}
                        onChange={(e) => setFormData({ ...formData, vat_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>MwSt-Satz %</Label>
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
                  <Label>Beschreibung</Label>
                  <Textarea 
                    placeholder="Beschreibung der Rechnung/Leistungen..." 
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  Abbrechen
                </Button>
                <Button onClick={handleSubmit} disabled={createInvoice.isPending || isScanning}>
                  {createInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Erstellen
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
            Rechnungen
          </CardTitle>
          <CardDescription>
            {filteredInvoices.length} Rechnungen gefunden
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
              <h3 className="text-lg font-medium text-foreground mb-2">Keine Rechnungen vorhanden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Erstellen Sie Ihre erste Rechnung.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Rechnung
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Fälligkeit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const statusConfig = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending_review;
                  const StatusIcon = statusConfig.icon;
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
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
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
