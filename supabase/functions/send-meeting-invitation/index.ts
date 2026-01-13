import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MeetingInvitationRequest {
  meeting: {
    title: string;
    date: string;
    duration: number;
    roomCode: string;
    description?: string;
  };
  participants: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authorization check - verify the caller's identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create a client with the user's auth token to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("Authorization failed:", authError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Meeting invitation requested by user: ${user.id}`);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { meeting, participants }: MeetingInvitationRequest = await req.json();

    console.log("Sending meeting invitations:", { meeting, participants });

    const meetingDate = new Date(meeting.date);
    const formattedDate = meetingDate.toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const formattedTime = meetingDate.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Send emails to all participants
    const emailPromises = participants.map(async (email) => {
      console.log(`Sending invitation to: ${email}`);

      const emailResponse = await resend.emails.send({
        from: "Meeting System <onboarding@resend.dev>",
        to: [email],
        subject: `Einladung: ${meeting.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .meeting-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .meeting-detail { display: flex; align-items: center; margin: 10px 0; }
              .meeting-detail .icon { width: 24px; height: 24px; margin-right: 12px; color: #d4af37; }
              .room-code { background: #1a1a2e; color: #d4af37; padding: 15px 25px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; text-align: center; margin: 20px 0; }
              .button { display: inline-block; background: #d4af37; color: #1a1a2e; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Online-Sitzung Einladung</h1>
              </div>
              <div class="content">
                <p>Guten Tag,</p>
                
                <p>Sie wurden zu einer Online-Sitzung eingeladen.</p>
                
                <div class="meeting-card">
                  <h2 style="margin-top: 0; color: #1a1a2e;">${meeting.title}</h2>
                  
                  ${meeting.description ? `<p style="color: #6b7280;">${meeting.description}</p>` : ""}
                  
                  <div class="meeting-detail">
                    <span style="font-weight: bold; min-width: 100px;">Datum:</span>
                    <span>${formattedDate}</span>
                  </div>
                  
                  <div class="meeting-detail">
                    <span style="font-weight: bold; min-width: 100px;">Uhrzeit:</span>
                    <span>${formattedTime} Uhr</span>
                  </div>
                  
                  <div class="meeting-detail">
                    <span style="font-weight: bold; min-width: 100px;">Dauer:</span>
                    <span>${meeting.duration} Minuten</span>
                  </div>
                </div>
                
                <p style="text-align: center; font-weight: bold;">Ihr Sitzungs-Code:</p>
                <div class="room-code">${meeting.roomCode}</div>
                
                <p style="text-align: center; color: #6b7280; font-size: 14px;">
                  Geben Sie diesen Code ein, um der Sitzung beizutreten.
                </p>
                
                <div class="footer">
                  <p>Diese E-Mail wurde automatisch generiert.</p>
                  <p>Bei Fragen wenden Sie sich bitte an den Organisator der Sitzung.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`Email sent to ${email}:`, emailResponse);
      return emailResponse;
    });

    await Promise.all(emailPromises);

    console.log("All invitation emails sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${participants.length} invitation emails`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-meeting-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
