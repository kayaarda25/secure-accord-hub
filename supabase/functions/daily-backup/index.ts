import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables scoped to organization (filtered by organization_id or user's org membership)
const ORG_SCOPED_TABLES: Record<string, string> = {
  "profiles": "organization_id",
  "documents": "organization_id",
  "document_folders": "organization_id",
  "document_templates": "organization_id",
  "document_tags": "organization_id",
  "communication_threads": "organization_id",
  "creditor_invoices": "organization_id",
  "cost_centers": "organization_id",
  "contacts": "organization_id",
  "contracts": "organization_id",
  "carrier_rates": "organization_id",
  "budget_plans": "organization_id",
  "bexio_tokens": "organization_id",
  "folder_shares": "shared_with_organization_id",
};

// Tables scoped to user (filtered by user_id or created_by)
const USER_SCOPED_TABLES: Record<string, string> = {
  "tasks": "created_by",
  "calendar_events": "created_by",
  "meeting_protocols": "created_by",
  "scheduled_meetings": "created_by",
  "opex_expenses": "submitted_by",
  "declarations": "submitted_by",
  "security_settings": "user_id",
  "letterhead_settings": "user_id",
  "backup_schedules": "user_id",
  "audit_logs": "user_id",
};

// Tables that reference other scoped tables (will be filtered by FK)
const FK_SCOPED_TABLES: Record<string, { fk: string; parent_table: string }> = {
  "document_shares": { fk: "document_id", parent_table: "documents" },
  "document_signatures": { fk: "document_id", parent_table: "documents" },
  "document_tag_assignments": { fk: "document_id", parent_table: "documents" },
  "document_activity": { fk: "document_id", parent_table: "documents" },
  "task_participants": { fk: "task_id", parent_table: "tasks" },
  "calendar_event_participants": { fk: "event_id", parent_table: "calendar_events" },
  "communication_messages": { fk: "thread_id", parent_table: "communication_threads" },
  "communication_documents": { fk: "thread_id", parent_table: "communication_threads" },
  "thread_participants": { fk: "thread_id", parent_table: "communication_threads" },
  "creditor_invoice_approvals": { fk: "invoice_id", parent_table: "creditor_invoices" },
  "opex_receipts": { fk: "expense_id", parent_table: "opex_expenses" },
  "meeting_participants": { fk: "meeting_id", parent_table: "scheduled_meetings" },
  "meeting_chat_messages": { fk: "room_code", parent_table: "scheduled_meetings" },
  "meeting_recordings": { fk: "meeting_id", parent_table: "scheduled_meetings" },
  "budget_forecasts": { fk: "budget_plan_id", parent_table: "budget_plans" },
  "budget_alerts": { fk: "cost_center_id", parent_table: "cost_centers" },
};

// Global tables (small config tables, always fully included)
const GLOBAL_TABLES = [
  "organizations", "organization_permissions", "user_roles",
  "notification_preferences", "notifications", "user_public_keys",
  "login_attempts", "social_insurance_records",
];

const STORAGE_BUCKETS = ["documents", "receipts", "creditor-invoices", "signatures", "avatars", "meeting-recordings"];

async function listAllFiles(supabase: any, bucket: string, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 10000 });
  if (error || !data) return paths;
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      paths.push(fullPath);
    } else {
      const subPaths = await listAllFiles(supabase, bucket, fullPath);
      paths.push(...subPaths);
    }
  }
  return paths;
}

