import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useThemeStore } from '@/store/themeStore';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import Home from './pages/Home';
import StreamDetail from './pages/StreamDetail';
import Shorts from './pages/Shorts';
import Submit from './pages/Submit';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => {
  const { isDark } = useThemeStore();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Navigation />
            <div className="flex w-full">
              <Sidebar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/stream/:id" element={<StreamDetail />} />
                  <Route path="/shorts" element={<Shorts />} />
                  <Route path="/submit" element={<Submit />} />
                  <Route path="/profile/:username?" element={<Profile />} />
                  <Route path="/trending" element={<Home />} />
                  <Route path="/recent" element={<Home />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
