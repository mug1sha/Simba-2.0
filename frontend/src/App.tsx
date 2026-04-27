import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PaletteThemeProvider } from "@/contexts/PaletteThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import StorefrontRoute from "@/components/StorefrontRoute";

const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AuthFlowPage = lazy(() =>
  import("./pages/AuthFlowPage.tsx").then((module) => ({ default: module.AuthFlowPage })),
);
const BranchDashboard = lazy(() => import("./pages/BranchDashboard.tsx"));
const BranchesPage = lazy(() => import("./pages/BranchesPage.tsx"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#050510] text-white">
    <div className="text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
      <p className="mt-4 text-sm font-bold text-gray-400">Loading Simba...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PaletteThemeProvider>
      <LanguageProvider>
        <CartProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <StorefrontRoute>
                          <Index />
                        </StorefrontRoute>
                      }
                    />
                    <Route
                      path="/branches"
                      element={
                        <StorefrontRoute>
                          <BranchesPage />
                        </StorefrontRoute>
                      }
                    />
                    <Route
                      path="/customer"
                      element={
                        <ProtectedRoute allowedRoles={["customer"]}>
                          <CustomerDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/branch/manager"
                      element={
                        <ProtectedRoute allowedRoles={["branch_manager"]}>
                          <BranchDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/branch/staff"
                      element={
                        <ProtectedRoute allowedRoles={["branch_staff"]}>
                          <BranchDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/branch" element={<Navigate to="/branch/manager" replace />} />
                    <Route path="/invite" element={<AuthFlowPage />} />
                    <Route path="/verify-email" element={<AuthFlowPage />} />
                    <Route path="/reset-password" element={<AuthFlowPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </CartProvider>
      </LanguageProvider>
    </PaletteThemeProvider>
  </QueryClientProvider>
);

export default App;
