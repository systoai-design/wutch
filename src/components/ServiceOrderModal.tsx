import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2, CheckCircle, XCircle, Briefcase, Clock, Wallet } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Card } from './ui/card';
import { useAuthDialog } from '@/store/authDialogStore';

interface ServiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  serviceDescription: string;
  deliveryTime?: string;
  price: number;
  creatorWallet: string;
  creatorName: string;
  onSuccess: () => void;
  hasAccess?: boolean;
}

const PLATFORM_WALLET = '899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G';

export const ServiceOrderModal = ({
  isOpen,
  onClose,
  postId,
  serviceDescription,
  deliveryTime,
  price,
  creatorWallet,
  creatorName,
  onSuccess,
  hasAccess = false,
}: ServiceOrderModalProps) => {
  const { user } = useAuth();
  const { open: openAuthDialog } = useAuthDialog();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connect, connecting } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasDbWallet, setHasDbWallet] = useState(false);

  // Check if user has a wallet saved in database
  useEffect(() => {
    const checkDbWallet = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profile_wallets')
        .select('wallet_address')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setHasDbWallet(!!data?.wallet_address);
    };
    
    checkDbWallet();
  }, [user]);

  const handleReconnect = async () => {
    try {
      await connect();
      toast.success('Wallet reconnected!');
    } catch (error) {
      toast.error('Failed to reconnect wallet');
    }
  };

  const creatorAmount = price * 0.95;
  const platformFee = price * 0.05;

  const handlePayment = async () => {
    if (!user) {
      openAuthDialog();
      return;
    }

    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (hasAccess) {
      toast.info('You have already purchased this service');
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('processing');
    setErrorMessage('');

    try {
      // Create transaction with two transfers: 95% to creator, 5% to platform
      const transaction = new Transaction();

      // Transfer to creator (95%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(creatorWallet),
          lamports: Math.floor(creatorAmount * LAMPORTS_PER_SOL),
        })
      );

      // Transfer to platform (5%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: Math.floor(platformFee * LAMPORTS_PER_SOL),
        })
      );

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);

      // Wait for confirmation
      toast.info('Confirming transaction...');
      await connection.confirmTransaction(signature, 'confirmed');

      // Verify payment via edge function
      const { data, error } = await supabase.functions.invoke('x402-verify-payment', {
        body: {
          transactionSignature: signature,
          contentType: 'community_post',
          contentId: postId,
        },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || 'Payment verification failed');
      }

      setPaymentStatus('success');
      toast.success('Service ordered successfully!');
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentStatus('error');
      setErrorMessage(error.message || 'Payment failed. Please try again.');
      toast.error(error.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setPaymentStatus('idle');
      setErrorMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Order Service
          </DialogTitle>
          <DialogDescription>
            You're ordering a service from {creatorName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Service Details */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <p className="font-medium">I will {serviceDescription}</p>
              {deliveryTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Delivery: {deliveryTime}
                </div>
              )}
            </div>
          </Card>

          {/* Payment Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Price</span>
              <span className="font-medium">{price} SOL</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>To Creator (95%)</span>
              <span>{creatorAmount.toFixed(4)} SOL</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Platform Fee (5%)</span>
              <span>{platformFee.toFixed(4)} SOL</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-primary">{price} SOL</span>
            </div>
          </div>

          {/* Status Messages */}
          {paymentStatus === 'success' && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                <strong>Order Placed!</strong> The seller will start working on your order. You'll receive a notification when it's ready.
              </AlertDescription>
            </Alert>
          )}

          {paymentStatus === 'error' && errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {hasAccess && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                <strong>Already Purchased!</strong> You have already ordered this service.
              </AlertDescription>
            </Alert>
          )}

          {!user && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Please sign in to order this service.
              </AlertDescription>
            </Alert>
          )}

          {!publicKey && user && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {hasDbWallet 
                    ? 'Your wallet needs to be reconnected to complete this order.'
                    : 'Please connect your Phantom wallet to order this service.'}
                </span>
                {hasDbWallet && (
                  <Button 
                    size="sm" 
                    onClick={handleReconnect}
                    disabled={connecting}
                    className="ml-2"
                  >
                    {connecting ? 'Connecting...' : 'Reconnect'}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={!user || !publicKey || isProcessing || paymentStatus === 'success' || hasAccess}
            className="flex-1"
          >
            {hasAccess ? (
              'Already Purchased'
            ) : isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : paymentStatus === 'success' ? (
              'Order Placed'
            ) : (
              `Pay ${price} SOL`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};