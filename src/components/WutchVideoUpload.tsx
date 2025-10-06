import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Video } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORY_NAMES } from '@/constants/categories';

export const WutchVideoUpload = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    promotional_link: '',
    promotional_link_text: 'Check this out!',
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
        toast({
          title: 'File too large',
          description: 'Video must be under 2GB',
          variant: 'destructive',
        });
        return;
      }

      if (!file.type.startsWith('video/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a video file',
          variant: 'destructive',
        });
        return;
      }

      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Thumbnail must be under 5MB',
          variant: 'destructive',
        });
        return;
      }

      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview('');
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload videos',
        variant: 'destructive',
      });
      return;
    }

    if (!videoFile) {
      toast({
        title: 'Video required',
        description: 'Please select a video to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: 'Terms required',
        description: 'Please agree to the terms of service',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload video
      const videoPath = `${user.id}/${Date.now()}-${videoFile.name}`;
      const { error: videoError } = await supabase.storage
        .from('wutch-videos')
        .upload(videoPath, videoFile);

      if (videoError) throw videoError;

      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('wutch-videos')
        .getPublicUrl(videoPath);

      // Generate thumbnail from video if not provided
      let thumbnailUrl = null;
      let thumbnailToUpload = thumbnailFile;
      
      if (!thumbnailToUpload) {
        // Generate thumbnail from first frame of video
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        thumbnailToUpload = await new Promise<File>((resolve, reject) => {
          video.onloadeddata = () => {
            video.currentTime = 1; // Capture at 1 second
          };
          
          video.onseeked = () => {
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              canvas.toBlob((blob) => {
                if (blob) {
                  const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                  resolve(file);
                } else {
                  reject(new Error('Failed to generate thumbnail'));
                }
              }, 'image/jpeg', 0.85);
            } else {
              reject(new Error('Canvas context not available'));
            }
            
            URL.revokeObjectURL(video.src);
          };
          
          video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video for thumbnail'));
          };
          
          video.src = URL.createObjectURL(videoFile);
        });
      }
      
      // Upload thumbnail
      if (thumbnailToUpload) {
        const thumbnailPath = `${user.id}/${Date.now()}-${thumbnailToUpload.name}`;
        const { error: thumbnailError } = await supabase.storage
          .from('wutch-video-thumbnails')
          .upload(thumbnailPath, thumbnailToUpload);

        if (!thumbnailError) {
          const { data: { publicUrl } } = supabase.storage
            .from('wutch-video-thumbnails')
            .getPublicUrl(thumbnailPath);
          thumbnailUrl = publicUrl;
        }
      }

      // Get video duration
      const video = document.createElement('video');
      video.src = videoPreview;
      await new Promise(resolve => { video.onloadedmetadata = resolve; });
      const duration = Math.floor(video.duration);

      // Create database record
      const { data, error } = await supabase
        .from('wutch_videos')
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration,
          category: formData.category,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          promotional_link: formData.promotional_link || null,
          promotional_link_text: formData.promotional_link_text,
          status: 'published',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Your video has been uploaded',
      });

      navigate(`/wutch/${data.id}`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload video',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Video Upload */}
      <div className="space-y-2">
        <Label htmlFor="video">Video File *</Label>
        {videoPreview ? (
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            <video src={videoPreview} controls className="w-full h-full" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={removeVideo}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="video"
            className="flex flex-col items-center justify-center aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Video className="h-12 w-12 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload video (Max 2GB)</span>
            <input
              id="video"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={handleVideoChange}
            />
          </label>
        )}
      </div>

      {/* Thumbnail Upload */}
      <div className="space-y-2">
        <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
        {thumbnailPreview ? (
          <div className="relative w-full max-w-sm">
            <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full rounded-lg" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={removeThumbnail}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="thumbnail"
            className="flex flex-col items-center justify-center w-full max-w-sm aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload thumbnail</span>
            <input
              id="thumbnail"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleThumbnailChange}
            />
          </label>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter video title"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your video"
          rows={4}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_NAMES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="gaming, tutorial, fun"
        />
      </div>

      {/* Promotional Link */}
      <div className="space-y-2">
        <Label htmlFor="promo-link">Promotional Link</Label>
        <Input
          id="promo-link"
          type="url"
          value={formData.promotional_link}
          onChange={(e) => setFormData({ ...formData, promotional_link: e.target.value })}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="promo-text">Link Text</Label>
        <Input
          id="promo-text"
          value={formData.promotional_link_text}
          onChange={(e) => setFormData({ ...formData, promotional_link_text: e.target.value })}
        />
      </div>

      {/* Terms */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
        />
        <Label htmlFor="terms" className="text-sm cursor-pointer">
          I agree to the terms of service and community guidelines
        </Label>
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? 'Uploading...' : 'Upload Video'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
