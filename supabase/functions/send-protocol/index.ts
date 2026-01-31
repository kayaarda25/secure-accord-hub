import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProtocolTopic {
  topic: string;
  notes: string;
}

interface SendProtocolRequest {
  protocol_id: string;
  title: string;
  date: string;
  location: string;
  attendee_emails: string[];
  attendee_names: string[];
  topics: ProtocolTopic[];
  decisions?: string;
  document_base64: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json() as SendProtocolRequest;

    console.log(`Sending protocol ${body.protocol_id} to ${body.attendee_emails.length} attendees`);

    // Get sender info
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", user.id)
      .single();

    const senderName = senderProfile 
      ? `${senderProfile.first_name || ""} ${senderProfile.last_name || ""}`.trim() || senderProfile.email
      : "MGI Platform";

    const resend = new Resend(resendApiKey);

    // Build topics HTML
    const topicsHtml = body.topics.map(t => `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #D4AF37; margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase;"># ${t.topic}</h3>
        ${t.notes.split('\n').filter(n => n.trim()).map(n => `<p style="color: #ccc; margin: 5px 0; padding-left: 15px;">- ${n}</p>`).join('')}
      </div>
    `).join('');

    const decisionsHtml = body.decisions ? `
      <div style="margin-top: 30px; border-top: 1px solid #333; padding-top: 20px;">
        <h3 style="color: #D4AF37; margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase;"># DECISIONS</h3>
        ${body.decisions.split('\n').filter(d => d.trim()).map(d => `<p style="color: #ccc; margin: 5px 0; padding-left: 15px;">- ${d}</p>`).join('')}
      </div>
    ` : '';

    const filename = `${body.date}_MoM_${body.title.replace(/\s+/g, "_")}.docx`;

    // Send to all attendees
    const emailPromises = body.attendee_emails.map(async (email) => {
      try {
        await resend.emails.send({
          from: "MGI Africa <onboarding@resend.dev>",
          to: [email],
          subject: `[Meeting Protocol] ${body.title} - ${body.date}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #0a0a0a;">
              <div style="background: linear-gradient(135deg, #D4AF37 0%, #B8960C 100%); padding: 25px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">MEETING PROTOCOL</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 13px;">Minutes of Meeting</p>
              </div>
              
              <div style="padding: 30px; background: #1a1a1a; color: #ffffff;">
                <div style="background: #111; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                  <p style="margin: 5px 0; color: #ccc;"><strong style="color: #D4AF37;">DATE:</strong> ${body.date}</p>
                  <p style="margin: 5px 0; color: #ccc;"><strong style="color: #D4AF37;">LOCATION:</strong> ${body.location || 'N/A'}</p>
                  <p style="margin: 5px 0; color: #ccc;"><strong style="color: #D4AF37;">SUBJECT:</strong> ${body.title}</p>
                </div>

                <div style="margin-bottom: 25px;">
                  <h3 style="color: #D4AF37; margin: 0 0 10px 0; font-size: 16px;"># ATTENDEES</h3>
                  ${body.attendee_names.map(name => `<p style="color: #ccc; margin: 3px 0; padding-left: 15px;">- ${name}</p>`).join('')}
                </div>

                ${topicsHtml}
                ${decisionsHtml}

                <div style="margin-top: 30px; padding: 20px; background: #222; border-radius: 8px; text-align: center;">
                  <p style="color: #888; margin: 0 0 10px 0; font-size: 13px;">
                    📎 The full protocol document is attached to this email.
                  </p>
                </div>
              </div>

              <div style="padding: 15px; background: #111; text-align: center;">
                <p style="color: #666; font-size: 12px; margin: 0;">
                  Sent by ${senderName} via MGI × AFRICA Platform
                </p>
              </div>
            </div>
          `,
          attachments: [
            {
              filename: filename,
              content: body.document_base64,
            }
          ],
        });
        console.log(`Email sent to ${email}`);
        return { email, success: true };
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        return { email, success: false, error: err };
      }
    });

    const results = await Promise.all(emailPromises);
    const successful = results.filter(r => r.success).length;

    // Create notifications for attendees
    for (const email of body.attendee_emails) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userProfile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: userProfile.user_id,
          type: "document",
          title: "New Meeting Protocol",
          message: `A meeting protocol "${body.title}" has been shared with you.`,
          link: "/protocols",
          is_read: false,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        total: body.attendee_emails.length,
        results 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-protocol:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
