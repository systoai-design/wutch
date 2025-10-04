import { Link, useLocation } from 'react-router-dom';
import { Home, Flame, Clock, Video, Upload, User, TrendingUp, Coins, Gamepad2, GraduationCap, Trophy, Bitcoin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/store/sidebarStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const categories = [
  { name: 'Trading', icon: TrendingUp },
  { name: 'NFTs', icon: Trophy },
  { name: 'DeFi', icon: Bitcoin },
  { name: 'Meme Coins', icon: Coins },
  { name: 'Education', icon: GraduationCap },
  { name: 'GameFi', icon: Gamepad2 },
];

const Sidebar = () => {
  const location = useLocation();
  const { isCollapsed } = useSidebar();

  const navItems = [
    { icon: Home, label: 'Home', path: '/app' },
    { icon: Flame, label: 'Trending', path: '/trending' },
    { icon: Clock, label: 'Recently Ended', path: '/recent' },
    { icon: Video, label: 'Shorts', path: '/shorts' },
    { icon: Upload, label: 'Submit Stream', path: '/submit' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-background h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto scrollbar-hide transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-60"
        )}
      >
        <div className={cn("p-4", isCollapsed && "px-2")}>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              const linkContent = (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-semibold'
                      : 'hover:bg-accent hover:text-accent-foreground',
                    isCollapsed && 'justify-center px-2'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );

              return isCollapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              ) : linkContent;
            })}
          </nav>

          {!isCollapsed && (
            <div className="mt-8">
              <h3 className="px-4 mb-3 text-sm font-semibold text-muted-foreground">
                Categories
              </h3>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    className="w-full flex items-center gap-3 text-left px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                  >
                    <category.icon className="h-4 w-4 shrink-0" />
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="mt-8 space-y-1">
              {categories.map((category) => (
                <Tooltip key={category.name}>
                  <TooltipTrigger asChild>
                    <button className="w-full flex items-center justify-center px-2 py-3 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
                      <category.icon className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{category.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
