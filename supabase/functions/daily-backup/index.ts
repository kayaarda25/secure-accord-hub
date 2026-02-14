import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// All tables to backup
const TABLES_TO_BACKUP = [
  "profiles",
  "organizations",
  "organization_permissions",
  "documents",
  "document_folders",
  "document_shares",
  "document_signatures",
  "document_tags",
  "document_tag_assignments",
  "document_templates",
  "document_activity",
  "tasks",
  "task_participants",
  "calendar_events",
  "calendar_event_participants",
  "communication_threads",
  "communication_messages",
  "communication_documents",
  "thread_participants",
  "meeting_protocols",
  "meeting_recordings",
  "meeting_chat_messages",
  "scheduled_meetings",
  "meeting_participants",
  "declarations",
  "creditor_invoices",
  "creditor_invoice_approvals",
  "opex_expenses" ,
  "opex_receipts",
  "budget_plans",
  "budget_forecasts",
  "budget_alerts",
  "cost_centers",
  "contacts",
  "contracts",
  "carrier_rates",
  "social_insurance_records",
  "security_settings",
  "letterhead_settings",
  "user_roles",
  "audit_logs",
  "notifications",
  "notification_preferences",
  "folder_shares",
  "bexio_tokens",
  "user_public_keys",
  "backup_schedules",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check auth - get user from token or allow service-role calls (cron)
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      // Try to get user from token
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Parse body for manual triggers
    let backupType = "automatic";
    try {
      const body = await req.json();
      if (body?.type === "manual") backupType = "manual";
      if (body?.user_id) userId = body.user_id;
    } catch {
      // No body = cron trigger
    }

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

    if (jobError) {
      console.error("Failed to create backup job:", jobError);
    }

    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    // Export each table
    for (const tableName of TABLES_TO_BACKUP) {
      try {
        // Use pagination for large tables
        let allData: unknown[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .range(offset, offset + pageSize - 1);

          if (error) {
            errors.push(`${tableName}: ${error.message}`);
            break;
          }

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
        console.log(`✓ ${tableName}: ${allData.length} rows`);
      } catch (tableError: unknown) {
        const msg = tableError instanceof Error ? tableError.message : String(tableError);
        errors.push(`${tableName}: ${msg}`);
      }
    }

    // List storage files metadata (not the actual files - too large)
    const storageBuckets = ["documents", "receipts", "creditor-invoices", "signatures", "avatars", "meeting-recordings"];
    const storageManifest: Record<string, { name: string; id: string; metadata: unknown }[]> = {};

    for (const bucket of storageBuckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list("", { limit: 10000 });
        if (files) {
          storageManifest[bucket] = files.map(f => ({
            name: f.name,
            id: f.id,
            metadata: f.metadata,
          }));
        }
      } catch {
        // Bucket may not exist
      }
    }

    // Build backup JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupContent = JSON.stringify({
      metadata: {
        version: "2.0",
        created_at: new Date().toISOString(),
        backup_type: backupType,
        tables_count: Object.keys(backupData).length,
        total_rows: totalRows,
        documents_count: Object.values(storageManifest).reduce((sum, arr) => sum + arr.length, 0),
        errors: errors.length > 0 ? errors : null,
      },
      data: backupData,
      storage_manifest: storageManifest,
    });

    const backupFileName = `backup-${timestamp}.json`;
    const backupSize = new TextEncoder().encode(backupContent).length;

    // Upload to backups bucket
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(backupFileName, new Blob([backupContent], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update backup job
    if (job) {
      await supabase
        .from("backup_jobs")
        .update({
          status: errors.length > 0 ? "completed" : "completed",
          file_path: backupFileName,
          file_size: backupSize,
          tables_count: Object.keys(backupData).length,
          documents_count: Object.values(storageManifest).reduce((sum, arr) => sum + arr.length, 0),
          completed_at: new Date().toISOString(),
          error_message: errors.length > 0 ? errors.join("; ") : null,
        })
        .eq("id", job.id);
    }

    // Cleanup old backups (keep last 30)
    const { data: existingBackups } = await supabase.storage.from("backups").list();
    if (existingBackups && existingBackups.length > 30) {
      const sorted = existingBackups
        .filter(f => f.name.startsWith("backup-"))
        .sort((a, b) => a.name.localeCompare(b.name));
      const toDelete = sorted.slice(0, sorted.length - 30);
      for (const f of toDelete) {
        await supabase.storage.from("backups").remove([f.name]);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job?.id,
      filename: backupFileName,
      size: backupSize,
      tables: Object.keys(backupData).length,
      rows: totalRows,
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
