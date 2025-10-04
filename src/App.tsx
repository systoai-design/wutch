import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useThemeStore } from '@/store/themeStore';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import Landing from './pages/Landing';
import Bounties from './pages/Bounties';
import Home from './pages/Home';
import StreamDetail from './pages/StreamDetail';
import Shorts from './pages/Shorts';
import Submit from './pages/Submit';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Search from './pages/Search';
import NotFound from './pages/NotFound';

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
    <Routes>
      {/* Public routes without app layout */}
      <Route path="/" element={<Landing />} />
      <Route path="/bounties" element={<Bounties />} />
      <Route path="/auth" element={<Auth />} />
      
      {/* App routes with Navigation and Sidebar */}
      <Route element={<AppLayout />}>
        <Route path="/app" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/stream/:id" element={<ProtectedRoute><StreamDetail /></ProtectedRoute>} />
        <Route path="/shorts" element={<ProtectedRoute><Shorts /></ProtectedRoute>} />
        <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
        <Route path="/profile/:username?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/trending" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/recent" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
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
