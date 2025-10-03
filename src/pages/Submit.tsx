import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';

const Submit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    streamUrl: '',
    title: '',
    description: '',
    category: '',
    tags: '',
    walletAddress: '',
    tosAccepted: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tosAccepted) {
      toast({
        title: 'Terms Required',
        description: 'Please accept the terms of service',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Stream Submitted!',
      description: 'Your stream will be reviewed and published shortly.',
    });

    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Submit Your Stream</h1>
          <p className="text-muted-foreground">
            Share your Pump.fun livestream with the community
          </p>
        </div>

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
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Submit Stream
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Submit;
