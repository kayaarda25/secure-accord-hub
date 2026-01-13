import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUser.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Nur Administratoren können Benutzer einladen" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, department, position, organizationId, roles } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "E-Mail-Adresse ist erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "Ein Benutzer mit dieser E-Mail-Adresse existiert bereits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseAdmin
      .from("user_invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: "Eine ausstehende Einladung für diese E-Mail-Adresse existiert bereits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("user_invitations")
      .insert({
        email,
        invited_by: requestingUser.id,
        organization_id: organizationId || null,
        department,
        position,
        roles: roles || [],
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      return new Response(
        JSON.stringify({ error: "Fehler beim Erstellen der Einladung" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter's name for the email
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", requestingUser.id)
      .single();

    const inviterName = inviterProfile 
      ? `${inviterProfile.first_name || ""} ${inviterProfile.last_name || ""}`.trim() || "Ein Administrator"
      : "Ein Administrator";

    // Get organization name if provided
    let organizationName = "";
    if (organizationId) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      organizationName = org?.name || "";
    }

    // Build invitation URL
    const appUrl = req.headers.get("origin") || supabaseUrl.replace(".supabase.co", ".lovable.app");
    const invitationUrl = `${appUrl}/auth?invitation=${invitation.token}`;

    // Send invitation email if Resend is configured
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sie wurden eingeladen!</h1>
            </div>
            <div class="content">
              <p>Hallo,</p>
              <p><strong>${inviterName}</strong> hat Sie eingeladen, dem MGI Dashboard beizutreten${organizationName ? ` als Teil von <strong>${organizationName}</strong>` : ""}.</p>
              
              ${department || position ? `
              <div class="details">
                <h3 style="margin-top: 0;">Ihre zugewiesene Rolle:</h3>
                ${department ? `<p><strong>Abteilung:</strong> ${department}</p>` : ""}
                ${position ? `<p><strong>Position:</strong> ${position}</p>` : ""}
              </div>
              ` : ""}
              
              <p>Klicken Sie auf den Button unten, um Ihr Konto zu erstellen und Ihre persönlichen Daten einzugeben:</p>
              
              <center>
                <a href="${invitationUrl}" class="button">Einladung annehmen</a>
              </center>
              
              <p style="color: #6b7280; font-size: 14px;">Dieser Link ist 7 Tage gültig. Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
              <a href="${invitationUrl}" style="color: #667eea;">${invitationUrl}</a></p>
            </div>
            <div class="footer">
              <p>MGI Dashboard • Diese E-Mail wurde automatisch generiert</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: "MGI Dashboard <onboarding@resend.dev>",
          to: [email],
          subject: `${inviterName} hat Sie zum MGI Dashboard eingeladen`,
          html: emailHtml,
        });

        console.log("Invitation email sent to:", email);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the whole request if email fails
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitationId: invitation.id,
        invitationUrl,
        message: "Einladung erfolgreich erstellt" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
