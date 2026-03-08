import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Mail, Phone, MoreHorizontal, Edit, Shield, UserX, UserCheck, UserPlus, Briefcase, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EmployeeEditDialog } from "@/components/employees/EmployeeEditDialog";
import { RolesDialog } from "@/components/employees/RolesDialog";
import { InviteEmployeeDialog } from "@/components/employees/InviteEmployeeDialog";
import { CreateEmployeeDialog } from "@/components/employees/CreateEmployeeDialog";

type AppRole = "admin" | "state" | "management" | "finance" | "partner";

interface Employee {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  roles: AppRole[];
}

interface ExternalEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  position: string | null;
  ahv_number: string | null;
  marital_status: string | null;
  children_count: number | null;
  monthly_salary: number | null;
  employment_type: string | null;
  employment_start: string | null;
  employment_end: string | null;
  birth_date: string | null;
  nationality: string | null;
  address: string | null;
  bank_iban: string | null;
  notes: string | null;
}

const maritalLabels: Record<string, string> = {
  single: "Ledig",
  married: "Verheiratet",
  divorced: "Geschieden",
  widowed: "Verwitwet",
  separated: "Getrennt",
  registered_partnership: "Eingetr. Partnerschaft",
};

const employmentLabels: Record<string, string> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  temporary: "Temporär",
  intern: "Praktikum",
  freelance: "Freelance",
};

