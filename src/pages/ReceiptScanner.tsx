import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Loader2,
  Check,
  Receipt,
  Sparkles,
  X,
  FileImage,
} from "lucide-react";
import { QRUploadSection } from "@/components/scanner/QRUploadSection";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  country: string | null;
}

interface ScannedData {
  title: string | null;
  amount: number | null;
  currency: string;
  category: string;
  vendor: string | null;
  date: string | null;
  description: string | null;
}

const CURRENCIES = ["CHF", "EUR", "USD", "UGX"];

export default function ReceiptScanner() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    currency: "CHF",
    category: "other",
    cost_center_id: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
  });

  const EXPENSE_CATEGORIES = [
    { value: "salaries", label: t("category.salaries") },
    { value: "rent", label: t("category.rent") },
    { value: "insurance", label: t("category.insurance") },
    { value: "transportation", label: t("category.transportation") },
    { value: "it", label: t("category.it") },
    { value: "utilities", label: t("category.utilities") },
    { value: "maintenance", label: t("category.maintenance") },
    { value: "marketing", label: t("category.marketing") },
    { value: "training", label: t("category.training") },
    { value: "office", label: t("category.office") },
    { value: "communication", label: t("category.communication") },
    { value: "other", label: t("category.other") },
  ];

  useEffect(() => {
    fetchCostCenters();
  }, [profile?.organization_id]);

  const fetchCostCenters = async () => {
    try {
      let orgName = "";
      if (profile?.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profile.organization_id)
          .single();
        
        if (orgData) {
          orgName = orgData.name.toLowerCase();
        }
      }

      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, code, name, country")
        .eq("is_active", true);

      if (error) throw error;
      
      let filtered = data || [];
      if (orgName) {
        if (orgName.includes("mgi m") || orgName.includes("mgi media")) {
          filtered = filtered.filter(cc => cc.code.startsWith("MGIM") && cc.name.toLowerCase().includes("allgemein"));
        } else if (orgName.includes("mgi c") || orgName.includes("mgi communication")) {
          filtered = filtered.filter(cc => cc.code.startsWith("MGIC") && cc.name.toLowerCase().includes("allgemein"));
        } else if (orgName.includes("gateway")) {
          filtered = filtered.filter(cc => cc.code.startsWith("GW") && cc.name.toLowerCase().includes("allgemein"));
        }
      } else {
        filtered = filtered.filter(cc => cc.name.toLowerCase().includes("allgemein"));
      }
      
      setCostCenters(filtered);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
      toast.error("Failed to load cost centers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanReceipt = async () => {
    if (!imageFile) {
      toast.error("Please select an image first");
      return;
    }

    setIsScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { 
          imageBase64: base64, 
          mimeType: imageFile.type 
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const scanned: ScannedData = data.data;
      
      setFormData(prev => ({
        ...prev,
        title: scanned.title || prev.title,
        amount: scanned.amount?.toString() || prev.amount,
        currency: scanned.currency || prev.currency,
        category: scanned.category || prev.category,
        description: scanned.description || prev.description,
        expense_date: scanned.date || prev.expense_date,
      }));

      toast.success("Receipt scanned successfully!");
    } catch (error) {
      console.error("Error scanning receipt:", error);
      toast.error("Failed to scan receipt");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title || !formData.amount || !formData.cost_center_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("opex_expenses")
        .insert({
          title: formData.title,
          description: formData.description || null,
          cost_center_id: formData.cost_center_id,
          category: formData.category,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          expense_date: formData.expense_date,
          submitted_by: user.id,
          expense_number: "",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Expense created successfully!");
      
      setFormData({
        title: "",
        amount: "",
        currency: "CHF",
        category: "other",
        cost_center_id: "",
        description: "",
        expense_date: new Date().toISOString().split("T")[0],
      });
      setSelectedImage(null);
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error creating expense:", error);
      toast.error("Failed to create expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <Layout title={t("page.scanner.title")} subtitle={t("page.scanner.subtitle")}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={t("page.scanner.title")} subtitle={t("page.scanner.subtitle")}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-accent" />
              {t("page.scanner.uploadReceipt")}
            </CardTitle>
            <CardDescription>
              {t("page.scanner.uploadDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedImage ? (
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Receipt preview"
                  className="w-full max-h-96 object-contain rounded-lg border border-border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="receipt-upload"
                className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors bg-muted/50"
              >
                <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                <span className="text-sm text-muted-foreground">
                  {t("page.scanner.clickUpload")}
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {t("page.scanner.fileHint")}
                </span>
              </label>
            )}
            
            <input
              ref={fileInputRef}
              id="receipt-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {selectedImage && (
              <Button
                onClick={handleScanReceipt}
                disabled={isScanning}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 glow-gold"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("page.scanner.scanning")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t("page.scanner.scanAI")}
                  </>
                )}
              </Button>
            )}

            {/* QR Code Section */}
            <div className="border-t border-border pt-4 mt-2">
              <QRUploadSection
                onImageReceived={(imageUrl, file) => {
                  setSelectedImage(imageUrl);
                  setImageFile(file);
                  toast.success("Bild vom Handy empfangen!");
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              {t("page.scanner.expenseDetails")}
            </CardTitle>
            <CardDescription>
              {t("page.scanner.reviewSubmit")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("page.scanner.titleField")} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t("page.scanner.titlePlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("common.amount")} *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t("common.currency")}</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t("common.category")} *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_center">{t("page.scanner.costCenter")} *</Label>
                <Select
                  value={formData.cost_center_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, cost_center_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("page.scanner.selectCostCenter")} />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense_date">{t("page.scanner.date")}</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("page.scanner.description")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t("page.scanner.descPlaceholder")}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("page.scanner.submitting")}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {t("page.scanner.submitOpex")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
