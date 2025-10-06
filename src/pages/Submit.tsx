import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, DollarSign, Users, Clock, Key, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShortVideoUpload } from '@/components/ShortVideoUpload';
import { WutchVideoUpload } from '@/components/WutchVideoUpload';
import { validatePromotionalLink, sanitizeUrl } from '@/utils/urlValidation';
import ScheduleStreamPicker from '@/components/ScheduleStreamPicker';
import GuestPromptDialog from '@/components/GuestPromptDialog';

const STREAM_CATEGORIES = [
  "Gaming",
  "Trading",
  "NFTs",
  "DeFi",
  "Meme Coins",
  "Education",
  "Music",
  "Art & Design",
  "Technology",
  "Just Chatting",
  "Other",
] as const;

const Submit = () => {
  useEffect(() => {
    document.title = 'Submit Your Stream | Wutch';
  }, []);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isGuest } = useAuth();
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  
  const [formData, setFormData] = useState({
    streamUrl: '',
    title: '',
    description: '',
    category: '',
    tags: '',
    promotional_link: '',
    promotional_link_text: '',
    walletAddress: '',
    tosAccepted: false,
    // Bounty fields
    createBounty: false,
    bountyWalletAddress: 'FFkRbqaArL1BVrUvAptPEg8kwTMu3WPLW37U2i8KieQn',
    rewardPerPerson: '',
    participantLimit: '',
    secretWord: '',
    minWatchTimeMinutes: '10',
    // Schedule fields
    scheduleForLater: false,
  });

  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('12:00');

  // Calculate bounty summary in SOL
  const calculateTotalBounty = () => {
    const reward = parseFloat(formData.rewardPerPerson) || 0;
    const participants = parseInt(formData.participantLimit) || 0;
    const subtotal = reward * participants;
    const fee = subtotal * 0.05; // 5% fee
    const total = subtotal + fee;
    return { subtotal, fee, total };
  };

  const bountyCalc = calculateTotalBounty();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit a stream',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (!formData.tosAccepted) {
      toast({
        title: 'Terms Required',
        description: 'Please accept the terms of service',
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

    if (formData.createBounty) {
      if (!formData.rewardPerPerson || !formData.participantLimit || !formData.secretWord) {
        toast({
          title: 'Bounty Information Required',
          description: 'Please fill in all bounty fields',
          variant: 'destructive',
        });
        return;
      }

      const reward = parseFloat(formData.rewardPerPerson);
      const participants = parseInt(formData.participantLimit);
      
      if (reward < 0 || participants <= 0) {
        toast({
          title: 'Invalid Bounty Values',
          description: 'Reward must be 0 or greater and participant limit must be greater than 0',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Validate scheduled time if scheduling
      let startedAt = null;
      let streamStatus: 'pending' | 'live' = 'live';
      let isLive = true;

      if (formData.scheduleForLater) {
        if (!scheduleDate || !scheduleTime) {
          toast({
            title: 'Schedule Date/Time Required',
            description: 'Please select both date and time for scheduled stream',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        // Combine date and time
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const scheduledDateTime = new Date(scheduleDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        // Check if scheduled time is in the future
        if (scheduledDateTime <= new Date()) {
          toast({
            title: 'Invalid Schedule Time',
            description: 'Scheduled time must be in the future',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        startedAt = scheduledDateTime.toISOString();
        streamStatus = 'pending';
        isLive = false;
      }

      // Process bounty payment FIRST if bounty is enabled
      let bountyTransactionSignature = null;
      
      if (formData.createBounty) {
        // Fetch user's wallet address
        const { data: walletData, error: walletError } = await supabase
          .from('profile_wallets')
          .select('wallet_address')
          .eq('user_id', user.id)
          .maybeSingle();

        if (walletError || !walletData?.wallet_address) {
          throw new Error('Please connect your wallet in your profile before creating a bounty');
        }

        // Charge the wallet for bounty + platform fee
        toast({
          title: 'Preparing Payment',
          description: 'Please approve the transaction in your wallet...',
        });

        const { data: chargeData, error: chargeError } = await supabase.functions.invoke(
          'charge-bounty-wallet',
          {
            body: {
              amount: bountyCalc.total,
              fromWalletAddress: walletData.wallet_address,
              toWalletAddress: formData.bountyWalletAddress,
            },
          }
        );

        if (chargeError || !chargeData?.success) {
          throw new Error(chargeData?.error || 'Failed to process bounty payment');
        }

        // Get Phantom wallet to sign the transaction
        const { solana } = window as any;
        if (!solana?.isPhantom) {
          throw new Error('Please install Phantom wallet to create a bounty');
        }

        try {
          // Import web3 dynamically to avoid bundling issues
          const { Transaction, Connection, clusterApiUrl } = await import('@solana/web3.js');
          
          // Decode and sign the transaction
          const transactionBuffer = Uint8Array.from(
            atob(chargeData.transaction),
            c => c.charCodeAt(0)
          );
          const transaction = Transaction.from(transactionBuffer);
          
          const signed = await solana.signTransaction(transaction);
          
          // Send the signed transaction
          const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
          
          const signature = await connection.sendRawTransaction(signed.serialize());
          await connection.confirmTransaction(signature, 'confirmed');

          console.log('Bounty payment successful:', signature);
          bountyTransactionSignature = signature;

        } catch (walletError) {
          console.error('Wallet transaction error:', walletError);
          throw new Error('Payment was cancelled or failed. Please try again.');
        }
      }

      // Upload thumbnail if selected
      let thumbnailUrl = null;
      if (thumbnailFile && user) {
        const fileExt = thumbnailFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

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

      // Create the livestream AFTER successful payment
      const { data: livestreamData, error: livestreamError } = await supabase
        .from('livestreams')
        .insert({
          user_id: user.id,
          pump_fun_url: formData.streamUrl,
          title: formData.title,
          description: formData.description,
          thumbnail_url: thumbnailUrl,
          category: formData.category,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          promotional_link: formData.promotional_link ? sanitizeUrl(formData.promotional_link) : null,
          promotional_link_text: formData.promotional_link_text || null,
          status: streamStatus,
          is_live: isLive,
          started_at: startedAt,
        })
        .select()
        .single();

      if (livestreamError) throw livestreamError;

      // Create bounty record if payment was successful
      if (formData.createBounty && livestreamData && bountyTransactionSignature) {
        const { data: bountyData, error: bountyError } = await supabase
          .from('stream_bounties')
          .insert({
            livestream_id: livestreamData.id,
            creator_id: user.id,
            total_deposit: bountyCalc.total,
            reward_per_participant: parseFloat(formData.rewardPerPerson),
            participant_limit: parseInt(formData.participantLimit),
            secret_word: formData.secretWord,
            platform_fee_amount: bountyCalc.fee,
            is_active: true,
          })
          .select()
          .single();

        if (bountyError) throw bountyError;

        // Add platform fee to revenue pool
        if (bountyData) {
          await supabase.rpc('add_to_revenue_pool', {
            p_amount: bountyCalc.fee,
            p_fee_source: 'bounty',
            p_source_id: bountyData.id,
          });
        }
      }

      toast({
        title: 'Stream Submitted!',
        description: formData.createBounty 
          ? `Your stream and bounty (${bountyCalc.total.toFixed(3)} SOL total) have been created.`
          : 'Your stream has been submitted successfully.',
      });

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      console.error('Error submitting stream:', error);
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit stream. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      {isGuest && (
        <Card className="max-w-3xl mx-auto mb-6 p-6 border-destructive bg-destructive/10">
          <p className="text-center">
            You need to sign up to submit content.{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto" 
              onClick={() => setShowGuestDialog(true)}
            >
              Sign up now
            </Button>
          </p>
        </Card>
      )}
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submit Content</h1>
          <p className="text-muted-foreground">
            Share your livestream or short video with the community
          </p>
        </div>

        <Tabs defaultValue="livestream" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="livestream">Submit Stream</TabsTrigger>
            <TabsTrigger value="video">Upload Video</TabsTrigger>
            <TabsTrigger value="short">Upload Short</TabsTrigger>
          </TabsList>

          <TabsContent value="livestream">
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset disabled={isGuest} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="streamUrl">
                Pump.fun Stream URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="streamUrl"
                type="url"
                placeholder="https://pump.fun/stream/..."
                required
                value={formData.streamUrl}
                onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Stream Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Give your stream an engaging title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what viewers can expect from your stream"
                rows={4}
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {STREAM_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Solana, Meme Coins, Live Trading"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail</Label>
              
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

              <Input
                type="file"
                id="thumbnail-upload"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="hidden"
              />
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => document.getElementById("thumbnail-upload")?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {thumbnailPreview ? "Click to change thumbnail" : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 5MB (16:9 recommended)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">
                Solana Wallet Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="walletAddress"
                placeholder="Your Solana wallet address for donations"
                required
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                This address will receive donations from viewers
              </p>
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
                Add an affiliate or promotional link for viewers to check out. Must be HTTPS.
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
                Customize the button text viewers see (max 50 characters)
              </p>
            </div>

            {/* Schedule Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <Label htmlFor="scheduleForLater" className="font-semibold cursor-pointer">
                    Schedule for Later
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Schedule your stream to appear in "Upcoming" section
                  </p>
                </div>
                <Switch
                  id="scheduleForLater"
                  checked={formData.scheduleForLater}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, scheduleForLater: checked })
                  }
                />
              </div>

              {formData.scheduleForLater && (
                <Card className="p-4 bg-muted/50">
                  <ScheduleStreamPicker
                    date={scheduleDate}
                    onDateChange={setScheduleDate}
                    time={scheduleTime}
                    onTimeChange={setScheduleTime}
                  />
                </Card>
              )}
            </div>

            {/* Bounty Section */}
            <div className="border-t pt-6">
              <div className="flex items-start space-x-2 mb-4">
                <Checkbox
                  id="createBounty"
                  checked={formData.createBounty}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, createBounty: checked as boolean })
                  }
                />
                <div>
                  <Label htmlFor="createBounty" className="font-semibold cursor-pointer">
                    Create Viewer Bounty (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reward viewers who watch your stream for a minimum duration in SOL
                  </p>
                </div>
              </div>

              {formData.createBounty && (
                <Card className="p-4 space-y-4 bg-muted/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rewardPerPerson" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Reward per Person (SOL)
                      </Label>
                      <Input
                        id="rewardPerPerson"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0.05"
                        value={formData.rewardPerPerson}
                        onChange={(e) => setFormData({ ...formData, rewardPerPerson: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="participantLimit" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Number of Slots
                      </Label>
                      <Input
                        id="participantLimit"
                        type="number"
                        min="1"
                        placeholder="50"
                        value={formData.participantLimit}
                        onChange={(e) => setFormData({ ...formData, participantLimit: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minWatchTime" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Min Watch Time (minutes)
                      </Label>
                      <Input
                        id="minWatchTime"
                        type="number"
                        min="1"
                        value={formData.minWatchTimeMinutes}
                        onChange={(e) => setFormData({ ...formData, minWatchTimeMinutes: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secretWord" className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Secret Word
                      </Label>
                      <Input
                        id="secretWord"
                        placeholder="Word to verify viewers"
                        value={formData.secretWord}
                        onChange={(e) => setFormData({ ...formData, secretWord: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Reveal this word during your stream for viewers to claim the bounty
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bountyWallet">Bounty Deposit Wallet</Label>
                    <Input
                      id="bountyWallet"
                      value={formData.bountyWalletAddress}
                      onChange={(e) => setFormData({ ...formData, bountyWalletAddress: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>

                  {formData.rewardPerPerson && formData.participantLimit && (
                    <div className="bg-background rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold">Bounty Summary</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{bountyCalc.subtotal.toFixed(3)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform Fee (5%):</span>
                          <span>{bountyCalc.fee.toFixed(3)} SOL</span>
                        </div>
                        <div className="flex justify-between font-semibold text-base pt-2 border-t">
                          <span>Total Deposit Required:</span>
                          <span className="text-primary">{bountyCalc.total.toFixed(3)} SOL</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formData.rewardPerPerson} SOL × {formData.participantLimit} people + 5% fee
                      </p>
                    </div>
                  )}
                </Card>
              )}
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="tos"
                checked={formData.tosAccepted}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, tosAccepted: checked as boolean })
                }
              />
              <Label htmlFor="tos" className="text-sm font-normal cursor-pointer">
                I accept the terms of service and confirm that I have the rights to stream
                this content
              </Label>
            </div>

            <div className="flex gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate(-1)} 
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Stream'}
              </Button>
            </div>
            </fieldset>
          </form>
        </Card>
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            <WutchVideoUpload />
          </TabsContent>

          <TabsContent value="video">
            <Card className="p-6">
              <WutchVideoUpload />
            </Card>
          </TabsContent>

          <TabsContent value="short">
            <ShortVideoUpload />
          </TabsContent>
        </Tabs>
      </div>

      <GuestPromptDialog
        open={showGuestDialog}
        onOpenChange={setShowGuestDialog}
        action="submit"
      />
    </div>
  );
};

export default Submit;
