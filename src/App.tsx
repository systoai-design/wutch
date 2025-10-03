import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useThemeStore } from '@/store/themeStore';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import Landing from './pages/Landing';
import Home from './pages/Home';
import StreamDetail from './pages/StreamDetail';
import Shorts from './pages/Shorts';
import Submit from './pages/Submit';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
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
  const { user } = useAuth();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background">
      {user && <Navigation />}
      <div className="flex w-full">
        {user && <Sidebar />}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/stream/:id" element={<ProtectedRoute><StreamDetail /></ProtectedRoute>} />
            <Route path="/shorts" element={<ProtectedRoute><Shorts /></ProtectedRoute>} />
            <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
            <Route path="/profile/:username?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/trending" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/recent" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
