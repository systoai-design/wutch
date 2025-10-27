import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Twitter, CheckCircle, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function TwitterConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [accessTokenSecret, setAccessTokenSecret] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('twitter_connections')
      .select('twitter_handle, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      setIsConnected(true);
      setTwitterHandle(data.twitter_handle);
    }
  };

  const handleConnect = async () => {
    if (!accessToken.trim() || !accessTokenSecret.trim()) {
      toast({
        title: 'Missing Credentials',
        description: 'Please enter both access token and secret',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('connect-twitter', {
        body: {
          accessToken: accessToken.trim(),
          accessTokenSecret: accessTokenSecret.trim(),
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setIsConnected(true);
      setTwitterHandle(data.twitter.username);
      setShowForm(false);
      setAccessToken('');
      setAccessTokenSecret('');

      toast({
        title: 'Twitter Connected! 🎉',
        description: `Successfully connected @${data.twitter.username}`,
      });
    } catch (error: any) {
      console.error('Twitter connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect Twitter account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('twitter_connections')
        .update({ is_active: false })
        .eq('user_id', user.id);

      if (error) throw error;

      setIsConnected(false);
      setTwitterHandle('');

      toast({
        title: 'Disconnected',
        description: 'Twitter account disconnected',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Twitter account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          Twitter/X Connection
        </CardTitle>
        <CardDescription>
          Connect your Twitter account to enable auto-sharing for campaigns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Connected Account</p>
                  <p className="text-sm text-muted-foreground">@{twitterHandle}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                When you share content with campaigns, tweets will be automatically posted to your connected account.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            {!showForm ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You'll need Twitter API credentials from your{' '}
                    <a
                      href="https://developer.twitter.com/en/portal/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      Twitter Developer Portal
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    . Make sure your app has "Read and Write" permissions.
                  </AlertDescription>
                </Alert>

                <Button onClick={() => setShowForm(true)} className="w-full">
                  <Twitter className="h-4 w-4 mr-2" />
                  Connect Twitter Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="Your Twitter Access Token"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessTokenSecret">Access Token Secret</Label>
                  <Input
                    id="accessTokenSecret"
                    type="password"
                    placeholder="Your Twitter Access Token Secret"
                    value={accessTokenSecret}
                    onChange={(e) => setAccessTokenSecret(e.target.value)}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Find these in your Twitter Developer Portal under "Keys and tokens". Your tokens are stored securely and encrypted.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Connecting...' : 'Connect'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setAccessToken('');
                      setAccessTokenSecret('');
                    }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
