import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2, CheckCircle, XCircle, RefreshCw, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
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
  const { publicKey, sendTransaction, connect, connected, connecting } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Multiple RPC endpoints with priority fallback
  const rpcEndpoints = useMemo(() => {
    const endpoints = [];
    
    // Prioritize authenticated Helius RPC if API key is available
    const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY;
    if (heliusApiKey) {
      endpoints.push(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`);
    }
    
    // Fallback endpoints
    endpoints.push(
      "https://rpc.ankr.com/solana",
      "https://solana.public-rpc.com",
      "https://api.mainnet-beta.solana.com"
    );
    
    return endpoints;
  }, []);

  // Try RPC endpoints in order until one works
  const getConnectionWithFallback = async (): Promise<Connection> => {
    for (const endpoint of rpcEndpoints) {
      try {
        const connection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
        });
        await connection.getLatestBlockhash();
        console.log(`[RPC] Using ${endpoint}`);
        return connection;
      } catch (error) {
        console.warn(`[RPC] ${endpoint} failed:`, error);
      }
    }
    // Fallback to last endpoint even if it failed
    console.warn('[RPC] All endpoints failed, using fallback');
    return new Connection(rpcEndpoints[rpcEndpoints.length - 1], {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  };

  // Check balance with multiple fallbacks including server-side check
  const checkBalance = async () => {
    if (!publicKey) return null;
    
    setIsRefreshingBalance(true);
    try {
      // Try client-side RPC check first
      for (const endpoint of rpcEndpoints) {
        try {
          const connection = new Connection(endpoint, { commitment: 'confirmed' });
          const balanceLamports = await connection.getBalance(publicKey);
          const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;
          
          console.log('[Balance Check] Success via', endpoint, ':', balanceSOL, 'SOL');
          setWalletBalance(balanceSOL);
          return balanceSOL;
        } catch (error) {
          console.warn(`[Balance Check] ${endpoint} failed:`, error);
        }
      }

      // All client RPCs failed, try server-side check as last resort
      console.log('[Balance Check] All client RPCs failed, trying server-side check');
      const { data, error } = await supabase.functions.invoke('solana-balance-check', {
        body: { walletAddress: publicKey.toBase58() }
      });

      if (error) throw error;
      if (data?.balance !== undefined) {
        console.log('[Balance Check] Server-side success:', data.balance, 'SOL');
        setWalletBalance(data.balance);
        return data.balance;
      }

      throw new Error('No balance data from server');
    } catch (error) {
      console.error('[Balance Check] All methods failed:', error);
      setWalletBalance(null);
      return null;
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Check balance when modal opens
  useEffect(() => {
    if (isOpen && publicKey) {
      checkBalance();
    }
  }, [isOpen, publicKey]);

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
      console.log('[Payment] Starting payment process:', {
        timestamp: new Date().toISOString(),
        buyer: publicKey.toBase58(),
        creator: creatorWallet,
        price,
        contentType,
        contentId
      });

      // Get connection with fallback
      const connection = await getConnectionWithFallback();

      // Fresh balance check (non-blocking if RPC fails)
      const currentBalance = await checkBalance();
      const requiredAmount = price + 0.002; // price + larger buffer for fees (increased from 0.0001)

      console.log('[Payment] Balance verification:', {
        current: currentBalance,
        required: requiredAmount,
        rpcAvailable: currentBalance !== null,
        sufficient: currentBalance !== null ? currentBalance >= requiredAmount : 'unknown',
        difference: currentBalance ? (currentBalance - requiredAmount).toFixed(6) : 'N/A'
      });

      // Only block payment if we successfully got balance AND it's insufficient
      if (currentBalance !== null && currentBalance < requiredAmount) {
        throw new Error(
          `Insufficient balance\n\n` +
          `Your balance: ${currentBalance.toFixed(6)} SOL\n` +
          `Required: ${requiredAmount.toFixed(6)} SOL\n` +
          `Need ${(requiredAmount - currentBalance).toFixed(6)} SOL more`
        );
      }

      // If balance check failed (null), show warning but allow proceeding
      if (currentBalance === null) {
        console.warn('[Payment] Balance check unavailable (RPC blocked). Proceeding - wallet will enforce limits.');
        toast.info('Balance check unavailable. Your wallet will confirm if you have enough SOL.');
      }

      // Pre-flight balance check (non-critical - wallet will enforce)
      let balance: number | null = null;
      try {
        balance = await connection.getBalance(publicKey);
        console.log('[Payment] Pre-flight balance check:', balance / LAMPORTS_PER_SOL, 'SOL');
      } catch (error) {
        console.warn('[Payment] Pre-flight balance check failed (non-critical):', error);
      }

      const priceLamports = Math.round(price * LAMPORTS_PER_SOL);
      const creatorLamports = Math.floor(priceLamports * 95 / 100);
      const platformLamports = priceLamports - creatorLamports;
      const feeBuffer = 50000;

      // Helper to create transfer instructions
      const createTransferInstructions = (creatorFirst: boolean): TransactionInstruction[] => {
        const creatorTransfer = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(creatorWallet),
          lamports: creatorLamports,
        });
        const platformTransfer = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: platformLamports,
        });
        return creatorFirst ? [creatorTransfer, platformTransfer] : [platformTransfer, creatorTransfer];
      };

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

      // Try simulation with both instruction orderings
      let instructions = createTransferInstructions(true); // Creator first
      let transaction = new Transaction().add(...instructions);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Simulate transaction
      console.log('[X402Payment] Pre-simulating transaction (creator-first)...');
      const message = transaction.compileMessage();
      let simulationResult = await connection.simulateTransaction(transaction);

      // If simulation failed with InsufficientFundsForRent, try reordering
      if (simulationResult.value.err) {
        const errStr = JSON.stringify(simulationResult.value.err);
        console.warn('[X402Payment] Initial simulation failed:', errStr);

        if (errStr.includes('InsufficientFundsForRent')) {
          console.log('[X402Payment] Trying reordered instructions (platform-first)...');
          toast.info('Optimizing transaction order...');
          
          instructions = createTransferInstructions(false); // Platform first
          transaction = new Transaction().add(...instructions);
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          simulationResult = await connection.simulateTransaction(transaction);
          
          if (!simulationResult.value.err) {
            console.log('[X402Payment] Reordering resolved the issue!');
          }
        }
      }

      // If both orderings failed, fall back to single-transfer
      let useFallback = false;
      if (simulationResult.value.err) {
        const errStr = JSON.stringify(simulationResult.value.err);
        console.warn('[X402Payment] Both orderings failed. Error:', errStr);
        
        if (errStr.includes('InsufficientFundsForRent')) {
          console.log('[X402Payment] Using single-transfer fallback...');
          toast.info('Using alternative payment method for reliability...');
          useFallback = true;

          // Create single transfer to creator with full amount
          transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: new PublicKey(creatorWallet),
              lamports: priceLamports,
            })
          );
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;
        }
      }

      // Estimate fee
      const estimatedFeeResponse = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
      const estimatedFee = estimatedFeeResponse.value || feeBuffer;
      
      console.log('[X402Payment] Fee estimation:', {
        estimatedFee: estimatedFee / LAMPORTS_PER_SOL,
        totalWithFee: ((useFallback ? priceLamports : creatorLamports + platformLamports) + estimatedFee) / LAMPORTS_PER_SOL,
        fallbackMode: useFallback
      });

      // Final balance check
      const totalLamports = (useFallback ? priceLamports : creatorLamports + platformLamports) + estimatedFee;
      if (balance !== null && balance < totalLamports) {
        const needed = (totalLamports / LAMPORTS_PER_SOL).toFixed(6);
        throw new Error(`Insufficient balance for transaction + fees. You need ${needed} SOL`);
      }

      // Send transaction
      console.log(`[X402Payment] Sending transaction (${useFallback ? 'single-transfer fallback' : 'two-transfer'})`);
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
        
        const { data, error } = await supabase.functions.invoke('x402-verify-payment-v2', {
          body: {
            transactionSignature: signature,
            contentType,
            contentId,
            allowSingleTransferFallback: useFallback,
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
          {/* Wallet Balance Display */}
          {publicKey && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Balance</span>
                <div className="flex items-center gap-2">
                  {walletBalance !== null ? (
                    <span className="font-semibold">{walletBalance.toFixed(6)} SOL</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Balance check unavailable (RPC blocked)</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={checkBalance}
                    disabled={isRefreshingBalance}
                    className="h-7 w-7 p-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              {walletBalance === null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your wallet will confirm if you have enough SOL to proceed with payment.
                </p>
              )}
            </div>
          )}

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
            {!publicKey ? (
              <Button
                onClick={connect}
                disabled={connecting}
                className="flex-1"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Phantom
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handlePayment}
                disabled={isProcessing || paymentStatus === 'success'}
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
            )}
          </div>

          {!publicKey && (
            <p className="text-xs text-center text-muted-foreground">
              Connect your wallet to unlock this premium content
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
