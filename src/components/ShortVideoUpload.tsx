import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Upload, Video, ExternalLink, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { validatePromotionalLink, sanitizeUrl } from '@/utils/urlValidation';
import { validateFilename } from '@/utils/fileValidation';

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
    promotional_link: '',
    promotional_link_text: '',
    is_premium: false,
    x402_price: 0.001,
    preview_duration: 3,
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

    // Validate filename
    const filenameValidation = validateFilename(file.name);
    if (!filenameValidation.isValid) {
      toast({
        title: 'Invalid filename',
        description: (
          <div className="space-y-2">
            <p>{filenameValidation.error}</p>
            <p className="text-xs pt-2 border-t border-border">
              <strong>Example valid name:</strong><br />
              {filenameValidation.suggestion}
            </p>
          </div>
        ),
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

    if (!formData.title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please provide a title for your short',
        variant: 'destructive',
      });
      return;
    }

    // Validate promotional link if provided
    if (formData.promotional_link) {
      const promoLinkValidation = validatePromotionalLink(formData.promotional_link);
      if (!promoLinkValidation.isValid) {
        toast({
          title: 'Invalid Promotional Link',
          description: promoLinkValidation.error,
          variant: 'destructive',
        });
        return;
      }
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

      // Call content moderation API (tier-based)
      const { data: moderationData, error: moderationError } = await supabase.functions.invoke(
        'moderate-content',
        {
          body: {
            videoUrl,
            contentType: 'short_video',
            contentId: null,
            userId: user.id,
          }
        }
      );

      if (moderationError || !moderationData?.success) {
        console.error('Moderation error:', moderationError);
        await supabase.storage.from('short-videos').remove([videoPath]);
        throw new Error('Content moderation failed. Please try again.');
      }

      // Handle skipped moderation for trusted users
      if (moderationData.skipped) {
        console.log('Moderation skipped:', moderationData.reason);
        toast({
          title: '✅ Instant Publish',
          description: 'Your content is going live immediately!',
        });
      } else {
        toast({
          title: 'Checking content safety...',
          description: 'This will only take a moment',
        });
      }

      // Only block if actual violation (not if skipped)
      if (moderationData.moderation.isViolation && !moderationData.skipped) {
        console.error('Content violation detected:', moderationData.moderation);
        await supabase.storage.from('short-videos').remove([videoPath]);
        throw new Error(
          `Content rejected: ${moderationData.moderation.violationCategories.join(', ')}. ` +
          `${moderationData.moderation.reasoning}`
        );
      }

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
        const thumbExt = thumbnailToUpload.name.split('.').pop();
        const thumbPath = `${user.id}/${Date.now()}.${thumbExt}`;
        const { error: thumbError } = await supabase.storage
          .from('short-thumbnails')
          .upload(thumbPath, thumbnailToUpload);

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

      // Create short video record with approved moderation status
      const { data: videoData, error: dbError } = await supabase
        .from('short_videos')
        .insert({
          user_id: user.id,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          title: formData.title,
          description: formData.description,
          promotional_link: formData.promotional_link ? sanitizeUrl(formData.promotional_link) : null,
          promotional_link_text: formData.promotional_link_text || null,
          duration,
          moderation_status: 'approved',
          is_premium: formData.is_premium,
          x402_price: formData.is_premium ? formData.x402_price : null,
          x402_asset: 'SOL',
          x402_network: 'solana',
          preview_duration: formData.is_premium ? formData.preview_duration : null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Store moderation record with tier info
      await supabase
        .from('content_moderation')
        .insert({
          content_type: 'short_video',
          content_id: videoData.id,
          user_id: user.id,
          status: moderationData.skipped ? 'skipped' : 'approved',
          skipped_reason: moderationData.reason || null,
          user_tier: moderationData.userTier || 'unknown',
          moderation_labels: moderationData.moderation,
        });

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
          <Label htmlFor="description">
            Description (Optional)
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your short video (optional)"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="promotional_link" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Promotional Link (Optional)
          </Label>
          <Input
            id="promotional_link"
            type="url"
            placeholder="https://your-affiliate-link.com"
            value={formData.promotional_link}
            onChange={(e) => setFormData({ ...formData, promotional_link: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Add an affiliate or promotional link. Must be HTTPS.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promotional_link_text">
            Promotional Link Button Text (Optional)
          </Label>
          <Input
            id="promotional_link_text"
            placeholder="Check this out!"
            maxLength={50}
            value={formData.promotional_link_text}
            onChange={(e) => setFormData({ ...formData, promotional_link_text: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Customize the button text (max 50 characters)
          </p>
        </div>

        {/* Premium Content Section */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="is_premium" className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-purple-600" />
                Premium Content (x402)
              </Label>
              <p className="text-sm text-muted-foreground">
                Charge viewers to access this short. You keep 95%, platform takes 5%.
              </p>
            </div>
            <Switch
              id="is_premium"
              checked={formData.is_premium}
              onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
            />
          </div>

          {formData.is_premium && (
            <div className="space-y-4 pl-6 border-l-2 border-purple-600/20">
              <div className="space-y-2">
                <Label htmlFor="x402_price">
                  Price (SOL) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="x402_price"
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="100"
                  value={formData.x402_price}
                  onChange={(e) => setFormData({ ...formData, x402_price: parseFloat(e.target.value) || 0.001 })}
                  placeholder="0.001"
                />
                <p className="text-xs text-muted-foreground">
                  Set your price in SOL. Minimum: 0.001 SOL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preview_duration">
                  Preview Duration (seconds)
                </Label>
                <Input
                  id="preview_duration"
                  type="number"
                  min="0"
                  max="30"
                  value={formData.preview_duration}
                  onChange={(e) => setFormData({ ...formData, preview_duration: parseInt(e.target.value) || 3 })}
                  placeholder="3"
                />
                <p className="text-xs text-muted-foreground">
                  Let viewers watch a preview before purchasing. Default: 3 seconds. Set to 0 to disable preview.
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg space-y-1">
                <p className="text-sm font-medium">Earnings Breakdown:</p>
                <div className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You receive:</span>
                    <span className="font-semibold text-green-600">{(formData.x402_price * 0.95).toFixed(4)} SOL (95%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee:</span>
                    <span>{(formData.x402_price * 0.05).toFixed(4)} SOL (5%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
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
