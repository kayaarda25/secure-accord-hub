import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  report_type: "opex" | "declarations" | "budget" | "compliance" | "financial_summary";
  start_date?: string;
  end_date?: string;
  format?: "pdf" | "excel" | "csv";
  recipients?: string[];
  scheduled_report_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      report_type, 
      start_date, 
      end_date, 
      format = "pdf",
      recipients,
      scheduled_report_id 
    } = await req.json() as ReportRequest;

    console.log(`Generating ${report_type} report in ${format} format`);

    // Fetch data based on report type
    let reportData: any = {};
    let reportTitle = "";

    switch (report_type) {
      case "opex":
        reportTitle = "OPEX-Übersicht";
        const { data: expenses } = await supabase
          .from("opex_expenses")
          .select("*, cost_center:cost_centers(name, code)")
          .gte("expense_date", start_date || "1900-01-01")
          .lte("expense_date", end_date || "2099-12-31")
          .order("expense_date", { ascending: false });
        
        reportData = {
          expenses: expenses || [],
          total: expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
          by_status: {
            pending: expenses?.filter(e => e.status === "pending").length || 0,
            approved: expenses?.filter(e => e.status === "approved").length || 0,
            rejected: expenses?.filter(e => e.status === "rejected").length || 0,
          }
        };
        break;

      case "declarations":
        reportTitle = "Deklarationen";
        const { data: declarations } = await supabase
          .from("declarations")
          .select("*")
          .gte("period_start", start_date || "1900-01-01")
          .lte("period_end", end_date || "2099-12-31")
          .order("period_start", { ascending: false });
        
        reportData = {
          declarations: declarations || [],
          total_count: declarations?.length || 0,
          by_status: {
            draft: declarations?.filter(d => d.status === "draft").length || 0,
            submitted: declarations?.filter(d => d.status === "submitted").length || 0,
            approved: declarations?.filter(d => d.status === "approved").length || 0,
          }
        };
        break;

      case "budget":
        reportTitle = "Budget-Analyse";
        const { data: budgetPlans } = await supabase
          .from("budget_plans")
          .select("*, cost_center:cost_centers(name, code)")
          .eq("fiscal_year", new Date().getFullYear());
        
        const { data: costCenters } = await supabase
          .from("cost_centers")
          .select("*")
          .eq("is_active", true);
        
        reportData = {
          plans: budgetPlans || [],
          cost_centers: costCenters || [],
          total_planned: budgetPlans?.reduce((sum, p) => sum + (p.planned_amount || 0), 0) || 0,
          total_used: costCenters?.reduce((sum, c) => sum + (c.budget_used || 0), 0) || 0,
        };
        break;

      case "compliance":
        reportTitle = "Compliance-Status";
        const { data: documents } = await supabase
          .from("documents")
          .select("*")
          .not("expires_at", "is", null)
          .order("expires_at", { ascending: true });
        
        const now = new Date();
        reportData = {
          documents: documents || [],
          expired: documents?.filter(d => new Date(d.expires_at!) < now).length || 0,
          expiring_soon: documents?.filter(d => {
            const exp = new Date(d.expires_at!);
            const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return diff > 0 && diff <= 30;
          }).length || 0,
        };
        break;

      case "financial_summary":
        reportTitle = "Finanzzusammenfassung";
        const { data: allExpenses } = await supabase
          .from("opex_expenses")
          .select("amount, status, expense_date")
          .eq("status", "approved");
        
        const { data: allDeclarations } = await supabase
          .from("declarations")
          .select("total_mgi_balance, total_gia_balance, status")
          .eq("status", "approved");
        
        reportData = {
          total_expenses: allExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
          total_mgi_balance: allDeclarations?.reduce((sum, d) => sum + (d.total_mgi_balance || 0), 0) || 0,
          total_gia_balance: allDeclarations?.reduce((sum, d) => sum + (d.total_gia_balance || 0), 0) || 0,
        };
        break;
    }

    console.log("Report data generated:", JSON.stringify(reportData).substring(0, 200) + "...");

    // If this is a scheduled report, update last_run_at and calculate next_run_at
    if (scheduled_report_id) {
      const { data: scheduledReport } = await supabase
        .from("scheduled_reports")
        .select("frequency")
        .eq("id", scheduled_report_id)
        .single();

      if (scheduledReport) {
        const now = new Date();
        let nextRun = new Date(now);

        switch (scheduledReport.frequency) {
          case "daily":
            nextRun.setDate(nextRun.getDate() + 1);
            break;
          case "weekly":
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          case "monthly":
            nextRun.setMonth(nextRun.getMonth() + 1);
            break;
          case "quarterly":
            nextRun.setMonth(nextRun.getMonth() + 3);
            break;
        }

        await supabase
          .from("scheduled_reports")
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq("id", scheduled_report_id);
      }
    }

    // Send email if recipients provided - import Resend dynamically
    if (recipients && recipients.length > 0 && resendApiKey) {
      console.log(`Sending report to ${recipients.length} recipients`);
      
      const { Resend } = await import("https://esm.sh/resend@2.0.0");
      const resend = new Resend(resendApiKey);

      const formatDate = (date: string | undefined) => 
        date ? new Date(date).toLocaleDateString("de-DE") : "N/A";

      await resend.emails.send({
        from: "MGI Africa Reports <onboarding@resend.dev>",
        to: recipients,
        subject: `[Report] ${reportTitle} - ${new Date().toLocaleDateString("de-DE")}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #D4AF37 0%, #B8960C 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">MGI × AFRICA</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">Automatischer Report</p>
            </div>
            <div style="padding: 30px; background: #1a1a1a; color: #ffffff;">
              <h2 style="color: #D4AF37; margin-top: 0;">${reportTitle}</h2>
              <p style="color: #888; font-size: 14px;">
                Zeitraum: ${formatDate(start_date)} - ${formatDate(end_date)}
              </p>
              <div style="background: #222; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <pre style="color: #ccc; font-size: 12px; overflow-x: auto; white-space: pre-wrap;">
${JSON.stringify(reportData, null, 2)}
                </pre>
              </div>
              <p style="color: #666; font-size: 12px;">
                Dieser Report wurde automatisch generiert. Für Details melden Sie sich bitte im System an.
              </p>
            </div>
          </div>
        `,
      });

      console.log("Report email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_type,
        title: reportTitle,
        data: reportData,
        generated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
