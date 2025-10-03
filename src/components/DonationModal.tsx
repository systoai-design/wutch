import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamerName: string;
  walletAddress: string;
}

const presetAmounts = [0.1, 0.5, 1, 5, 10];

const DonationModal = ({ isOpen, onClose, streamerName, walletAddress }: DonationModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const { toast } = useToast();

  const handleDonate = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid donation amount',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Donation Initiated',
      description: `Sending ${amount} SOL to ${streamerName}. Please approve in your wallet.`,
    });

    // In a real app, this would trigger the Phantom wallet
    setTimeout(() => {
      toast({
        title: 'Thank You!',
        description: `Your donation of ${amount} SOL was successful!`,
      });
      onClose();
    }, 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Support {streamerName}</DialogTitle>
          <DialogDescription>
            Send a donation directly to their Solana wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Quick Amount (SOL)</Label>
            <div className="grid grid-cols-5 gap-2">
              {presetAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                >
                  {amount}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-amount">Custom Amount (SOL)</Label>
            <Input
              id="custom-amount"
              type="number"
              step="0.1"
              min="0"
              placeholder="Enter custom amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="p-3 bg-muted rounded-lg text-xs font-mono break-all">
              {walletAddress}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="donation"
            onClick={handleDonate}
            className="flex-1 gap-2"
          >
            <Wallet className="h-4 w-4" />
            Donate with Phantom
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DonationModal;
