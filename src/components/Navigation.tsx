import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, Moon, Sun, User, LogOut, Plus, Shield, ShieldCheck, Flag, Bell, Wallet, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useThemeStore } from '@/store/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useModerator } from '@/hooks/useModerator';
import { useSidebar } from '@/store/sidebarStore';
import { WalletConnect } from '@/components/WalletConnect';
import { useState, useEffect } from 'react';
import wutchLogo from '@/assets/wutch-logo.png';
import wutchLogoSm from '@/assets/wutch-logo-sm.png';
import xLogo from '@/assets/x-logo.png';
import xLogoSm from '@/assets/x-logo-sm.png';
import pumpFunLogo from '@/assets/pumpfun-logo.png';
import pumpFunLogoSm from '@/assets/pumpfun-logo-sm.png';
import { useAuthDialog } from '@/store/authDialogStore';
import { supabase } from '@/integrations/supabase/client';
import { NotificationBell } from './NotificationBell';
import { VerificationBadge } from './VerificationBadge';
import { AdminBadge } from './AdminBadge';
import { ModeratorBadge } from './ModeratorBadge';
import { useUserRoles } from '@/hooks/useUserRoles';
import { X402Badge } from './X402Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();
  const { user, signOut, isGuest } = useAuth();
  const { isAdmin } = useAdmin();
  const { isModerator } = useModerator();
  const { toggle, toggleMobile } = useSidebar();
  const { open: openAuthDialog } = useAuthDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const { isAdmin: isUserAdmin, isModerator: isUserModerator } = useUserRoles(user?.id);

  useEffect(() => {
    if (user && !isGuest) {
      fetchUserProfile();
    }
  }, [user, isGuest]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, username, display_name, verification_type')
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
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggle}
            className="hidden md:inline-flex min-h-[44px] min-w-[44px]"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobile}
            className="md:hidden min-h-[44px] min-w-[44px]"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Link to="/" className="flex items-center gap-2 group touch-manipulation">
            <img 
              src={wutchLogoSm}
              srcSet={`${wutchLogoSm} 1x, ${wutchLogo} 2x`}
              alt="Wutch" 
              className="h-10 w-10 md:h-9 md:w-9 rounded-xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: 'transparent' }}
              width="40"
              height="40"
              loading="eager"
            />
            <span className="font-bold text-base sm:text-lg hidden xs:inline">
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
              className="w-full pr-10 rounded-[35px]"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSearch}
              className="absolute right-0 top-0 h-full min-h-[44px] min-w-[44px]"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

          {/* Wallet Connect - hidden on mobile, visible on tablet+ */}
          <div className="hidden md:block">
            <WalletConnect />
          </div>

          {/* Notification Bell - hidden on mobile, visible on tablet+ */}
          {!isGuest && (
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          )}

          {/* X402 Badge - desktop only */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link to="/x402-explained" className="hidden lg:inline-flex items-center">
                  <X402Badge size="sm" showText />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Powered by X402</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* PumpFun Icon - desktop only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open('https://pump.fun/', '_blank')}
            className="hidden lg:inline-flex min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Visit PumpFun"
          >
            <img 
              src={pumpFunLogoSm} 
              srcSet={`${pumpFunLogoSm} 1x, ${pumpFunLogo} 2x`}
              alt="PumpFun" 
              className="h-5 w-5" 
              style={{ backgroundColor: 'transparent' }}
              width="20" 
              height="20" 
              loading="lazy" 
              decoding="async" 
            />
          </Button>

          {/* Twitter/X Icon - desktop only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open('https://x.com/wutchdotfun', '_blank')}
            className="hidden lg:inline-flex min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="Follow us on X"
          >
            <img 
              src={xLogoSm} 
              srcSet={`${xLogoSm} 1x, ${xLogo} 2x`}
              alt="X" 
              className="h-5 w-5" 
              style={{ backgroundColor: 'transparent' }}
              width="20" 
              height="20" 
              loading="lazy" 
              decoding="async" 
            />
          </Button>

          {/* Create Button - desktop only */}
          {!isGuest && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/submit')}
              className="hidden lg:inline-flex gap-2 min-h-[44px]"
            >
              <Plus className="h-5 w-5" />
              <span>Create</span>
            </Button>
          )}
          
          {/* Theme Toggle - desktop only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="hidden lg:inline-flex transition-transform hover:scale-110 min-h-[44px] min-w-[44px]"
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
            <DropdownMenuContent align="end" className="min-w-[220px] bg-background z-50">
              {isGuest ? (
                <>
                  {/* Theme toggle for guest */}
                  <DropdownMenuItem 
                    onClick={toggleTheme}
                    className="cursor-pointer py-3 min-h-[44px] lg:hidden"
                  >
                    {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => openAuthDialog('signup')} 
                    className="cursor-pointer py-3 min-h-[44px]"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Sign Up / Login
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  {/* User Info Section */}
                  <div className="px-2 py-2 border-b">
                    <p className="text-sm font-medium leading-none flex items-center gap-1.5">
                      {userProfile?.display_name || userProfile?.username || 'User'}
                      {isUserAdmin && <AdminBadge size="sm" />}
                      {!isUserAdmin && isUserModerator && <ModeratorBadge size="sm" />}
                      {userProfile?.verification_type && userProfile.verification_type !== 'none' && (
                        <VerificationBadge verificationType={userProfile.verification_type as 'blue' | 'red'} size="sm" />
                      )}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">
                      @{userProfile?.username}
                    </p>
                  </div>

                  {/* Theme Toggle - Mobile/Tablet only */}
                  <DropdownMenuItem 
                    onClick={toggleTheme}
                    className="cursor-pointer py-3 min-h-[44px] lg:hidden"
                  >
                    {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </DropdownMenuItem>

                  {/* Notifications - Mobile only */}
                  <DropdownMenuItem 
                    asChild
                    className="cursor-pointer py-3 min-h-[44px] md:hidden"
                  >
                    <div onClick={(e) => {
                      e.preventDefault();
                      document.querySelector('[aria-label="Notifications"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }}>
                      <Bell className="h-4 w-4 mr-2" />
                      Notifications
                    </div>
                  </DropdownMenuItem>

                  {/* Wallet - Mobile only */}
                  <DropdownMenuItem 
                    asChild
                    className="cursor-pointer py-3 min-h-[44px] md:hidden"
                  >
                    <div onClick={(e) => {
                      e.preventDefault();
                      document.querySelector('[aria-label="Connect Wallet"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }}>
                      <Wallet className="h-4 w-4 mr-2" />
                      Wallet
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="md:hidden" />

                  {/* Main Actions */}
                  <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px]">
                    <Link to="/profile">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>

                  {/* Create Content - Mobile/Tablet only */}
                  <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px] lg:hidden">
                    <Link to="/submit">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Content
                    </Link>
                  </DropdownMenuItem>

                  {/* X402 - Mobile/Tablet only */}
                  <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px] lg:hidden">
                    <Link to="/x402-explained">
                      <Zap className="h-4 w-4 mr-2" />
                      X402 Protocol
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="lg:hidden" />

                  {/* External Links - Mobile/Tablet only */}
                  <DropdownMenuItem 
                    onClick={() => window.open('https://pump.fun/', '_blank')}
                    className="cursor-pointer py-3 min-h-[44px] lg:hidden"
                  >
                    <img 
                      src={pumpFunLogoSm} 
                      alt="PumpFun" 
                      className="h-4 w-4 mr-2" 
                      style={{ backgroundColor: 'transparent' }}
                    />
                    PumpFun
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={() => window.open('https://x.com/wutchdotfun', '_blank')}
                    className="cursor-pointer py-3 min-h-[44px] lg:hidden"
                  >
                    <img 
                      src={xLogoSm} 
                      alt="X" 
                      className="h-4 w-4 mr-2" 
                      style={{ backgroundColor: 'transparent' }}
                    />
                    Follow on X
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  
                  {/* Admin/Moderator Actions */}
                  {isModerator && (
                    <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px]">
                      <Link to="/admin/reports">
                        <Flag className="h-4 w-4 mr-2" />
                        Reports
                      </Link>
                    </DropdownMenuItem>
                  )}
                  
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px]">
                        <Link to="/admin/verification">
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          Verification
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer py-3 min-h-[44px]">
                        <Link to="/admin/roles">
                          <Shield className="h-4 w-4 mr-2" />
                          Roles
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* Sign Out */}
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
