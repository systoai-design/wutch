import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, DollarSign, Users, Clock, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShortVideoUpload } from '@/components/ShortVideoUpload';

const Submit = () => {
  useEffect(() => {
    document.title = 'Submit Your Stream | Wutch';
  }, []);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    streamUrl: '',
    title: '',
    description: '',
    category: '',
    tags: '',
    walletAddress: '',
    tosAccepted: false,
    // Bounty fields
    createBounty: false,
    bountyWalletAddress: 'FFkRbqaArL1BVrUvAptPEg8kwTMu3WPLW37U2i8KieQn',
    rewardPerPerson: '',
    participantLimit: '',
    secretWord: '',
    minWatchTimeMinutes: '10',
  });

  const calculateTotalBounty = () => {
    const reward = parseFloat(formData.rewardPerPerson) || 0;
    const participants = parseInt(formData.participantLimit) || 0;
    const subtotal = reward * participants;
    const fee = subtotal * 0.05; // 5% fee
    const total = subtotal + fee;
    return { subtotal, fee, total };
  };

  const bountyCalc = calculateTotalBounty();

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
      
      if (reward <= 0 || participants <= 0) {
        toast({
          title: 'Invalid Bounty Values',
          description: 'Reward and participant limit must be greater than 0',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Create the livestream
      const { data: livestreamData, error: livestreamError } = await supabase
        .from('livestreams')
        .insert({
          user_id: user.id,
          pump_fun_url: formData.streamUrl,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          status: 'live',
          is_live: true,
        })
        .select()
        .single();

      if (livestreamError) throw livestreamError;

      // Create bounty if requested
      if (formData.createBounty && livestreamData) {
        const { error: bountyError } = await supabase
          .from('stream_bounties')
          .insert({
            livestream_id: livestreamData.id,
            creator_id: user.id,
            total_deposit: bountyCalc.total,
            reward_per_participant: parseFloat(formData.rewardPerPerson),
            participant_limit: parseInt(formData.participantLimit),
            secret_word: formData.secretWord,
            is_active: true,
          });

        if (bountyError) throw bountyError;
      }

      toast({
        title: 'Stream Submitted!',
        description: formData.createBounty 
          ? `Your stream and bounty (${bountyCalc.total.toFixed(2)} USD total) have been created.`
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submit Content</h1>
          <p className="text-muted-foreground">
            Share your livestream or short video with the community
          </p>
        </div>

        <Tabs defaultValue="livestream" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="livestream">Submit Livestream</TabsTrigger>
            <TabsTrigger value="short">Upload Short Video</TabsTrigger>
          </TabsList>

          <TabsContent value="livestream">
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
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
                <Input
                  id="category"
                  placeholder="e.g., Trading, NFTs, DeFi"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
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
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 10MB
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
                    Reward viewers who watch your stream for a minimum duration
                  </p>
                </div>
              </div>

              {formData.createBounty && (
                <Card className="p-4 space-y-4 bg-muted/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rewardPerPerson" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Reward per Person (USD)
                      </Label>
                      <Input
                        id="rewardPerPerson"
                        type="number"
                        step="0.01"
                        min="0.01"
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
                          <span>${bountyCalc.subtotal.toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform Fee (5%):</span>
                          <span>${bountyCalc.fee.toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between font-semibold text-base pt-2 border-t">
                          <span>Total Deposit Required:</span>
                          <span className="text-primary">${bountyCalc.total.toFixed(2)} USD</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formData.rewardPerPerson} USD × {formData.participantLimit} people + 5% fee
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
          </form>
        </Card>
          </TabsContent>

          <TabsContent value="short">
            <ShortVideoUpload />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Submit;
