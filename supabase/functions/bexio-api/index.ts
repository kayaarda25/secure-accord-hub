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
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  organization_id: string;
  scope?: string | null;
}

async function resolveInternalContactPartnerId(
  accessToken: string,
  userEmail?: string | null
): Promise<number | null> {
  try {
    const meResp = await fetch(`${BEXIO_API_URL}/3.0/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (meResp.ok) {
      const me = await meResp.json();
      const meId = toNumber(me?.id);
      if (Number.isFinite(meId) && meId > 0) return meId;
    }
  } catch {
    // ignore
  }

  if (userEmail) {
    try {
      const usersResp = await fetch(`${BEXIO_API_URL}/2.0/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!usersResp.ok) return null;
      const users = await usersResp.json();
      if (!Array.isArray(users)) return null;

      const match = users.find((u: any) =>
        typeof u?.email === "string" &&
        u.email.trim().toLowerCase() === userEmail.trim().toLowerCase()
      );
      const matchId = toNumber(match?.id);
      if (Number.isFinite(matchId) && matchId > 0) return matchId;
    } catch {
      // ignore
    }
  }

  return null;
}

class BexioReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BexioReconnectRequiredError";
  }
}

/**
 * Resolve tokens: prefer bexio_accounts (multi-account), fallback to bexio_tokens (legacy).
 * If bexio_account_id is provided, use that specific account.
 */
async function resolveTokens(
  serviceSupabase: any,
  organizationId: string,
  bexioAccountId?: string | null
): Promise<BexioTokens | null> {
  // Try bexio_accounts first (multi-account)
  if (bexioAccountId) {
    const { data } = await serviceSupabase
      .from("bexio_accounts")
      .select("id, access_token, refresh_token, expires_at, organization_id, scope")
      .eq("id", bexioAccountId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single();
    if (data?.access_token) return data as BexioTokens;
  }

  // Try any active account for this org
  const { data: accounts } = await serviceSupabase
    .from("bexio_accounts")
    .select("id, access_token, refresh_token, expires_at, organization_id, scope")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("access_token", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (accounts && accounts.length > 0 && accounts[0].access_token) {
    return accounts[0] as BexioTokens;
  }

  // Fallback to legacy bexio_tokens table
  const { data: legacyTokens } = await serviceSupabase
    .from("bexio_tokens")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (legacyTokens) {
    return { ...legacyTokens, id: legacyTokens.id } as BexioTokens;
  }

  return null;
}

/**
 * Persist refreshed tokens back to the correct table.
 */
async function persistRefreshedTokens(
  serviceSupabase: any,
  tokens: BexioTokens,
  newAccessToken: string,
  newRefreshToken: string,
  expiresAt: string
) {
  // Check if this token came from bexio_accounts
  const { data: account } = await serviceSupabase
    .from("bexio_accounts")
    .select("id")
    .eq("id", tokens.id)
    .single();

  if (account) {
    await serviceSupabase
      .from("bexio_accounts")
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: expiresAt,
      })
      .eq("id", tokens.id);
  } else {
    // Legacy bexio_tokens
    await serviceSupabase
      .from("bexio_tokens")
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: expiresAt,
      })
      .eq("organization_id", tokens.organization_id);
  }
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
    
    if (errorText.includes("invalid_grant") || errorText.includes("Token is not active")) {
      // Check if from bexio_accounts
      const { data: account } = await supabase
        .from("bexio_accounts")
        .select("id")
        .eq("id", tokens.id)
        .single();

      if (account) {
        await supabase
          .from("bexio_accounts")
          .update({ access_token: null, refresh_token: null, expires_at: null })
          .eq("id", tokens.id);
      } else {
        await supabase
          .from("bexio_tokens")
          .delete()
          .eq("organization_id", tokens.organization_id);
      }
      
      throw new BexioReconnectRequiredError("Bexio-Sitzung abgelaufen. Bitte verbinden Sie Bexio erneut.");
    }
    
    throw new Error("Failed to refresh Bexio token");
  }

  const newTokens = await response.json();
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  await persistRefreshedTokens(
    supabase,
    tokens,
    newTokens.access_token,
    newTokens.refresh_token || tokens.refresh_token,
    expiresAt
  );

  return newTokens.access_token;
}

