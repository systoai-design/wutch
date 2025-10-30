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
import { Upload, X, Video, Sparkles, Loader2, Lock, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { CATEGORY_NAMES } from '@/constants/categories';
import { validateFilename } from '@/utils/fileValidation';

interface Chapter {
  time: number;
  title: string;
}

export const WutchVideoUpload = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    promotional_link: '',
    promotional_link_text: 'Check this out!',
    is_premium: false,
    x402_price: 0.001,
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Chapter support
  const [chapters, setChapters] = useState<Chapter[]>([{ time: 0, title: '' }]);

  // Validate video codec
  const validateVideoCodec = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const canPlay = video.canPlayType(file.type);
        URL.revokeObjectURL(video.src);
        resolve(canPlay === 'probably' || canPlay === 'maybe');
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(false);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024 * 1024) {
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

      // Validate codec
      const isValid = await validateVideoCodec(file);
      if (!isValid) {
        toast({
          title: 'Codec not supported',
          description: 'Your browser may not support this video format. Try converting to MP4 (H.264)',
          variant: 'destructive',
        });
        return;
      }

      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      
      toast({
        title: 'Video loaded',
        description: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Thumbnail must be under 5MB',
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
    setGeneratedImage(null);
  };

  const generateCoverImage = async () => {
    if (!formData.title) {
      toast({ 
        title: 'Title required', 
        description: 'Please enter a title first',
        variant: 'destructive'
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cover-image', {
        body: {
          title: formData.title,
          description: formData.description,
        }
      });
      
      if (error) throw error;
      
      if (!data?.imageUrl) {
        throw new Error('No image URL received');
      }
      
      setGeneratedImage(data.imageUrl);
      setThumbnailPreview(data.imageUrl);
      
      const response = await fetch(data.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'generated-thumbnail.png', { type: 'image/png' });
      setThumbnailFile(file);
      
      toast({ 
        title: 'Cover image generated!', 
        description: 'You can regenerate or upload your own'
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate cover image',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Chapter management
  const addChapter = () => {
    setChapters([...chapters, { time: 0, title: '' }]);
  };

  const updateChapter = (index: number, field: 'time' | 'title', value: string | number) => {
    const updated = [...chapters];
    if (field === 'time') {
      updated[index][field] = typeof value === 'number' ? value : parseTimeInput(value as string);
    } else {
      updated[index][field] = value as string;
    }
    // Sort by time
    updated.sort((a, b) => a.time - b.time);
    setChapters(updated);
  };

  const removeChapter = (index: number) => {
    if (chapters.length > 1) {
      setChapters(chapters.filter((_, i) => i !== index));
    }
  };

  const parseTimeInput = (input: string): number => {
    const parts = input.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parseInt(input) || 0;
  };

  const formatTimeInput = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-detect chapters from description
  const detectChaptersFromDescription = () => {
    const timeRegex = /(\d{1,2}):(\d{2})\s+(.+)/gm;
    const detected: Chapter[] = [];
    let match;
    
    while ((match = timeRegex.exec(formData.description)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const title = match[3].trim();
      detected.push({ 
        time: minutes * 60 + seconds, 
        title 
      });
    }
    
    if (detected.length > 0) {
      setChapters(detected);
      toast({
        title: 'Chapters detected!',
        description: `Found ${detected.length} chapters in your description`,
      });
    } else {
      toast({
        title: 'No chapters found',
        description: 'Use format like "0:00 Introduction" in your description',
        variant: 'destructive',
      });
    }
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
    setUploadProgress(0);

    try {
      // Upload video
      const videoPath = `${user.id}/${Date.now()}-${videoFile.name}`;
      
      const { error: videoError } = await supabase.storage
        .from('wutch-videos')
        .upload(videoPath, videoFile);

      if (videoError) throw videoError;
      
      setUploadProgress(100);

      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('wutch-videos')
        .getPublicUrl(videoPath);

      // Content moderation
      const { data: moderationData, error: moderationError } = await supabase.functions.invoke(
        'moderate-content',
        {
          body: {
            videoUrl,
            contentType: 'wutch_video',
            contentId: null,
            userId: user.id,
          }
        }
      );

      if (moderationError || !moderationData?.success) {
        console.error('Moderation error:', moderationError);
        await supabase.storage.from('wutch-videos').remove([videoPath]);
        throw new Error('Content moderation failed. Please try again.');
      }

      if (moderationData.skipped) {
        toast({
          title: '✅ Instant Publish',
          description: 'Your content is going live immediately!',
        });
      }

      if (moderationData.moderation.isViolation && !moderationData.skipped) {
        await supabase.storage.from('wutch-videos').remove([videoPath]);
        throw new Error(
          `Content rejected: ${moderationData.moderation.violationCategories.join(', ')}`
        );
      }

      // Generate thumbnail if not provided
      let thumbnailUrl = null;
      let thumbnailToUpload = thumbnailFile;
      
      if (!thumbnailToUpload) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        thumbnailToUpload = await new Promise<File>((resolve, reject) => {
          video.onloadeddata = () => {
            video.currentTime = 1;
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

      // Filter valid chapters
      const validChapters = chapters.filter(ch => ch.title.trim() !== '');

      // Create database record
      const { data, error } = await supabase
        .from('wutch_videos')
        .insert([{
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
          moderation_status: 'approved',
          is_premium: formData.is_premium,
          x402_price: formData.is_premium ? formData.x402_price : null,
          x402_asset: 'SOL',
          x402_network: 'solana',
          chapters: validChapters.length > 0 ? validChapters as any : null,
          transcoding_status: 'pending',
          original_file_size: videoFile.size,
        }])
        .select()
        .single();

      if (error) throw error;

      // Store moderation record
      await supabase
        .from('content_moderation')
        .insert({
          content_type: 'wutch_video',
          content_id: data.id,
          user_id: user.id,
          status: moderationData.skipped ? 'skipped' : 'approved',
          skipped_reason: moderationData.reason || null,
          user_tier: moderationData.userTier || 'unknown',
          moderation_labels: moderationData.moderation,
        });

      toast({
        title: 'Success!',
        description: 'Your video is being processed for optimal streaming',
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
      setUploadProgress(0);
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
            <span className="text-xs text-muted-foreground mt-1">Optimized for web playback</span>
            <input
              id="video"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={handleVideoChange}
            />
          </label>
        )}
        
        {/* Upload Progress */}
        {isSubmitting && uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Uploading... {uploadProgress}%</span>
              <span>{(videoFile!.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Upload */}
      <div className="space-y-3">
        <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
        
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={generateCoverImage}
          disabled={isGenerating || !formData.title}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating AI Cover Image...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {!formData.title ? 'Enter a title to generate with AI' : 'Generate Cover Image with AI'}
            </>
          )}
        </Button>
        
        {thumbnailPreview ? (
          <div className="relative w-full max-w-sm">
            <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full rounded-lg border border-border" />
            <div className="absolute top-2 right-2 flex gap-2">
              {generatedImage && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={generateCoverImage}
                  disabled={isGenerating}
                >
                  Regenerate
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={removeThumbnail}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="thumbnail"
            className="flex flex-col items-center justify-center w-full max-w-sm aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload or use AI generation above</span>
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
          placeholder="Describe your video&#10;&#10;Tip: Add timestamps for chapters (e.g., 0:00 Introduction, 5:30 Main Content)"
          rows={4}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={detectChaptersFromDescription}
        >
          Auto-detect Chapters from Description
        </Button>
      </div>

      {/* Video Chapters */}
      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Video Chapters (Optional)</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Break your video into sections to help viewers navigate
            </p>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={addChapter}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Chapter
          </Button>
        </div>
        
        <div className="space-y-2">
          {chapters.map((chapter, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-[120px_1fr] gap-2">
                <Input
                  type="text"
                  placeholder="0:00"
                  value={formatTimeInput(chapter.time)}
                  onChange={(e) => updateChapter(index, 'time', e.target.value)}
                />
                <Input
                  placeholder="Chapter title"
                  value={chapter.title}
                  onChange={(e) => updateChapter(index, 'title', e.target.value)}
                  maxLength={100}
                />
              </div>
              {chapters.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChapter(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
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

      {/* Premium Content Section */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="is_premium" className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-purple-600" />
              Premium Content (x402)
            </Label>
            <p className="text-sm text-muted-foreground">
              Charge viewers to access this video. You keep 95%, platform takes 5%.
            </p>
          </div>
          <Switch
            id="is_premium"
            checked={formData.is_premium}
            onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
          />
        </div>

        {formData.is_premium && (
          <div className="space-y-2 pl-6 border-l-2 border-purple-600/20">
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
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Processing...'}
            </>
          ) : (
            'Upload Video'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
};