import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar,
  Clock,
  Users,
  Plus,
  X,
  Video,
  Send,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isPast, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { de } from "date-fns/locale";

interface ScheduledMeeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  duration_minutes: number;
  room_code: string;
  zoom_join_url?: string | null;
  zoom_meeting_id?: string | null;
  status: string;
  created_by: string;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface MeetingSchedulerProps {
  onClose: () => void;
  onJoinMeeting: (roomCode: string) => void;
}

export function MeetingScheduler({ onClose, onJoinMeeting }: MeetingSchedulerProps) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "10:00",
    duration: 60,
    participants: [] as string[],
  });

  useEffect(() => {
    fetchMeetings();
    fetchProfiles();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data } = await supabase
        .from("scheduled_meetings")
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (data) {
        setMeetings(data);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name")
        .eq("is_active", true);

      if (data) {
        setProfiles(data.filter(p => p.user_id !== user?.id));
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const scheduledDate = new Date(`${formData.date}T${formData.time}`);

      // Get participant emails for Zoom invitation
      const participantEmails = formData.participants
        .map(userId => profiles.find(p => p.user_id === userId)?.email)
        .filter(Boolean) as string[];

      let zoomMeetingData: { id: number; joinUrl: string; password: string } | null = null;

      // Create Zoom meeting and send invitations if there are participants
      if (participantEmails.length > 0) {
        try {
          const { data: zoomResponse, error: zoomError } = await supabase.functions.invoke(
            "create-zoom-meeting",
            {
              body: {
                meeting: {
                  title: formData.title,
                  date: scheduledDate.toISOString(),
                  duration: formData.duration,
                  description: formData.description || undefined,
                },
                participants: participantEmails,
              },
            }
          );

          if (zoomError) {
            console.error("Zoom error:", zoomError);
          } else if (zoomResponse?.zoomMeeting) {
            zoomMeetingData = zoomResponse.zoomMeeting;
          }
        } catch (zoomErr) {
          console.error("Failed to create Zoom meeting:", zoomErr);
        }
      }

      const { data: meeting, error: meetingError } = await supabase
        .from("scheduled_meetings")
        .insert({
          title: formData.title,
          description: formData.description || null,
          scheduled_date: scheduledDate.toISOString(),
          duration_minutes: formData.duration,
          room_code: roomCode,
          zoom_join_url: zoomMeetingData?.joinUrl || null,
          zoom_meeting_id: zoomMeetingData?.id?.toString() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Add participants
      if (meeting && formData.participants.length > 0) {
        const participantRecords = formData.participants.map(userId => {
          const profile = profiles.find(p => p.user_id === userId);
          return {
            meeting_id: meeting.id,
            user_id: userId,
            email: profile?.email || "",
          };
        });

        await supabase.from("meeting_participants").insert(participantRecords);
      }

      setShowNewMeeting(false);
      setFormData({
        title: "",
        description: "",
        date: "",
        time: "10:00",
        duration: 60,
        participants: [],
      });
      fetchMeetings();
    } catch (error) {
      console.error("Error creating meeting:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const openZoomMeeting = (url: string) => {
    window.open(url, "_blank");
  };

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter(m => isSameDay(new Date(m.scheduled_date), date));
  };

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card-state w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-accent" size={24} />
            <h2 className="text-xl font-semibold text-foreground">Meeting-Kalender</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewMeeting(true)}
              className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Neue Sitzung planen
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-medium text-foreground">
                  {format(currentMonth, "MMMM yyyy", { locale: de })}
                </h3>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth().map((day, index) => {
                  const dayMeetings = getMeetingsForDate(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className={`aspect-square p-1 rounded-lg transition-colors relative ${
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : isToday(day)
                          ? "bg-accent/20 text-foreground"
                          : isCurrentMonth
                          ? "hover:bg-muted text-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      <span className="text-sm">{format(day, "d")}</span>
                      {dayMeetings.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayMeetings.slice(0, 3).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-1 rounded-full ${
                                isSelected ? "bg-accent-foreground" : "bg-accent"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meetings List */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">
                {selectedDate
                  ? format(selectedDate, "EEEE, d. MMMM", { locale: de })
                  : "Kommende Sitzungen"}
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedDate
                    ? getMeetingsForDate(selectedDate)
                    : meetings.filter(m => new Date(m.scheduled_date) >= new Date()).slice(0, 5)
                  ).map(meeting => (
                    <div
                      key={meeting.id}
                      className="p-3 bg-muted/50 rounded-lg border border-border"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-foreground text-sm">{meeting.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          meeting.status === "scheduled"
                            ? "bg-accent/20 text-accent"
                            : meeting.status === "completed"
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {meeting.status === "scheduled" ? "Geplant" : 
                           meeting.status === "completed" ? "Beendet" : meeting.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Clock size={12} />
                        {format(new Date(meeting.scheduled_date), "HH:mm", { locale: de })} Uhr
                        <span>({meeting.duration_minutes} Min.)</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => copyRoomCode(meeting.room_code)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {copiedCode === meeting.room_code ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                          {meeting.room_code}
                        </button>
                        {meeting.status === "scheduled" && !isPast(new Date(meeting.scheduled_date)) && (
                          <div className="ml-auto flex items-center gap-2">
                            {meeting.zoom_join_url && (
                              <button
                                onClick={() => openZoomMeeting(meeting.zoom_join_url!)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                              >
                                📹 Zoom
                              </button>
                            )}
                            <button
                              onClick={() => onJoinMeeting(meeting.room_code)}
                              className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs font-medium hover:bg-accent/90 flex items-center gap-1"
                            >
                              <Video size={12} />
                              Beitreten
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(selectedDate
                    ? getMeetingsForDate(selectedDate)
                    : meetings.filter(m => new Date(m.scheduled_date) >= new Date())
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Sitzungen geplant
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Meeting Modal */}
        {showNewMeeting && (
          <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
              <h3 className="text-lg font-semibold text-foreground mb-4">Neue Sitzung planen</h3>
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Titel
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Datum
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Uhrzeit
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Dauer (Minuten)
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value={15}>15 Minuten</option>
                    <option value={30}>30 Minuten</option>
                    <option value={45}>45 Minuten</option>
                    <option value={60}>1 Stunde</option>
                    <option value={90}>1.5 Stunden</option>
                    <option value={120}>2 Stunden</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Teilnehmer einladen
                  </label>
                  <div className="max-h-32 overflow-y-auto bg-muted border border-border rounded-lg p-2 space-y-1">
                    {profiles.map(profile => (
                      <label
                        key={profile.user_id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-background/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.participants.includes(profile.user_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                participants: [...formData.participants, profile.user_id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                participants: formData.participants.filter(id => id !== profile.user_id),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-foreground">
                          {profile.first_name} {profile.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">({profile.email})</span>
                      </label>
                    ))}
                    {profiles.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Keine Benutzer verfügbar
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewMeeting(false)}
                    className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        Planen & Einladen
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
