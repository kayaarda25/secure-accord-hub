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

async function refreshBexioToken(
  supabase: any,
  tokens: BexioTokens
): Promise<string> {
  const bexioClientId = Deno.env.get("BEXIO_CLIENT_ID")!;
  const bexioClientSecret = Deno.env.get("BEXIO_CLIENT_SECRET")!;

  const response = await fetch(BEXIO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: bexioClientId,
      client_secret: bexioClientSecret,
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    throw new Error("Failed to refresh Bexio token");
  }

  const newTokens = await response.json();
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  // Update tokens in database
  await supabase
    .from("bexio_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq("organization_id", tokens.organization_id);

  return newTokens.access_token;
}

async function getValidAccessToken(
  supabase: any,
  tokens: BexioTokens
): Promise<string> {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();

  // Refresh if token expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return await refreshBexioToken(supabase, tokens);
  }

  return tokens.access_token;
}

// Helper to safely parse Bexio response (handles text error responses)
async function parseBexioResponse(response: Response, action: string): Promise<any> {
  const text = await response.text();
  
  console.log(`Bexio ${action} response status: ${response.status}`);
  console.log(`Bexio ${action} response body: ${text.substring(0, 500)}`);
  
  if (!response.ok) {
    throw new Error(`Bexio API error (${response.status}): ${text}`);
  }
  
  try {
    return JSON.parse(text);
  } catch {
    // Response is not JSON, return as wrapped object
    return { message: text, raw: true };
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

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error("No organization found");
    }

    // Use service role to get tokens
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokens, error: tokensError } = await serviceSupabase
      .from("bexio_tokens")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .single();

    if (tokensError || !tokens) {
      return new Response(
        JSON.stringify({ connected: false }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(serviceSupabase, tokens);

    // Parse request
    const { action, data } = await req.json();
    console.log(`Bexio API action: ${action}`, data ? JSON.stringify(data).substring(0, 200) : "");

    let bexioResponse: Response;
    let result: any;

    switch (action) {
      case "check_connection":
        // Just check if we have valid tokens
        return new Response(
          JSON.stringify({ connected: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );

      case "get_contacts":
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/contact`, {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      case "search_contact":
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/contact/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify([
            { field: "name_1", value: data.name, criteria: "like" }
          ]),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      case "create_contact":
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/contact`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            contact_type_id: 1, // Company
            name_1: data.name,
            address: data.address,
            postcode: data.postcode,
            city: data.city,
            country_id: data.country_id || 1, // Switzerland
            mail: data.email,
            phone_fixed: data.phone,
          }),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      case "create_invoice": {
        // Some Bexio accounts no longer expose /2.0/kb_bill (returns 404).
        // The v4 Purchase API is available and works for those accounts.
        // Endpoint: /4.0/purchase/bills
        const payload = {
          vendor_id: data.vendor_id || data.contact_id,
          title: data.title || `${data.invoice_number || "Rechnung"} - ${data.vendor_name}`,
          vendor_ref: data.vendor_ref || data.invoice_number || null,
          currency_code: (data.currency || "CHF") as string,
          bill_date: data.bill_date || data.invoice_date || null,
          due_date: data.due_date || null,
          // Minimal positions; adjust accounts/taxes in Bexio if needed.
          positions: [
            {
              text: data.title || data.vendor_name || "Lieferantenrechnung",
              amount: 1,
              unit_price: Number(data.amount),
            },
          ],
        };

        console.log("Creating purchase bill (v4) with payload:", JSON.stringify(payload));

        bexioResponse = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;
      }

      case "get_invoices":
        // Use v4 purchase bills listing for supplier invoices
        bexioResponse = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;
      
      case "create_creditor":
        // Create or get creditor (supplier) contact
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/contact`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            contact_type_id: 2, // Supplier/Creditor
            name_1: data.name,
            address: data.address,
            mail: data.email,
          }),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Bexio API error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
