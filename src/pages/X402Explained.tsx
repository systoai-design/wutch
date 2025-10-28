import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  Coins,
  Clock,
  Ban
} from 'lucide-react';

const X402Explained = () => {
  useEffect(() => {
    document.title = 'X402 Protocol Explained | Wutch';
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge className="mb-4 px-6 py-2 text-sm animate-pulse-subtle">
            🔒 Revolutionary Payment Technology
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            What is X402 Protocol?
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The future of content monetization. Instant, secure, blockchain-powered payments that put creators first.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button asChild size="lg" className="pulse-glow">
              <Link to="/app">Start Earning with X402</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              How X402 Works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">1. User Wants Premium Content</h3>
                <p className="text-muted-foreground">
                  Viewer finds a premium livestream, video, or post they want to access. They click "Unlock with X402".
                </p>
              </Card>

              <Card className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">2. Connect Wallet & Pay</h3>
                <p className="text-muted-foreground">
                  User connects their Phantom wallet and pays in SOL. Transaction is submitted to Solana blockchain.
                </p>
              </Card>

              <Card className="p-6 space-y-4">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold">3. Instant Access Granted</h3>
                <p className="text-muted-foreground">
                  Payment verified on blockchain (95% to creator, 5% platform fee). Content unlocked immediately.
                </p>
              </Card>
            </div>

            {/* Transaction Flow Diagram */}
            <div className="mt-12 p-8 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-2xl border border-primary/20">
              <h3 className="text-2xl font-bold mb-6 text-center">Payment Flow</h3>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-2 bg-background p-4 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Viewer</span>
                </div>
                
                <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
                
                <div className="flex items-center gap-2 bg-background p-4 rounded-lg">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="font-semibold">100 SOL Payment</span>
                </div>
                
                <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90 md:rotate-0" />
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-primary/10 p-3 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="font-semibold">95 SOL → Creator</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">5 SOL → Platform</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Comparison */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              X402 vs Traditional Payment Platforms
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-bold">Feature</th>
                    <th className="text-center p-4 font-bold text-primary">X402 Protocol</th>
                    <th className="text-center p-4 font-bold text-muted-foreground">Traditional</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 font-semibold">Platform Fee</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        5% (95% to you)
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        15-30%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 font-semibold">Payout Speed</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Instant (&lt;30 seconds)
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        7-30 days
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 font-semibold">Chargebacks</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Impossible
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        Common issue
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 font-semibold">Account Freezing</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Your wallet, your control
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        Platform can freeze anytime
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-border hover:bg-muted/50">
                    <td className="p-4 font-semibold">Transaction Transparency</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        100% on blockchain
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        Hidden fees
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/50">
                    <td className="p-4 font-semibold">Payment Failures</td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Guaranteed by blockchain
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="inline-flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        Card declines, errors
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Trust */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Security & Trust
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-4">
                <Shield className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">Blockchain Security</h3>
                <p className="text-muted-foreground">
                  Every X402 transaction is verified and recorded on the Solana blockchain. Immutable, transparent, and secure.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Cryptographic signature verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>On-chain transaction validation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Irreversible payments (no chargebacks)</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-6 space-y-4">
                <Clock className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Solana blockchain processes transactions in milliseconds. No waiting, no delays.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Payment confirmed in &lt;30 seconds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Instant content access after payment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Real-time earnings tracking</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-6 space-y-4">
                <Ban className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">No Middlemen</h3>
                <p className="text-muted-foreground">
                  Direct wallet-to-wallet payments. No banks, no payment processors, no intermediaries taking cuts.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Peer-to-peer transactions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>95% revenue directly to creators</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Full control of your funds</span>
                  </li>
                </ul>
              </Card>

              <Card className="p-6 space-y-4">
                <Lock className="h-12 w-12 text-primary" />
                <h3 className="text-2xl font-bold">Your Keys, Your Crypto</h3>
                <p className="text-muted-foreground">
                  We never hold your funds. Payments go directly to your wallet. You maintain full ownership and control.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Non-custodial - you control your wallet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>No platform can freeze your earnings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span>Withdraw anytime, no restrictions</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">Do I need cryptocurrency to use X402?</h3>
                <p className="text-muted-foreground">
                  Yes, you'll need SOL (Solana) in your wallet to pay for premium content. You can purchase SOL on exchanges like Coinbase, Binance, or directly through Phantom wallet.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">What wallet do I need?</h3>
                <p className="text-muted-foreground">
                  We recommend Phantom wallet (available on mobile and as a browser extension). It's secure, user-friendly, and designed specifically for Solana.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">How much does X402 content cost?</h3>
                <p className="text-muted-foreground">
                  Creators set their own prices. Most premium content ranges from 0.1 to 5 SOL (approximately $2-$100 USD depending on SOL price).
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">Can I get a refund?</h3>
                <p className="text-muted-foreground">
                  Blockchain transactions are irreversible, so X402 payments cannot be refunded. However, you can contact the creator directly if there's an issue with the content.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">How do creators receive payments?</h3>
                <p className="text-muted-foreground">
                  95% of the payment goes directly to the creator's wallet within seconds. They can use it immediately or hold it as investment.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">Is X402 safe?</h3>
                <p className="text-muted-foreground">
                  Yes! X402 uses Solana blockchain's military-grade cryptography. Every transaction is verified on-chain and cannot be tampered with. Your wallet remains in your control at all times.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary/10 to-purple-500/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to Experience X402?
            </h2>
            <p className="text-xl text-muted-foreground">
              Start earning with the fairest, fastest payment protocol in the world.
            </p>
            <Button asChild size="lg" className="text-lg px-12 py-6 h-auto pulse-glow">
              <Link to="/app">Get Started Now</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default X402Explained;
