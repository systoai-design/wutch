import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, ArrowLeft } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

const PrivacyPolicy = () => {
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
            <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground">Last Updated: January 2025</p>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                Welcome to Wutch. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold mb-3 mt-6">2.1 Personal Information</h3>
              <p className="text-muted-foreground mb-4">
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Account information (username, email address, password)</li>
                <li>Profile information (display name, bio, avatar)</li>
                <li>Content you create or upload (videos, comments, streams)</li>
                <li>Communications with us or other users</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Blockchain and Wallet Information</h3>
              <p className="text-muted-foreground mb-4">
                When you connect a Solana wallet to our platform:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>We collect your public wallet address</li>
                <li>Transaction data related to bounties, donations, and rewards</li>
                <li>Blockchain data is public and immutable by nature</li>
                <li>We do not have access to your private keys</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Usage Data</h3>
              <p className="text-muted-foreground mb-4">
                We automatically collect certain information about your device and how you interact with our platform:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>IP address and device identifiers</li>
                <li>Browser type and operating system</li>
                <li>Pages visited and features used</li>
                <li>Watch time and viewing preferences</li>
                <li>Timestamps of your activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and manage bounties, donations, and rewards</li>
                <li>Personalize your experience and content recommendations</li>
                <li>Communicate with you about updates, security, and support</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, prevent, and address fraud and security issues</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-muted-foreground mb-4">
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li><strong>Public Information:</strong> Your profile, uploaded content, and comments are publicly visible</li>
                <li><strong>Blockchain Transactions:</strong> All blockchain transactions are publicly recorded on the Solana network</li>
                <li><strong>Service Providers:</strong> We share data with third-party service providers who assist in operating our platform</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or sale of assets</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational measures to protect your personal information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure database infrastructure</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
              <p className="text-muted-foreground mb-4">You have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                <li><strong>Access:</strong> Request access to your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                Note: Blockchain transactions cannot be deleted due to the immutable nature of blockchain technology.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking Technologies</h2>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar tracking technologies to track activity on our platform and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
              <p className="text-muted-foreground mb-4">
                Our platform is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-muted-foreground">
                Email: wutch.fun@gmail.com
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

export default PrivacyPolicy;