async function getValidAccessToken(
  supabase: any,
  tokens: BexioTokens
): Promise<string> {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return await refreshBexioToken(supabase, tokens);
  }

  return tokens.access_token;
}

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error("No organization found");
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { action, data } = await req.json();
    console.log(`Bexio API action: ${action}`, data ? JSON.stringify(data).substring(0, 200) : "");

    // Resolve tokens - support bexio_account_id for multi-account
    const bexioAccountId = data?.bexio_account_id || null;
    const tokens = await resolveTokens(serviceSupabase, profile.organization_id, bexioAccountId);

    if (!tokens) {
      // For check_connection and disconnect, return gracefully
      if (action === "check_connection") {
        return new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (action === "disconnect") {
        return new Response(
          JSON.stringify({ disconnected: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return new Response(
        JSON.stringify({ connected: false, error: "No Bexio connection found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(serviceSupabase, tokens);

    let bexioResponse: Response;
    let result: any;

    switch (action) {
      case "disconnect":
        // For multi-account: if bexio_account_id given, clear that account's tokens
        if (bexioAccountId) {
          await serviceSupabase
            .from("bexio_accounts")
            .update({ access_token: null, refresh_token: null, expires_at: null })
            .eq("id", bexioAccountId);
        } else {
          // Legacy: delete from bexio_tokens
          await serviceSupabase
            .from("bexio_tokens")
            .delete()
            .eq("organization_id", profile.organization_id);
        }

        return new Response(
          JSON.stringify({ disconnected: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );

      case "check_connection":
        return new Response(
          JSON.stringify({ connected: true, account_id: tokens.id }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
            contact_type_id: 1,
            name_1: data.name,
            address: data.address,
            postcode: data.postcode,
            city: data.city,
            country_id: data.country_id || 1,
            mail: data.email,
            phone_fixed: data.phone,
          }),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      case "create_invoice": {
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

        const vatRate = toNumber(data.vat_rate);
        const hasVat = Number.isFinite(vatRate) && vatRate > 0;
        let taxId: number | null = null;
        if (data?.tax_id !== null && Number.isFinite(toNumber(data.tax_id))) {
          taxId = toNumber(data.tax_id);
        } else if (hasVat) {
          if (vatRate >= 7.5 && vatRate <= 8.1) {
            taxId = 35;
          } else if (vatRate >= 2.4 && vatRate <= 2.6) {
            taxId = 36;
          } else if (vatRate >= 3.7 && vatRate <= 3.9) {
            taxId = 37;
          } else {
            taxId = 35;
          }
        }

        const rawVendorName = typeof data.vendor_name === "string" ? data.vendor_name.trim() : "";
        const rawVendorAddress = typeof data.vendor_address === "string" ? data.vendor_address.trim() : "";

        const addrTokens = rawVendorAddress
          ? rawVendorAddress
              .split(/\r?\n/)
              .flatMap((line: string) => line.split(","))
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        let postcode: string | null = null;
        let city: string | null = null;
        let addressLine: string | null = null;

        if (addrTokens.length > 0) {
          const last = addrTokens[addrTokens.length - 1];
          const m = last.match(/^(\d{4})\s+(.+)$/);
          if (m) {
            postcode = m[1];
            city = m[2];
            addressLine = addrTokens.slice(0, -1).join(", ") || null;
          } else {
            addressLine = addrTokens.join(", ") || null;
          }
        }

        const addressObj: Record<string, any> = {
          type: "COMPANY",
          lastname_company: rawVendorName || "Lieferant",
          address_line: addressLine || "-",
          postcode,
          city,
          country_code: (typeof data.country_code === "string" && data.country_code) ? data.country_code : "CH",
          contact_address_id: null,
          main_contact_id: null,
          firstname_suffix: null,
          salutation: null,
          title: null,
        };

        const titleWithNr = data.invoice_number 
          ? `${data.invoice_number} - ${data.vendor_name}` 
          : data.title || `Rechnung - ${data.vendor_name}`;
        
        const contactPartnerIdCandidate = toNumber(data.contact_partner_id);
        let contactPartnerId =
          Number.isFinite(contactPartnerIdCandidate) && contactPartnerIdCandidate > 0
            ? contactPartnerIdCandidate
            : null;

        if (!contactPartnerId) {
          contactPartnerId = await resolveInternalContactPartnerId(accessToken, user?.email);
        }

        if (!contactPartnerId) {
          throw new Error(
            "Konnte keinen internen Bexio Kontakt (contact_partner_id) ermitteln. Bitte stelle sicher, dass die Bexio-Verbindung von einem gültigen Benutzer autorisiert wurde."
          );
        }

        const lineDescription = (data.notes || data.title || titleWithNr || "Rechnung").slice(0, 200);

        const payload: Record<string, any> = {
          supplier_id: supplierId,
          contact_partner_id: contactPartnerId,
          title: data.title || titleWithNr,
          vendor_ref: data.payment_reference || data.vendor_ref || null,
          address: addressObj,
          currency_code: (data.currency || "CHF") as string,
          bill_date: data.bill_date || data.invoice_date || new Date().toISOString().split("T")[0],
          due_date: data.due_date || null,
          ...(data.invoice_number ? { document_nr: data.invoice_number } : {}),
          manual_amount: true,
          item_net: false,
          amount_man: totalAmount,
          line_items: [
            {
              position: 0,
              title: lineDescription,
              amount: totalAmount,
              booking_account_id: bookingAccountId,
              tax_id: taxId,
            },
          ],
        };

        if (Array.isArray(data.attachment_ids) && data.attachment_ids.length > 0) {
          payload.attachment_ids = data.attachment_ids;
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

        const createdBill = await parseBexioResponse(bexioResponse, action);

        // Auto-issue the bill to create payment order
        let issuedBill = createdBill;
        const billId = createdBill?.id;
        if (billId !== undefined && billId !== null) {
          console.log("Issuing purchase bill to mark as open:", billId);

          if (data.invoice_number) {
            try {
              const validateResp = await fetch(
                `${BEXIO_API_URL}/4.0/purchase/bills/validate-document-nr?document_nr=${encodeURIComponent(data.invoice_number)}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                  },
                }
              );
              const validateResult = await validateResp.text();
              console.log("Document nr validation:", validateResp.status, validateResult);
            } catch (e) {
              console.warn("Document nr validation check failed (non-blocking):", e);
            }
          }

          const issueResp = await fetch(
            `${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(String(billId))}/issue`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({}),
            }
          );

          if (issueResp.ok) {
            issuedBill = await parseBexioResponse(issueResp, "issue_bill");
            console.log("Purchase bill issued successfully, Nr:", issuedBill?.document_nr);
          } else {
            const issueError = await issueResp.text();
            console.error(`Failed to issue purchase bill (${issueResp.status}):`, issueError);
            try {
              const statusResp = await fetch(
                `${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(String(billId))}/status`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify({ status: "OPEN" }),
                }
              );
              if (statusResp.ok) {
                issuedBill = await parseBexioResponse(statusResp, "status_update");
                console.log("Purchase bill status updated to OPEN");
              } else {
                const statusError = await statusResp.text();
                console.error(`Status update also failed (${statusResp.status}):`, statusError);
              }
            } catch (statusErr) {
              console.error("Status update attempt failed:", statusErr);
            }
          }
        }

        result = issuedBill;
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
        bexioResponse = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;
      
      case "create_creditor":
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/contact`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            contact_type_id: 2,
            name_1: data.name,
            address: data.address,
            mail: data.email,
          }),
        });
        result = await parseBexioResponse(bexioResponse, action);
        break;

      case "upload_file": {
        if (!data?.file_base64 || !data?.filename) {
          throw new Error("upload_file: missing file_base64 or filename");
        }

        const tokenScope = typeof tokens.scope === "string" ? tokens.scope : "";
        const hasFileScope = tokenScope.split(/\s+/).includes("file");
        if (!hasFileScope) {
          throw new Error(
            "Bexio connection is missing the required 'file' permission. Please disconnect and reconnect Bexio to grant file access."
          );
        }

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
        if (!data?.bill_id || !data?.attachment_ids) {
          throw new Error("attach_file_to_bill: missing bill_id or attachment_ids");
        }

        const getBillResp = await fetch(`${BEXIO_API_URL}/4.0/purchase/bills/${encodeURIComponent(data.bill_id)}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        const currentBill = await parseBexioResponse(getBillResp, "get_bill_for_attach");

        const existingAttachments: string[] = currentBill.attachment_ids || [];
        const allAttachments = [...new Set([...existingAttachments, ...data.attachment_ids])];

        const currentContactPartnerId = toNumber(currentBill.contact_partner_id);
        let safeContactPartnerId =
          Number.isFinite(currentContactPartnerId) && currentContactPartnerId > 0
            ? currentContactPartnerId
            : null;
        if (!safeContactPartnerId) {
          safeContactPartnerId = await resolveInternalContactPartnerId(accessToken, user?.email);
        }
        if (!safeContactPartnerId) {
          throw new Error(
            "attach_file_to_bill: Konnte keinen gültigen internen contact_partner_id ermitteln."
          );
        }

        const updatePayload: Record<string, any> = {
          supplier_id: currentBill.supplier_id,
          contact_partner_id: safeContactPartnerId,
          title: currentBill.title,
          vendor_ref: currentBill.vendor_ref ?? null,
          address: currentBill.address,
          currency_code: currentBill.currency_code,
          bill_date: currentBill.bill_date,
          due_date: currentBill.due_date,
          manual_amount: currentBill.manual_amount ?? true,
          item_net: currentBill.item_net ?? false,
          split_into_line_items: currentBill.split_into_line_items ?? false,
          amount_man: currentBill.amount_man ?? currentBill.amount_calc ?? 0,
          line_items: currentBill.line_items ?? [],
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

      case "get_bank_accounts": {
        bexioResponse = await fetch(`${BEXIO_API_URL}/2.0/bank_account`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        
        if (bexioResponse.status === 404) {
          console.log("Bexio bank accounts not available (404)");
          result = [];
          break;
        }
        
        result = await parseBexioResponse(bexioResponse, action);
        break;
      }

      case "create_iban_payment": {
        const bankAccountId = toNumber(data.bank_account_id);
        if (!Number.isFinite(bankAccountId)) {
          throw new Error("create_iban_payment: missing/invalid bank_account_id");
        }

        if (!data.iban || typeof data.iban !== "string") {
          throw new Error("create_iban_payment: missing iban");
        }

        const paymentAmount = toNumber(data.amount);
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
          throw new Error("create_iban_payment: missing/invalid amount");
        }

        const recipientName = data.recipient_name || data.vendor_name || "Lieferant";
        const recipientStreet = data.recipient_street || data.vendor_address || "-";
        const recipientZip = data.recipient_zip || "";
        const recipientCity = data.recipient_city || "";
        const recipientCountry = data.recipient_country || "CH";

        const paymentPayload = {
          iban: data.iban.replace(/\s/g, "").toUpperCase(),
          instructed_amount: {
            currency: data.currency || "CHF",
            amount: paymentAmount.toFixed(2),
          },
          recipient: {
            name: recipientName.slice(0, 70),
            street: recipientStreet.slice(0, 70),
            zip: recipientZip.slice(0, 16),
            city: recipientCity.slice(0, 35),
            country_code: recipientCountry.slice(0, 2).toUpperCase(),
          },
          execution_date: data.execution_date || new Date().toISOString().split("T")[0],
          message: data.message || data.reference || "",
        };

        console.log(`Creating IBAN payment on bank account ${bankAccountId}:`, JSON.stringify(paymentPayload));

        bexioResponse = await fetch(
          `${BEXIO_API_URL}/3.0/banking/bank_accounts/${bankAccountId}/payments/iban`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(paymentPayload),
          }
        );
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
    
    if (error instanceof BexioReconnectRequiredError || error.name === "BexioReconnectRequiredError") {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          reconnect_required: true, 
          error: error.message 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
