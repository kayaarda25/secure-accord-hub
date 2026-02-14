import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All tables to backup
const TABLES_TO_BACKUP = [
  "profiles", "organizations", "organization_permissions",
  "documents", "document_folders", "document_shares", "document_signatures",
  "document_tags", "document_tag_assignments", "document_templates", "document_activity",
  "tasks", "task_participants",
  "calendar_events", "calendar_event_participants",
  "communication_threads", "communication_messages", "communication_documents", "thread_participants",
  "meeting_protocols", "meeting_recordings", "meeting_chat_messages",
  "scheduled_meetings", "meeting_participants",
  "declarations", "creditor_invoices", "creditor_invoice_approvals",
  "opex_expenses", "opex_receipts",
  "budget_plans", "budget_forecasts", "budget_alerts", "cost_centers",
  "contacts", "contracts", "carrier_rates", "social_insurance_records",
  "security_settings", "letterhead_settings",
  "user_roles", "audit_logs", "notifications", "notification_preferences",
  "folder_shares", "bexio_tokens", "user_public_keys", "backup_schedules",
];

const STORAGE_BUCKETS = ["documents", "receipts", "creditor-invoices", "signatures", "avatars", "meeting-recordings"];

// Recursively list all files in a bucket (including subdirectories)
async function listAllFiles(supabase: any, bucket: string, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 10000 });
  if (error || !data) return paths;

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      // It's a file
      paths.push(fullPath);
    } else {
      // It's a folder — recurse
      const subPaths = await listAllFiles(supabase, bucket, fullPath);
      paths.push(...subPaths);
    }
  }
  return paths;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check auth
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    let backupType = "automatic";
    try {
      const body = await req.json();
      if (body?.type === "manual") backupType = "manual";
      if (body?.user_id) userId = body.user_id;
    } catch { /* No body = cron trigger */ }

    console.log(`Starting ${backupType} backup for user ${userId || "system"}...`);

    // Create backup job record
    const { data: job, error: jobError } = await supabase
      .from("backup_jobs")
      .insert({
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        status: "running",
        backup_type: backupType === "manual" ? "manual" : "full",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) console.error("Failed to create backup job:", jobError);

    // ──────────────────────────────
    // 1. Export database tables
    // ──────────────────────────────
    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    for (const tableName of TABLES_TO_BACKUP) {
      try {
        let allData: unknown[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .range(offset, offset + pageSize - 1);

          if (error) { errors.push(`${tableName}: ${error.message}`); break; }
          if (data && data.length > 0) {
            allData = allData.concat(data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        backupData[tableName] = allData;
        totalRows += allData.length;
        console.log(`✓ DB ${tableName}: ${allData.length} rows`);
      } catch (tableError: unknown) {
        const msg = tableError instanceof Error ? tableError.message : String(tableError);
        errors.push(`${tableName}: ${msg}`);
      }
    }

    // ──────────────────────────────
    // 2. Export storage files
    // ──────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPrefix = `full-backup-${timestamp}`;
    let totalFiles = 0;
    const storageManifest: Record<string, string[]> = {};

    for (const bucket of STORAGE_BUCKETS) {
      try {
        const filePaths = await listAllFiles(supabase, bucket);
        storageManifest[bucket] = filePaths;

        // Copy each file to the backups bucket under a subfolder
        for (const filePath of filePaths) {
          try {
            const { data: fileData, error: dlError } = await supabase.storage
              .from(bucket)
              .download(filePath);

            if (dlError || !fileData) {
              errors.push(`storage/${bucket}/${filePath}: download failed`);
              continue;
            }

            const destPath = `${backupPrefix}/storage/${bucket}/${filePath}`;
            const { error: uploadErr } = await supabase.storage
              .from("backups")
              .upload(destPath, fileData, {
                contentType: fileData.type || "application/octet-stream",
                upsert: true,
              });

            if (uploadErr) {
              errors.push(`storage/${bucket}/${filePath}: upload failed - ${uploadErr.message}`);
            } else {
              totalFiles++;
            }
          } catch (fileErr: unknown) {
            const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
            errors.push(`storage/${bucket}/${filePath}: ${msg}`);
          }
        }

        console.log(`✓ Storage ${bucket}: ${filePaths.length} files`);
      } catch {
        // Bucket may not exist
      }
    }

    // ──────────────────────────────
    // 3. Build metadata JSON
    // ──────────────────────────────
    const backupContent = JSON.stringify({
      metadata: {
        version: "3.0",
        created_at: new Date().toISOString(),
        backup_type: backupType,
        tables_count: Object.keys(backupData).length,
        total_rows: totalRows,
        storage_files_count: totalFiles,
        storage_buckets: Object.keys(storageManifest),
        backup_prefix: backupPrefix,
        errors: errors.length > 0 ? errors : null,
      },
      data: backupData,
      storage_manifest: storageManifest,
    });

    const metadataFileName = `${backupPrefix}/backup-metadata.json`;
    const backupSize = new TextEncoder().encode(backupContent).length;

    // Upload metadata JSON
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(metadataFileName, new Blob([backupContent], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) throw new Error(`Metadata upload failed: ${uploadError.message}`);

    // Update backup job
    if (job) {
      await supabase
        .from("backup_jobs")
        .update({
          status: "completed",
          file_path: metadataFileName,
          file_size: backupSize,
          tables_count: Object.keys(backupData).length,
          documents_count: totalFiles,
          completed_at: new Date().toISOString(),
          error_message: errors.length > 0 ? errors.join("; ") : null,
        })
        .eq("id", job.id);
    }

    // Cleanup old backups (keep last 30 backup folders)
    const { data: existingItems } = await supabase.storage.from("backups").list("", { limit: 1000 });
    if (existingItems) {
      const backupFolders = existingItems
        .filter((f: any) => f.name.startsWith("full-backup-") && !f.id)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      if (backupFolders.length > 30) {
        const toDelete = backupFolders.slice(0, backupFolders.length - 30);
        for (const folder of toDelete) {
          // List and delete all files in the old backup folder
          const oldFiles = await listAllFiles(supabase, "backups", folder.name);
          if (oldFiles.length > 0) {
            await supabase.storage.from("backups").remove(oldFiles.map((f: string) => `${folder.name}/${f}`));
          }
        }
      }

      // Also clean up legacy single-file backups
      const legacyFiles = existingItems
        .filter((f: any) => f.name.startsWith("backup-") && f.name.endsWith(".json") && f.id)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      if (legacyFiles.length > 5) {
        const toDelete = legacyFiles.slice(0, legacyFiles.length - 5);
        await supabase.storage.from("backups").remove(toDelete.map((f: any) => f.name));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job?.id,
      filename: metadataFileName,
      size: backupSize,
      tables: Object.keys(backupData).length,
      rows: totalRows,
      files: totalFiles,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Backup failed:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
