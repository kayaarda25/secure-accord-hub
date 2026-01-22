import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BEXIO_API_URL = "https://api.bexio.com";
const BEXIO_TOKEN_URL = "https://auth.bexio.com/realms/bexio/protocol/openid-connect/token";

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

interface BexioTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  organization_id: string;
  scope?: string | null;
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
      case "disconnect":
        // Delete stored tokens for this organization (forces re-connect)
        await serviceSupabase
          .from("bexio_tokens")
          .delete()
          .eq("organization_id", profile.organization_id);

        return new Response(
          JSON.stringify({ disconnected: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );

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
        // Bexio v4 Purchase Bills API
        // Endpoint: POST /4.0/purchase/bills
        // REQUIRED FIELDS (based on Bexio responses + 400 errors):
        // - supplier_id: number
        // - contact_partner_id: number
        // - address: object (NOT a string)
        // - manual_amount: boolean
        // - item_net: boolean
        // - line_items[].position: number (0-indexed position)
        
        const supplierId = toNumber(data.vendor_id ?? data.contact_id);
        if (!Number.isFinite(supplierId)) {
          throw new Error("create_invoice: missing/invalid supplier_id (vendor_id/contact_id)");
        }

        const totalAmount = toNumber(data.amount);
        if (!Number.isFinite(totalAmount)) {
          throw new Error("create_invoice: missing/invalid amount");
        }

        const bookingAccountId = Number.isFinite(toNumber(data.booking_account_id))
          ? toNumber(data.booking_account_id)
          : (Number.isFinite(toNumber(data.account_id)) ? toNumber(data.account_id) : 99);

        // Tax ID: use provided, or infer (22 = standard Swiss VAT, null = no VAT)
        const vatRate = toNumber(data.vat_rate);
        const hasVat = Number.isFinite(vatRate) && vatRate > 0;
        const taxId = (data?.tax_id === null)
          ? null
          : (Number.isFinite(toNumber(data.tax_id))
            ? toNumber(data.tax_id)
            : (hasVat ? 22 : null));

        // Build address OBJECT as expected by v4 (we verified via GET /4.0/purchase/bills/{id}).
        // We try to parse Swiss-style addresses like: "Street 1, 8005 Zürich".
        const rawVendorName = typeof data.vendor_name === "string" ? data.vendor_name.trim() : "";
        const rawVendorAddress = typeof data.vendor_address === "string" ? data.vendor_address.trim() : "";

        // Normalize to tokens (split commas/newlines)
        const tokens = rawVendorAddress
          ? rawVendorAddress
              .split(/\r?\n/)
              .flatMap((line: string) => line.split(","))
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        // Heuristic: last token may contain postcode + city
        let postcode: string | null = null;
        let city: string | null = null;
        let addressLine: string | null = null;

        if (tokens.length > 0) {
          const last = tokens[tokens.length - 1];
          const m = last.match(/^(\d{4})\s+(.+)$/);
          if (m) {
            postcode = m[1];
            city = m[2];
            addressLine = tokens.slice(0, -1).join(", ") || null;
          } else {
            addressLine = tokens.join(", ") || null;
          }
        }

        const addressObj: Record<string, any> = {
          type: "COMPANY",
          lastname_company: rawVendorName || "Lieferant",
          address_line: addressLine || "-",
          postcode,
          city,
          country_code: (typeof data.country_code === "string" && data.country_code) ? data.country_code : "CH",
          // keep other fields optional/null
          contact_address_id: null,
          main_contact_id: null,
          firstname_suffix: null,
          salutation: null,
          title: null,
        };

        // Bexio v4 Purchase Bills: when manual_amount=true, provide amount_man (not amount_calc)
        // Include description in line_items and attachment_ids at root level
        const lineDescription = data.description || data.title || `${data.invoice_number || "Rechnung"} - ${data.vendor_name || "Lieferant"}`;
        
        const payload: Record<string, any> = {
          supplier_id: supplierId,
          contact_partner_id: supplierId,
          title: data.title || `${data.invoice_number || "Rechnung"} - ${data.vendor_name}`,
          vendor_ref: data.vendor_ref || data.invoice_number || null,
          address: addressObj,
          currency_code: (data.currency || "CHF") as string,
          bill_date: data.bill_date || data.invoice_date || new Date().toISOString().split("T")[0],
          due_date: data.due_date || null,
          // CRITICAL: manual_amount=true requires amount_man, NOT amount_calc
          manual_amount: true,
          item_net: false,
          amount_man: totalAmount,
          line_items: [
            {
              position: 0,
              amount: totalAmount,
              description: lineDescription,
              booking_account_id: bookingAccountId,
              tax_id: taxId,
            },
          ],
        };

        // Add attachment_ids if provided (file UUIDs from upload_file)
        if (Array.isArray(data.attachment_ids) && data.attachment_ids.length > 0) {
          payload.attachment_ids = data.attachment_ids;
          console.log("Including attachment_ids in bill creation:", data.attachment_ids);
        }

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

      case "get_bill": {
        if (!data?.id) throw new Error("get_bill: missing id");

        bexioResponse = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(data.id)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
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

      case "upload_file": {
        // Upload a file to Bexio Files (Inbox)
        // Expects: data.file_base64 (base64 encoded), data.filename, data.mime_type
        if (!data?.file_base64 || !data?.filename) {
          throw new Error("upload_file: missing file_base64 or filename");
        }

        // If OAuth token was created without file scope, Bexio will return 403 for this endpoint.
        const tokenScope = typeof tokens.scope === "string" ? tokens.scope : "";
        const hasFileScope = tokenScope.split(/\s+/).includes("file");
        if (!hasFileScope) {
          throw new Error(
            "Bexio connection is missing the required 'file' permission. Please disconnect and reconnect Bexio to grant file access."
          );
        }

        // Decode base64 to binary
        const binaryString = atob(data.file_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const mimeType = data.mime_type || "application/pdf";
        const blob = new Blob([bytes], { type: mimeType });

        const formData = new FormData();
        formData.append("file", blob, data.filename);

        console.log(`Uploading file to Bexio: ${data.filename} (${bytes.length} bytes)`);

        bexioResponse = await fetch(`${BEXIO_API_URL}/3.0/files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          body: formData,
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;
      }

      case "attach_file_to_bill": {
        // Attach file(s) to an existing purchase bill
        // Expects: data.bill_id (UUID), data.attachment_ids (array of file UUIDs)
        if (!data?.bill_id || !data?.attachment_ids) {
          throw new Error("attach_file_to_bill: missing bill_id or attachment_ids");
        }

        // First get current bill to preserve existing data
        const getBillResp = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(data.bill_id)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        const currentBill = await parseBexioResponse(getBillResp, "get_bill_for_attach");

        // Merge existing attachment_ids with new ones
        const existingAttachments = currentBill.attachment_ids || [];
        const allAttachments = [...new Set([...existingAttachments, ...data.attachment_ids])];

        // Update bill with attachment_ids
        const updatePayload = {
          attachment_ids: allAttachments,
        };

        console.log(`Attaching files to bill ${data.bill_id}:`, allAttachments);

        bexioResponse = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(data.bill_id)}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(updatePayload),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;
      }

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
