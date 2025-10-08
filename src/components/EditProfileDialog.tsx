import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Upload, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { validatePromotionalLink, sanitizeUrl } from '@/utils/urlValidation';
import { WalletManagement } from '@/components/WalletManagement';
import { Separator } from '@/components/ui/separator';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface EditProfileDialogProps {
  profile: Profile;
  onProfileUpdate: (updatedProfile: Profile) => void;
}

export function EditProfileDialog({ profile, onProfileUpdate }: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile.avatar_url || '');
  const [bannerPreview, setBannerPreview] = useState<string>(profile.banner_url || '');
  const { toast } = useToast();

  const socialLinks = (profile.social_links as { twitter?: string; discord?: string; website?: string }) || {};

  const [formData, setFormData] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    promotional_link: profile.promotional_link || '',
    promotional_link_text: profile.promotional_link_text || '',
    twitter: socialLinks.twitter || '',
    discord: socialLinks.discord || '',
    website: socialLinks.website || '',
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate promotional link
    const promoLinkValidation = validatePromotionalLink(formData.promotional_link);
    if (!promoLinkValidation.isValid) {
      toast({
        title: 'Invalid Promotional Link',
        description: promoLinkValidation.error,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      let avatarUrl = profile.avatar_url;
      let bannerUrl = profile.banner_url;

      // Upload avatar if selected
      if (avatarFile) {
        const uploadedUrl = await uploadFile(avatarFile, 'avatars');
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        } else {
          throw new Error('Failed to upload avatar');
        }
      }

      // Upload banner if selected
      if (bannerFile) {
        const uploadedUrl = await uploadFile(bannerFile, 'banners');
        if (uploadedUrl) {
          bannerUrl = uploadedUrl;
        } else {
          throw new Error('Failed to upload banner');
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name || null,
          bio: formData.bio || null,
          promotional_link: sanitizeUrl(formData.promotional_link) || null,
          promotional_link_text: formData.promotional_link_text || null,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          social_links: {
            twitter: formData.twitter || undefined,
            discord: formData.discord || undefined,
            website: formData.website || undefined,
          },
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });

      onProfileUpdate(data);
      setOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="text-lg sm:text-xl">Edit Profile</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update your profile information. Changes will be visible to everyone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Your display name"
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="bio" className="text-sm">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself"
                rows={2}
                maxLength={500}
                className="text-sm"
              />
            </div>

            <div>
              <Label htmlFor="promotional_link" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Promotional Link (Optional)
              </Label>
              <Input
                id="promotional_link"
                type="url"
                value={formData.promotional_link}
                onChange={(e) => setFormData({ ...formData, promotional_link: e.target.value })}
                placeholder="https://your-affiliate-link.com"
                maxLength={500}
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Add an affiliate or promotional link (e.g., product, service, etc.). Must be HTTPS.
              </p>
            </div>

            <div>
              <Label htmlFor="promotional_link_text">
                Promotional Link Button Text (Optional)
              </Label>
              <Input
                id="promotional_link_text"
                value={formData.promotional_link_text || ''}
                onChange={(e) => setFormData({ ...formData, promotional_link_text: e.target.value })}
                placeholder="Check this out!"
                maxLength={50}
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Customize what viewers see on your promotional link button (max 50 characters)
              </p>
            </div>

            <div>
              <Label htmlFor="avatar" className="text-sm">Avatar Image</Label>
              <div className="space-y-2">
                {avatarPreview && (
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border">
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 touch-manipulation"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview('');
                      }}
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild className="touch-manipulation">
                      <span>
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="text-xs sm:text-sm">Upload Avatar</span>
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="banner" className="text-sm">Banner Image</Label>
              <div className="space-y-2">
                {bannerPreview && (
                  <div className="relative w-full h-24 sm:h-32 rounded-lg overflow-hidden border">
                    <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 sm:top-2 right-1 sm:right-2 h-6 w-6 touch-manipulation"
                      onClick={() => {
                        setBannerFile(null);
                        setBannerPreview('');
                      }}
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="banner"
                    type="file"
                    accept="image/*"
                    onChange={handleBannerChange}
                    className="hidden"
                  />
                  <Label htmlFor="banner" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild className="touch-manipulation">
                      <span>
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="text-xs sm:text-sm">Upload Banner</span>
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>
            </div>


            <Separator className="my-4 sm:my-6" />

            <div>
              <h3 className="font-semibold mb-3 text-base sm:text-lg">Wallet Management</h3>
              <WalletManagement />
            </div>

            <Separator className="my-4 sm:my-6" />

            <div>
              <h3 className="font-semibold mb-3 text-base sm:text-lg">Social Links</h3>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="twitter">Twitter</Label>
                  <Input
                    id="twitter"
                    type="url"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    placeholder="https://twitter.com/username"
                  />
                </div>

                <div>
                  <Label htmlFor="discord">Discord</Label>
                  <Input
                    id="discord"
                    value={formData.discord}
                    onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                    placeholder="username#1234 or discord.gg/invite"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto touch-manipulation">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto touch-manipulation">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
