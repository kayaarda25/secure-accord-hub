import { useState } from "react";
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
} from "lucide-react";

interface Declaration {
  id: string;
  number: string;
  title: string;
  type: "vat" | "income" | "customs" | "other";
  period: string;
  dueDate: string;
  submittedDate?: string;
  status: "draft" | "pending" | "submitted" | "approved" | "rejected";
  amount: number;
  currency: string;
  organization: string;
}

const TYPE_LABELS: Record<string, string> = {
  vat: "MWST",
  income: "Einkommenssteuer",
  customs: "Zoll",
  other: "Sonstige",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  draft: { label: "Entwurf", variant: "secondary", icon: Edit },
  pending: { label: "Ausstehend", variant: "outline", icon: Clock },
  submitted: { label: "Eingereicht", variant: "default", icon: FileText },
  approved: { label: "Genehmigt", variant: "default", icon: CheckCircle },
  rejected: { label: "Abgelehnt", variant: "destructive", icon: AlertCircle },
};

export default function Declarations() {
  const [declarations] = useState<Declaration[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const formatCurrency = (amount: number, currency: string = "CHF") => {
    return new Intl.NumberFormat("de-CH", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredDeclarations = declarations.filter((decl) => {
    const matchesSearch = decl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      decl.number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || decl.type === filterType;
    return matchesSearch && matchesType;
  });

  const pendingCount = declarations.filter((d) => d.status === "pending" || d.status === "draft").length;
  const upcomingDeadlines = declarations.filter((d) => {
    const dueDate = new Date(d.dueDate);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0 && d.status !== "approved";
  }).length;

  return (
    <Layout title="Deklarationen" subtitle="Steuererklärungen und behördliche Meldungen">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
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
                <p className="text-sm text-muted-foreground">Ausstehend</p>
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
                <p className="text-sm text-muted-foreground">Fällig in 30 Tagen</p>
                <p className="text-2xl font-bold text-destructive">{upcomingDeadlines}</p>
              </div>
              <Calendar className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Genehmigt</p>
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
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="vat">MWST</SelectItem>
              <SelectItem value="income">Einkommenssteuer</SelectItem>
              <SelectItem value="customs">Zoll</SelectItem>
              <SelectItem value="other">Sonstige</SelectItem>
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
                Neue Deklaration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Deklaration erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie eine neue Steuerdeklaration oder behördliche Meldung
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input placeholder="z.B. MWST-Deklaration Q1 2025" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Typ</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vat">MWST</SelectItem>
                        <SelectItem value="income">Einkommenssteuer</SelectItem>
                        <SelectItem value="customs">Zoll</SelectItem>
                        <SelectItem value="other">Sonstige</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Periode</Label>
                    <Input placeholder="z.B. Q1 2025" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fälligkeitsdatum</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Bemerkungen</Label>
                  <Textarea placeholder="Optionale Bemerkungen..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={() => setCreateDialogOpen(false)}>
                  Erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Declarations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Deklarationen</CardTitle>
          <CardDescription>
            {filteredDeclarations.length} Deklarationen gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDeclarations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Keine Deklarationen vorhanden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Erstellen Sie Ihre erste Deklaration, um zu beginnen.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Neue Deklaration
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Fällig</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeclarations.map((decl) => {
                  const statusConfig = STATUS_CONFIG[decl.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={decl.id}>
                      <TableCell className="font-mono text-sm">{decl.number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{decl.title}</p>
                          <p className="text-xs text-muted-foreground">{decl.organization}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[decl.type]}</Badge>
                      </TableCell>
                      <TableCell>{decl.period}</TableCell>
                      <TableCell>{formatDate(decl.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {decl.amount > 0 ? formatCurrency(decl.amount, decl.currency) : "-"}
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
