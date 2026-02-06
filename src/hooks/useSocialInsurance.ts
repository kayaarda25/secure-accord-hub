import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SocialInsuranceRecord {
  id: string;
  user_id: string;
  year: number;
  month: number;
  gross_salary: number;
  ahv_iv_eo_employee: number;
  ahv_iv_eo_employer: number;
  alv_employee: number;
  alv_employer: number;
  bvg_employee: number;
  bvg_employer: number;
  uvg_nbu: number;
  uvg_bu: number;
  ktg: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

// Swiss social insurance rates (2024)
export const INSURANCE_RATES = {
  AHV_IV_EO: 0.053, // 5.3% each (employee + employer)
  ALV: 0.011, // 1.1% each up to threshold
  BVG_DEFAULT: 0.07, // varies by age, simplified
  UVG_NBU: 0.0, // paid by employee, varies
  UVG_BU: 0.0, // paid by employer, varies
  KTG: 0.0, // optional, varies
};

export function useSocialInsurance() {
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(["admin", "management", "finance"]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Fetch all records (for managers) or own records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["social-insurance-records"],
    queryFn: async () => {
      const { data: insuranceData, error } = await supabase
        .from("social_insurance_records")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each unique user_id
      const userIds = [...new Set(insuranceData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.user_id, p]) || []
      );

      return insuranceData.map((r) => ({
        ...r,
        profiles: profilesMap.get(r.user_id),
      })) as SocialInsuranceRecord[];
    },
    enabled: !!user,
  });

  // Create/Update record
  const upsertRecord = useMutation({
    mutationFn: async (data: {
      user_id: string;
      year: number;
      month: number;
      gross_salary: number;
      notes?: string;
    }) => {
      // Calculate contributions based on gross salary
      const ahvRate = INSURANCE_RATES.AHV_IV_EO;
      const alvRate = INSURANCE_RATES.ALV;
      const bvgRate = INSURANCE_RATES.BVG_DEFAULT;

      const record = {
        user_id: data.user_id,
        year: data.year,
        month: data.month,
        gross_salary: data.gross_salary,
        ahv_iv_eo_employee: data.gross_salary * ahvRate,
        ahv_iv_eo_employer: data.gross_salary * ahvRate,
        alv_employee: data.gross_salary * alvRate,
        alv_employer: data.gross_salary * alvRate,
        bvg_employee: data.gross_salary * bvgRate,
        bvg_employer: data.gross_salary * bvgRate,
        uvg_nbu: 0,
        uvg_bu: 0,
        ktg: 0,
        notes: data.notes || null,
        created_by: user!.id,
      };

      const { error } = await supabase
        .from("social_insurance_records")
        .upsert(record, { onConflict: "user_id,year,month" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eintrag gespeichert");
      queryClient.invalidateQueries({ queryKey: ["social-insurance-records"] });
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  // Delete record
  const deleteRecord = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from("social_insurance_records")
        .delete()
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eintrag gelöscht");
      queryClient.invalidateQueries({ queryKey: ["social-insurance-records"] });
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  // Calculate monthly totals
  const currentMonthRecords = records.filter(
    (r) => r.year === currentYear && r.month === currentMonth
  );

  const monthlyTotals = {
    ahv: currentMonthRecords.reduce(
      (sum, r) => sum + Number(r.ahv_iv_eo_employee) + Number(r.ahv_iv_eo_employer),
      0
    ),
    bvg: currentMonthRecords.reduce(
      (sum, r) => sum + Number(r.bvg_employee) + Number(r.bvg_employer),
      0
    ),
    uvg: currentMonthRecords.reduce(
      (sum, r) => sum + Number(r.uvg_nbu) + Number(r.uvg_bu),
      0
    ),
  };

  return {
    records,
    isLoading,
    canManage,
    currentYear,
    currentMonth,
    monthlyTotals,
    upsertRecord,
    deleteRecord,
  };
}
