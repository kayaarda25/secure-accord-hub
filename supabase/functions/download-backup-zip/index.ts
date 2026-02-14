import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin role check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Nur Administratoren können Backups herunterladen." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_path } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`ZIP download requested by admin ${user.id} for ${file_path}`);

    // Download metadata JSON
    const { data: metaFile, error: metaError } = await supabase.storage
      .from("backups")
      .download(file_path);

    if (metaError || !metaFile) {
      throw new Error(`Metadata download failed: ${metaError?.message || "not found"}`);
    }

    const metaText = await metaFile.text();
    const backup = JSON.parse(metaText);

    if (!backup.metadata || !backup.data) {
      throw new Error("Invalid backup format");
    }

    const zip = new JSZip();

    // 1. Add individual table JSON files
    for (const [tableName, tableData] of Object.entries(backup.data)) {
      const arr = tableData as unknown[];
      if (arr && arr.length > 0) {
        zip.file(`tables/${tableName}.json`, JSON.stringify(arr, null, 2));
      }
    }

    // 2. Add metadata summary
    zip.file("metadata.json", JSON.stringify(backup.metadata, null, 2));

    // 3. Add storage manifest
    if (backup.storage_manifest) {
      zip.file("storage_manifest.json", JSON.stringify(backup.storage_manifest, null, 2));
    }

    // 4. Download and add storage files from backup folder
    const backupPrefix = backup.metadata.backup_prefix;
    if (backupPrefix && backup.storage_manifest) {
      for (const [bucket, filePaths] of Object.entries(backup.storage_manifest)) {
        const paths = filePaths as string[];
        for (const filePath of paths) {
          try {
            const backupFilePath = `${backupPrefix}/storage/${bucket}/${filePath}`;
            const { data: fileBlob, error: dlError } = await supabase.storage
              .from("backups")
              .download(backupFilePath);

            if (dlError || !fileBlob) continue;

            const arrayBuffer = await fileBlob.arrayBuffer();
            zip.file(`storage/${bucket}/${filePath}`, new Uint8Array(arrayBuffer));
          } catch (err) {
            console.warn(`Error adding ${bucket}/${filePath} to ZIP:`, err);
          }
        }
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });

    const timestamp = backup.metadata.created_at?.replace(/[:.]/g, "-")?.slice(0, 19) || "unknown";
    const filename = `backup-${timestamp}.zip`;

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ZIP download failed:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
