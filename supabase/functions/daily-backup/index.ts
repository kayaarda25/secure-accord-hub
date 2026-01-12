import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to backup
const TABLES_TO_BACKUP = [
  "profiles",
  "organizations",
  "documents",
  "document_signatures",
  "tasks",
  "calendar_events",
  "expenses",
  "invoices",
  "declarations",
  "budget_items",
  "contacts",
  "notifications",
];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily backup...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const timestamp = new Date().toISOString().split("T")[0];
    const backupData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Export each table
    for (const tableName of TABLES_TO_BACKUP) {
      try {
        console.log(`Backing up table: ${tableName}`);
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .limit(10000); // Limit to prevent memory issues

        if (error) {
          console.error(`Error backing up ${tableName}:`, error.message);
          errors.push(`${tableName}: ${error.message}`);
        } else {
          backupData[tableName] = data || [];
          console.log(`Backed up ${data?.length || 0} rows from ${tableName}`);
        }
      } catch (tableError: unknown) {
        const errorMessage = tableError instanceof Error ? tableError.message : String(tableError);
        console.error(`Failed to backup ${tableName}:`, tableError);
        errors.push(`${tableName}: ${errorMessage}`);
      }
    }

    // Create backup metadata
    const backupMetadata = {
      created_at: new Date().toISOString(),
      tables_count: Object.keys(backupData).length,
      total_rows: Object.values(backupData).reduce((sum, arr) => sum + arr.length, 0),
      errors: errors.length > 0 ? errors : null,
    };

    // Save backup to storage
    const backupFileName = `backup-${timestamp}.json`;
    const backupContent = JSON.stringify(
      {
        metadata: backupMetadata,
        data: backupData,
      },
      null,
      2
    );

    console.log(`Saving backup to storage: ${backupFileName}`);

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(backupFileName, new Blob([backupContent], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true, // Overwrite if exists (same day)
      });

    if (uploadError) {
      console.error("Error uploading backup:", uploadError);
      throw new Error(`Failed to upload backup: ${uploadError.message}`);
    }

    // Clean up old backups (keep last 30 days)
    console.log("Cleaning up old backups...");
    const { data: existingBackups } = await supabase.storage.from("backups").list();

    if (existingBackups && existingBackups.length > 30) {
      const sortedBackups = existingBackups
        .filter((f) => f.name.startsWith("backup-"))
        .sort((a, b) => a.name.localeCompare(b.name));

      const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - 30);

      for (const backup of backupsToDelete) {
        console.log(`Deleting old backup: ${backup.name}`);
        await supabase.storage.from("backups").remove([backup.name]);
      }
    }

    const result = {
      success: true,
      message: `Backup completed successfully`,
      filename: backupFileName,
      metadata: backupMetadata,
    };

    console.log("Backup completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Backup failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
