import { Home, Video, PlusCircle, PlaySquare, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/app' },
    { icon: Video, label: 'Streams', path: '/streams' },
    { icon: PlusCircle, label: 'Upload', path: '/submit', isAction: true },
    { icon: PlaySquare, label: 'Wutch', path: '/wutch' },
    { icon: Zap, label: 'Shorts', path: '/shorts' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden pb-safe">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-manipulation",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                item.isAction && "text-primary"
              )}
            >
              <Icon className={cn(
                "h-6 w-6",
                item.isAction && "h-7 w-7"
              )} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
