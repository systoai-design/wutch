import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Upload, X, ExternalLink, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { validatePromotionalLink, sanitizeUrl } from "@/utils/urlValidation";
import { CATEGORY_NAMES } from "@/constants/categories";
import { Switch } from "@/components/ui/switch";

type Livestream = Database['public']['Tables']['livestreams']['Row'];

const streamSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  tags: z.string().max(200).optional(),
  promotional_link: z.string().max(500).optional(),
  promotional_link_text: z.string().max(50).optional(),
  is_premium: z.boolean().optional(),
  x402_price: z.number().min(0.001).max(100).optional(),
});

type StreamFormData = z.infer<typeof streamSchema>;

interface EditStreamDialogProps {
  stream: Livestream;
  onUpdate: () => void;
}

export function EditStreamDialog({ stream, onUpdate }: EditStreamDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(stream.thumbnail_url || "");

  const form = useForm<StreamFormData>({
    resolver: zodResolver(streamSchema),
    defaultValues: {
      title: stream.title,
      description: stream.description || "",
      category: stream.category || "",
      tags: Array.isArray(stream.tags) ? stream.tags.join(", ") : "",
      promotional_link: stream.promotional_link || "",
      promotional_link_text: stream.promotional_link_text || "",
      is_premium: stream.is_premium || false,
      x402_price: stream.x402_price || 0.001,
    },
  });

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setThumbnailFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview("");
  };

  const onSubmit = async (data: StreamFormData) => {
    // Validate promotional link
    if (data.promotional_link) {
      const promoLinkValidation = validatePromotionalLink(data.promotional_link);
      if (!promoLinkValidation.isValid) {
        toast({
          title: "Invalid Promotional Link",
          description: promoLinkValidation.error,
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsLoading(true);
    try {
      let thumbnailUrl = stream.thumbnail_url;

      // Upload thumbnail if a new file was selected
      if (thumbnailFile && user) {
        const fileExt = thumbnailFile.name.split(".").pop();
        const fileName = `${user.id}/${stream.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError, data: uploadData } = await supabase.storage
          .from("banners")
          .upload(fileName, thumbnailFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("banners")
          .getPublicUrl(fileName);

        thumbnailUrl = publicUrl;
      }

      const tags = data.tags
        ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from("livestreams")
        .update({
          title: data.title,
          description: data.description || null,
          thumbnail_url: thumbnailUrl,
          category: data.category || null,
          tags,
          promotional_link: data.promotional_link ? sanitizeUrl(data.promotional_link) : null,
          promotional_link_text: data.promotional_link_text || null,
          is_premium: data.is_premium || false,
          x402_price: data.is_premium ? data.x402_price : null,
          x402_asset: 'SOL',
          x402_network: 'solana',
          updated_at: new Date().toISOString(),
        })
        .eq("id", stream.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stream information updated successfully",
      });

      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating stream:", error);
      toast({
        title: "Error",
        description: "Failed to update stream information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Stream
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Stream Information</DialogTitle>
          <DialogDescription>
            Update your stream details. The pump.fun link cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Stream title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Stream description"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Thumbnail</FormLabel>
              
              {thumbnailPreview && (
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveThumbnail}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="hidden"
                  id="thumbnail-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("thumbnail-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {thumbnailPreview ? "Change Thumbnail" : "Upload Thumbnail"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: 16:9 aspect ratio, max 5MB
              </p>
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover z-50">
                      {CATEGORY_NAMES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma-separated)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="tag1, tag2, tag3"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promotional_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Promotional Link (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://your-affiliate-link.com"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Add an affiliate or promotional link. Must be HTTPS.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promotional_link_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Promotional Link Button Text (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Check this out!"
                      maxLength={50}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Customize the button text (max 50 characters)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Premium Content Section */}
            <div className="space-y-4 border-t pt-4">
              <FormField
                control={form.control}
                name="is_premium"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2 text-base">
                        <Lock className="h-4 w-4 text-purple-600" />
                        Premium Content (x402)
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Charge viewers to access. You keep 95%.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("is_premium") && (
                <FormField
                  control={form.control}
                  name="x402_price"
                  render={({ field }) => (
                    <FormItem className="pl-6 border-l-2 border-purple-600/20">
                      <FormLabel>Price (SOL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          max="100"
                          placeholder="0.001"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.001)}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Min: 0.001 SOL • You receive: {((field.value || 0.001) * 0.95).toFixed(4)} SOL (95%)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
