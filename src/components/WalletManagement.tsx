import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Copy, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

export const WalletManagement = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [firstConnectedAt, setFirstConnectedAt] = useState<string | null>(null);
  const [showDisconnectWarning, setShowDisconnectWarning] = useState(false);
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  useEffect(() => {
    loadWalletData();
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profile_wallets')
        .select('wallet_address, first_connected_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWalletAddress(data.wallet_address);
        setFirstConnectedAt(data.first_connected_at);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    }
  };

  const handleCopyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Wallet address copied to clipboard',
    });
  };

  const handleConnectNewWallet = async () => {
    try {
      setIsProcessing(true);
      const { solana } = window as any;

      if (!solana?.isPhantom) {
        toast({
          title: 'Phantom Not Found',
          description: 'Please install Phantom wallet extension to continue.',
          variant: 'destructive',
        });
        return;
      }

      const response = await solana.connect();
      const address = response.publicKey.toString();

      // Check if this wallet is already connected to another account
      const { data: existingWallet, error: checkError } = await supabase
        .from('profile_wallets')
        .select('user_id')
        .eq('wallet_address', address)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing wallet:', checkError);
        throw new Error('Failed to verify wallet availability');
      }

      if (existingWallet && existingWallet.user_id !== user?.id) {
        toast({
          title: 'Wallet Already Connected',
          description: 'This wallet is already connected to another account. Each wallet can only be linked to one account.',
          variant: 'destructive',
        });
        await solana.disconnect();
        return;
      }

      // Upsert wallet (will update if exists, insert if not)
      const { error } = await supabase
        .from('profile_wallets')
        .upsert({
          user_id: user?.id,
          wallet_address: address,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Also disable donations when changing wallet
      await supabase
        .from('profiles')
        .update({ public_wallet_address: null })
        .eq('id', user?.id);

      setWalletAddress(address);
      setShowChangeWarning(false);
      toast({
        title: 'Wallet Connected',
        description: 'Your new wallet has been connected successfully.',
      });
      
      await loadWalletData();
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect wallet. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      setIsProcessing(true);
      const { solana } = window as any;
      await solana?.disconnect();

      if (user) {
        // Remove from profile_wallets
        await supabase
          .from('profile_wallets')
          .delete()
          .eq('user_id', user.id);

        // Remove public wallet address and disable donations
        await supabase
          .from('profiles')
          .update({ public_wallet_address: null })
          .eq('id', user.id);

        // Log out the user
        await signOut();
      }

      setWalletAddress(null);
      setFirstConnectedAt(null);
      setShowDisconnectWarning(false);
      toast({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected and you have been logged out.',
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect wallet. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>No wallet connected.</strong> Connect your Solana wallet to receive donations, claim bounties, and participate in share & earn campaigns.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setShowChangeWarning(true)} className="w-full gap-2" type="button">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
        
        <AlertDialog open={showChangeWarning} onOpenChange={setShowChangeWarning}>
          <AlertDialogContent className="w-[90vw] max-w-[90vw] overflow-x-hidden p-4 sm:p-6 sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connect Your Wallet
              </AlertDialogTitle>
              <AlertDialogDescription>
                You're about to connect your Solana wallet to your Wutch account.
              </AlertDialogDescription>
              <div className="space-y-3 text-left text-sm">
                <div className="space-y-2">
                  <p className="font-semibold">What you'll be able to do:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Receive donations from viewers on your streams and shorts</li>
                    <li>Send donations to support your favorite creators</li>
                    <li>Claim bounty rewards from stream challenges</li>
                    <li>Receive rewards from share & earn campaigns</li>
                  </ul>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-semibold">Important:</p>
                  <ul className="text-sm list-disc pl-5 space-y-1 mt-1">
                    <li>Each wallet can only be connected to ONE Wutch account</li>
                    <li>You cannot connect a wallet that's already linked to another account</li>
                    <li>Your wallet address is stored securely and only visible to you</li>
                  </ul>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing} type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConnectNewWallet} disabled={isProcessing} type="button">
                {isProcessing ? 'Connecting...' : 'Connect Wallet'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connected Wallet</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-green-500" />
            Connected
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 min-w-0">
          <code className="text-sm bg-muted px-3 py-2 rounded flex-1 min-w-0 truncate">
            {walletAddress}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAddress}
            className="gap-2 shrink-0"
            type="button"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {firstConnectedAt && (
          <p className="text-xs text-muted-foreground">
            Connected {formatDistanceToNow(new Date(firstConnectedAt), { addSuffix: true })}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowChangeWarning(true)}
          disabled={isProcessing}
          className="flex-1"
          type="button"
        >
          Change Wallet
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDisconnectWarning(true)}
          disabled={isProcessing}
          className="flex-1"
          type="button"
        >
          Disconnect
        </Button>
      </div>

      {/* Change Wallet Warning */}
      <AlertDialog open={showChangeWarning} onOpenChange={setShowChangeWarning}>
        <AlertDialogContent className="w-[90vw] max-w-[90vw] overflow-x-hidden p-4 sm:p-6 sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Change Wallet Address
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change your connected Solana wallet.
            </AlertDialogDescription>
            <div className="space-y-3 text-left text-sm">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                <p className="font-semibold text-destructive">What happens when you change your wallet:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Your old wallet will be disconnected immediately</li>
                  <li>All donation settings will be automatically disabled</li>
                  <li>You will need to re-enable donations with your new wallet</li>
                  <li>Any pending earnings tied to your old wallet may be lost</li>
                </ul>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-semibold">Important reminders:</p>
                <ul className="text-sm list-disc pl-5 space-y-1 mt-1">
                  <li>Each wallet can only be connected to ONE Wutch account</li>
                  <li>You cannot connect a wallet that's already linked to another account</li>
                  <li>This action cannot be easily undone</li>
                </ul>
              </div>

              <p className="text-sm font-semibold">Are you sure you want to continue?</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing} type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConnectNewWallet} disabled={isProcessing} className="bg-orange-500 hover:bg-orange-600" type="button">
              {isProcessing ? 'Changing...' : 'Yes, Change Wallet'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Warning */}
      <AlertDialog open={showDisconnectWarning} onOpenChange={setShowDisconnectWarning}>
        <AlertDialogContent className="w-[90vw] max-w-[90vw] overflow-x-hidden p-4 sm:p-6 sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disconnect Wallet
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to disconnect your Solana wallet from your Wutch account.
            </AlertDialogDescription>
            <div className="space-y-3 text-left text-sm">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                <p className="font-semibold text-destructive">What happens when you disconnect:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>You will be automatically logged out of your account</li>
                  <li>You will NO LONGER be able to receive donations from viewers</li>
                  <li>You will NO LONGER be able to send donations to creators</li>
                  <li>You will NO LONGER be able to claim bounty rewards</li>
                  <li>You will NO LONGER be able to receive share & earn campaign rewards</li>
                  <li>Your public wallet address will be removed from your profile</li>
                  <li>Any active donation settings will be automatically disabled</li>
                </ul>
              </div>

              <p className="text-sm font-semibold text-destructive">This action cannot be easily undone. Are you sure you want to disconnect your wallet?</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing} type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectWallet} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90" type="button">
              {isProcessing ? 'Disconnecting...' : 'Yes, Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
