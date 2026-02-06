import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PayrollRecord {
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
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export interface PayrollSummary {
  id: string;
  userId: string;
  employeeName: string;
  email: string;
  grossSalary: number;
  employeeDeductions: number;
  netSalary: number;
  employerCosts: number;
  totalCost: number;
}

export function usePayroll() {
  const { user, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "management", "finance"]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Fetch all payroll records (using social_insurance_records)
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["payroll-records", currentYear, currentMonth],
    queryFn: async () => {
      const { data: insuranceData, error } = await supabase
        .from("social_insurance_records")
        .select("*")
        .eq("year", currentYear)
        .eq("month", currentMonth)
        .order("created_at", { ascending: false });

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
      })) as PayrollRecord[];
    },
    enabled: !!user,
  });

  // Fetch all records for yearly overview
  const { data: yearlyRecords = [] } = useQuery({
    queryKey: ["payroll-yearly", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_insurance_records")
        .select("*")
        .eq("year", currentYear)
        .order("month", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate payroll summaries
  const payrollSummaries: PayrollSummary[] = records.map((record) => {
    const employeeDeductions =
      Number(record.ahv_iv_eo_employee) +
      Number(record.alv_employee) +
      Number(record.bvg_employee) +
      Number(record.uvg_nbu);

    const employerCosts =
      Number(record.ahv_iv_eo_employer) +
      Number(record.alv_employer) +
      Number(record.bvg_employer) +
      Number(record.uvg_bu) +
      Number(record.ktg);

    const netSalary = Number(record.gross_salary) - employeeDeductions;
    const totalCost = Number(record.gross_salary) + employerCosts;

    return {
      id: record.id,
      userId: record.user_id,
      employeeName: record.profiles
        ? `${record.profiles.first_name || ""} ${record.profiles.last_name || ""}`.trim() || record.profiles.email
        : "Unbekannt",
      email: record.profiles?.email || "",
      grossSalary: Number(record.gross_salary),
      employeeDeductions,
      netSalary,
      employerCosts,
      totalCost,
    };
  });

  // Statistics
  const totalEmployees = payrollSummaries.length;
  const totalGrossSalary = payrollSummaries.reduce((sum, p) => sum + p.grossSalary, 0);
  const totalNetSalary = payrollSummaries.reduce((sum, p) => sum + p.netSalary, 0);
  const totalEmployerCosts = payrollSummaries.reduce((sum, p) => sum + p.employerCosts, 0);
  const totalPayrollCost = payrollSummaries.reduce((sum, p) => sum + p.totalCost, 0);

  // Yearly statistics
  const yearlyPayrollByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthRecords = yearlyRecords.filter((r) => r.month === i + 1);
    const totalGross = monthRecords.reduce((sum, r) => sum + Number(r.gross_salary), 0);
    return {
      month: i + 1,
      monthName: new Date(2024, i, 1).toLocaleString("de-CH", { month: "short" }),
      total: totalGross,
      count: monthRecords.length,
    };
  });

  return {
    records,
    payrollSummaries,
    isLoading,
    canManage,
    currentYear,
    currentMonth,
    totalEmployees,
    totalGrossSalary,
    totalNetSalary,
    totalEmployerCosts,
    totalPayrollCost,
    yearlyPayrollByMonth,
  };
}
