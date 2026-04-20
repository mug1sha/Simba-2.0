import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import DealsSection from "@/components/DealsSection";
import TrustSection from "@/components/TrustSection";
import ProductsGrid from "@/components/ProductsGrid";
import CartDrawer from "@/components/CartDrawer";
import FooterSection from "@/components/FooterSection";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <HeroSection />
      <CategorySection onSelectCategory={setSelectedCategory} selectedCategory={selectedCategory} />
      <DealsSection />
      <TrustSection />
      <ProductsGrid searchQuery={searchQuery} selectedCategory={selectedCategory} />
      <FooterSection />
      <CartDrawer />
    </div>
  );
};

export default Index;
