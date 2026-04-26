import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDashboardPath } from "@/lib/auth";

interface StorefrontRouteProps {
  children: ReactElement;
}

const StorefrontRoute = ({ children }: StorefrontRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050510] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
          <p className="mt-4 text-sm font-bold text-gray-400">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user && user.role !== "customer") {
    return <Navigate to={getRoleDashboardPath(user.role)} replace />;
  }

  return children;
};

export default StorefrontRoute;
