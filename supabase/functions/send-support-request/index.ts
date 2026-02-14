import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { type, subject, description, userName, userEmail } = await req.json();

    if (!type || !subject || !description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const typeLabels: Record<string, string> = {
      bug: "🐛 Bug Report",
      error: "⚠️ Fehlermeldung",
      feature: "💡 Feature Request",
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "MGI Hub Support <onboarding@resend.dev>",
        to: ["kayaarda42@icloud.com"],
        subject: `[${typeLabels[type] || type}] ${subject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
              .field { margin-bottom: 16px; }
              .label { font-weight: 600; color: #555; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
              .value { margin-top: 4px; padding: 12px; background: #fff; border-radius: 6px; border: 1px solid #e0e0e0; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
              .badge-bug { background: #fee2e2; color: #991b1b; }
              .badge-error { background: #fef3c7; color: #92400e; }
              .badge-feature { background: #dbeafe; color: #1e40af; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📬 Support-Anfrage</h1>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">Typ</div>
                  <div style="margin-top: 4px;">
                    <span class="badge badge-${type}">${typeLabels[type] || type}</span>
                  </div>
                </div>
                <div class="field">
                  <div class="label">Betreff</div>
                  <div class="value">${subject}</div>
                </div>
                <div class="field">
                  <div class="label">Beschreibung</div>
                  <div class="value" style="white-space: pre-wrap;">${description}</div>
                </div>
                <div class="field">
                  <div class="label">Absender</div>
                  <div class="value">${userName} (${userEmail})</div>
                </div>
              </div>
              <div class="footer">
                <p>MGI Hub – Support System</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResponse = await res.json();

    if (!res.ok) {
      console.error("Resend error:", emailResponse);
      return new Response(JSON.stringify({ error: emailResponse }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-support-request:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
