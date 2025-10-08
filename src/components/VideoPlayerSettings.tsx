import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface VideoPlayerSettingsProps {
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
}

const PLAYBACK_RATES = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2, label: '2x' },
];

export function VideoPlayerSettings({ playbackRate, onPlaybackRateChange }: VideoPlayerSettingsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Load saved playback rate from localStorage
    const savedRate = localStorage.getItem('wutch_playback_rate');
    if (savedRate) {
      const rate = parseFloat(savedRate);
      if (!isNaN(rate)) {
        onPlaybackRateChange(rate);
      }
    }
  }, [onPlaybackRateChange]);

  const handlePlaybackRateChange = (value: string) => {
    const rate = parseFloat(value);
    onPlaybackRateChange(rate);
    localStorage.setItem('wutch_playback_rate', value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-white hover:text-white hover:bg-white/20 shrink-0"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 bg-black/95 border-white/20 text-white backdrop-blur-sm pointer-events-auto" 
        align="end"
        side="top"
        sideOffset={10}
      >
        <div className="space-y-4">
          {/* Playback Speed Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Playback Speed</h4>
            <RadioGroup 
              value={playbackRate.toString()} 
              onValueChange={handlePlaybackRateChange}
              className="space-y-2"
            >
              {PLAYBACK_RATES.map((rate) => (
                <div key={rate.value} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={rate.value.toString()} 
                    id={`rate-${rate.value}`}
                    className="border-white/40 text-white"
                  />
                  <Label 
                    htmlFor={`rate-${rate.value}`} 
                    className="text-sm cursor-pointer text-white/90 hover:text-white"
                  >
                    {rate.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator className="bg-white/20" />

          {/* Quality Section (UI Only) */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Quality</h4>
            <p className="text-xs text-white/60">
              Quality adjustment requires HLS video format support. Currently displaying source quality.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
