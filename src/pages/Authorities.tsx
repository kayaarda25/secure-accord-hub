import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Globe,
  Plus,
  Search,
  Mail,
  Phone,
  User,
  FileText,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast } from "date-fns";
import { de } from "date-fns/locale";

interface Organization {
  id: string;
  name: string;
  type: string;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string | null;
}

interface Contact {
  id: string;
  organization_id: string | null;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
}

interface Document {
  id: string;
  name: string;
  type: string;
  expires_at: string | null;
  created_at: string;
}

export default function Authorities() {
  const { t } = useLanguage();
  const [authorities, setAuthorities] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedAuthority, setSelectedAuthority] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddAuthorityOpen, setIsAddAuthorityOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();

  const canManage = hasAnyRole(["admin", "management", "state"]);

  useEffect(() => {
    fetchAuthorities();
  }, []);

  useEffect(() => {
    if (selectedAuthority) {
      fetchContacts(selectedAuthority.id);
      fetchDocuments(selectedAuthority.id);
    }
  }, [selectedAuthority]);

  const fetchAuthorities = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("type", "authority")
      .order("name");

    if (error) {
      console.error("Error fetching authorities:", error);
      toast({ title: "Fehler", description: "Behörden konnten nicht geladen werden", variant: "destructive" });
    } else {
      setAuthorities(data || []);
      if (data && data.length > 0 && !selectedAuthority) {
        setSelectedAuthority(data[0]);
      }
    }
    setIsLoading(false);
  };

  const fetchContacts = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "authority")
      .order("is_primary", { ascending: false });

    if (!error) {
      setContacts(data || []);
    }
  };

  const fetchDocuments = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, type, expires_at, created_at")
      .eq("organization_id", organizationId)
      .order("expires_at", { ascending: true });

    if (!error) {
      setDocuments(data || []);
    }
  };

  const handleAddAuthority = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name: formData.get("name") as string,
        type: "authority",
        country: formData.get("country") as string,
        contact_email: formData.get("email") as string,
        contact_phone: formData.get("phone") as string,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fehler", description: "Behörde konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Behörde wurde erstellt" });
      setIsAddAuthorityOpen(false);
      fetchAuthorities();
      setSelectedAuthority(data);
    }
  };

  const handleAddContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAuthority || !user) return;

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from("contacts")
      .insert({
        organization_id: selectedAuthority.id,
        type: "authority",
        name: formData.get("name") as string,
        position: formData.get("position") as string,
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
        notes: formData.get("notes") as string,
        is_primary: formData.get("is_primary") === "on",
        created_by: user.id,
      });

    if (error) {
      toast({ title: "Fehler", description: "Kontakt konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Kontakt wurde hinzugefügt" });
      setIsAddContactOpen(false);
      fetchContacts(selectedAuthority.id);
    }
  };

  const getExpiryStatus = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = differenceInDays(new Date(expiresAt), new Date());
    if (isPast(new Date(expiresAt))) {
      return { label: "Abgelaufen", variant: "destructive" as const };
    }
    if (days <= 30) {
      return { label: `${days} Tage`, variant: "warning" as const };
    }
    return { label: format(new Date(expiresAt), "dd.MM.yyyy"), variant: "secondary" as const };
  };

  const filteredAuthorities = authorities.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingDeadlines = documents.filter((d) => {
    if (!d.expires_at) return false;
    const days = differenceInDays(new Date(d.expires_at), new Date());
    return days <= 30 && days >= 0;
  });

  return (
    <Layout title={t("page.authorities.title")} subtitle={t("page.authorities.subtitle")}>
      {/* Deadline Warnings */}
      {upcomingDeadlines.length > 0 && (
        <Card className="mb-6 border-warning bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Ablaufende Dokumente</p>
                <p className="text-sm text-muted-foreground">
                  {upcomingDeadlines.length} Dokument(e) laufen in den nächsten 30 Tagen ab
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Authorities List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Behörden</CardTitle>
              {canManage && (
                <Dialog open={isAddAuthorityOpen} onOpenChange={setIsAddAuthorityOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Neu
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Neue Behörde hinzufügen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddAuthority} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" required />
                      </div>
                      <div>
                        <Label htmlFor="country">Land</Label>
                        <Input id="country" name="country" />
                      </div>
                      <div>
                        <Label htmlFor="email">E-Mail</Label>
                        <Input id="email" name="email" type="email" />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefon</Label>
                        <Input id="phone" name="phone" />
                      </div>
                      <Button type="submit" className="w-full">Behörde erstellen</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-auto">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">Laden...</div>
              ) : filteredAuthorities.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Keine Behörden gefunden
                </div>
              ) : (
                filteredAuthorities.map((authority) => (
                  <div
                    key={authority.id}
                    onClick={() => setSelectedAuthority(authority)}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedAuthority?.id === authority.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Globe className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{authority.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {authority.country || "Kein Land"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Authority Details */}
        <Card className="lg:col-span-2">
          {selectedAuthority ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedAuthority.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedAuthority.country}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 text-sm">
                  {selectedAuthority.contact_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {selectedAuthority.contact_email}
                    </div>
                  )}
                  {selectedAuthority.contact_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {selectedAuthority.contact_phone}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contacts Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Ansprechpartner ({contacts.length})
                    </h3>
                    {canManage && (
                      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-1" />
                            Kontakt
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Kontakt hinzufügen</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleAddContact} className="space-y-4">
                            <div>
                              <Label htmlFor="contact-name">Name *</Label>
                              <Input id="contact-name" name="name" required />
                            </div>
                            <div>
                              <Label htmlFor="position">Position</Label>
                              <Input id="position" name="position" />
                            </div>
                            <div>
                              <Label htmlFor="contact-email">E-Mail</Label>
                              <Input id="contact-email" name="email" type="email" />
                            </div>
                            <div>
                              <Label htmlFor="contact-phone">Telefon</Label>
                              <Input id="contact-phone" name="phone" />
                            </div>
                            <div>
                              <Label htmlFor="notes">Notizen</Label>
                              <Textarea id="notes" name="notes" />
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" id="is_primary" name="is_primary" />
                              <Label htmlFor="is_primary">Hauptansprechpartner</Label>
                            </div>
                            <Button type="submit" className="w-full">Kontakt speichern</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Kontakte vorhanden</p>
                  ) : (
                    <div className="grid gap-3">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{contact.name}</p>
                              {contact.is_primary && (
                                <Badge variant="secondary" className="text-xs">Haupt</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{contact.position}</p>
                          </div>
                          <div className="flex gap-2">
                            {contact.email && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={`mailto:${contact.email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {contact.phone && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={`tel:${contact.phone}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compliance Documents Section */}
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4" />
                    Compliance-Dokumente ({documents.length})
                  </h3>
                  {documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dokument</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Ablaufdatum</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.map((doc) => {
                          const expiryStatus = getExpiryStatus(doc.expires_at);
                          return (
                            <TableRow key={doc.id}>
                              <TableCell className="font-medium">{doc.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{doc.type}</Badge>
                              </TableCell>
                              <TableCell>
                                {expiryStatus ? (
                                  <Badge variant={expiryStatus.variant === "warning" ? "secondary" : expiryStatus.variant}>
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {expiryStatus.label}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Wählen Sie eine Behörde aus</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
