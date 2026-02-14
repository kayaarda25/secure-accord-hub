import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESTORE_ORDER = [
  "organizations", "organization_permissions", "profiles", "user_roles",
  "security_settings", "letterhead_settings", "user_public_keys",
  "document_folders", "documents", "document_shares", "document_signatures",
  "document_tags", "document_tag_assignments", "document_templates", "document_activity",
  "folder_shares", "contacts", "contracts", "cost_centers", "carrier_rates",
  "declarations", "creditor_invoices", "creditor_invoice_approvals",
  "budget_plans", "budget_forecasts", "budget_alerts",
  "calendar_events", "calendar_event_participants",
  "communication_threads", "thread_participants",
  "communication_messages", "communication_documents",
  "meeting_protocols", "scheduled_meetings", "meeting_participants",
  "meeting_recordings", "meeting_chat_messages",
  "tasks", "task_participants",
  "social_insurance_records", "notifications", "notification_preferences",
  "bexio_tokens", "backup_schedules", "audit_logs",
  "opex_expenses", "opex_receipts",
];

const STORAGE_BUCKETS = ["documents", "receipts", "creditor-invoices", "signatures", "avatars", "meeting-recordings"];

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
      return new Response(JSON.stringify({ error: "Nur Administratoren können Backups wiederherstellen." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read ZIP from request body
    const zipBuffer = await req.arrayBuffer();
    if (!zipBuffer || zipBuffer.byteLength === 0) {
      return new Response(JSON.stringify({ error: "No ZIP file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`ZIP restore requested by ${user.id}, size: ${zipBuffer.byteLength} bytes`);

    const zip = await JSZip.loadAsync(zipBuffer);

    // ──────────────────────────────
    // 1. Restore database tables
    // ──────────────────────────────
    const dbResults: Record<string, { restored: number; errors: string[] }> = {};

    for (const tableName of RESTORE_ORDER) {
      const tableFile = zip.file(`tables/${tableName}.json`);
      if (!tableFile) {
        dbResults[tableName] = { restored: 0, errors: [] };
        continue;
      }

      try {
        const content = await tableFile.async("text");
        const tableData = JSON.parse(content);
        if (!Array.isArray(tableData) || tableData.length === 0) {
          dbResults[tableName] = { restored: 0, errors: [] };
          continue;
        }

        const tableErrors: string[] = [];
        let restoredCount = 0;
        const batchSize = 100;

        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize);
          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

          if (error) {
            tableErrors.push(`Batch ${i / batchSize}: ${error.message}`);
          } else {
            restoredCount += batch.length;
          }
        }

        dbResults[tableName] = { restored: restoredCount, errors: tableErrors };
        console.log(`✓ DB ${tableName}: ${restoredCount}/${tableData.length} rows`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        dbResults[tableName] = { restored: 0, errors: [msg] };
      }
    }

    // ──────────────────────────────
    // 2. Restore storage files
    // ──────────────────────────────
    let filesRestored = 0;
    let fileErrors = 0;
    const storageResults: Record<string, { restored: number; errors: number }> = {};

    for (const bucket of STORAGE_BUCKETS) {
      const prefix = `storage/${bucket}/`;
      const bucketFiles = Object.keys(zip.files).filter(
        (path) => path.startsWith(prefix) && !zip.files[path].dir
      );

      let bucketRestored = 0;
      let bucketErrors = 0;

      for (const zipPath of bucketFiles) {
        try {
          const fileData = await zip.files[zipPath].async("uint8array");
          const originalPath = zipPath.slice(prefix.length);

          // Determine content type from extension
          const ext = originalPath.split(".").pop()?.toLowerCase() || "";
          const contentTypeMap: Record<string, string> = {
            pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
            jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
            doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            csv: "text/csv", txt: "text/plain", json: "application/json",
            mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
          };
          const contentType = contentTypeMap[ext] || "application/octet-stream";

          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(originalPath, fileData, { contentType, upsert: true });

          if (uploadErr) {
            bucketErrors++;
          } else {
            bucketRestored++;
          }
        } catch {
          bucketErrors++;
        }
      }

      if (bucketFiles.length > 0) {
        storageResults[bucket] = { restored: bucketRestored, errors: bucketErrors };
        filesRestored += bucketRestored;
        fileErrors += bucketErrors;
        console.log(`✓ Storage ${bucket}: ${bucketRestored}/${bucketFiles.length} files`);
      }
    }

    const totalRestored = Object.values(dbResults).reduce((s, r) => s + r.restored, 0);
    const totalDbErrors = Object.values(dbResults).reduce((s, r) => s + r.errors.length, 0);

    return new Response(JSON.stringify({
      success: true,
      total_restored: totalRestored,
      total_errors: totalDbErrors,
      files_restored: filesRestored,
      file_errors: fileErrors,
      db_details: dbResults,
      storage_details: storageResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ZIP restore failed:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