async function fetchAllRows(supabase: any, tableName: string, filter?: { column: string; value: string }): Promise<unknown[]> {
  let allData: unknown[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select("*").range(offset, offset + pageSize - 1);
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    const { data, error } = await query;
    if (error) throw new Error(`${tableName}: ${error.message}`);
    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  return allData;
}

async function fetchRowsByIds(supabase: any, tableName: string, column: string, ids: string[]): Promise<unknown[]> {
  if (ids.length === 0) return [];
  let allData: unknown[] = [];
  // Batch in chunks of 100 for the IN filter
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data, error } = await supabase.from(tableName).select("*").in(column, batch);
    if (error) throw new Error(`${tableName}: ${error.message}`);
    if (data) allData = allData.concat(data);
  }
  return allData;
}

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
      return new Response(JSON.stringify({ error: "Nur Administratoren können Backups erstellen." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.organization_id;

    let backupType = "manual";
    try {
      const body = await req.json();
      if (body?.type) backupType = body.type;
    } catch { /* No body */ }

    console.log(`Starting ${backupType} backup for admin ${user.id}, org ${orgId}...`);

    // Create backup job record
    const { data: job, error: jobError } = await supabase
      .from("backup_jobs")
      .insert({
        user_id: user.id,
        status: "running",
        backup_type: backupType === "manual" ? "manual" : "full",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) console.error("Failed to create backup job:", jobError);

    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];
    let totalRows = 0;

    // Collect IDs from parent tables for FK filtering
    const parentIds: Record<string, string[]> = {};

    // 1. Org-scoped tables
    for (const [tableName, column] of Object.entries(ORG_SCOPED_TABLES)) {
      try {
        const filter = orgId ? { column, value: orgId } : undefined;
        const data = await fetchAllRows(supabase, tableName, filter);
        backupData[tableName] = data;
        totalRows += data.length;
        // Store IDs for FK tables
        parentIds[tableName] = (data as any[]).map(r => r.id).filter(Boolean);
        console.log(`✓ ${tableName}: ${data.length} rows (org-scoped)`);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 2. User-scoped tables (users in this org)
    // Get all user IDs in the organization
    const orgUserIds = orgId
      ? (backupData["profiles"] as any[] || []).map(p => p.user_id).filter(Boolean)
      : [user.id];

    for (const [tableName, column] of Object.entries(USER_SCOPED_TABLES)) {
      try {
        const data = await fetchRowsByIds(supabase, tableName, column, orgUserIds);
        backupData[tableName] = data;
        totalRows += data.length;
        parentIds[tableName] = (data as any[]).map(r => r.id).filter(Boolean);
        console.log(`✓ ${tableName}: ${data.length} rows (user-scoped)`);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 3. FK-scoped tables
    for (const [tableName, { fk, parent_table }] of Object.entries(FK_SCOPED_TABLES)) {
      try {
        const parentIdList = parentIds[parent_table] || [];
        // Special case for meeting_chat_messages which uses room_code
        if (fk === "room_code" && parent_table === "scheduled_meetings") {
          const roomCodes = (backupData[parent_table] as any[] || []).map(r => r.room_code).filter(Boolean);
          const data = roomCodes.length > 0 ? await fetchRowsByIds(supabase, tableName, fk, roomCodes) : [];
          backupData[tableName] = data;
          totalRows += data.length;
        } else {
          const data = parentIdList.length > 0 ? await fetchRowsByIds(supabase, tableName, fk, parentIdList) : [];
          backupData[tableName] = data;
          totalRows += data.length;
        }
        console.log(`✓ ${tableName}: ${(backupData[tableName] as any[]).length} rows (fk-scoped)`);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 4. Global tables
    for (const tableName of GLOBAL_TABLES) {
      try {
        const data = await fetchAllRows(supabase, tableName);
        backupData[tableName] = data;
        totalRows += data.length;
        console.log(`✓ ${tableName}: ${data.length} rows (global)`);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // ──────────────────────────────
    // Storage files - scoped to org's documents
    // ──────────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPrefix = `full-backup-${timestamp}`;
    let totalFiles = 0;
    const storageManifest: Record<string, string[]> = {};

    // Get file paths from org's documents and receipts
    const orgDocPaths = (backupData["documents"] as any[] || []).map(d => d.file_path).filter(Boolean);
    const orgReceiptPaths = (backupData["opex_receipts"] as any[] || []).map(r => r.file_path).filter(Boolean);
    const orgInvoicePaths = (backupData["creditor_invoices"] as any[] || [])
      .map(i => i.document_path).filter(Boolean);
    const orgSignaturePaths = (backupData["document_signatures"] as any[] || [])
      .map(s => s.signature_image).filter((p: string) => p && p.startsWith("signatures/"));
    const orgRecordingPaths = (backupData["meeting_recordings"] as any[] || [])
      .map(r => r.file_path).filter(Boolean);
    const orgAvatarPaths = (backupData["profiles"] as any[] || [])
      .map(p => p.avatar_url).filter((p: string) => p && !p.startsWith("http"));

    // Map bucket -> file paths to backup
    const scopedFiles: Record<string, string[]> = {
      "documents": orgDocPaths,
      "receipts": orgReceiptPaths,
      "creditor-invoices": orgInvoicePaths,
      "signatures": orgSignaturePaths,
      "meeting-recordings": orgRecordingPaths,
      "avatars": orgAvatarPaths,
    };

    for (const [bucket, filePaths] of Object.entries(scopedFiles)) {
      const validPaths: string[] = [];
      for (const filePath of filePaths) {
        try {
          const { data: fileData, error: dlError } = await supabase.storage
            .from(bucket)
            .download(filePath);

          if (dlError || !fileData) continue;

          const destPath = `${backupPrefix}/storage/${bucket}/${filePath}`;
          const { error: uploadErr } = await supabase.storage
            .from("backups")
            .upload(destPath, fileData, {
              contentType: fileData.type || "application/octet-stream",
              upsert: true,
            });

          if (!uploadErr) {
            validPaths.push(filePath);
            totalFiles++;
          }
        } catch {
          // Skip individual file errors
        }
      }
      if (validPaths.length > 0) {
        storageManifest[bucket] = validPaths;
      }
      console.log(`✓ Storage ${bucket}: ${validPaths.length} files`);
    }

    // Build metadata JSON
    const backupContent = JSON.stringify({
      metadata: {
        version: "4.0",
        created_at: new Date().toISOString(),
        backup_type: backupType,
        organization_id: orgId,
        admin_user_id: user.id,
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
          const oldFiles = await listAllFiles(supabase, "backups", folder.name);
          if (oldFiles.length > 0) {
            await supabase.storage.from("backups").remove(oldFiles.map((f: string) => `${folder.name}/${f}`));
          }
        }
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
