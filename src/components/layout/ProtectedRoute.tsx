import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ("admin" | "state" | "management" | "finance" | "partner")[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, isLoading, hasAnyRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Authentifizierung wird überprüft...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If specific roles are required, check them
  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-state p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Zugriff verweigert</h2>
          <p className="text-muted-foreground">
            Sie haben keine Berechtigung, diese Seite anzuzeigen.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
