import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/auth/login">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground">
                  By accessing and using Outpaced's intelligent real estate lead management system, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p className="text-muted-foreground mb-4">
                  Outpaced provides an intelligent real estate lead management system that includes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>AI-powered lead qualification and management</li>
                  <li>WhatsApp Business API integration</li>
                  <li>Property database and search functionality</li>
                  <li>Automated follow-up and communication tools</li>
                  <li>Analytics and reporting features</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
                <p className="text-muted-foreground mb-4">
                  As a user of our service, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Provide accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Use the service in compliance with applicable laws and regulations</li>
                  <li>Respect the privacy and rights of leads and customers</li>
                  <li>Not use the service for spam or unauthorized marketing</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Data and Privacy</h2>
                <p className="text-muted-foreground">
                  Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, 
                  which is incorporated into these Terms of Service by reference.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Service Availability</h2>
                <p className="text-muted-foreground">
                  We strive to maintain high service availability, but we do not guarantee uninterrupted access to our services. 
                  We may temporarily suspend service for maintenance, updates, or other operational reasons.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
                <p className="text-muted-foreground">
                  Outpaced shall not be liable for any indirect, incidental, special, consequential, or punitive damages, 
                  including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Termination</h2>
                <p className="text-muted-foreground">
                  We may terminate or suspend your account and access to the service immediately, without prior notice, 
                  for conduct that we believe violates these Terms of Service or is harmful to other users or our business.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify these terms at any time. We will notify users of any material changes 
                  via email or through our service interface.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Contact Information</h2>
                <p className="text-muted-foreground">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="font-medium">Outpaced Support</p>
                  <p className="text-muted-foreground">Email: support@outpaced.com</p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
