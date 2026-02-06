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
// All rates are split 50% employee / 50% employer unless noted
export const INSURANCE_RATES = {
  AHV_IV_EO: 0.053, // 5.3% each (employee + employer) - 50/50
  ALV: 0.011, // 1.1% each up to threshold - 50/50
  UVG_NBU: 0.012, // ~1.2% NBU (paid by employee)
  UVG_BU: 0.001, // ~0.1% BU (paid by employer)
  KTG: 0.01, // ~1% KTG (100% paid by employer)
};

export interface InsuranceRecordInput {
  user_id: string;
  year: number;
  month: number;
  gross_salary: number;
  bvg_total: number; // Manual BVG entry (total, will be split 50/50)
  ktg?: number; // Optional manual KTG override
  notes?: string;
}

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
    mutationFn: async (data: InsuranceRecordInput) => {
      const grossSalary = data.gross_salary;

      // AHV/IV/EO: 50% employee, 50% employer
      const ahvAmount = grossSalary * INSURANCE_RATES.AHV_IV_EO;

      // ALV: 50% employee, 50% employer
      const alvAmount = grossSalary * INSURANCE_RATES.ALV;

      // BVG: Manual entry, split 50/50
      const bvgEach = data.bvg_total / 2;

      // UVG NBU: Paid by employee (non-occupational accident)
      const uvgNbu = grossSalary * INSURANCE_RATES.UVG_NBU;

      // UVG BU: Paid by employer (occupational accident)
      const uvgBu = grossSalary * INSURANCE_RATES.UVG_BU;

      // KTG: 100% paid by employer
      const ktgAmount = data.ktg ?? grossSalary * INSURANCE_RATES.KTG;

      const record = {
        user_id: data.user_id,
        year: data.year,
        month: data.month,
        gross_salary: grossSalary,
        ahv_iv_eo_employee: ahvAmount, // 50%
        ahv_iv_eo_employer: ahvAmount, // 50%
        alv_employee: alvAmount, // 50%
        alv_employer: alvAmount, // 50%
        bvg_employee: bvgEach, // 50%
        bvg_employer: bvgEach, // 50%
        uvg_nbu: uvgNbu, // Employee
        uvg_bu: uvgBu, // Employer
        ktg: ktgAmount, // 100% Employer
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
    ktg: currentMonthRecords.reduce(
      (sum, r) => sum + Number(r.ktg),
      0
    ),
    alv: currentMonthRecords.reduce(
      (sum, r) => sum + Number(r.alv_employee) + Number(r.alv_employer),
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
