import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { EmptyState } from './EmptyState';

interface Transaction {
  id: string;
  transaction_type: string;
  gross_amount: number;
  creator_amount: number;
  platform_amount: number;
  transaction_signature: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  content_type: string | null;
  buyer_id: string | null;
  seller_id: string;
  seller_username: string | null;
  buyer_username: string | null;
  seller_display_name: string | null;
  buyer_display_name: string | null;
}

export function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earnings' | 'purchases'>('all');

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('user_transaction_history')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, [user]);

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'earnings') return tx.seller_id === user?.id;
    if (filter === 'purchases') return tx.buyer_id === user?.id;
    return true;
  });

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'x402_purchase': 'Premium Content',
      'service_purchase': 'Service Purchase',
      'share_reward': 'Share Reward',
      'bounty_reward': 'Bounty Reward',
      'donation': 'Donation',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionDirection = (tx: Transaction): 'in' | 'out' => {
    return tx.seller_id === user?.id ? 'in' : 'out';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Transaction History</h2>
          <p className="text-sm text-muted-foreground">View all your earnings and purchases</p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No transactions yet"
                description="Your transaction history will appear here"
              />
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((tx) => {
                  const direction = getTransactionDirection(tx);
                  const amount = direction === 'in' ? tx.creator_amount : tx.gross_amount;
                  const otherParty = direction === 'in' 
                    ? (tx.buyer_display_name || tx.buyer_username || 'Unknown User')
                    : (tx.seller_display_name || tx.seller_username || 'Unknown User');

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-2 rounded-full ${direction === 'in' ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                          {direction === 'in' ? (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-blue-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{getTypeLabel(tx.transaction_type)}</span>
                            {getStatusBadge(tx.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {direction === 'in' ? 'From' : 'To'}: {otherParty}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <span className={`font-semibold ${direction === 'in' ? 'text-green-500' : 'text-foreground'}`}>
                          {direction === 'in' ? '+' : '-'}{amount.toFixed(4)} SOL
                        </span>
                        {tx.transaction_signature && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => window.open(`https://solscan.io/tx/${tx.transaction_signature}`, '_blank')}
                          >
                            View <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
