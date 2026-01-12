import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  FileText,
  Download,
  Plus,
  Clock,
  Calendar,
  Mail,
  Trash2,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  recipients: string[];
  format: string;
  last_run_at: string | null;
  next_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

const reportTypes = [
  { value: "opex", label: "OPEX-Übersicht", icon: FileText },
  { value: "declarations", label: "Deklarationen", icon: FileText },
  { value: "budget", label: "Budget-Analyse", icon: BarChart },
  { value: "compliance", label: "Compliance-Status", icon: FileText },
  { value: "financial_summary", label: "Finanzzusammenfassung", icon: BarChart },
];

const frequencies = [
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Quartalsweise" },
];

const formats = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "csv", label: "CSV" },
];

export default function Reports() {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [isAddReportOpen, setIsAddReportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchScheduledReports();
  }, []);

  const fetchScheduledReports = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
    } else {
      setScheduledReports(data || []);
    }
    setIsLoading(false);
  };

  const handleAddReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const recipients = (formData.get("recipients") as string)
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const { error } = await supabase.from("scheduled_reports").insert({
      name: formData.get("name") as string,
      report_type: formData.get("report_type") as string,
      frequency: formData.get("frequency") as string,
      format: formData.get("format") as string,
      recipients,
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Fehler", description: "Report konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Geplanter Report wurde erstellt" });
      setIsAddReportOpen(false);
      fetchScheduledReports();
    }
  };

  const handleGenerateReport = async (type: string, format: string) => {
    setIsGenerating(type);
    
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    toast({
      title: "Report generiert",
      description: `Der ${reportTypes.find((r) => r.value === type)?.label}-Report wurde erstellt.`,
    });
    
    setIsGenerating(null);
  };

  const handleDeleteReport = async (id: string) => {
    const { error } = await supabase
      .from("scheduled_reports")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Fehler", description: "Report konnte nicht gelöscht werden", variant: "destructive" });
    } else {
      toast({ title: "Gelöscht", description: "Geplanter Report wurde gelöscht" });
      fetchScheduledReports();
    }
  };

  const getReportTypeLabel = (type: string) => {
    return reportTypes.find((r) => r.value === type)?.label || type;
  };

  const getFrequencyLabel = (freq: string) => {
    return frequencies.find((f) => f.value === freq)?.label || freq;
  };

  return (
    <Layout title="Reports" subtitle="Berichte generieren und automatisieren">
      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate">Report erstellen</TabsTrigger>
          <TabsTrigger value="scheduled">Geplante Reports</TabsTrigger>
        </TabsList>

        {/* Generate Reports Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((report) => (
              <Card key={report.value} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <report.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.label}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "pdf")}
                      disabled={isGenerating === report.value}
                    >
                      {isGenerating === report.value ? (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "excel")}
                      disabled={isGenerating === report.value}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(report.value, "csv")}
                      disabled={isGenerating === report.value}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Date Range Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Zeitraum für Reports</CardTitle>
              <CardDescription>
                Wählen Sie den Zeitraum für die Reportgenerierung
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Heute</Button>
                  <Button variant="outline" size="sm">Diese Woche</Button>
                  <Button variant="outline" size="sm">Dieser Monat</Button>
                  <Button variant="outline" size="sm">Dieses Quartal</Button>
                  <Button variant="outline" size="sm">Dieses Jahr</Button>
                </div>
                <div className="flex gap-2 items-center ml-auto">
                  <Label>Von:</Label>
                  <Input type="date" className="w-40" />
                  <Label>Bis:</Label>
                  <Input type="date" className="w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Geplante Reports</CardTitle>
                  <CardDescription>
                    Automatische Reports die regelmäßig generiert und versendet werden
                  </CardDescription>
                </div>
                <Dialog open={isAddReportOpen} onOpenChange={setIsAddReportOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Neuer Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Geplanten Report erstellen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddReport} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" required placeholder="z.B. Monatlicher OPEX-Report" />
                      </div>
                      <div>
                        <Label>Report-Typ *</Label>
                        <Select name="report_type" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {reportTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Häufigkeit *</Label>
                        <Select name="frequency" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencies.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Format *</Label>
                        <Select name="format" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {formats.map((fmt) => (
                              <SelectItem key={fmt.value} value={fmt.value}>
                                {fmt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="recipients">Empfänger (E-Mails, kommagetrennt) *</Label>
                        <Input
                          id="recipients"
                          name="recipients"
                          required
                          placeholder="email1@example.com, email2@example.com"
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        Report planen
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Laden...</div>
              ) : scheduledReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine geplanten Reports vorhanden</p>
                  <p className="text-sm">Erstellen Sie Ihren ersten automatisierten Report</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Häufigkeit</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Empfänger</TableHead>
                      <TableHead>Nächste Ausführung</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduledReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell>{getReportTypeLabel(report.report_type)}</TableCell>
                        <TableCell>{getFrequencyLabel(report.frequency)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{report.recipients?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.next_run_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(report.next_run_at), "dd.MM.yyyy HH:mm", { locale: de })}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={report.is_active ? "default" : "secondary"}>
                            {report.is_active ? "Aktiv" : "Pausiert"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleGenerateReport(report.report_type, report.format)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
