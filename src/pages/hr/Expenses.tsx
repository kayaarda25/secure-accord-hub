import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, Plus, CheckCircle, XCircle, Clock, Banknote } from "lucide-react";
import { useExpenses } from "@/hooks/useExpenses";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "travel", label: "Reisekosten" },
  { value: "meals", label: "Verpflegung" },
  { value: "accommodation", label: "Unterkunft" },
  { value: "transport", label: "Transport" },
  { value: "office", label: "Büromaterial" },
  { value: "communication", label: "Kommunikation" },
  { value: "training", label: "Weiterbildung" },
  { value: "other", label: "Sonstiges" },
];

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  approved: { label: "Genehmigt", variant: "default" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
};

export default function Expenses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { user, profile } = useAuth();

  const {
    expenses,
    isLoading,
    isManager,
    totalPending,
    totalApproved,
    createExpense,
    approveExpense,
    rejectExpense,
  } = useExpenses();

  // Form state
  const [form, setForm] = useState({
    employee_id: "",
    expense_date: new Date().toISOString().split("T")[0],
    category: "other",
    description: "",
    amount: "",
    currency: "CHF",
    notes: "",
  });

  // Get employee records for the dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["employee-records-for-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("id, first_name, last_name, profile_id")
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Find current user's employee record
  const myEmployeeRecord = employees.find(
    (e) => e.profile_id && profile?.id && e.profile_id === profile.id
  );

  const handleSubmit = () => {
    const employeeId = form.employee_id || myEmployeeRecord?.id;
    if (!employeeId || !form.description || !form.amount) return;

    createExpense.mutate(
      {
        employee_id: employeeId,
        expense_date: form.expense_date,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        currency: form.currency,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setForm({
            employee_id: "",
            expense_date: new Date().toISOString().split("T")[0],
            category: "other",
            description: "",
            amount: "",
            currency: "CHF",
            notes: "",
          });
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectDialog || !rejectReason) return;
    rejectExpense.mutate(
      { id: rejectDialog, reason: rejectReason },
      {
        onSuccess: () => {
          setRejectDialog(null);
          setRejectReason("");
        },
      }
    );
  };

  const getCategoryLabel = (val: string) =>
    CATEGORIES.find((c) => c.value === val)?.label || val;

  return (
    <Layout title="Spesen" subtitle="Spesenabrechnungen erfassen und verwalten">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Spesenübersicht</h2>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Spesen erfassen
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Receipt className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Gesamt Einträge</p>
                  <p className="text-2xl font-bold text-foreground">{expenses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Ausstehend</p>
                  <p className="text-2xl font-bold text-foreground">CHF {totalPending.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Genehmigt</p>
                  <p className="text-2xl font-bold text-foreground">CHF {totalApproved.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Banknote className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Ø pro Eintrag</p>
                  <p className="text-2xl font-bold text-foreground">
                    CHF {expenses.length ? (expenses.reduce((s, e) => s + Number(e.amount), 0) / expenses.length).toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Spesenliste</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Laden...</p>
            ) : expenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Noch keine Spesen erfasst.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    {isManager && <TableHead>Aktionen</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const st = statusMap[expense.status] || statusMap.pending;
                    return (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.expense_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>{expense.employee_name}</TableCell>
                        <TableCell>{getCategoryLabel(expense.category)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                        <TableCell className="text-right font-medium">
                          {expense.currency} {Number(expense.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        {isManager && (
                          <TableCell>
                            {expense.status === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => approveExpense.mutate(expense.id)}
                                >
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRejectDialog(expense.id)}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Spesen erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isManager && (
              <div className="space-y-2">
                <Label>Mitarbeiter</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mitarbeiter wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Datum</Label>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="z.B. Zugfahrt Zürich-Bern"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Betrag</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Währung</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bemerkungen</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optionale Bemerkungen..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={createExpense.isPending}>
              Erfassen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Spesen ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Begründung</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Grund für die Ablehnung..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
