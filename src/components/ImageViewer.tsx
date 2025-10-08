import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ImageViewerProps {
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alt?: string;
}

export function ImageViewer({ imageUrl, open, onOpenChange, alt = 'Image' }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = alt.replace(/\s+/g, '_') + '.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleClose = () => {
    setZoom(1);
    onOpenChange(false);
  };

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="bg-background/80 backdrop-blur hover:bg-background"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="bg-background/80 backdrop-blur hover:bg-background"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleDownload}
            className="bg-background/80 backdrop-blur hover:bg-background"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClose}
            className="bg-background/80 backdrop-blur hover:bg-background"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="w-full h-full flex items-center justify-center overflow-auto p-8">
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
