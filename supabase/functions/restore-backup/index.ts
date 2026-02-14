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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_path } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Restore requested by ${user.id} from ${file_path}`);

    // Download backup from storage
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

    console.log(`Restoring backup v${backup.metadata.version} with ${backup.metadata.tables_count} tables`);

    const results: Record<string, { restored: number; errors: string[] }> = {};

    // Restore order matters due to foreign keys
    const restoreOrder = [
      "organizations",
      "organization_permissions",
      "profiles",
      "user_roles",
      "security_settings",
      "letterhead_settings",
      "user_public_keys",
      "document_folders",
      "documents",
      "document_shares",
      "document_signatures",
      "document_tags",
      "document_tag_assignments",
      "document_templates",
      "document_activity",
      "folder_shares",
      "contacts",
      "contracts",
      "cost_centers",
      "carrier_rates",
      "declarations",
      "creditor_invoices",
      "creditor_invoice_approvals",
      "budget_plans",
      "budget_forecasts",
      "budget_alerts",
      "calendar_events",
      "calendar_event_participants",
      "communication_threads",
      "thread_participants",
      "communication_messages",
      "communication_documents",
      "meeting_protocols",
      "scheduled_meetings",
      "meeting_participants",
      "meeting_recordings",
      "meeting_chat_messages",
      "tasks",
      "task_participants",
      "social_insurance_records",
      "notifications",
      "notification_preferences",
      "bexio_tokens",
      "backup_schedules",
      "audit_logs",
    ];

    for (const tableName of restoreOrder) {
      const tableData = backup.data[tableName];
      if (!tableData || tableData.length === 0) {
        results[tableName] = { restored: 0, errors: [] };
        continue;
      }

      const tableErrors: string[] = [];
      let restoredCount = 0;

      // Insert in batches of 100
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
      console.log(`✓ ${tableName}: ${restoredCount}/${tableData.length} rows restored`);
    }

    const totalRestored = Object.values(results).reduce((s, r) => s + r.restored, 0);
    const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);

    return new Response(JSON.stringify({
      success: true,
      total_restored: totalRestored,
      total_errors: totalErrors,
      details: results,
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
