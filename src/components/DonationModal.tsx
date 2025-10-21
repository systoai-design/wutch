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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { donationSchema } from '@/utils/donationValidation';
import { z } from 'zod';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamerName: string;
  walletAddress: string;
  contentId: string;
  contentType: 'livestream' | 'shortvideo';
  recipientUserId: string;
}

const presetAmounts = [0.1, 0.5, 1, 5, 10];

const DonationModal = ({ isOpen, onClose, streamerName, walletAddress, contentId, contentType, recipientUserId }: DonationModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDonate = async () => {
    const amount = selectedAmount || parseFloat(customAmount);

    // Input validation using Zod schema
    try {
      donationSchema.parse({
        amount,
        walletAddress,
        contentId,
        contentType,
        recipientUserId,
        message: null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: 'Validation Error',
          description: firstError.message,
          variant: 'destructive',
        });
        return;
      }
    }

    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to send donations',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Check if Phantom wallet is available
      const solana = (window as any).solana;
      if (!solana || !solana.isPhantom) {
        throw new Error('Phantom wallet not found. Please install it from phantom.app');
      }

      // Connect wallet if not connected
      if (!solana.isConnected) {
        await solana.connect();
      }

      // Calculate 95% to creator, 5% to platform
      const creatorAmount = amount * 0.95;
      const platformFee = amount * 0.05;
      const ESCROW_WALLET = 'DzrB51hp4RoR8ctsbKeuyJHe4KXr24cGewyTucBZezrF';

      toast({
        title: 'Processing Donation',
        description: `Sending ${creatorAmount.toFixed(4)} SOL to ${streamerName} (${platformFee.toFixed(4)} SOL platform fee). Please approve in your wallet.`,
      });

      // Import Solana web3 dynamically
      const { Transaction, SystemProgram, Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

      // Create connection
      const connection = new Connection(
        'https://mainnet.helius-rpc.com/?api-key=a181d89a-54f8-4a83-a857-a760d595180f',
        'confirmed'
      );

      // Create transaction with TWO transfers: 95% to creator, 5% to platform
      const transaction = new Transaction()
        .add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(solana.publicKey.toString()),
            toPubkey: new PublicKey(walletAddress),
            lamports: Math.floor(creatorAmount * LAMPORTS_PER_SOL),
          })
        )
        .add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(solana.publicKey.toString()),
            toPubkey: new PublicKey(ESCROW_WALLET),
            lamports: Math.floor(platformFee * LAMPORTS_PER_SOL),
          })
        );

      transaction.feePayer = solana.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign and send transaction
      const signed = await solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      // Record donation in database (full amount)
      const { data: donationData, error: donationError } = await supabase
        .from('donations')
        .insert({
          content_type: contentType,
          content_id: contentId,
          recipient_user_id: recipientUserId,
          amount: amount,
          donor_wallet_address: solana.publicKey.toString(),
          transaction_signature: signature,
          status: 'confirmed',
          message: null,
        })
        .select()
        .single();

      if (donationError) throw donationError;

      // Record platform fee
      await supabase.from('platform_fees').insert({
        donation_id: donationData.id,
        fee_amount: platformFee,
        transaction_signature: signature,
      });

      // Update creator's total donations received (95% only)
      const { error: updateError } = await supabase.rpc('increment_user_donations', {
        user_id: recipientUserId,
        donation_amount: creatorAmount,
      });

      if (updateError) console.error('Error updating user donations:', updateError);

      // Update content's total donations (95% only)
      const tableName = contentType === 'livestream' ? 'livestreams' : 'short_videos';
      const { data: contentData } = await supabase
        .from(tableName)
        .select('total_donations')
        .eq('id', contentId)
        .single();

      if (contentData) {
        const currentTotal = parseFloat(String(contentData.total_donations || 0));
        await supabase
          .from(tableName)
          .update({ total_donations: currentTotal + creatorAmount })
          .eq('id', contentId);
      }

      toast({
        title: 'Thank You!',
        description: `${creatorAmount.toFixed(4)} SOL sent to ${streamerName} (${platformFee.toFixed(4)} SOL platform fee)`,
      });

      onClose();
    } catch (error: any) {
      console.error('Donation error:', error);
      toast({
        title: 'Donation Failed',
        description: error.message || 'Failed to process donation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
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

          {(selectedAmount || customAmount) && (
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-semibold">{(selectedAmount || parseFloat(customAmount) || 0).toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creator Receives (95%):</span>
                <span className="font-semibold text-primary">{((selectedAmount || parseFloat(customAmount) || 0) * 0.95).toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (5%):</span>
                <span className="text-xs">{((selectedAmount || parseFloat(customAmount) || 0) * 0.05).toFixed(4)} SOL</span>
              </div>
            </div>
          )}

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
            disabled={isProcessing}
            className="flex-1 gap-2"
          >
            <Wallet className="h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Donate with Phantom'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DonationModal;
