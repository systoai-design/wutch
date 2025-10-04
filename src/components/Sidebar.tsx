import { Link, useLocation } from 'react-router-dom';
import { Home, Flame, Clock, Video, Upload, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  'Trading',
  'NFTs',
  'DeFi',
  'Meme Coins',
  'Education',
  'GameFi',
];

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/app' },
    { icon: Flame, label: 'Trending', path: '/trending' },
    { icon: Clock, label: 'Recently Ended', path: '/recent' },
    { icon: Video, label: 'Shorts', path: '/shorts' },
    { icon: Upload, label: 'Submit Stream', path: '/submit' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-background h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto scrollbar-hide">
      <div className="p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground font-semibold'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">
          <h3 className="px-4 mb-3 text-sm font-semibold text-muted-foreground">
            Categories
          </h3>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category}
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
