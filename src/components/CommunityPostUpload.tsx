import { useState } from "react";
import { Image, X, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CommunityPostUploadProps {
  onSuccess?: () => void;
}

export const CommunityPostUpload = ({ onSuccess }: CommunityPostUploadProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Service offering fields
  const [postType, setPostType] = useState<'general' | 'service' | 'meme'>('general');
  const [isPremium, setIsPremium] = useState(false);
  const [x402Price, setX402Price] = useState(0.001);
  const [serviceDescription, setServiceDescription] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('3d');
  const [serviceCategory, setServiceCategory] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const MAX_CHARS = 500;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setMediaPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to post");
      return;
    }

    if (!content.trim()) {
      toast.error("Post content cannot be empty");
      return;
    }

    if (postType === 'service') {
      if (!serviceDescription.trim() || serviceDescription.trim().length < 20) {
        toast.error("Service description must be at least 20 characters");
        return;
      }
      if (!serviceCategory) {
        toast.error("Please select a service category");
        return;
      }
      if (isPremium && !termsAccepted) {
        toast.error("Please accept the service terms");
        return;
      }
    }

    if (isPremium && postType === 'service' && x402Price < 0.001) {
      toast.error("Price must be at least 0.001 SOL");
      return;
    }

    setIsUploading(true);

    try {
      let mediaUrl: string | undefined;

      // Upload media if exists
      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("community-posts")
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("community-posts")
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      // Create post
      const postData: any = {
        user_id: user.id,
        content: content.trim(),
        media_url: mediaUrl,
        post_type: postType,
      };

      // Add service-specific fields
      if (postType === 'service') {
        postData.service_description = serviceDescription.trim();
        postData.delivery_time = deliveryTime;
        postData.service_category = serviceCategory;
        postData.terms_accepted = termsAccepted;
        
        if (isPremium) {
          postData.is_premium = true;
          postData.x402_price = x402Price;
          postData.x402_asset = 'SOL';
          postData.x402_network = 'solana';
        }
      }

      const { error: insertError } = await supabase
        .from("community_posts")
        .insert(postData);

      if (insertError) throw insertError;

      toast.success(postType === 'service' ? "Service offering posted!" : "Post created successfully!");
      
      // Reset form
      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
      setPostType('general');
      setIsPremium(false);
      setX402Price(0.001);
      setServiceDescription('');
      setDeliveryTime('3d');
      setServiceCategory('');
      setTermsAccepted(false);
      
      onSuccess?.();
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-6">
      {/* Post Type Selector */}
      <div className="mb-4">
        <Label className="mb-2 block">Post Type</Label>
        <Tabs value={postType} onValueChange={(v) => setPostType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="service">Service 🛠️</TabsTrigger>
            <TabsTrigger value="meme">Meme/Fun</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Textarea
        placeholder={postType === 'meme' ? "Share something funny!" : "What's on your mind?"}
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        className="min-h-32 mb-4 resize-none"
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {content.length} / {MAX_CHARS}
        </p>
      </div>

      {/* Service Section */}
      {postType === 'service' && (
        <div className="space-y-4 border-t pt-4 mb-4">
          <Label>Service Offering</Label>
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground mt-2">I will</span>
            <Input
              placeholder="create banners for you"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              className="flex-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Category</Label>
              <Select value={serviceCategory} onValueChange={setServiceCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="graphic-design">Graphic Design</SelectItem>
                  <SelectItem value="video-editing">Video Editing</SelectItem>
                  <SelectItem value="social-media">Social Media Management</SelectItem>
                  <SelectItem value="content-writing">Content Writing</SelectItem>
                  <SelectItem value="web-development">Web Development</SelectItem>
                  <SelectItem value="music-production">Music Production</SelectItem>
                  <SelectItem value="voice-over">Voice Over</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Delivery Time</Label>
              <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="3d">3 days</SelectItem>
                  <SelectItem value="1w">1 week</SelectItem>
                  <SelectItem value="2w">2 weeks</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Premium Pricing Section */}
      {postType === 'service' && (
        <div className="border-t pt-4 space-y-4 mb-4">
          <div className="flex items-center justify-between">
            <Label>Set Price for Service</Label>
            <Switch checked={isPremium} onCheckedChange={setIsPremium} />
          </div>
          
          {isPremium && (
            <Card className="p-4 bg-purple-500/5 border-purple-500/20">
              <Label>Price (SOL)</Label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                max="1000"
                value={x402Price}
                onChange={(e) => setX402Price(parseFloat(e.target.value) || 0.001)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum: 0.001 SOL
              </p>
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>You receive (95%):</span>
                  <span className="text-green-500 font-semibold">{(x402Price * 0.95).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Platform fee (5%):</span>
                  <span className="text-muted-foreground">{(x402Price * 0.05).toFixed(4)} SOL</span>
                </div>
              </div>

              <Alert className="mt-4">
                <Briefcase className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Users will need to pay this amount to order your service. Once paid, they'll be able to see your full post details and you'll receive an order notification.
                </AlertDescription>
              </Alert>

              <div className="flex items-start gap-2 mt-4">
                <Switch 
                  checked={termsAccepted} 
                  onCheckedChange={setTermsAccepted}
                  id="terms"
                />
                <Label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
                  I agree to deliver the service as described and understand that payment is held in escrow until completion. I will respond to buyer messages within 24 hours.
                </Label>
              </div>
            </Card>
          )}
        </div>
      )}

      {mediaPreview && (
        <div className="relative mb-4 rounded-lg overflow-hidden">
          <img src={mediaPreview} alt="Preview" className="w-full h-auto max-h-96 object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemoveMedia}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label>
          <input
            type="file"
            accept="image/*"
            onChange={handleMediaSelect}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span className="cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Add Image
            </span>
          </Button>
        </label>

        <div className="flex-1" />

        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isUploading || (postType === 'service' && !serviceDescription.trim())}
        >
          {isUploading ? "Posting..." : postType === 'service' ? "Post Service" : "Post"}
        </Button>
      </div>
    </Card>
  );
};