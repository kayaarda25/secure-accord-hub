import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEXIO_API_URL = "https://api.bexio.com";
const BEXIO_TOKEN_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/token";

interface BexioTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  organization_id: string;
}

async function refreshBexioToken(supabase: any, tokens: BexioTokens): Promise<string> {
  const bexioClientId = Deno.env.get("BEXIO_CLIENT_ID")!;
  const bexioClientSecret = Deno.env.get("BEXIO_CLIENT_SECRET")!;

  const response = await fetch(BEXIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: bexioClientId,
      client_secret: bexioClientSecret,
      refresh_token: tokens.refresh_token,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error("Token refresh failed:", text);
    throw new Error("Failed to refresh Bexio token");
  }

  const newTokens = JSON.parse(text);
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  await supabase
    .from("bexio_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
      // NOTE: we do not overwrite stored scope on refresh; Bexio keeps scopes stable.
    })
    .eq("organization_id", tokens.organization_id);

  return newTokens.access_token;
}

async function getValidAccessToken(supabase: any, tokens: BexioTokens): Promise<string> {
  const expiresAt = new Date(tokens.expires_at);
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return await refreshBexioToken(supabase, tokens);
  }
  return tokens.access_token;
}

async function probe(url: string, accessToken: string) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body_sample: body.slice(0, 300),
    };
  } catch (e: any) {
    return { ok: false, status: 0, body_sample: e?.message || String(e) };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error("No organization found");
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tokens, error: tokensError } = await serviceSupabase
      .from("bexio_tokens")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .single();

    if (tokensError || !tokens) {
      return new Response(JSON.stringify({ connected: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = await getValidAccessToken(serviceSupabase, tokens);

    const results = {
      connected: true,
      token_scope_stored: tokens.scope ?? null,
      endpoints: {
        kb_bill_v2: await probe(`${BEXIO_API_URL}/2.0/kb_bill`, accessToken),
        purchase_bills_v4: await probe(`${BEXIO_API_URL}/4.0/purchase/bills`, accessToken),
      },
    };

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("bexio-probe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
