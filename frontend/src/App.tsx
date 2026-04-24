import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PaletteThemeProvider } from "@/contexts/PaletteThemeContext";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthFlowPage } from "./pages/AuthFlowPage.tsx";
import BranchDashboard from "./pages/BranchDashboard.tsx";
import BranchesPage from "./pages/BranchesPage.tsx";

const queryClient = new QueryClient();

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
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/branches" element={<BranchesPage />} />
                  <Route path="/branch" element={<BranchDashboard />} />
                  <Route path="/verify-email" element={<AuthFlowPage />} />
                  <Route path="/reset-password" element={<AuthFlowPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </CartProvider>
      </LanguageProvider>
    </PaletteThemeProvider>
  </QueryClientProvider>
);

export default App;
