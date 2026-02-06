import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Mail, Phone, MoreHorizontal, Edit, Shield, UserX, UserCheck, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EmployeeEditDialog } from "@/components/employees/EmployeeEditDialog";
import { RolesDialog } from "@/components/employees/RolesDialog";
import { InviteEmployeeDialog } from "@/components/employees/InviteEmployeeDialog";

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

export default function Employees() {
  const { profile, hasRole } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchEmployees();
    }
  }, [profile?.organization_id]);

  const fetchEmployees = async () => {
    if (!profile?.organization_id) return;
    
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          email,
          first_name,
          last_name,
          department,
          position,
          phone,
          avatar_url,
          is_active
        `)
        .eq("organization_id", profile.organization_id)
        .order("first_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to profiles
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

  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      emp.first_name?.toLowerCase().includes(searchLower) ||
      emp.last_name?.toLowerCase().includes(searchLower) ||
      emp.email.toLowerCase().includes(searchLower) ||
      emp.department?.toLowerCase().includes(searchLower) ||
      emp.position?.toLowerCase().includes(searchLower)
    );
  });

  const activeCount = employees.filter((e) => e.is_active).length;
  const inactiveCount = employees.filter((e) => !e.is_active).length;

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "management":
        return "default";
      case "finance":
        return "secondary";
      case "state":
        return "outline";
      default:
        return "secondary";
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

  return (
    <Layout title="Mitarbeiter" subtitle="HR-Verwaltung und Mitarbeiterübersicht">
      <div className="space-y-6">
        {/* Header with stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Users size={18} className="text-muted-foreground" />
              <span className="font-medium">{employees.length}</span>
              <span className="text-muted-foreground">Gesamt</span>
            </div>
            <Badge variant="default">
              {activeCount} Aktiv
            </Badge>
            {inactiveCount > 0 && (
              <Badge variant="secondary">
                {inactiveCount} Inaktiv
              </Badge>
            )}
          </div>
          {isAdmin && (
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Mitarbeiter einladen
            </Button>
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

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mitarbeiterliste</CardTitle>
            <CardDescription>
              {isAdmin 
                ? "Verwalten Sie Mitarbeiter, Rollen und Berechtigungen"
                : "Übersicht aller Mitarbeiter in Ihrer Organisation"
              }
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
                        <TableCell>
                          <span className="text-sm">{employee.position || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{employee.department || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            {employee.phone && (
                              <div className="flex items-center gap-1">
                                <Phone size={12} />
                                <span>{employee.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Mail size={12} />
                              <span>{employee.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {employee.roles.length > 0 ? (
                              employee.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant={getRoleBadgeVariant(role)}
                                  className="text-xs capitalize"
                                >
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
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openRolesDialog(employee)}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Rollen verwalten
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleActive(employee)}
                                  className={employee.is_active ? "text-destructive" : ""}
                                >
                                  {employee.is_active ? (
                                    <>
                                      <UserX className="mr-2 h-4 w-4" />
                                      Deaktivieren
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Aktivieren
                                    </>
                                  )}
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
      </div>

      {/* Dialogs - only mount when needed to avoid Radix ref composition issues */}
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
    </Layout>
  );
}
