import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Finances from "./pages/Finances";
import Declarations from "./pages/Declarations";
import Invoices from "./pages/Invoices";
import Documents from "./pages/Documents";
import Explorer from "./pages/Explorer";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Opex from "./pages/Opex";
import ReceiptScanner from "./pages/ReceiptScanner";
import Communication from "./pages/Communication";
import UsersPage from "./pages/Users";
import NotFound from "./pages/NotFound";
import Partners from "./pages/Partners";
import Authorities from "./pages/Authorities";
import BudgetPlanning from "./pages/BudgetPlanning";
import Reports from "./pages/Reports";
import Security from "./pages/Security";
import Settings from "./pages/Settings";
import Protocols from "./pages/Protocols";
import Employees from "./pages/Employees";
import Vacations from "./pages/hr/Vacations";
import Payroll from "./pages/hr/Payroll";
import SocialInsurance from "./pages/hr/SocialInsurance";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="mgi-ui-theme">
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finances"
              element={
                <ProtectedRoute>
                  <Finances />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finances/declarations"
              element={
                <ProtectedRoute>
                  <Declarations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finances/invoices"
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/opex"
              element={
                <ProtectedRoute>
                  <Opex />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipt-scanner"
              element={
                <ProtectedRoute>
                  <ReceiptScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/explorer"
              element={
                <ProtectedRoute>
                  <Explorer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/protocols"
              element={
                <ProtectedRoute>
                  <Protocols />
                </ProtectedRoute>
              }
            />
            <Route
              path="/communication"
              element={
                <ProtectedRoute>
                  <Communication />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Tasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <Employees />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/vacations"
              element={
                <ProtectedRoute>
                  <Vacations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll"
              element={
                <ProtectedRoute>
                  <Payroll />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/social-insurance"
              element={
                <ProtectedRoute>
                  <SocialInsurance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/partners"
              element={
                <ProtectedRoute>
                  <Partners />
                </ProtectedRoute>
              }
            />
            <Route
              path="/authorities"
              element={
                <ProtectedRoute>
                  <Authorities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/budget"
              element={
                <ProtectedRoute>
                  <BudgetPlanning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/security"
              element={
                <ProtectedRoute>
                  <Security />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
