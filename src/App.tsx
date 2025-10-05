import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useThemeStore } from '@/store/themeStore';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';

// Lazy load pages for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Bounties = lazy(() => import('./pages/Bounties'));
const Home = lazy(() => import('./pages/Home'));
const StreamDetail = lazy(() => import('./pages/StreamDetail'));
const Shorts = lazy(() => import('./pages/Shorts'));
const Submit = lazy(() => import('./pages/Submit'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const Search = lazy(() => import('./pages/Search'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        
        {/* App routes with Navigation and Sidebar */}
        <Route element={<AppLayout />}>
          <Route path="/app" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/stream/:id" element={<ProtectedRoute><StreamDetail /></ProtectedRoute>} />
          <Route path="/shorts" element={<ProtectedRoute><Shorts /></ProtectedRoute>} />
          <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
          <Route path="/profile/:username?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/trending" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/upcoming" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/recent" element={<ProtectedRoute><Home /></ProtectedRoute>} />
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
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <AppContent />
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
