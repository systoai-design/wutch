import { useState } from "react";
import { Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
      const { error: insertError } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          content: content.trim(),
          media_url: mediaUrl,
        });

      if (insertError) throw insertError;

      toast.success("Post created successfully!");
      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
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
      <Textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        className="min-h-32 mb-4 resize-none"
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {content.length} / {MAX_CHARS}
        </p>
      </div>

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
          disabled={!content.trim() || isUploading}
        >
          {isUploading ? "Posting..." : "Post"}
        </Button>
      </div>
    </Card>
  );
};
