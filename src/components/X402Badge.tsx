import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface X402BadgeProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export const X402Badge = ({ size = "md", showText = true, className = "" }: X402BadgeProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  return (
    <Badge 
      className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 gap-1 ${sizeClasses[size]} ${className}`}
    >
      <Lock className={iconSizes[size]} />
      {showText && <span>X402</span>}
    </Badge>
  );
};
