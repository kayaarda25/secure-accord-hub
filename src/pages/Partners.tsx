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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Search,
  Mail,
  Phone,
  User,
  FileText,
  MessageSquare,
  Edit,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

interface Contract {
  id: string;
  organization_id: string | null;
  name: string;
  contract_number: string | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
  currency: string;
  status: string;
}

export default function Partners() {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, hasAnyRole } = useAuth();
  const { toast } = useToast();

  const canManage = hasAnyRole(["admin", "management", "state"]);

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchContacts(selectedPartner.id);
      fetchContracts(selectedPartner.id);
    }
  }, [selectedPartner]);

  const fetchPartners = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("type", "partner")
      .order("name");

    if (error) {
      console.error("Error fetching partners:", error);
      toast({ title: "Fehler", description: "Partner konnten nicht geladen werden", variant: "destructive" });
    } else {
      setPartners(data || []);
      if (data && data.length > 0 && !selectedPartner) {
        setSelectedPartner(data[0]);
      }
    }
    setIsLoading(false);
  };

  const fetchContacts = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "partner")
      .order("is_primary", { ascending: false });

    if (!error) {
      setContacts(data || []);
    }
  };

  const fetchContracts = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (!error) {
      setContracts(data || []);
    }
  };

  const handleAddPartner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name: formData.get("name") as string,
        type: "partner",
        country: formData.get("country") as string,
        contact_email: formData.get("email") as string,
        contact_phone: formData.get("phone") as string,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fehler", description: "Partner konnte nicht erstellt werden", variant: "destructive" });
    } else {
      toast({ title: "Erfolg", description: "Partner wurde erstellt" });
      setIsAddPartnerOpen(false);
      fetchPartners();
      setSelectedPartner(data);
    }
  };

  const handleAddContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPartner || !user) return;

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from("contacts")
      .insert({
        organization_id: selectedPartner.id,
        type: "partner",
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
      fetchContacts(selectedPartner.id);
    }
  };

  const filteredPartners = partners.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title={t("page.partners.title")} subtitle={t("page.partners.subtitle")}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partner List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Partner</CardTitle>
              {canManage && (
                <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Neu
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Neuen Partner hinzufügen</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPartner} className="space-y-4">
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
                      <Button type="submit" className="w-full">Partner erstellen</Button>
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
              ) : filteredPartners.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Keine Partner gefunden
                </div>
              ) : (
                filteredPartners.map((partner) => (
                  <div
                    key={partner.id}
                    onClick={() => setSelectedPartner(partner)}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedPartner?.id === partner.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{partner.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {partner.country || "Kein Land"}
                        </p>
                      </div>
                      <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                        {partner.status === "active" ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Partner Details */}
        <Card className="lg:col-span-2">
          {selectedPartner ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedPartner.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedPartner.country}
                    </p>
                  </div>
                  <Badge variant={selectedPartner.status === "active" ? "default" : "secondary"}>
                    {selectedPartner.status === "active" ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
                <div className="flex gap-4 mt-4 text-sm">
                  {selectedPartner.contact_email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {selectedPartner.contact_email}
                    </div>
                  )}
                  {selectedPartner.contact_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {selectedPartner.contact_phone}
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
                      Kontaktpersonen ({contacts.length})
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

                {/* Contracts Section */}
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4" />
                    Verträge ({contracts.length})
                  </h3>
                  {contracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Verträge vorhanden</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vertrag</TableHead>
                          <TableHead>Laufzeit</TableHead>
                          <TableHead>Wert</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{contract.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {contract.contract_number}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {contract.start_date && contract.end_date ? (
                                <span className="text-sm">
                                  {new Date(contract.start_date).toLocaleDateString("de-DE")} -{" "}
                                  {new Date(contract.end_date).toLocaleDateString("de-DE")}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell>
                              {contract.value
                                ? `${contract.currency} ${contract.value.toLocaleString("de-CH")}`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  contract.status === "active"
                                    ? "default"
                                    : contract.status === "expired"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {contract.status === "active"
                                  ? "Aktiv"
                                  : contract.status === "expired"
                                  ? "Abgelaufen"
                                  : contract.status === "draft"
                                  ? "Entwurf"
                                  : "Beendet"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Wählen Sie einen Partner aus</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
