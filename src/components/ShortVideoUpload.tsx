import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const ShortVideoUpload = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if video
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a video file',
        variant: 'destructive',
      });
      return;
    }

    // Check aspect ratio using video element
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const aspectRatio = video.videoWidth / video.videoHeight;
      const target = 9 / 16;
      
      if (Math.abs(aspectRatio - target) > 0.1) {
        toast({
          title: 'Invalid Aspect Ratio',
          description: 'Please upload a 9:16 (vertical) video',
          variant: 'destructive',
        });
        return;
      }
      
      setVideoFile(file);
    };
    video.src = URL.createObjectURL(file);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setThumbnailFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to upload a short video',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (!videoFile) {
      toast({
        title: 'Video Required',
        description: 'Please select a video file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload video
      const videoExt = videoFile.name.split('.').pop();
      const videoPath = `${user.id}/${Date.now()}.${videoExt}`;
      const { error: videoError } = await supabase.storage
        .from('short-videos')
        .upload(videoPath, videoFile);

      if (videoError) throw videoError;

      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('short-videos')
        .getPublicUrl(videoPath);

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split('.').pop();
        const thumbPath = `${user.id}/${Date.now()}.${thumbExt}`;
        const { error: thumbError } = await supabase.storage
          .from('short-thumbnails')
          .upload(thumbPath, thumbnailFile);

        if (!thumbError) {
          const { data: { publicUrl } } = supabase.storage
            .from('short-thumbnails')
            .getPublicUrl(thumbPath);
          thumbnailUrl = publicUrl;
        }
      }

      // Get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      const duration = await new Promise<number>((resolve) => {
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          resolve(Math.floor(video.duration));
        };
        video.src = URL.createObjectURL(videoFile);
      });

      // Create short video record
      const { error: dbError } = await supabase
        .from('short_videos')
        .insert({
          user_id: user.id,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          title: formData.title,
          description: formData.description,
          duration,
        });

      if (dbError) throw dbError;

      toast({
        title: 'Short Video Uploaded!',
        description: 'Your video has been uploaded successfully.',
      });

      setTimeout(() => {
        navigate('/shorts');
      }, 1500);
    } catch (error) {
      console.error('Error uploading short:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="video">
            Video File (9:16 aspect ratio) <span className="text-destructive">*</span>
          </Label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
            <input
              id="video"
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />
            <label htmlFor="video" className="cursor-pointer">
              <Video className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {videoFile ? videoFile.name : 'Click to upload video'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vertical format (9:16) required
              </p>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
            <input
              id="thumbnail"
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
            />
            <label htmlFor="thumbnail" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {thumbnailFile ? thumbnailFile.name : 'Click to upload thumbnail'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG up to 10MB
              </p>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Give your short an engaging title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your short video"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate(-1)} 
            className="flex-1"
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload Short'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
