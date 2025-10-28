import { ServiceMarketplaceCard } from "./ServiceMarketplaceCard";
import { SkeletonStreamCard } from "./SkeletonCard";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

interface ServiceMarketplaceGridProps {
  services?: any[];
  isLoading?: boolean;
}

type SortOption = 'rating' | 'price-low' | 'price-high' | 'popular';

export const ServiceMarketplaceGrid = ({
  services = [],
  isLoading = false,
}: ServiceMarketplaceGridProps) => {
  const [sortBy, setSortBy] = useState<SortOption>('rating');

  // Sort services
  const sortedServices = [...services].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.user.service_rating_avg || 0) - (a.user.service_rating_avg || 0);
      case 'price-low':
        return (a.x402_price || 0) - (b.x402_price || 0);
      case 'price-high':
        return (b.x402_price || 0) - (a.x402_price || 0);
      case 'popular':
        return (b.user.service_orders_completed || 0) - (a.user.service_orders_completed || 0);
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonStreamCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (sortedServices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          No services available yet. Be the first to offer a service!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Service Marketplace
          </h2>
          <span className="text-sm text-muted-foreground">
            Powered by X402
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedServices.map((service) => (
          <ServiceMarketplaceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  );
};
