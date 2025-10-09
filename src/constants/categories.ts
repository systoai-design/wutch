import { 
  TrendingUp, 
  Trophy, 
  Bitcoin, 
  Coins, 
  GraduationCap, 
  Gamepad2, 
  Users, 
  Layers, 
  Gift, 
  Code, 
  BarChart3, 
  Globe2, 
  Sparkles,
  Music,
  Cpu,
  MessageSquare,
  MoreHorizontal,
  Laugh,
  Tv,
  Heart,
  Dumbbell,
  UtensilsCrossed,
  Plane,
  Wallet,
  FlaskConical,
  HeartPulse,
  Palette,
  Mic,
  type LucideIcon
} from 'lucide-react';

export interface Category {
  name: string;
  icon: LucideIcon;
  color?: string;
}

export const CATEGORIES: Category[] = [
  // Crypto & Web3
  { name: 'Trading', icon: TrendingUp, color: 'text-green-500' },
  { name: 'NFTs', icon: Trophy, color: 'text-purple-500' },
  { name: 'DeFi', icon: Bitcoin, color: 'text-orange-500' },
  { name: 'Meme Coins', icon: Coins, color: 'text-yellow-500' },
  { name: 'DAOs & Governance', icon: Users, color: 'text-indigo-500' },
  { name: 'Layer 2 & Scaling', icon: Layers, color: 'text-cyan-500' },
  { name: 'Airdrops & Farming', icon: Gift, color: 'text-emerald-500' },
  { name: 'Blockchain Development', icon: Code, color: 'text-violet-500' },
  { name: 'Market Analysis', icon: BarChart3, color: 'text-red-500' },
  { name: 'Web3 Social', icon: Globe2, color: 'text-sky-500' },
  { name: 'Metaverse', icon: Sparkles, color: 'text-fuchsia-500' },
  
  // Entertainment & Lifestyle
  { name: 'Gaming', icon: Gamepad2, color: 'text-pink-500' },
  { name: 'Comedy', icon: Laugh, color: 'text-amber-500' },
  { name: 'Entertainment', icon: Tv, color: 'text-purple-400' },
  { name: 'Lifestyle & Vlogs', icon: Heart, color: 'text-rose-400' },
  { name: 'Music & Arts', icon: Music, color: 'text-rose-500' },
  { name: 'Art & Design', icon: Palette, color: 'text-pink-400' },
  { name: 'Podcast & Talk Shows', icon: Mic, color: 'text-indigo-400' },
  
  // Health & Fitness
  { name: 'Sports & Fitness', icon: Dumbbell, color: 'text-blue-400' },
  { name: 'Health & Wellness', icon: HeartPulse, color: 'text-green-400' },
  
  // Knowledge & Skills
  { name: 'Education', icon: GraduationCap, color: 'text-blue-500' },
  { name: 'Technology & AI', icon: Cpu, color: 'text-teal-500' },
  { name: 'Science & Engineering', icon: FlaskConical, color: 'text-cyan-400' },
  { name: 'Finance & Investing', icon: Wallet, color: 'text-green-600' },
  
  // Hobbies & Travel
  { name: 'Food & Cooking', icon: UtensilsCrossed, color: 'text-orange-400' },
  { name: 'Travel & Adventure', icon: Plane, color: 'text-sky-400' },
  
  // General
  { name: 'Just Chatting', icon: MessageSquare, color: 'text-slate-500' },
  { name: 'Other', icon: MoreHorizontal, color: 'text-gray-500' },
];

// Export just the category names for select inputs
export const CATEGORY_NAMES = CATEGORIES.map(cat => cat.name);

// Helper to get category icon by name
export const getCategoryIcon = (categoryName: string): LucideIcon | undefined => {
  return CATEGORIES.find(cat => cat.name === categoryName)?.icon;
};

// Helper to get category color by name
export const getCategoryColor = (categoryName: string): string | undefined => {
  return CATEGORIES.find(cat => cat.name === categoryName)?.color;
};
