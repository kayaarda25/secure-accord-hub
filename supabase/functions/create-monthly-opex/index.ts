import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  { value: "salaries", label: "Salaries & Wages" },
  { value: "rent", label: "Rent & Lease" },
  { value: "insurance", label: "Insurance" },
  { value: "transportation", label: "Transportation" },
  { value: "it", label: "IT & Technology" },
  { value: "utilities", label: "Utilities" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing & Ads" },
  { value: "training", label: "Training & Education" },
  { value: "office", label: "Office Supplies" },
  { value: "communication", label: "Communication" },
  { value: "other", label: "Other" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Calculate previous month period (YYYY-MM)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

    console.log(`Creating monthly OPEX for period: ${period}`);

    // Get all active "Allgemein" cost centers (one per org)
    const { data: costCenters, error: ccError } = await supabase
      .from("cost_centers")
      .select("id, code, name, organization_id")
      .eq("is_active", true)
      .ilike("name", "%allgemein%");

    if (ccError) throw ccError;
    if (!costCenters || costCenters.length === 0) {
      return new Response(
        JSON.stringify({ message: "No cost centers found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let created = 0;
    let skipped = 0;

    for (const cc of costCenters) {
      // Check if OPEX already exists for this period + cost center
      const { data: existing } = await supabase
        .from("opex_budgets")
        .select("id")
        .eq("cost_center_id", cc.id)
        .eq("period", period)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // We need a user to set as submitted_by. Use the first admin.
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      const submittedBy = adminRole?.user_id;
      if (!submittedBy) {
        console.error("No admin user found to assign as submitter");
        continue;
      }

      // Create OPEX draft
      const { data: budget, error: budgetError } = await supabase
        .from("opex_budgets")
        .insert({
          cost_center_id: cc.id,
          organization_id: cc.organization_id || null,
          period,
          currency: "CHF",
          total_amount: 0,
          submitted_by: submittedBy,
          status: "draft",
          notes: `Automatisch erstellt für ${period}`,
        })
        .select("id")
        .single();

      if (budgetError) {
        console.error(`Error creating OPEX for ${cc.code}:`, budgetError);
        continue;
      }

      // Create placeholder line items for each category
      const lineItems = CATEGORIES.map((cat, idx) => ({
        budget_id: budget.id,
        category: cat.value,
        label: cat.label,
        amount: 0,
        sort_order: idx,
      }));

      const { error: liError } = await supabase
        .from("opex_line_items")
        .insert(lineItems);

      if (liError) {
        console.error(`Error creating line items for ${cc.code}:`, liError);
      } else {
        created++;
      }
    }

    const message = `OPEX ${period}: ${created} erstellt, ${skipped} übersprungen (bereits vorhanden)`;
    console.log(message);

    return new Response(
      JSON.stringify({ success: true, message, period, created, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-monthly-opex:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