export default function Employees() {
  const { profile, hasRole } = useAuth();
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [externalEmployees, setExternalEmployees] = useState<ExternalEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const isAdmin = hasRole("admin");
  const canManageHR = isAdmin || hasRole("management") || hasRole("finance");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchEmployees();
      fetchExternalEmployees();
    }
  }, [profile?.organization_id]);

  const fetchEmployees = async () => {
    if (!profile?.organization_id) return;
    
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name, department, position, phone, avatar_url, is_active")
        .eq("organization_id", profile.organization_id)
        .order("first_name", { ascending: true });

      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const employeesWithRoles = (profiles || []).map((p) => ({
        ...p,
        roles: allRoles
          ?.filter((r) => r.user_id === p.user_id)
          .map((r) => r.role as AppRole) || [],
      }));

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Fehler beim Laden der Mitarbeiter");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExternalEmployees = async () => {
    if (!profile?.organization_id) return;
    try {
      const { data, error } = await supabase
        .from("employee_records")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("is_system_user", false)
        .is("profile_id", null)
        .order("first_name", { ascending: true });

      if (error) throw error;
      setExternalEmployees(data || []);
    } catch (error) {
      console.error("Error fetching external employees:", error);
    }
  };

  const handleToggleActive = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (error) throw error;
      toast.success(employee.is_active ? "Mitarbeiter deaktiviert" : "Mitarbeiter aktiviert");
      fetchEmployees();
    } catch (error) {
      console.error("Error toggling employee status:", error);
      toast.error("Fehler beim Ändern des Status");
    }
  };

  const handleDeleteExternal = async (id: string) => {
    if (!confirm("Mitarbeiter wirklich löschen?")) return;
    try {
      const { error } = await supabase.from("employee_records").delete().eq("id", id);
      if (error) throw error;
      toast.success("Mitarbeiter gelöscht");
      fetchExternalEmployees();
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const s = searchQuery.toLowerCase();
    return (
      emp.first_name?.toLowerCase().includes(s) ||
      emp.last_name?.toLowerCase().includes(s) ||
      emp.email.toLowerCase().includes(s) ||
      emp.department?.toLowerCase().includes(s) ||
      emp.position?.toLowerCase().includes(s)
    );
  });

  const filteredExternal = externalEmployees.filter((emp) => {
    const s = searchQuery.toLowerCase();
    return (
      emp.first_name?.toLowerCase().includes(s) ||
      emp.last_name?.toLowerCase().includes(s) ||
      emp.email?.toLowerCase().includes(s) ||
      emp.position?.toLowerCase().includes(s)
    );
  });

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "management": return "default";
      case "finance": return "secondary";
      case "state": return "outline";
      default: return "secondary";
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditDialogOpen(true);
  };

  const openRolesDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setRolesDialogOpen(true);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("de-CH") : "—";
  const formatCHF = (v: number | null) => v != null ? new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(v) : "—";

  return (
    <Layout title={t("page.employees.title")} subtitle={t("page.employees.subtitle")}>
      <div className="space-y-6">
        {/* Header with stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Users size={18} className="text-muted-foreground" />
              <span className="font-medium">{employees.length + externalEmployees.length}</span>
              <span className="text-muted-foreground">Gesamt</span>
            </div>
            <Badge variant="default">{activeCount} Aktiv</Badge>
            {inactiveCount > 0 && <Badge variant="secondary">{inactiveCount} Inaktiv</Badge>}
            {externalEmployees.length > 0 && (
              <Badge variant="outline">
                <Briefcase className="mr-1 h-3 w-3" />
                {externalEmployees.length} Extern
              </Badge>
            )}
          </div>
          {canManageHR && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Briefcase className="mr-2 h-4 w-4" />
                Mitarbeiter erfassen
              </Button>
              {isAdmin && (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Mitarbeiter einladen
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, E-Mail, Abteilung oder Position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="system" className="space-y-4">
          <TabsList>
            <TabsTrigger value="system">Systembenutzer ({employees.length})</TabsTrigger>
            <TabsTrigger value="external">Ohne Systemzugang ({externalEmployees.length})</TabsTrigger>
          </TabsList>

          {/* System users tab */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mitarbeiter mit Systemzugang</CardTitle>
                <CardDescription>
                  Benutzer mit Login-Zugriff auf die Plattform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Keine Mitarbeiter gefunden</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mitarbeiter</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Abteilung</TableHead>
                          <TableHead>Kontakt</TableHead>
                          <TableHead>Rollen</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => (
                          <TableRow key={employee.id} className={!employee.is_active ? "opacity-50" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={employee.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(employee.first_name, employee.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-foreground">
                                    {employee.first_name || ""} {employee.last_name || ""}
                                    {!employee.first_name && !employee.last_name && (
                                      <span className="text-muted-foreground italic">Kein Name</span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{employee.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-sm">{employee.position || "—"}</span></TableCell>
                            <TableCell><span className="text-sm">{employee.department || "—"}</span></TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                {employee.phone && (
                                  <div className="flex items-center gap-1"><Phone size={12} /><span>{employee.phone}</span></div>
                                )}
                                <div className="flex items-center gap-1"><Mail size={12} /><span>{employee.email}</span></div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {employee.roles.length > 0 ? (
                                  employee.roles.map((role) => (
                                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs capitalize">
                                      {role}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={employee.is_active ? "default" : "secondary"}>
                                {employee.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                                      <Edit className="mr-2 h-4 w-4" />Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openRolesDialog(employee)}>
                                      <Shield className="mr-2 h-4 w-4" />Rollen verwalten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleToggleActive(employee)} className={employee.is_active ? "text-destructive" : ""}>
                                      {employee.is_active ? <><UserX className="mr-2 h-4 w-4" />Deaktivieren</> : <><UserCheck className="mr-2 h-4 w-4" />Aktivieren</>}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* External employees tab */}
          <TabsContent value="external">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mitarbeiter ohne Systemzugang</CardTitle>
                <CardDescription>
                  Mitarbeiter, die nur in der HR-Verwaltung erfasst sind (kein Login)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredExternal.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Keine externen Mitarbeiter erfasst</p>
                    {canManageHR && (
                      <Button variant="outline" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        Mitarbeiter erfassen
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>AHV-Nr.</TableHead>
                          <TableHead>Monatslohn</TableHead>
                          <TableHead>Beschäftigung</TableHead>
                          <TableHead>Eintritt</TableHead>
                          <TableHead>Zivilstand</TableHead>
                          {canManageHR && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExternal.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(emp.first_name, emp.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-foreground">
                                    {emp.first_name || ""} {emp.last_name || ""}
                                  </p>
                                  {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell><span className="text-sm">{emp.position || "—"}</span></TableCell>
                            <TableCell><span className="text-sm font-mono">{emp.ahv_number || "—"}</span></TableCell>
                            <TableCell><span className="text-sm">{formatCHF(emp.monthly_salary)}</span></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {employmentLabels[emp.employment_type || ""] || emp.employment_type || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell><span className="text-sm">{formatDate(emp.employment_start)}</span></TableCell>
                            <TableCell><span className="text-sm">{maritalLabels[emp.marital_status || ""] || "—"}</span></TableCell>
                            {canManageHR && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleDeleteExternal(emp.id)} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {editDialogOpen && selectedEmployee && (
        <EmployeeEditDialog
          employee={selectedEmployee}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchEmployees}
        />
      )}

      {rolesDialogOpen && selectedEmployee && (
        <RolesDialog
          employee={selectedEmployee}
          open={rolesDialogOpen}
          onOpenChange={setRolesDialogOpen}
          onSuccess={fetchEmployees}
        />
      )}

      {inviteDialogOpen && (
        <InviteEmployeeDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSuccess={fetchEmployees}
        />
      )}

      {createDialogOpen && (
        <CreateEmployeeDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => { fetchExternalEmployees(); }}
        />
      )}
    </Layout>
  );
}
