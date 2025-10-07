import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, Moon, Sun, User, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/store/sidebarStore';
import { WalletConnect } from '@/components/WalletConnect';
import { useState, useEffect } from 'react';
import wutchLogo from '@/assets/wutch-logo.png';
import { useAuthDialog } from '@/store/authDialogStore';
import { supabase } from '@/integrations/supabase/client';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, signOut, isGuest } = useAuth();
  const { toggle, toggleMobile } = useSidebar();
  const { open: openAuthDialog } = useAuthDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user && !isGuest) {
      fetchUserProfile();
    }
  }, [user, isGuest]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, username, display_name')
      .eq('id', user.id)
      .single();
    setUserProfile(data);
  };

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
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggle}
            className="hidden md:inline-flex min-h-[44px] min-w-[44px]"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobile}
            className="md:hidden min-h-[44px] min-w-[44px] -ml-2"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Link to="/" className="flex items-center gap-2 group touch-manipulation">
            <img 
              src={wutchLogo} 
              alt="Wutch" 
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl transition-transform group-hover:scale-110"
              width="36"
              height="36"
              loading="eager"
            />
            <span className="font-bold text-base sm:text-lg hidden xs:inline text-white">
              Wutch
            </span>
          </Link>
        </div>

        <div className="flex-1 max-w-2xl mx-3 sm:mx-4 hidden md:flex">
          <div className="relative w-full">
            <Input
              type="text"
              placeholder="Search streams, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pr-10 rounded-[35px]"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSearch}
              className="absolute right-0 top-0 h-full min-h-[44px] min-w-[44px]"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search icon - mobile only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/search')}
            className="md:hidden min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Wallet Connect - visible on mobile and desktop */}
          <div className="block">
            <WalletConnect />
          </div>

          {/* Twitter/X Icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open('https://twitter.com', '_blank')}
            className="hidden sm:inline-flex min-h-[44px] min-w-[44px]"
            aria-label="Twitter"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </Button>

          {/* Create Button */}
          {!isGuest && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/submit')}
              className="hidden sm:inline-flex gap-2 min-h-[44px]"
            >
              <Plus className="h-5 w-5" />
              <span>Create</span>
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden sm:inline-flex transition-transform hover:scale-110 min-h-[44px] min-w-[44px]"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] rounded-full touch-manipulation" aria-label="User menu">
                {!isGuest && userProfile ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={userProfile.avatar_url} alt={userProfile.display_name || userProfile.username} />
                    <AvatarFallback>
                      {userProfile.display_name?.[0] || userProfile.username?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px] bg-background z-50">
              {/* Mobile-only theme toggle */}
              <DropdownMenuItem 
                onClick={toggleTheme}
                className="cursor-pointer py-3 min-h-[44px] sm:hidden"
              >
                {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
              
              {isGuest ? (
                <DropdownMenuItem 
                  onClick={() => openAuthDialog('signup')} 
                  className="cursor-pointer py-3 min-h-[44px]"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign Up / Login
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px]">
                    <Link to="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-3 min-h-[44px]">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
