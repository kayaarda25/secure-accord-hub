import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  contentBytes: string;
  size: number;
}

async function getGraphToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to get Graph token: ${resp.status} ${err}`);
  }

  const data: GraphTokenResponse = await resp.json();
  return data.access_token;
}

async function getUnreadEmails(token: string, mailbox: string): Promise<GraphMessage[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/messages?$filter=isRead eq false and hasAttachments eq true&$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,isRead`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to fetch emails: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.value || [];
}

async function getAttachments(token: string, mailbox: string, messageId: string): Promise<GraphAttachment[]> {
  const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${messageId}/attachments?$filter=microsoft.graph.fileAttachment/contentType eq 'application/pdf' or startswith(microsoft.graph.fileAttachment/contentType,'image/')`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Failed to fetch attachments for ${messageId}: ${err}`);
    return [];
  }

  const data = await resp.json();
  // Filter to only PDF and image files
  return (data.value || []).filter((att: any) => {
    const ct = att.contentType?.toLowerCase() || "";
    return ct === "application/pdf" || ct.startsWith("image/");
  });
}

async function markAsRead(token: string, mailbox: string, messageId: string): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${messageId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Failed to mark message ${messageId} as read: ${err}`);
  } else {
    await resp.text(); // consume body
  }
}

async function scanInvoiceWithAI(fileBytes: Uint8Array, mimeType: string, fileName: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  // Build base64 in chunks
  let binaryString = "";
  const chunkSize = 8192;
  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    const chunk = fileBytes.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binaryString);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für die Extraktion von Schweizer Rechnungsdaten. Analysiere das Bild/PDF SEHR GENAU und extrahiere alle relevanten Informationen. Achte besonders auf:
- IBAN: Suche im QR-Code-Bereich, in der Fusszeile, oder bei Zahlungsinformationen. Format: CH.. oder LI.. gefolgt von 19 Ziffern
- UID/MwSt-Nr: Suche in der Kopfzeile, Fusszeile oder bei Firmenangaben. Format: CHE-XXX.XXX.XXX
- Zahlungsreferenz: Suche die lange Nummer im QR-Einzahlungsschein (26-27 Ziffern)

Antworte NUR mit einem JSON-Objekt ohne Markdown-Formatierung.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: `Analysiere diese Schweizer Rechnung SEHR SORGFÄLTIG und extrahiere folgende Informationen als JSON:

{
  "vendor_name": "Firmenname des Lieferanten/Rechnungsstellers",
  "vendor_address": "Vollständige Adresse",
  "vendor_iban": "IBAN des Lieferanten",
  "vendor_vat_number": "UID/MwSt-Nummer CHE-XXX.XXX.XXX",
  "invoice_number": "Rechnungsnummer",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD falls vorhanden",
  "payment_reference": "QR-Referenz (26-27 Ziffern)",
  "amount": "Gesamtbetrag als Zahl",
  "vat_amount": "MwSt-Betrag als Zahl",
  "vat_rate": "MwSt-Satz als Zahl",
  "currency": "CHF/EUR/USD",
  "notes": "Kurze Beschreibung der Leistungen"
}

Falls ein Feld nicht gefunden wird, setze null. Antworte NUR mit dem JSON-Objekt.`,
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} ${errText}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error("No AI response");

  // Parse JSON
  let cleanContent = content.trim();
  const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleanContent = jsonBlockMatch[1].trim();
  } else {
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanContent = jsonMatch[0];
  }

  return JSON.parse(cleanContent);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mailbox = Deno.env.get("AZURE_INVOICE_MAILBOX");
    if (!mailbox) throw new Error("AZURE_INVOICE_MAILBOX not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[ingest-email-invoices] Starting email ingestion for ${mailbox}`);

    // 1. Get Microsoft Graph access token
    const graphToken = await getGraphToken();

    // 2. Fetch unread emails with attachments
    const messages = await getUnreadEmails(graphToken, mailbox);
    console.log(`[ingest-email-invoices] Found ${messages.length} unread emails with attachments`);

    let processedCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      try {
        // 3. Get attachments (PDFs and images only)
        const attachments = await getAttachments(graphToken, mailbox, message.id);

        for (const attachment of attachments) {
          try {
            // Decode base64 attachment content
            const binaryStr = atob(attachment.contentBytes);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }

            // 4. Upload to storage
            const fileName = `email-${crypto.randomUUID()}-${attachment.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("creditor-invoices")
              .upload(fileName, bytes, { contentType: attachment.contentType });

            if (uploadError) {
              console.error(`Upload error for ${attachment.name}:`, uploadError);
            }

            // 5. Scan with AI
            const extractedData = await scanInvoiceWithAI(
              bytes,
              attachment.contentType,
              attachment.name
            );

            // 6. Insert into creditor_invoices
            const { error: insertError } = await supabase
              .from("creditor_invoices")
              .insert({
                vendor_name: extractedData.vendor_name || `Email: ${message.from.emailAddress.name}`,
                vendor_address: extractedData.vendor_address || null,
                vendor_iban: extractedData.vendor_iban || null,
                vendor_vat_number: extractedData.vendor_vat_number || null,
                invoice_number: extractedData.invoice_number || null,
                invoice_date: extractedData.invoice_date || null,
                due_date: extractedData.due_date || null,
                payment_reference: extractedData.payment_reference || null,
                amount: extractedData.amount || 0,
                vat_amount: extractedData.vat_amount || null,
                vat_rate: extractedData.vat_rate || null,
                currency: extractedData.currency || "CHF",
                notes: extractedData.notes || null,
                document_path: uploadData?.path || null,
                document_name: attachment.name,
                original_email_from: message.from.emailAddress.address,
                original_email_subject: message.subject,
                status: "pending",
                extraction_status: "completed",
                ai_extracted_data: extractedData,
                received_at: message.receivedDateTime,
              });

            if (insertError) {
              console.error(`Insert error for ${attachment.name}:`, insertError);
              errorCount++;
            } else {
              processedCount++;
              console.log(`[ingest-email-invoices] Processed: ${attachment.name} from ${message.from.emailAddress.address}`);
            }
          } catch (attError) {
            console.error(`Error processing attachment ${attachment.name}:`, attError);
            errorCount++;
          }
        }

        // 7. Mark email as read
        await markAsRead(graphToken, mailbox, message.id);
      } catch (msgError) {
        console.error(`Error processing message ${message.id}:`, msgError);
        errorCount++;
      }
    }

    console.log(`[ingest-email-invoices] Done. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        messages_checked: messages.length,
        invoices_processed: processedCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ingest-email-invoices] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
