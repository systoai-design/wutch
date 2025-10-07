import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
const NotFound = lazy(() => import('./pages/NotFound'));

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
  const { user, isLoading } = useAuth();
  const { open: openAuthDialog } = useAuthDialog();

  useEffect(() => {
    if (!isLoading && !user) {
      openAuthDialog('signup');
    }
  }, [user, isLoading, openAuthDialog]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
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
          
          {/* SEO-friendly routes */}
          <Route path="/stream/:username/:titleSlug/:id" element={<StreamDetail />} />
          <Route path="/wutch/:username/:titleSlug/:id" element={<WutchVideoDetail />} />
          
          {/* Legacy routes for backward compatibility */}
          <Route path="/stream/:id" element={<StreamDetail />} />
          <Route path="/wutch" element={<WutchVideos />} />
          <Route path="/wutch/:id" element={<WutchVideoDetail />} />
          
          <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
          <Route path="/profile/:username?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/search" element={<Search />} />
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
    </div>
  );
}

function ShortsLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  
  // On mobile, render shorts without any navigation/layout
  if (isMobile) {
    return <Outlet />;
  }
  
  // On desktop, use standard layout
  return <AppLayout />;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <AuthDialog />
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
