import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZoomMeetingRequest {
  meeting: {
    title: string;
    date: string;
    duration: number;
    description?: string;
  };
  participants: string[];
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomMeetingResponse {
  id: number;
  join_url: string;
  password: string;
  start_url: string;
}

async function getZoomAccessToken(): Promise<string> {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Zoom token error:", errorText);
    throw new Error(`Failed to get Zoom access token: ${response.status}`);
  }

  const data: ZoomTokenResponse = await response.json();
  return data.access_token;
}

async function createZoomMeeting(
  accessToken: string,
  title: string,
  startTime: string,
  duration: number,
  description?: string
): Promise<ZoomMeetingResponse> {
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: title,
      type: 2, // Scheduled meeting
      start_time: startTime,
      duration: duration,
      timezone: "Europe/Zurich",
      agenda: description || "",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: false,
        waiting_room: false,
        audio: "both",
        auto_recording: "none",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Zoom meeting creation error:", errorText);
    throw new Error(`Failed to create Zoom meeting: ${response.status}`);
  }

  return await response.json();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authorization check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Zoom meeting requested by user: ${user.id}`);

    const { meeting, participants }: ZoomMeetingRequest = await req.json();

    // 1. Get Zoom access token
    console.log("Getting Zoom access token...");
    const accessToken = await getZoomAccessToken();

    // 2. Create Zoom meeting
    console.log("Creating Zoom meeting...");
    const zoomMeeting = await createZoomMeeting(
      accessToken,
      meeting.title,
      meeting.date,
      meeting.duration,
      meeting.description
    );

    console.log("Zoom meeting created:", zoomMeeting.id);

    // 3. Send invitations with Zoom link
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
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

    const emailPromises = participants.map(async (email) => {
      console.log(`Sending Zoom invitation to: ${email}`);

      const emailResponse = await resend.emails.send({
        from: "Meeting System <onboarding@resend.dev>",
        to: [email],
        subject: `Zoom-Einladung: ${meeting.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2D8CFF 0%, #0B5CFF 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 24px; }
              .zoom-logo { font-size: 32px; margin-bottom: 10px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .meeting-card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #2D8CFF; }
              .meeting-detail { display: flex; align-items: center; margin: 12px 0; }
              .meeting-detail .label { font-weight: bold; min-width: 100px; color: #666; }
              .join-button { display: block; background: #2D8CFF; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center; margin: 20px 0; font-size: 18px; }
              .join-button:hover { background: #0B5CFF; }
              .meeting-link { background: #f0f4f8; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 15px 0; }
              .password-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 15px 0; }
              .password-box strong { color: #856404; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="zoom-logo">📹</div>
                <h1>Zoom-Sitzung Einladung</h1>
              </div>
              <div class="content">
                <p>Guten Tag,</p>
                
                <p>Sie wurden zu einer <strong>Zoom-Sitzung</strong> eingeladen.</p>
                
                <div class="meeting-card">
                  <h2 style="margin-top: 0; color: #1a1a2e;">${meeting.title}</h2>
                  
                  ${meeting.description ? `<p style="color: #6b7280;">${meeting.description}</p>` : ""}
                  
                  <div class="meeting-detail">
                    <span class="label">📅 Datum:</span>
                    <span>${formattedDate}</span>
                  </div>
                  
                  <div class="meeting-detail">
                    <span class="label">🕐 Uhrzeit:</span>
                    <span>${formattedTime} Uhr</span>
                  </div>
                  
                  <div class="meeting-detail">
                    <span class="label">⏱️ Dauer:</span>
                    <span>${meeting.duration} Minuten</span>
                  </div>
                </div>
                
                <a href="${zoomMeeting.join_url}" class="join-button">
                  🎥 An Zoom-Meeting teilnehmen
                </a>
                
                <div class="password-box">
                  <strong>Meeting-Passwort:</strong> ${zoomMeeting.password}
                </div>
                
                <p style="font-size: 14px; color: #666;">
                  <strong>Meeting-Link:</strong>
                </p>
                <div class="meeting-link">
                  ${zoomMeeting.join_url}
                </div>
                
                <p style="font-size: 13px; color: #666; margin-top: 20px;">
                  💡 <em>Klicken Sie auf den Button oben oder kopieren Sie den Link in Ihren Browser, um dem Meeting beizutreten.</em>
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

      return emailResponse;
    });

    await Promise.all(emailPromises);

    console.log("All Zoom invitations sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        zoomMeeting: {
          id: zoomMeeting.id,
          joinUrl: zoomMeeting.join_url,
          password: zoomMeeting.password,
        },
        message: `Zoom meeting created and ${participants.length} invitation emails sent`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in create-zoom-meeting function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
