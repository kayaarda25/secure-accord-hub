import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayroll } from "@/hooks/usePayroll";
import { PayrollTable } from "@/components/hr/PayrollTable";
import { PayrollChart } from "@/components/hr/PayrollChart";
import { PayrollSummaryCards } from "@/components/hr/PayrollSummaryCards";
import { Skeleton } from "@/components/ui/skeleton";

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export default function Payroll() {
  const {
    payrollSummaries,
    isLoading,
    currentYear,
    currentMonth,
    totalEmployees,
    totalGrossSalary,
    totalNetSalary,
    totalEmployerCosts,
    totalPayrollCost,
    yearlyPayrollByMonth,
  } = usePayroll();

  return (
    <Layout title="Löhne" subtitle="Lohnabrechnung und Gehaltsübersichten">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Löhne</h1>
          <p className="text-muted-foreground">
            Lohnabrechnung und Gehaltsübersichten für {monthNames[currentMonth - 1]} {currentYear}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <PayrollSummaryCards
            totalEmployees={totalEmployees}
            totalGrossSalary={totalGrossSalary}
            totalNetSalary={totalNetSalary}
            totalEmployerCosts={totalEmployerCosts}
            totalPayrollCost={totalPayrollCost}
          />
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="yearly">Jahresverlauf</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lohnübersicht {monthNames[currentMonth - 1]} {currentYear}</CardTitle>
                <CardDescription>
                  Brutto- und Nettolöhne aller Mitarbeiter im aktuellen Monat
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <PayrollTable summaries={payrollSummaries} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detaillierte Lohnabrechnung</CardTitle>
                <CardDescription>
                  Aufschlüsselung aller Abzüge und Beiträge
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : payrollSummaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Keine Lohndaten vorhanden.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {payrollSummaries.map((summary) => (
                      <div
                        key={summary.id}
                        className="border rounded-lg p-4 space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{summary.employeeName}</h4>
                            <p className="text-sm text-muted-foreground">{summary.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Nettolohn</p>
                            <p className="text-xl font-bold text-primary">
                              {new Intl.NumberFormat("de-CH", {
                                style: "currency",
                                currency: "CHF",
                              }).format(summary.netSalary)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Bruttolohn</p>
                            <p className="font-medium">
                              {new Intl.NumberFormat("de-CH", {
                                style: "currency",
                                currency: "CHF",
                              }).format(summary.grossSalary)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Abzüge AN</p>
                            <p className="font-medium text-destructive">
                              -{new Intl.NumberFormat("de-CH", {
                                style: "currency",
                                currency: "CHF",
                              }).format(summary.employeeDeductions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">AG-Beiträge</p>
                            <p className="font-medium">
                              {new Intl.NumberFormat("de-CH", {
                                style: "currency",
                                currency: "CHF",
                              }).format(summary.employerCosts)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gesamtkosten AG</p>
                            <p className="font-semibold">
                              {new Intl.NumberFormat("de-CH", {
                                style: "currency",
                                currency: "CHF",
                              }).format(summary.totalCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="yearly" className="space-y-4">
            <PayrollChart data={yearlyPayrollByMonth} currentYear={currentYear} />

            <Card>
              <CardHeader>
                <CardTitle>Monatliche Übersicht {currentYear}</CardTitle>
                <CardDescription>
                  Lohnsummen pro Monat im aktuellen Jahr
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {yearlyPayrollByMonth.map((month) => (
                    <div
                      key={month.month}
                      className={`p-4 rounded-lg border ${
                        month.month === currentMonth
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <p className="text-sm text-muted-foreground">{month.monthName}</p>
                      <p className="text-lg font-semibold">
                        {new Intl.NumberFormat("de-CH", {
                          style: "currency",
                          currency: "CHF",
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(month.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {month.count} Mitarbeiter
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
