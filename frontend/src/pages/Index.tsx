import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import DealsSection from "@/components/DealsSection";
import TrustSection from "@/components/TrustSection";
import ProductsGrid from "@/components/ProductsGrid";
import RecommendationsSection from "@/components/RecommendationsSection";
import CartDrawer from "@/components/CartDrawer";
import FooterSection from "@/components/FooterSection";
import ChatWidget from "@/components/ChatWidget";

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
      <RecommendationsSection />
      <FooterSection />
      <CartDrawer />
      <ChatWidget />
    </div>
  );
};

export default Index;
