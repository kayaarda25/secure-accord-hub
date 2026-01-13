import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignatureRequestEmail {
  signerEmail: string;
  signerName: string;
  documentName: string;
  requesterName: string;
  documentUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
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

    console.log(`Signature request initiated by user: ${user.id}`);

    const { signerEmail, signerName, documentName, requesterName, documentUrl }: SignatureRequestEmail = await req.json();

    console.log(`Sending signature request email to ${signerEmail} for document: ${documentName}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "MGI Multicell <onboarding@resend.dev>",
        to: [signerEmail],
        subject: `Unterschrift erforderlich: ${documentName}`,
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
              .button { display: inline-block; background: #d4af37; color: #1a1a2e; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📝 Unterschrift erforderlich</h1>
              </div>
              <div class="content">
                <p>Hallo ${signerName || 'Kollege/in'},</p>
                <p><strong>${requesterName}</strong> hat Sie gebeten, folgendes Dokument zu unterschreiben:</p>
                <p style="background: #fff; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0;">
                  <strong>📄 ${documentName}</strong>
                </p>
                <p>Bitte melden Sie sich im Portal an und überprüfen Sie das Dokument.</p>
                <a href="${documentUrl}" class="button">Dokument ansehen</a>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  Sie können das Dokument nach der Prüfung unterschreiben oder ablehnen.
                </p>
              </div>
              <div class="footer">
                <p>MGI Multicell Partner Portal</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResponse = await res.json();
    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: res.ok ? 200 : 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-signature-request function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
