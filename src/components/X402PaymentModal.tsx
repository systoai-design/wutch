import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface X402PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'livestream' | 'shortvideo' | 'wutch_video';
  contentId: string;
  contentTitle: string;
  creatorName: string;
  price: number;
  creatorWallet: string;
  onSuccess: () => void;
}

const PLATFORM_WALLET = '899PTTcBgFauWKL2jyjtuJTyWTuQAEBqyY8bPsPvCH1G';

export const X402PaymentModal = ({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentTitle,
  creatorName,
  price,
  creatorWallet,
  onSuccess,
}: X402PaymentModalProps) => {
  const { user } = useAuth();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const creatorAmount = price * 0.95;
  const platformFee = price * 0.05;

  const handlePayment = async () => {
    if (!publicKey || !user) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('processing');
    setErrorMessage('');

    try {
      // Pre-flight balance check
      const balance = await connection.getBalance(publicKey);
      const priceLamports = Math.round(price * LAMPORTS_PER_SOL);
      const creatorLamports = Math.floor(priceLamports * 95 / 100);
      const platformLamports = priceLamports - creatorLamports;
      const feeBuffer = 50000; // ~0.00005 SOL for network fees (increased for 2-instruction tx)
      const requiredLamports = creatorLamports + platformLamports + feeBuffer;

      if (balance < requiredLamports) {
        const requiredSOL = (requiredLamports / LAMPORTS_PER_SOL).toFixed(6);
        const actualSOL = (balance / LAMPORTS_PER_SOL).toFixed(6);
        throw new Error(
          `Insufficient balance. Need ${requiredSOL} SOL (price + network fee), but you have ${actualSOL} SOL`
        );
      }

      // Create transaction with two transfers: 95% to creator, 5% to platform
      const transaction = new Transaction();

      // Transfer to creator (95%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(creatorWallet),
          lamports: creatorLamports,
        })
      );

      // Transfer to platform (5%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: platformLamports,
        })
      );

      // Get latest blockhash for confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Estimate real fee
      const message = transaction.compileMessage();
      const estimatedFeeResponse = await connection.getFeeForMessage(message, 'confirmed');
      const estimatedFee = estimatedFeeResponse.value || feeBuffer;
      
      console.log('[X402Payment] Fee estimation:', {
        estimatedFee: estimatedFee / LAMPORTS_PER_SOL,
        feeBuffer: feeBuffer / LAMPORTS_PER_SOL,
        totalWithFee: (creatorLamports + platformLamports + estimatedFee) / LAMPORTS_PER_SOL
      });

      // Final balance check with real estimated fee
      if (balance < (creatorLamports + platformLamports + estimatedFee)) {
        const needed = ((creatorLamports + platformLamports + estimatedFee) / LAMPORTS_PER_SOL).toFixed(6);
        throw new Error(`Insufficient balance for transaction + fees. You need ${needed} SOL`);
      }

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('[X402Payment] Transaction sent:', signature);
      console.log('[X402Payment] View on Solana Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=mainnet`);

      // Wait for finalized confirmation
      toast.info('Confirming transaction on blockchain...');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'finalized');

      console.log('[X402Payment] Transaction confirmed:', confirmation);

      if (confirmation.value.err) {
        console.error('[X402Payment] Transaction failed on-chain:', confirmation.value.err);
        throw new Error(`Transaction failed on blockchain: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('[X402Payment] Transaction finalized, verifying payment...');

      // Verify payment via edge function with retry logic
      let verifyAttempts = 0;
      let verifySuccess = false;
      let verifyError: any = null;

      while (verifyAttempts < 3 && !verifySuccess) {
        verifyAttempts++;
        
        const { data, error } = await supabase.functions.invoke('x402-verify-payment', {
          body: {
            transactionSignature: signature,
            contentType,
            contentId,
          },
        });

        if (error) {
          verifyError = error;
          // Check if it's a transient "not found" error
          const errorMsg = error.message?.toLowerCase() || '';
          if (errorMsg.includes('not found') || errorMsg.includes('indexing')) {
            if (verifyAttempts < 3) {
              console.log(`Verification attempt ${verifyAttempts} failed, retrying in 1s...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          throw error;
        }

        if (!data?.success) {
          throw new Error('Payment verification failed');
        }

        verifySuccess = true;
      }

      if (!verifySuccess) {
        throw verifyError || new Error('Payment verification failed after retries');
      }

      setPaymentStatus('success');
      toast.success('Payment successful! Access granted.');
      
      // Wait a moment before closing
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('[X402Payment] Payment error:', error);
      setPaymentStatus('error');
      
      // Try to extract detailed error from backend
      let errorMessage = error.message || 'Payment failed. Please try again.';
      
      // If there's a context with JSON error details from the edge function
      if (error.context) {
        try {
          const contextJson = await error.context.json();
          if (contextJson.error) {
            errorMessage = contextJson.error;
            // Include transaction signature if available
            if (contextJson.signature) {
              errorMessage += `\n\nTransaction: ${contextJson.signature}`;
            }
          }
        } catch {
          // Ignore JSON parsing errors
        }
      }
      
      setErrorMessage(errorMessage);
      toast.error('Payment failed: ' + errorMessage.split('\n\n')[0]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Premium Content
          </DialogTitle>
          <DialogDescription>
            Unlock "{contentTitle}" by {creatorName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Breakdown */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Content Price:</span>
              <span className="font-semibold">{price} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Creator receives:</span>
              <span className="text-green-600 font-semibold">{creatorAmount.toFixed(4)} SOL (95%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform fee:</span>
              <span className="text-muted-foreground">{platformFee.toFixed(4)} SOL (5%)</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total:</span>
              <span>{price} SOL</span>
            </div>
          </div>

          {/* Status Messages */}
          {paymentStatus === 'processing' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Processing payment... Please confirm in your wallet and wait for blockchain confirmation.
              </AlertDescription>
            </Alert>
          )}

          {paymentStatus === 'success' && (
            <Alert className="border-green-500 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                Payment successful! Granting access...
              </AlertDescription>
            </Alert>
          )}

          {paymentStatus === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>{errorMessage?.split('\n\n')[0]}</p>
                  {errorMessage?.includes('Transaction:') && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          const sig = errorMessage.split('Transaction: ')[1];
                          navigator.clipboard.writeText(sig);
                          toast.success('Transaction signature copied!');
                        }}
                        className="text-xs underline hover:opacity-80 text-left"
                      >
                        Copy Transaction Signature
                      </button>
                      <a
                        href={`https://explorer.solana.com/tx/${errorMessage.split('Transaction: ')[1]}?cluster=mainnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline hover:opacity-80"
                      >
                        View on Solana Explorer
                      </a>
                    </div>
                  )}
                  <p className="text-xs opacity-80 mt-2">
                    Need help? Contact support with your transaction signature above.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Payment Info */}
          {paymentStatus === 'idle' && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                This is a one-time payment. You'll have permanent access to this content.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={isProcessing || !publicKey || paymentStatus === 'success'}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : paymentStatus === 'success' ? (
                'Success!'
              ) : (
                `Pay ${price} SOL`
              )}
            </Button>
          </div>

          {!publicKey && (
            <p className="text-xs text-center text-muted-foreground">
              Please connect your Phantom wallet to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
