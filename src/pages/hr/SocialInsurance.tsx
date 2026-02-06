import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Shield, FileCheck, Plus } from "lucide-react";
import { useSocialInsurance } from "@/hooks/useSocialInsurance";
import { SocialInsuranceTable } from "@/components/hr/SocialInsuranceTable";
import { AddInsuranceRecordDialog } from "@/components/hr/AddInsuranceRecordDialog";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value);
};

export default function SocialInsurance() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    records,
    isLoading,
    canManage,
    currentYear,
    currentMonth,
    monthlyTotals,
    upsertRecord,
    deleteRecord,
  } = useSocialInsurance();

  const handleAddRecord = (data: {
    user_id: string;
    year: number;
    month: number;
    gross_salary: number;
    bvg_total: number;
    notes?: string;
  }) => {
    upsertRecord.mutate(data, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  return (
    <Layout title="Sozialversicherungen" subtitle="AHV, BVG, UVG und weitere Sozialversicherungsbeiträge">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sozialversicherungen</h1>
            <p className="text-muted-foreground">AHV, BVG, UVG und weitere Sozialversicherungsbeiträge</p>
          </div>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Eintrag hinzufügen
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AHV/IV/EO</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyTotals.ahv)}</div>
              <p className="text-xs text-muted-foreground">Monatliche Beiträge (AN + AG)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">BVG</CardTitle>
              <HeartHandshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyTotals.bvg)}</div>
              <p className="text-xs text-muted-foreground">Pensionskassenbeiträge (AN + AG)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">UVG</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyTotals.uvg)}</div>
              <p className="text-xs text-muted-foreground">Unfallversicherung</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Versicherungsübersicht</CardTitle>
            <CardDescription>
              Sozialversicherungsbeiträge nach Mitarbeiter und Periode
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Laden...</div>
            ) : (
              <SocialInsuranceTable
                records={records}
                canManage={canManage}
                onDelete={(id) => deleteRecord.mutate(id)}
              />
            )}
          </CardContent>
        </Card>

        <AddInsuranceRecordDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleAddRecord}
          isLoading={upsertRecord.isPending}
          currentYear={currentYear}
          currentMonth={currentMonth}
        />
      </div>
    </Layout>
  );
}
