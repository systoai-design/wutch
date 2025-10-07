import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

const TermsOfService = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="mr-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Wutch
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <Button onClick={() => navigate("/home")} className="ml-2">
              Launch App
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
            <p className="text-muted-foreground">Last Updated: January 2025</p>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground mb-4">
                By accessing or using Wutch, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="text-muted-foreground mb-4">
                Wutch is a video streaming platform that enables creators to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Upload and stream video content (livestreams, shorts, and long-form videos)</li>
                <li>Receive donations and bounties from viewers using Solana blockchain</li>
                <li>Create sharing campaigns to reward viewers for promoting content</li>
                <li>Track watch time and engagement analytics</li>
                <li>Build and engage with their audience</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <h3 className="text-xl font-semibold mb-3 mt-6">3.1 Account Creation</h3>
              <p className="text-muted-foreground mb-4">
                To use certain features of Wutch, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and update your information to keep it accurate</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Eligibility</h3>
              <p className="text-muted-foreground mb-4">
                You must be at least 13 years old to create an account. If you are under 18, you must have permission from a parent or legal guardian.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Content Guidelines</h2>
              <h3 className="text-xl font-semibold mb-3 mt-6">4.1 Your Content</h3>
              <p className="text-muted-foreground mb-4">
                You retain ownership of content you upload to Wutch. By uploading content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, distribute, and display your content on our platform.
              </p>

              <h3 className="text-xl font-semibold mb-3 mt-6">4.2 Prohibited Content</h3>
              <p className="text-muted-foreground mb-4">You may not upload content that:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Violates any law or regulation</li>
                <li>Infringes on intellectual property rights of others</li>
                <li>Contains hate speech, harassment, or threats</li>
                <li>Depicts violence, illegal activities, or harmful behavior</li>
                <li>Contains sexually explicit or pornographic material</li>
                <li>Spreads misinformation or spam</li>
                <li>Violates the privacy of others</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">4.3 Content Moderation</h3>
              <p className="text-muted-foreground mb-4">
                We reserve the right to remove any content that violates these terms or is otherwise objectionable. We may also suspend or terminate accounts that repeatedly violate our guidelines.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Payment Terms</h2>
              <h3 className="text-xl font-semibold mb-3 mt-6">5.1 Blockchain Transactions</h3>
              <p className="text-muted-foreground mb-4">
                All financial transactions on Wutch are processed through the Solana blockchain:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Transactions are irreversible once confirmed on the blockchain</li>
                <li>You are responsible for all blockchain transaction fees (gas fees)</li>
                <li>Wutch does not custody your cryptocurrency or private keys</li>
                <li>You must use a compatible Solana wallet</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">5.2 Bounties and Donations</h3>
              <p className="text-muted-foreground mb-4">
                Creators can receive bounties and donations from viewers:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>All transactions are voluntary and at the discretion of the sender</li>
                <li>Wutch may charge a platform fee on transactions</li>
                <li>Creators must comply with all applicable tax obligations</li>
                <li>Refunds are not available for blockchain transactions</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">5.3 Share and Earn Campaigns</h3>
              <p className="text-muted-foreground mb-4">
                Creators can create campaigns to reward viewers for sharing content:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Creators fund campaigns from their wallet</li>
                <li>Rewards are distributed based on verified clicks and conversions</li>
                <li>Wutch is not responsible for campaign performance</li>
                <li>Unused campaign funds can be reclaimed by the creator</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Watch Time and Earnings</h2>
              <p className="text-muted-foreground mb-4">
                Creators can earn rewards based on viewer watch time:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Watch time must be genuine and from real users</li>
                <li>Artificial inflation of watch time is prohibited</li>
                <li>Earnings are calculated based on platform algorithms</li>
                <li>Minimum payout thresholds may apply</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
              <p className="text-muted-foreground mb-4">
                The Wutch platform, including its design, features, and functionality, is owned by Wutch and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of our platform without permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground mb-4">
                Wutch is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>The platform will be uninterrupted or error-free</li>
                <li>Defects will be corrected</li>
                <li>The platform is free of viruses or harmful components</li>
                <li>Results from using the platform will be accurate or reliable</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">
                To the fullest extent permitted by law, Wutch shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Loss of profits, revenue, or data</li>
                <li>Loss of cryptocurrency or digital assets</li>
                <li>Damage to reputation</li>
                <li>Costs of obtaining substitute services</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
              <p className="text-muted-foreground mb-4">
                You agree to indemnify and hold harmless Wutch and its affiliates from any claims, damages, liabilities, and expenses arising from your use of the platform, violation of these terms, or infringement of any rights of another.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
              <p className="text-muted-foreground mb-4">
                We may terminate or suspend your account and access to the platform immediately, without prior notice, for any reason, including breach of these terms. Upon termination, your right to use the platform will immediately cease.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
              <p className="text-muted-foreground mb-4">
                We reserve the right to modify these terms at any time. We will notify you of any changes by posting the new terms on this page. Your continued use of the platform after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
              <p className="text-muted-foreground mb-4">
                These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-muted-foreground">
                Email: legal@wutch.com
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">© 2025 Wutch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
