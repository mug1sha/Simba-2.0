import ProductCard from "./ProductCard";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/products";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const DealsSection = () => {
  const { t } = useLanguage();
  const { data: products = [] } = useQuery({
    queryKey: ["deal-products"],
    queryFn: () => fetchProducts(),
  });

  // Pick more products for the carousel (e.g., top 15)
  const dealProducts = products.filter((p) => p.inStock).slice(0, 15);

  return (
    <section id="deals" className="section-padding bg-gradient-to-b from-primary/5 to-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔥</span>
              <span className="bg-destructive/10 text-destructive text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {t("deals.hot")}
              </span>
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">{t("deals.title")}</h2>
          </div>
          <a href="#products" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            {t("deals.view_all")} →
          </a>
        </div>

        <div className="relative px-12">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {dealProducts.map((p) => (
                <CarouselItem key={p.id} className="pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                  <ProductCard product={p} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="-left-12 h-10 w-10 border-border/50 bg-card text-foreground hover:bg-primary hover:text-primary-foreground" />
            <CarouselNext className="-right-12 h-10 w-10 border-border/50 bg-card text-foreground hover:bg-primary hover:text-primary-foreground" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};

export default DealsSection;
