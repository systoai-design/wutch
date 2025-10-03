import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, Moon, Sun, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { WalletConnect } from '@/components/WalletConnect';
import { useState } from 'react';

const Navigation = () => {
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">W</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline">Wutch</span>
          </Link>
        </div>

        <div className="flex-1 max-w-2xl mx-4 hidden md:flex">
          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Search streams, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WalletConnect />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:inline-flex"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
