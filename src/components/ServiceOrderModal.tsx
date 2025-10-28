import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2, CheckCircle, XCircle, Briefcase, Clock, Wallet, ChevronRight, ChevronLeft } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Card } from './ui/card';
import { useAuthDialog } from '@/store/authDialogStore';
import { usePhantomConnect } from '@/hooks/usePhantomConnect';
import { Label } from './ui/label';

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

type OrderStep = 'requirements' | 'review' | 'pay' | 'confirmation';

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
  const { publicKey, sendTransaction } = useWallet();
  const { connectPhantomWallet, isConnecting: isWalletConnecting } = usePhantomConnect();
  
  const [currentStep, setCurrentStep] = useState<OrderStep>('requirements');
  const [requirements, setRequirements] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasDbWallet, setHasDbWallet] = useState(false);

  const creatorAmount = price * 0.95;
  const platformFee = price * 0.05;

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

  // Reset to requirements step when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('requirements');
      setRequirements('');
      setPaymentStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleReconnect = async () => {
    const address = await connectPhantomWallet();
    if (address) {
      toast.success('Wallet reconnected!');
    }
  };

  const handlePayment = async () => {
    if (!user) {
      openAuthDialog();
      return;
    }

    // If wallet not connected, connect it first
    if (!publicKey) {
      const address = await connectPhantomWallet();
      if (!address) {
        return; // User cancelled or error occurred
      }
      // Wait a moment for publicKey to update
      await new Promise(resolve => setTimeout(resolve, 1000));
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
          requirements: requirements || undefined,
        },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || 'Payment verification failed');
      }

      setPaymentStatus('success');
      setCurrentStep('confirmation');
      toast.success('Service ordered successfully!');
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);
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
      setCurrentStep('requirements');
      setRequirements('');
      setPaymentStatus('idle');
      setErrorMessage('');
      onClose();
    }
  };

  const canProceedToReview = requirements.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Order Service from {creatorName}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'requirements' && 'Step 1: Describe your requirements'}
            {currentStep === 'review' && 'Step 2: Review your order'}
            {currentStep === 'pay' && 'Step 3: Complete payment'}
            {currentStep === 'confirmation' && 'Order confirmed!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Requirements */}
          {currentStep === 'requirements' && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <p className="font-medium">Service: {serviceDescription}</p>
                  {deliveryTime && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Delivery: {deliveryTime}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-primary">
                    Price: {price} SOL
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="requirements">Project Requirements *</Label>
                <Textarea
                  id="requirements"
                  placeholder="Describe what you need... Include any specific details, preferences, or files you'll provide."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Be as detailed as possible to help the seller understand your needs
                </p>
              </div>

              <Button 
                onClick={() => setCurrentStep('review')}
                disabled={!canProceedToReview || !user}
                className="w-full"
              >
                {!user ? 'Sign in to continue' : 'Continue to Review'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>

              {!user && (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Please <button onClick={() => openAuthDialog()} className="underline">sign in</button> to order this service.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/50 space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service</p>
                  <p className="font-medium">{serviceDescription}</p>
                </div>
                
                {deliveryTime && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Delivery Time</p>
                    <p className="font-medium">{deliveryTime}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Requirements</p>
                  <p className="text-sm whitespace-pre-wrap">{requirements}</p>
                </div>
              </Card>

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

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('requirements')}
                  className="flex-1"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep('pay')}
                  className="flex-1"
                >
                  Continue to Payment
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Pay */}
          {currentStep === 'pay' && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">{price} SOL</span>
                </div>
              </Card>

              {/* Wallet Status */}
              {!publicKey && (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      {hasDbWallet 
                        ? 'Reconnect your wallet to complete payment'
                        : 'Connect your Phantom wallet to pay'}
                    </span>
                    <Button 
                      size="sm" 
                      onClick={handleReconnect}
                      disabled={isWalletConnecting}
                      className="ml-2"
                    >
                      {isWalletConnecting ? 'Connecting...' : hasDbWallet ? 'Reconnect' : 'Connect'}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {publicKey && (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-500">
                    Wallet connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Status Messages */}
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

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('review')}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handlePayment}
                  disabled={!publicKey || isProcessing || hasAccess}
                  className="flex-1"
                >
                  {hasAccess ? (
                    'Already Purchased'
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay ${price} SOL`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 'confirmation' && (
            <div className="space-y-4 text-center py-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-500/10 p-3">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Order Placed Successfully!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {creatorName} will start working on your order. You'll receive a notification when it's ready.
                </p>
                <p className="text-sm text-muted-foreground">
                  Check your order messages to communicate with the seller.
                </p>
              </div>

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
