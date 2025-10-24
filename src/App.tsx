import { useEffect, lazy, Suspense, useMemo } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useThemeStore } from '@/store/themeStore';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import BottomNavigation from '@/components/BottomNavigation';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuthDialog } from '@/store/authDialogStore';
import { ChatWidget } from '@/components/ChatWidget';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { 
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler
} from '@solana-mobile/wallet-standard-mobile';
import { Capacitor } from '@capacitor/core';

// Lazy load pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Bounties = lazy(() => import('./pages/Bounties'));
const Home = lazy(() => import('./pages/Home'));
const Streams = lazy(() => import('./pages/Streams'));
const WutchVideos = lazy(() => import('./pages/WutchVideos'));
const WutchVideoDetail = lazy(() => import('./pages/WutchVideoDetail'));
const StreamDetail = lazy(() => import('./pages/StreamDetail'));
const Shorts = lazy(() => import('./pages/Shorts'));
const Submit = lazy(() => import('./pages/Submit'));
const Profile = lazy(() => import('./pages/Profile'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const Search = lazy(() => import('./pages/Search'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const NotFound = lazy(() => import('./pages/NotFound'));
const CommunityPosts = lazy(() => import('./pages/CommunityPosts'));
const CommunityPostDetail = lazy(() => import('./pages/CommunityPostDetail'));
const AdminVerification = lazy(() => import('./pages/AdminVerification'));
const AdminModeration = lazy(() => import('./pages/AdminModeration'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminRoleManagement = lazy(() => import('./pages/AdminRoleManagement'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isVerified } = useAuth();
  const { open: openAuthDialog } = useAuthDialog();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      openAuthDialog('signup');
    } else if (!isLoading && user && !isVerified) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email to continue. Check your inbox for the verification link.",
        variant: "destructive",
      });
    }
  }, [user, isLoading, isVerified, openAuthDialog, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isVerified) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { isDark } = useThemeStore();
  const location = useLocation();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Redirect mobile app users from landing page to main app
  useEffect(() => {
    if (Capacitor.isNativePlatform() && location.pathname === '/') {
      window.location.href = '/app';
    }
  }, [location.pathname]);

  // Detect OAuth callback errors
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      toast.error('Authentication Error', {
        description: errorDescription || 'Failed to sign in with Google. Please try again.'
      });
    }
  }, [location.search]);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <Routes>
        {/* Public routes without app layout */}
        <Route path="/" element={<Landing />} />
        <Route path="/bounties" element={<Bounties />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        
        {/* App routes with Navigation and Sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/app" element={<Home />} />
          <Route path="/streams" element={<Streams />} />
          <Route path="/community" element={<CommunityPosts />} />
          <Route path="/community/post/:postId" element={<CommunityPostDetail />} />
          
          {/* SEO-friendly routes */}
          <Route path="/stream/:username/:titleSlug/:id" element={<StreamDetail />} />
          <Route path="/wutch/:username/:titleSlug/:id" element={<WutchVideoDetail />} />
          
          {/* Legacy routes for backward compatibility */}
          <Route path="/stream/:id" element={<StreamDetail />} />
          <Route path="/wutch" element={<WutchVideos />} />
          <Route path="/wutch/:id" element={<WutchVideoDetail />} />
          
          <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/search" element={<Search />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/admin/verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
          <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute><AdminRoleManagement /></ProtectedRoute>} />
          <Route path="/trending" element={<Home />} />
          <Route path="/upcoming" element={<Home />} />
          <Route path="/recent" element={<Home />} />
        </Route>

        {/* Shorts routes with special mobile layout */}
        <Route element={<ShortsLayout />}>
          <Route path="/shorts/:username/:titleSlug/:id" element={<Shorts />} />
          <Route path="/shorts" element={<Shorts />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex w-full">
        <Sidebar />
        <main className="flex-1 w-full min-w-0 pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
      <ChatWidget />
    </div>
  );
}

function ShortsLayout() {
  // Render shorts without any navigation/layout on all devices for immersive experience
  return <Outlet />;
}

const App = () => {
  const endpoint = useMemo(() => 
    'https://mainnet.helius-rpc.com/?api-key=a181d89a-54f8-4a83-a857-a760d595180f',
    []
  );
  
  // Register Mobile Wallet Adapter for mobile web support
  useEffect(() => {
    registerMwa({
      appIdentity: {
        name: 'Wutch',
        uri: window.location.origin,
      },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: ['solana:mainnet'],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, []);
  
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={false}>
          <BrowserRouter>
            <AuthProvider>
              <Toaster />
              <Sonner />
              <AuthDialog />
              <AppContent />
            </AuthProvider>
          </BrowserRouter>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
};

export default App;
