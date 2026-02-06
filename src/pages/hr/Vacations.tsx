import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palmtree, Calendar, Clock, CheckCircle, Plus } from "lucide-react";
import { useVacations } from "@/hooks/useVacations";
import { VacationRequestDialog } from "@/components/hr/VacationRequestDialog";
import { VacationRequestsTable } from "@/components/hr/VacationRequestsTable";

export default function Vacations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    requests,
    requestsLoading,
    remainingDays,
    pendingCount,
    approvedThisMonth,
    currentAbsences,
    isManager,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
  } = useVacations();

  const handleCreateRequest = (data: {
    start_date: string;
    end_date: string;
    days_count: number;
    reason?: string;
  }) => {
    createRequest.mutate(data, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  return (
    <Layout title="Ferienmanagement" subtitle="Verwalten Sie Ferienanträge und Abwesenheiten">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ferienmanagement</h1>
            <p className="text-muted-foreground">Verwalten Sie Ferienanträge und Abwesenheiten</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Antrag stellen
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offene Anträge</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Warten auf Genehmigung</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Genehmigte Ferien</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedThisMonth}</div>
              <p className="text-xs text-muted-foreground">Diesen Monat</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verbleibende Tage</CardTitle>
              <Palmtree className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {remainingDays !== null ? remainingDays : "—"}
              </div>
              <p className="text-xs text-muted-foreground">Ihr Ferienguthaben</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktuelle Abwesenheiten</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentAbsences}</div>
              <p className="text-xs text-muted-foreground">Heute abwesend</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ferienanträge</CardTitle>
            <CardDescription>
              {isManager
                ? "Übersicht aller Ferienanträge"
                : "Ihre eingereichten Ferienanträge"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Laden...</div>
            ) : (
              <VacationRequestsTable
                requests={requests}
                isManager={isManager}
                onApprove={(id) => approveRequest.mutate(id)}
                onReject={(id, reason) => rejectRequest.mutate({ requestId: id, reason })}
                onCancel={(id) => cancelRequest.mutate(id)}
              />
            )}
          </CardContent>
        </Card>

        <VacationRequestDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleCreateRequest}
          isLoading={createRequest.isPending}
        />
      </div>
    </Layout>
  );
}
