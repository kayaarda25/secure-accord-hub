import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  FileText,
  Wallet,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Repeat,
  Share2,
  Video,
} from "lucide-react";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  event_type: string;
  priority: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  created_by: string;
  participants?: EventParticipant[];
}

interface EventParticipant {
  id: string;
  user_id: string;
  status: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

const months = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "deadline", label: "Deadline", icon: AlertTriangle },
  { value: "finance", label: "Finanzen", icon: Wallet },
  { value: "contract", label: "Vertrag", icon: FileText },
  { value: "other", label: "Sonstiges", icon: CalendarIcon },
];

export default function Calendar() {
  const { user } = useAuth();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchProfiles();
  }, [currentMonth, currentYear]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("calendar_events")
        .select(`
          *,
          participants:calendar_event_participants(
            id,
            user_id,
            status
          )
        `)
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .order("event_date", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, first_name, last_name, email")
        .eq("is_active", true);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleRespondToEvent = async (eventId: string, status: "accepted" | "declined") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("calendar_event_participants")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(`Termin ${status === "accepted" ? "angenommen" : "abgelehnt"}`);
      fetchEvents();
    } catch (error) {
      console.error("Error responding to event:", error);
      toast.error("Fehler beim Antworten auf den Termin");
    }
  };

  const getEventIcon = (type: string) => {
    const eventType = EVENT_TYPES.find(t => t.value === type);
    const Icon = eventType?.icon || CalendarIcon;
    return <Icon size={14} />;
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-l-destructive bg-destructive/5";
      case "high":
        return "border-l-warning bg-warning/5";
      default:
        return "border-l-accent bg-accent/5";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-warning text-warning-foreground">Important</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const isZoomLink = (location: string | null): boolean => {
    if (!location) return false;
    return location.includes("zoom.us") || location.includes("zoom.com");
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.event_date === dateStr);
  };

  const upcomingEvents = events
    .filter(e => new Date(e.event_date) >= new Date())
    .slice(0, 5);

  const pendingInvitations = events.filter(e => 
    e.participants?.some(p => p.user_id === user?.id && p.status === "pending")
  );

  const getProfileName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    return profile?.email || "Unknown";
  };

  if (isLoading) {
    return (
      <Layout title="Kalender & Termine" subtitle="Übersicht aller wichtigen Termine">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Kalender & Termine" subtitle="Übersicht aller wichtigen Termine">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Offene Einladungen ({pendingInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvitations.map(event => (
                <div key={event.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(event.event_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRespondToEvent(event.id, "accepted")}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Annehmen
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRespondToEvent(event.id, "declined")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Ablehnen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-foreground min-w-[160px] text-center">
            {months[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <Button className="glow-gold" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={16} className="mr-2" />
          Neuer Termin
        </Button>
        
        <CreateEventDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          profiles={profiles}
          onEventCreated={fetchEvents}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-state p-4 sm:p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              const isToday =
                day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

              return (
                <div
                  key={index}
                  className={`min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 rounded-lg border transition-colors ${
                    day
                      ? "border-border/50 hover:border-border cursor-pointer"
                      : "border-transparent"
                  } ${isToday ? "bg-accent/10 border-accent/30" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          isToday ? "text-accent" : "text-foreground"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1 hidden sm:block">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate flex items-center gap-1 ${
                              event.priority === "critical"
                                ? "bg-destructive/20 text-destructive"
                                : event.priority === "high"
                                ? "bg-warning/20 text-warning"
                                : "bg-accent/20 text-accent"
                            }`}
                          >
                            {event.is_recurring && <Repeat className="h-3 w-3 flex-shrink-0" />}
                            {event.participants && event.participants.length > 0 && (
                              <Share2 className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="truncate">{event.title.slice(0, 10)}...</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                      {dayEvents.length > 0 && (
                        <div className="sm:hidden mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            dayEvents.some(e => e.priority === "critical")
                              ? "bg-destructive"
                              : dayEvents.some(e => e.priority === "high")
                              ? "bg-warning"
                              : "bg-accent"
                          }`} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Anstehende Termine</h3>
          {upcomingEvents.length === 0 ? (
            <div className="card-state p-6 text-center">
              <CalendarIcon size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Keine anstehenden Termine</p>
              <p className="text-xs text-muted-foreground mt-1">Klicken Sie auf "Neuer Termin" um einen hinzuzufügen</p>
            </div>
          ) : (
            upcomingEvents.map((event, index) => (
              <div
                key={event.id}
                className={`card-state p-4 border-l-2 ${getPriorityStyles(event.priority)} animate-fade-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getEventIcon(event.event_type)}
                    <span className="text-xs uppercase tracking-wider">
                      {EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                    </span>
                    {event.is_recurring && (
                      <Repeat className="h-3 w-3 text-accent" />
                    )}
                    {event.participants && event.participants.length > 0 && (
                      <Share2 className="h-3 w-3 text-accent" />
                    )}
                  </div>
                  {getPriorityBadge(event.priority)}
                </div>
                <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={12} />
                    <span>{formatDate(event.event_date)}</span>
                    {event.start_time && (
                      <>
                        <Clock size={12} className="ml-2" />
                        <span>{formatTime(event.start_time)}</span>
                        {event.end_time && <span>- {formatTime(event.end_time)}</span>}
                      </>
                    )}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      {isZoomLink(event.location) ? (
                        <>
                          <Video size={12} className="text-accent" />
                          <a 
                            href={event.location} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-accent hover:underline truncate"
                          >
                            Zoom-Meeting beitreten
                          </a>
                        </>
                      ) : (
                        <>
                          <MapPin size={12} />
                          <span>{event.location}</span>
                        </>
                      )}
                    </div>
                  )}
                  {event.participants && event.participants.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={12} />
                      <span>
                        {event.participants.length} Teilnehmer
                      </span>
                    </div>
                  )}
                  {event.description && (
                    <p className="mt-2">{event.description}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}