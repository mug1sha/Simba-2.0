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
    <section id="deals" className="section-padding overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary">
                {t("deals.hot")}
              </span>
            </div>
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">Fresh Deals Today</h2>
          </div>
          <a href="#products" className="text-sm font-bold text-primary transition-opacity hover:opacity-80">
            {t("deals.view_all")}
          </a>
        </div>

        <div className="relative rounded-[2rem] border border-border bg-card px-12 py-6">
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
            <CarouselPrevious className="-left-5 h-10 w-10 border-border bg-background text-foreground hover:bg-accent hover:text-foreground" />
            <CarouselNext className="-right-5 h-10 w-10 border-border bg-background text-foreground hover:bg-accent hover:text-foreground" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};

export default DealsSection;
