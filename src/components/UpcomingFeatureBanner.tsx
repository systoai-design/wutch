import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface UpcomingFeatureBannerProps {
  title?: string;
  description?: string;
}

export const UpcomingFeatureBanner = ({ 
  title = "Coming Soon", 
  description = "This feature is currently under development and will be available soon!" 
}: UpcomingFeatureBannerProps) => {
  return (
    <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-primary/10 p-3 animate-pulse">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-2 text-foreground">{title}</h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </Card>
  );
};
