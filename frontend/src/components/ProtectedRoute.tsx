import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDashboardPath, type UserRole } from "@/lib/auth";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: ReactElement;
}

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050510] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
          <p className="mt-4 text-sm font-bold text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleDashboardPath(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
