import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      throw new Error("No file provided");
    }

    // Convert file to base64 - use chunked approach to avoid stack overflow
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Build base64 string in chunks to prevent stack overflow
    let binaryString = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binaryString);
    const mimeType = file.type || "image/jpeg";

    // Call Lovable AI with vision capabilities
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
            content: `Du bist ein Experte für die Extraktion von Rechnungsdaten. Analysiere das Bild und extrahiere alle relevanten Informationen. Antworte NUR mit einem JSON-Objekt ohne Markdown-Formatierung.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              },
              {
                type: "text",
                text: `Extrahiere folgende Informationen aus dieser Rechnung und gib sie als JSON zurück:
                
{
  "vendor_name": "Firmenname des Lieferanten",
  "vendor_address": "Vollständige Adresse",
  "vendor_iban": "IBAN falls vorhanden",
  "vendor_vat_number": "MwSt-Nummer/UID falls vorhanden",
  "invoice_number": "Rechnungsnummer",
  "invoice_date": "Rechnungsdatum im Format YYYY-MM-DD",
  "due_date": "Fälligkeitsdatum im Format YYYY-MM-DD falls vorhanden",
  "payment_reference": "Zahlungsreferenz/ESR/QR-Referenz falls vorhanden",
  "amount": "Gesamtbetrag als Zahl ohne Währungssymbol",
  "vat_amount": "MwSt-Betrag als Zahl",
  "vat_rate": "MwSt-Satz als Zahl (z.B. 8.1)",
  "currency": "Währungscode (CHF, EUR, USD)",
  "notes": "Kurze Beschreibung der Rechnung/Leistungen"
}

Falls ein Feld nicht gefunden wird, setze null. Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text oder Markdown.`
              }
            ]
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response - handle potential markdown wrapping
    let extractedData;
    try {
      // Remove potential markdown code blocks (various formats)
      let cleanContent = content.trim();
      
      // Handle ```json\n...\n``` format using regex
      const jsonBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        cleanContent = jsonBlockMatch[1].trim();
      } else {
        // Try to find JSON object directly
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanContent = jsonMatch[0];
        }
      }
      
      extractedData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      console.error("Parse error:", parseError);
      throw new Error("Could not parse invoice data");
    }

    // Upload file to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("creditor-invoices")
      .upload(fileName, file, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Don't fail - we still have the extracted data
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        document_path: uploadData?.path || null,
        document_name: file.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("scan-invoice error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
