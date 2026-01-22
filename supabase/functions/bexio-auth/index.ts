import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEXIO_AUTH_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const bexioClientId = Deno.env.get("BEXIO_CLIENT_ID");

    if (!bexioClientId) {
      throw new Error("BEXIO_CLIENT_ID is not configured");
    }

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get the redirect URI from request or use default
    const { redirectUri } = await req.json().catch(() => ({}));
    const callbackUrl = `${supabaseUrl}/functions/v1/bexio-oauth-callback`;

    // Capture caller origin so we can redirect back to the right frontend (preview vs prod)
    let origin: string | null = req.headers.get("origin") || req.headers.get("Origin");
    try {
      if (origin) origin = new URL(origin).origin;
    } catch {
      origin = null;
    }

    // Generate state parameter with user info for security
    const state = btoa(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      redirectUri: redirectUri || "/finances/invoices",
      origin
    }));

    // Build Bexio OAuth URL
    const params = new URLSearchParams({
      client_id: bexioClientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid profile email kb_invoice_edit kb_invoice_show contact_edit contact_show",
      state: state,
    });

    const authUrl = `${BEXIO_AUTH_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({ authUrl }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in bexio-auth:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
