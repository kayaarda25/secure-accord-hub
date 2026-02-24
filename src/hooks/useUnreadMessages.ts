import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    try {
      // Get all threads where user is a participant, with their last_read_at
      const { data: participations } = await (supabase as any)
        .from("thread_participants")
        .select("thread_id, last_read_at")
        .eq("user_id", user.id);

      if (!participations || participations.length === 0) {
        setUnreadCount(0);
        return;
      }

      let total = 0;
      for (const p of participations) {
        // Count messages in thread after last_read_at, not sent by current user
        let query = supabase
          .from("communication_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", p.thread_id)
          .neq("sender_id", user.id);

        if (p.last_read_at) {
          query = query.gt("created_at", p.last_read_at);
        }

        const { count } = await query;
        total += count || 0;
      }

      setUnreadCount(total);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Listen for new messages to update count
    const channel = supabase
      .channel("unread-messages-global")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "communication_messages",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Also refresh periodically
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id]);

  return { unreadCount, refreshUnread: fetchUnreadCount };
}
