import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { file_path } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Restore requested by ${user.id} from ${file_path}`);

    // Download backup metadata from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("backups")
      .download(file_path);

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message || "File not found"}`);
    }

    const backupText = await fileData.text();
    const backup = JSON.parse(backupText);

    if (!backup.metadata || !backup.data) {
      throw new Error("Invalid backup format");
    }

    const isV3 = backup.metadata.version === "3.0";
    const backupPrefix = backup.metadata.backup_prefix || null;

    console.log(`Restoring backup v${backup.metadata.version} — ${backup.metadata.tables_count} tables, ${backup.metadata.storage_files_count || 0} files`);

    // ──────────────────────────────
    // 1. Restore database tables
    // ──────────────────────────────
    const results: Record<string, { restored: number; errors: string[] }> = {};

    const restoreOrder = [
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
    ];

    for (const tableName of restoreOrder) {
      const tableData = backup.data[tableName];
      if (!tableData || tableData.length === 0) {
        results[tableName] = { restored: 0, errors: [] };
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

      results[tableName] = { restored: restoredCount, errors: tableErrors };
      console.log(`✓ DB ${tableName}: ${restoredCount}/${tableData.length} rows`);
    }

    // ──────────────────────────────
    // 2. Restore storage files
    // ──────────────────────────────
    let filesRestored = 0;
    let fileErrors = 0;
    const storageResults: Record<string, { restored: number; errors: number }> = {};

    if (isV3 && backupPrefix && backup.storage_manifest) {
      for (const [bucket, filePaths] of Object.entries(backup.storage_manifest)) {
        const paths = filePaths as string[];
        let bucketRestored = 0;
        let bucketErrors = 0;

        for (const filePath of paths) {
          try {
            // Download from backups bucket
            const backupFilePath = `${backupPrefix}/storage/${bucket}/${filePath}`;
            const { data: fileBlob, error: dlError } = await supabase.storage
              .from("backups")
              .download(backupFilePath);

            if (dlError || !fileBlob) {
              bucketErrors++;
              continue;
            }

            // Upload back to original bucket
            const { error: uploadErr } = await supabase.storage
              .from(bucket)
              .upload(filePath, fileBlob, {
                contentType: fileBlob.type || "application/octet-stream",
                upsert: true,
              });

            if (uploadErr) {
              bucketErrors++;
            } else {
              bucketRestored++;
            }
          } catch {
            bucketErrors++;
          }
        }

        storageResults[bucket] = { restored: bucketRestored, errors: bucketErrors };
        filesRestored += bucketRestored;
        fileErrors += bucketErrors;
        console.log(`✓ Storage ${bucket}: ${bucketRestored}/${paths.length} files restored`);
      }
    }

    const totalRestored = Object.values(results).reduce((s, r) => s + r.restored, 0);
    const totalDbErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);

    return new Response(JSON.stringify({
      success: true,
      total_restored: totalRestored,
      total_errors: totalDbErrors,
      files_restored: filesRestored,
      file_errors: fileErrors,
      db_details: results,
      storage_details: storageResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Restore failed:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
