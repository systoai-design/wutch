import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ShortsHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/app')}
        className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
        aria-label="Go back"
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      <h1 className="text-white font-semibold text-lg">Shorts</h1>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/search')}
          className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
          aria-label="Search"
        >
          <Search className="h-6 w-6" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
              aria-label="More options"
            >
              <MoreVertical className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur">
            <DropdownMenuItem className="cursor-pointer">
              Report
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              Not interested
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default ShortsHeader;
