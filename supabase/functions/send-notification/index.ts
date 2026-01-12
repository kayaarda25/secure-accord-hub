import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  user_id: string;
  type: "task" | "document" | "expense" | "calendar" | "system" | "approval" | "budget";
  title: string;
  message: string;
  link?: string;
  send_email?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, type, title, message, link, send_email } = await req.json() as NotificationRequest;

    console.log(`Creating notification for user ${user_id}: ${title}`);

    // Create in-app notification
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type,
        title,
        message,
        link,
        is_read: false,
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
      throw notificationError;
    }

    console.log("Notification created:", notification.id);

    // Check if user wants email notifications
    if (send_email && resendApiKey) {
      // Get user's notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_enabled, task_notifications, document_notifications, expense_notifications, calendar_notifications, approval_notifications, budget_notifications")
        .eq("user_id", user_id)
        .single();

      const shouldSendEmail = prefs?.email_enabled && (
        (type === "task" && prefs.task_notifications) ||
        (type === "document" && prefs.document_notifications) ||
        (type === "expense" && prefs.expense_notifications) ||
        (type === "calendar" && prefs.calendar_notifications) ||
        (type === "approval" && prefs.approval_notifications) ||
        (type === "budget" && prefs.budget_notifications) ||
        type === "system"
      );

      if (shouldSendEmail) {
        // Get user's email
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name")
          .eq("user_id", user_id)
          .single();

        if (profile?.email) {
          console.log(`Sending email to ${profile.email}`);

          const resend = new Resend(resendApiKey);

          const typeLabels: Record<string, string> = {
            task: "Aufgabe",
            document: "Dokument",
            expense: "Ausgabe",
            calendar: "Termin",
            system: "System",
            approval: "Genehmigung",
            budget: "Budget",
          };

          await resend.emails.send({
            from: "MGI Africa <onboarding@resend.dev>",
            to: [profile.email],
            subject: `[${typeLabels[type] || "Benachrichtigung"}] ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #D4AF37 0%, #B8960C 100%); padding: 20px; text-align: center;">
                  <h1 style="color: white; margin: 0;">MGI × AFRICA</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">State Cooperation</p>
                </div>
                <div style="padding: 30px; background: #1a1a1a; color: #ffffff;">
                  <h2 style="color: #D4AF37; margin-top: 0;">${title}</h2>
                  <p style="color: #cccccc; line-height: 1.6;">${message}</p>
                  ${link ? `
                    <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}${link}" 
                       style="display: inline-block; background: #D4AF37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold;">
                      Details anzeigen
                    </a>
                  ` : ""}
                </div>
                <div style="padding: 15px; background: #111; text-align: center;">
                  <p style="color: #666; font-size: 12px; margin: 0;">
                    Sie erhalten diese E-Mail, weil Sie Benachrichtigungen aktiviert haben.
                  </p>
                </div>
              </div>
            `,
          });

          console.log("Email sent successfully");
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notification }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
