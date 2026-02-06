import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Mail, Phone, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  organization?: {
    name: string;
  } | null;
  roles: string[];
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Fetch profiles with organization info
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
          is_active,
          organizations:organization_id (
            name
          )
        `)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to profiles
      const employeesWithRoles = (profiles || []).map((profile) => ({
        ...profile,
        organization: profile.organizations as { name: string } | null,
        roles: allRoles
          ?.filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role) || [],
      }));

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
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

  return (
    <Layout title="Mitarbeiter" subtitle="Übersicht aller Mitarbeiter und ihrer Funktionen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Mitarbeiter</h1>
            <p className="text-sm text-muted-foreground">
              Übersicht aller Mitarbeiter und ihrer Funktionen
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users size={18} />
            <span>{employees.length} Mitarbeiter</span>
          </div>
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
              Alle aktiven Mitarbeiter mit ihren Kontaktdaten und Rollen
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
                      <TableHead>Organisation</TableHead>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Rollen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
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
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 size={14} className="text-muted-foreground" />
                            <span>{employee.organization?.name || "—"}</span>
                          </div>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
