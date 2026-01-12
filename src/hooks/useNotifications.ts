import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface SendNotificationParams {
  user_id: string;
  type: "task" | "document" | "expense" | "calendar" | "system" | "approval" | "budget";
  title: string;
  message: string;
  link?: string;
  send_email?: boolean;
}

export async function sendNotification(params: SendNotificationParams) {
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: params,
    });

    if (error) {
      console.error("Error sending notification:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Failed to send notification:", error);
    throw error;
  }
}

// Helper to notify multiple users
export async function notifyUsers(
  userIds: string[],
  notification: Omit<SendNotificationParams, "user_id">
) {
  const promises = userIds.map((user_id) =>
    sendNotification({ ...notification, user_id })
  );

  return Promise.allSettled(promises);
}

// Helper to notify users by role
export async function notifyByRole(
  role: AppRole,
  notification: Omit<SendNotificationParams, "user_id">
) {
  const { data: roleUsers, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);

  if (error || !roleUsers) {
    console.error("Error fetching users by role:", error);
    return [];
  }

  const userIds = roleUsers.map((r) => r.user_id);
  return notifyUsers(userIds, notification);
}
