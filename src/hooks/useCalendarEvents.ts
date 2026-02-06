import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CalendarEvent {
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
  recurrence_end_date: string | null;
  created_by: string;
  participants?: EventParticipant[];
  _isOccurrence?: boolean;
  _parentId?: string;
}

export interface EventParticipant {
  id: string;
  user_id: string;
  status: string;
  response_reason: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

function generateRecurrenceOccurrences(
  event: CalendarEvent,
  monthStart: Date,
  monthEnd: Date
): CalendarEvent[] {
  if (!event.is_recurring || !event.recurrence_type) return [event];

  const occurrences: CalendarEvent[] = [];
  const baseDate = new Date(event.event_date + "T00:00:00");
  const recEndDate = event.recurrence_end_date
    ? new Date(event.recurrence_end_date + "T23:59:59")
    : new Date(monthEnd.getFullYear() + 1, 0, 1);

  const limit = Math.min(monthEnd.getTime(), recEndDate.getTime());
  let current = new Date(baseDate);

  for (let i = 0; i < 500; i++) {
    if (current.getTime() > limit) break;

    if (current.getTime() >= monthStart.getTime() && current.getTime() <= limit) {
      const dateStr = current.toISOString().split("T")[0];
      if (dateStr === event.event_date) {
        occurrences.push(event);
      } else {
        occurrences.push({
          ...event,
          event_date: dateStr,
          _isOccurrence: true,
          _parentId: event.id,
        });
      }
    }

    switch (event.recurrence_type) {
      case "daily":
        current.setDate(current.getDate() + 1);
        break;
      case "weekly":
        current.setDate(current.getDate() + 7);
        break;
      case "monthly":
        current.setMonth(current.getMonth() + 1);
        break;
      case "yearly":
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        return occurrences;
    }
  }

  return occurrences;
}

export function useCalendarEvents(currentMonth: number, currentYear: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<CalendarEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchStart = new Date(currentYear, currentMonth - 2, 1).toISOString().split("T")[0];
      const fetchEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);

      const { data, error } = await supabase
        .from("calendar_events")
        .select(`
          *,
          participants:calendar_event_participants(
            id,
            user_id,
            status,
            response_reason
          )
        `)
        .or(`and(event_date.gte.${fetchStart},event_date.lte.${fetchEnd},is_recurring.eq.false),is_recurring.eq.true`)
        .order("event_date", { ascending: true });

      if (error) throw error;

      const rawEvents = (data || []) as CalendarEvent[];
      setEvents(rawEvents);

      const allOccurrences: CalendarEvent[] = [];
      for (const ev of rawEvents) {
        if (ev.is_recurring) {
          allOccurrences.push(...generateRecurrenceOccurrences(ev, monthStart, monthEnd));
        } else {
          const evDate = new Date(ev.event_date + "T00:00:00");
          if (evDate >= monthStart && evDate <= monthEnd) {
            allOccurrences.push(ev);
          }
        }
      }

      setExpandedEvents(allOccurrences);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Fehler beim Laden der Termine");
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  const fetchProfiles = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchProfiles();
  }, [fetchEvents, fetchProfiles]);

  const getEventsForDay = useCallback(
    (day: number) => {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return expandedEvents.filter((e) => e.event_date === dateStr);
    },
    [expandedEvents, currentMonth, currentYear]
  );

  const getProfileName = useCallback(
    (userId: string) => {
      const profile = profiles.find((p) => p.user_id === userId);
      if (profile?.first_name || profile?.last_name) {
        return `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
      }
      return profile?.email || "Unbekannt";
    },
    [profiles]
  );

  return {
    events,
    expandedEvents,
    profiles,
    isLoading,
    fetchEvents,
    getEventsForDay,
    getProfileName,
  };
}
