import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Flame, Clock, CalendarClock, Zap, DollarSign, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/store/sidebarStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CATEGORIES } from '@/constants/categories';
import { useEffect, useState } from 'react';
import pumpFunLogo from '@/assets/pumpfun-logo.webp';
import wutchLogo from '@/assets/wutch-logo.webp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const INITIAL_CATEGORIES_COUNT = 8;

const Sidebar = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isCollapsed, isMobileOpen, setMobileOpen, setCollapsed } = useSidebar();
  const activeCategory = searchParams.get('category');
  const [isHovering, setIsHovering] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  
  const isHomePage = location.pathname === '/app' || location.pathname === '/';

  // Auto-expand on homepage, collapsed elsewhere
  useEffect(() => {
    if (isHomePage) {
      setCollapsed(false);
    } else if (!isHovering) {
      setCollapsed(true);
    }
  }, [location.pathname, isHomePage, isHovering, setCollapsed]);

  const navItems: Array<{
    icon: any;
    label: string;
    path: string;
    type: 'icon' | 'image';
    imageSrc?: string;
    badge?: string;
  }> = [
    { icon: Home, label: 'Home', path: '/app', type: 'icon' },
    { icon: null, label: 'Pump Streams', path: '/streams', type: 'image', imageSrc: pumpFunLogo },
    { icon: null, label: 'Wutch', path: '/wutch', type: 'image', imageSrc: wutchLogo },
    { icon: Zap, label: 'Shorts', path: '/shorts', type: 'icon' },
    { icon: Trophy, label: 'Leaderboards', path: '/leaderboards', type: 'icon' },
    { icon: Flame, label: 'Trending', path: '/trending', type: 'icon' },
    { icon: CalendarClock, label: 'Upcoming', path: '/upcoming', type: 'icon' },
    { icon: Clock, label: 'Recently Ended', path: '/recent', type: 'icon' },
  ];

  const sidebarContent = (
    <div className="p-4">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-secondary text-secondary-foreground font-semibold'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
            {item.type === 'icon' ? (
              <item.icon className="h-5 w-5 shrink-0" />
            ) : (
              <img 
                src={item.imageSrc} 
                alt={item.label} 
                className="h-5 w-5 shrink-0 object-contain rounded-xl"
                style={{ backgroundColor: 'transparent' }}
                width="20"
                height="20"
                loading="lazy"
                decoding="async"
              />
            )}
              <span>{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <h3 className="px-4 mb-3 text-sm font-semibold text-muted-foreground">
          Categories
        </h3>
        <div className="space-y-1">
          {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, INITIAL_CATEGORIES_COUNT)).map((category) => {
            const isActive = activeCategory === category.name;
            return (
              <Link
                key={category.name}
                to={`/app?category=${encodeURIComponent(category.name)}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 text-left px-4 py-2 rounded-lg transition-colors text-sm",
                  isActive 
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'hover:bg-accent/50 hover:text-accent-foreground'
                )}
              >
                <category.icon className="h-4 w-4 shrink-0" />
                <span>{category.name}</span>
              </Link>
            );
          })}
          {CATEGORIES.length > INITIAL_CATEGORIES_COUNT && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="w-full justify-start gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {showAllCategories ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show More ({CATEGORIES.length - INITIAL_CATEGORIES_COUNT} more)
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 md:hidden">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-background h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto scrollbar-hide transition-all duration-300",
          isCollapsed && !isHovering ? "w-[72px]" : "w-60"
        )}
        onMouseEnter={() => !isHomePage && setIsHovering(true)}
        onMouseLeave={() => !isHomePage && setIsHovering(false)}
      >
        <div className={cn("p-4", (isCollapsed && !isHovering) && "px-2")}>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const shouldCollapse = isCollapsed && !isHovering;
              
              const linkContent = (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-semibold'
                      : 'hover:bg-accent hover:text-accent-foreground',
                    shouldCollapse && 'justify-center px-2'
                  )}
                >
                {item.type === 'icon' ? (
                  <item.icon className="h-5 w-5 shrink-0" />
                ) : (
                  <img 
                    src={item.imageSrc} 
                    alt={item.label} 
                    className="h-5 w-5 shrink-0 object-contain rounded-xl"
                    style={{ backgroundColor: 'transparent' }}
                    width="20"
                    height="20"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                  {!shouldCollapse && <span>{item.label}</span>}
                </Link>
              );

              return shouldCollapse ? (
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

          {!(isCollapsed && !isHovering) && (
            <div className="mt-8">
              <h3 className="px-4 mb-3 text-sm font-semibold text-muted-foreground">
                Categories
              </h3>
              <div className="space-y-1">
                {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, INITIAL_CATEGORIES_COUNT)).map((category) => {
                  const isActive = activeCategory === category.name;
                  return (
                    <Link
                      key={category.name}
                      to={`/app?category=${encodeURIComponent(category.name)}`}
                      className={cn(
                        "w-full flex items-center gap-3 text-left px-4 py-2 rounded-lg transition-colors text-sm",
                        isActive 
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'hover:bg-accent/50 hover:text-accent-foreground'
                      )}
                    >
                      <category.icon className="h-4 w-4 shrink-0" />
                      <span>{category.name}</span>
                    </Link>
                  );
                })}
                {CATEGORIES.length > INITIAL_CATEGORIES_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="w-full justify-start gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showAllCategories ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show More ({CATEGORIES.length - INITIAL_CATEGORIES_COUNT} more)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {(isCollapsed && !isHovering) && (
            <div className="mt-8 space-y-1">
              {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, INITIAL_CATEGORIES_COUNT)).map((category) => {
                const isActive = activeCategory === category.name;
                return (
                  <Tooltip key={category.name}>
                    <TooltipTrigger asChild>
                      <Link
                        to={`/app?category=${encodeURIComponent(category.name)}`}
                        className={cn(
                          "w-full flex items-center justify-center px-2 py-3 rounded-lg transition-colors",
                          isActive 
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <category.icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{category.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {CATEGORIES.length > INITIAL_CATEGORIES_COUNT && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      className="w-full justify-center px-2 py-3"
                    >
                      {showAllCategories ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{showAllCategories ? 'Show Less' : `Show ${CATEGORIES.length - INITIAL_CATEGORIES_COUNT} More`}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
