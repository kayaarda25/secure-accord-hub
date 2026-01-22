import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BEXIO_TOKEN_URL = "https://idp.bexio.com/token";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return new Response(null, {
        status: 302,
        headers: { Location: `/finances/invoices?error=${encodeURIComponent(error)}` },
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=missing_params" },
      });
    }

    // Parse state
    let stateData: { userId: string; timestamp: number; redirectUri: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=invalid_state" },
      });
    }

    // Verify state timestamp (max 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=expired_state" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bexioClientId = Deno.env.get("BEXIO_CLIENT_ID")!;
    const bexioClientSecret = Deno.env.get("BEXIO_CLIENT_SECRET")!;

    const callbackUrl = `${supabaseUrl}/functions/v1/bexio-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch(BEXIO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: bexioClientId,
        client_secret: bexioClientSecret,
        code: code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=token_exchange_failed" },
      });
    }

    const tokens = await tokenResponse.json();

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", stateData.userId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error("Profile error:", profileError);
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=no_organization" },
      });
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert tokens
    const { error: upsertError } = await supabase
      .from("bexio_tokens")
      .upsert({
        organization_id: profile.organization_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: tokens.scope,
        created_by: stateData.userId,
      }, {
        onConflict: "organization_id",
      });

    if (upsertError) {
      console.error("Token storage error:", upsertError);
      return new Response(null, {
        status: 302,
        headers: { Location: "/finances/invoices?error=storage_failed" },
      });
    }

    // Get the app URL for redirect
    const appUrl = Deno.env.get("APP_URL") || "https://secure-accord-hub.lovable.app";
    
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}${stateData.redirectUri}?bexio=connected` },
    });
  } catch (error: any) {
    console.error("Callback error:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: "/finances/invoices?error=callback_failed" },
    });
  }
});
