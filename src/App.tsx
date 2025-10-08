import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
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
const Landing = lazy(() => import('./pages/Landing').catch(() => ({ default: () => <div>Error loading page</div> })));
const Bounties = lazy(() => import('./pages/Bounties').catch(() => ({ default: () => <div>Error loading page</div> })));
const Home = lazy(() => import('./pages/Home').catch(() => ({ default: () => <div>Error loading page</div> })));
const Streams = lazy(() => import('./pages/Streams').catch(() => ({ default: () => <div>Error loading page</div> })));
const WutchVideos = lazy(() => import('./pages/WutchVideos').catch(() => ({ default: () => <div>Error loading page</div> })));
const WutchVideoDetail = lazy(() => import('./pages/WutchVideoDetail').catch(() => ({ default: () => <div>Error loading page</div> })));
const StreamDetail = lazy(() => import('./pages/StreamDetail').catch(() => ({ default: () => <div>Error loading page</div> })));
const Shorts = lazy(() => import('./pages/Shorts').catch(() => ({ default: () => <div>Error loading page</div> })));
const Submit = lazy(() => import('./pages/Submit').catch(() => ({ default: () => <div>Error loading page</div> })));
const Profile = lazy(() => import('./pages/Profile').catch(() => ({ default: () => <div>Error loading page</div> })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').catch(() => ({ default: () => <div>Error loading page</div> })));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword').catch(() => ({ default: () => <div>Error loading page</div> })));
const Search = lazy(() => import('./pages/Search').catch(() => ({ default: () => <div>Error loading page</div> })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').catch(() => ({ default: () => <div>Error loading page</div> })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').catch(() => ({ default: () => <div>Error loading page</div> })));
const NotFound = lazy(() => import('./pages/NotFound').catch(() => ({ default: () => <div>Error loading page</div> })));

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
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AuthDialog />
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
