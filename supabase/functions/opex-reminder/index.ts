import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting OPEX reminder email job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with finance role
    const { data: financeUsers, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "finance");

    if (rolesError) {
      console.error("Error fetching finance users:", rolesError);
      throw rolesError;
    }

    console.log(`Found ${financeUsers?.length || 0} finance users`);

    if (!financeUsers || financeUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No finance users found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get profiles for finance users
    const userIds = financeUsers.map(u => u.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles to notify`);

    const currentDate = new Date();
    const monthNames = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];
    const currentMonth = monthNames[currentDate.getMonth()];
    const currentYear = currentDate.getFullYear();

    // Send emails to all finance managers
    const emailPromises = profiles?.map(async (profile) => {
      const name = profile.first_name 
        ? `${profile.first_name} ${profile.last_name || ""}`.trim()
        : "Finance Manager";

      console.log(`Sending reminder to: ${profile.email}`);

      const emailResponse = await resend.emails.send({
        from: "OPEX System <onboarding@resend.dev>",
        to: [profile.email],
        subject: `OPEX-Einreichung ${currentMonth} ${currentYear} - Erinnerung`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .highlight { background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>OPEX-Einreichung Erinnerung</h1>
              </div>
              <div class="content">
                <p>Guten Tag ${name},</p>
                
                <p>dies ist eine freundliche Erinnerung, dass die <strong>OPEX-Einreichung</strong> für den Monat <strong>${currentMonth} ${currentYear}</strong> fällig ist.</p>
                
                <div class="highlight">
                  <strong>Fälligkeitsdatum:</strong> 4. ${currentMonth} ${currentYear}<br>
                  <strong>Aktion erforderlich:</strong> Bitte reichen Sie alle Betriebsausgaben ein
                </div>
                
                <p>Folgende Kategorien müssen berücksichtigt werden:</p>
                <ul>
                  <li>Gehälter (Salaries)</li>
                  <li>Miete (Rent)</li>
                  <li>Versicherungen (Insurance)</li>
                  <li>Transport (Transportation)</li>
                  <li>IT-Kosten</li>
                  <li>Nebenkosten (Utilities)</li>
                  <li>Wartung (Maintenance)</li>
                  <li>Marketing</li>
                  <li>Schulungen (Training)</li>
                  <li>Büromaterial (Office)</li>
                  <li>Kommunikation (Communication)</li>
                  <li>Sonstiges (Other)</li>
                </ul>
                
                <p>Bitte loggen Sie sich in das System ein und reichen Sie Ihre OPEX-Daten ein.</p>
                
                <div class="footer">
                  <p>Diese E-Mail wurde automatisch generiert. Bei Fragen wenden Sie sich bitte an die Finanzabteilung.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`Email sent to ${profile.email}:`, emailResponse);
      return emailResponse;
    }) || [];

    await Promise.all(emailPromises);

    console.log("All reminder emails sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${profiles?.length || 0} reminder emails`,
        recipients: profiles?.map(p => p.email)
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in opex-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
