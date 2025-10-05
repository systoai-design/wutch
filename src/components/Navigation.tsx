import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { useSidebar } from '@/store/sidebarStore';
import { WalletConnect } from '@/components/WalletConnect';
import { useState } from 'react';
import wutchLogo from '@/assets/wutch-logo.png';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, signOut } = useAuth();
  const { toggle } = useSidebar();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md transition-all duration-300">
      <div className="flex items-center justify-between px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggle}
            className="hidden md:inline-flex h-11 w-11"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden h-11 w-11 -ml-2">
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2 group touch-manipulation">
            <img 
              src={wutchLogo} 
              alt="Wutch" 
              className="h-9 w-9 sm:h-10 sm:w-10 transition-transform group-hover:scale-110"
              width="40"
              height="40"
              loading="eager"
            />
            <span className="font-bold text-lg sm:text-xl hidden xs:inline bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Wutch
            </span>
          </Link>
        </div>

        <div className="flex-1 max-w-2xl mx-4 hidden md:flex">
          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Search streams, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSearch}
              className="absolute right-0 top-0 h-full"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <WalletConnect />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:inline-flex transition-transform hover:scale-110 h-11 w-11"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 touch-manipulation" aria-label="User menu">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px] bg-background z-50">
              <DropdownMenuItem asChild className="cursor-pointer py-3">
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-3">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-3 md:hidden">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pr-10 h-11 text-base"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSearch}
            className="absolute right-0 top-0 h-11 w-11 touch-manipulation"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
