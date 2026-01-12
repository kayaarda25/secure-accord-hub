import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";

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
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "deadline", label: "Deadline", icon: AlertTriangle },
  { value: "finance", label: "Finance", icon: Wallet },
  { value: "contract", label: "Contract", icon: FileText },
  { value: "other", label: "Other", icon: CalendarIcon },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting",
    priority: "normal",
    is_recurring: false,
    recurrence_type: "none",
    recurrence_end_date: "",
    selectedParticipants: [] as string[],
  });

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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title || !formData.event_date) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("calendar_events")
        .insert({
          title: formData.title,
          description: formData.description || null,
          event_date: formData.event_date,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          location: formData.location || null,
          event_type: formData.event_type,
          priority: formData.priority,
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
          recurrence_end_date: formData.is_recurring && formData.recurrence_end_date ? formData.recurrence_end_date : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add participants if any selected
      if (formData.selectedParticipants.length > 0) {
        const participantsToInsert = formData.selectedParticipants.map(userId => ({
          event_id: eventData.id,
          user_id: userId,
          status: "pending",
        }));

        const { error: partError } = await supabase
          .from("calendar_event_participants")
          .insert(participantsToInsert);

        if (partError) throw partError;
      }

      toast.success("Event created successfully");
      resetForm();
      setCreateDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event");
    } finally {
      setIsSubmitting(false);
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
      toast.success(`Event ${status}`);
      fetchEvents();
    } catch (error) {
      console.error("Error responding to event:", error);
      toast.error("Failed to respond to event");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_date: "",
      start_time: "",
      end_time: "",
      location: "",
      event_type: "meeting",
      priority: "normal",
      is_recurring: false,
      recurrence_type: "none",
      recurrence_end_date: "",
      selectedParticipants: [],
    });
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
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
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
      <Layout title="Calendar & Deadlines" subtitle="Overview of all important dates">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Calendar & Deadlines" subtitle="Overview of all important dates">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Pending Invitations ({pendingInvitations.length})
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
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRespondToEvent(event.id, "declined")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
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

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="glow-gold">
              <Plus size={16} className="mr-2" />
              New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Add a new event to your calendar
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select 
                    value={formData.event_type} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, event_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Event location"
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                />
              </div>

              {/* Recurrence */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_recurring: checked as boolean }))
                    }
                  />
                  <Label htmlFor="recurring" className="flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring Event
                  </Label>
                </div>

                {formData.is_recurring && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Repeat</Label>
                      <Select 
                        value={formData.recurrence_type} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, recurrence_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_OPTIONS.filter(o => o.value !== "none").map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Until</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Share with participants */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share with
                </Label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {profiles
                    .filter(p => p.user_id !== user?.id)
                    .map(profile => (
                      <div key={profile.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={profile.id}
                          checked={formData.selectedParticipants.includes(profile.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({
                                ...prev,
                                selectedParticipants: [...prev.selectedParticipants, profile.user_id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                selectedParticipants: prev.selectedParticipants.filter(id => id !== profile.user_id)
                              }));
                            }
                          }}
                        />
                        <Label htmlFor={profile.id} className="text-sm">
                          {profile.first_name || profile.last_name 
                            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
                            : profile.email}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="glow-gold">
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Event
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-state p-4 sm:p-6">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
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
          <h3 className="font-semibold text-foreground">Upcoming Events</h3>
          {upcomingEvents.length === 0 ? (
            <div className="card-state p-6 text-center">
              <CalendarIcon size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
              <p className="text-xs text-muted-foreground mt-1">Click "New Event" to add one</p>
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
                      <MapPin size={12} />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.participants && event.participants.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={12} />
                      <span>
                        {event.participants.length} participant{event.participants.length !== 1 ? "s" : ""}
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