import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CONVERTAPI_SECRET = Deno.env.get("CONVERTAPI_SECRET");
    if (!CONVERTAPI_SECRET) {
      throw new Error("CONVERTAPI_SECRET is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { filePath } = await req.json();
    if (!filePath) {
      return new Response(JSON.stringify({ error: "filePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the Word document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Could not download document: ${downloadError?.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64File = btoa(binary);

    // Call ConvertAPI to convert Word → PDF
    const fileName = filePath.split("/").pop() || "document.docx";
    const convertResponse = await fetch(
      `https://v2.convertapi.com/convert/docx/to/pdf?Secret=${CONVERTAPI_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Parameters: [
            {
              Name: "File",
              FileValue: {
                Name: fileName,
                Data: base64File,
              },
            },
            {
              Name: "StoreFile",
              Value: true,
            },
          ],
        }),
      }
    );

    if (!convertResponse.ok) {
      const errText = await convertResponse.text();
      throw new Error(`ConvertAPI error [${convertResponse.status}]: ${errText}`);
    }

    const result = await convertResponse.json();

    if (!result.Files || result.Files.length === 0) {
      throw new Error("ConvertAPI returned no files");
    }

    // Download the converted PDF from ConvertAPI
    const pdfUrl = result.Files[0].Url;
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error("Could not download converted PDF from ConvertAPI");
    }

    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);

    // Return the PDF as base64
    let pdfBinary = "";
    for (let i = 0; i < pdfUint8.length; i++) {
      pdfBinary += String.fromCharCode(pdfUint8[i]);
    }
    const pdfBase64 = btoa(pdfBinary);

    return new Response(
      JSON.stringify({ pdfBase64, fileName: result.Files[0].FileName }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error converting document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
