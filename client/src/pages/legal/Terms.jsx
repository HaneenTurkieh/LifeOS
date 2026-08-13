import React from 'react';
import LegalLayout, { Section } from './LegalLayout.jsx';

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="August 2026">
      <Section>
        <p>
          These Terms of Service ("Terms") govern your use of Nuvora (the "Service"), a personal
          productivity application covering tasks, goals, habits, focus sessions, an AI assistant
          ("Lumi"), an AI exam study tool, and related features, available at{' '}
          <strong>life-os-three-xi.vercel.app</strong> and any successor domain. Nuvora is
          developed and operated by Haneen Turkieh, an individual seller based in Nablus,
          Palestine ("we", "us", "our"). By creating an account or using Nuvora, you agree to
          these Terms.
        </p>
      </Section>

      <Section heading="1. Eligibility">
        <p>
          You must be at least 13 years old to use Nuvora. If you are under the age of majority
          in your country, you may only use Nuvora with the involvement of a parent or guardian.
        </p>
      </Section>

      <Section heading="2. Your account">
        <p>
          You're responsible for keeping your login credentials secure and for all activity under
          your account. Let us know right away if you suspect unauthorized access. You can delete
          your account and associated data at any time from Settings.
        </p>
      </Section>

      <Section heading="3. Subscriptions, billing, and Paddle">
        <p>
          Nuvora offers a free tier and a paid "Premium" subscription (monthly, semester, or
          annual). All payments are processed by our order processor,{' '}
          <strong>Paddle.com Market Ltd</strong> ("Paddle"), who act as the Merchant of Record for
          all orders. Paddle handles payment collection, applicable sales tax/VAT, invoicing, and
          buyer-facing payment support. Your purchase is therefore subject to{' '}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            Paddle's Buyer Terms and Conditions
          </a>{' '}
          in addition to these Terms.
        </p>
        <p>
          Subscriptions renew automatically at the end of each billing period unless cancelled
          beforehand. You can cancel anytime from Settings → Premium; your access continues until
          the end of the period you already paid for. See our{' '}
          <a href="/refund-policy" style={{ textDecoration: 'underline' }}>Refund Policy</a> for
          details on refunds.
        </p>
      </Section>

      <Section heading="4. Acceptable use">
        <p>
          Don't use Nuvora to break the law, harass others, upload malicious content, or attempt
          to disrupt or reverse-engineer the Service. The AI exam study tool is intended as a
          study aid for practicing and reviewing material you already have access to — you're
          responsible for complying with your school or institution's academic integrity policies
          when using it.
        </p>
      </Section>

      <Section heading="5. Your content">
        <p>
          You retain ownership of the content you create or upload in Nuvora (tasks, notes,
          uploaded study material, etc.). By using AI-powered features (Lumi chat, exam
          generation), you understand that relevant content is sent to third-party AI providers
          for processing — see our{' '}
          <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</a> for
          details.
        </p>
      </Section>

      <Section heading="6. Disclaimers and limitation of liability">
        <p>
          Nuvora is provided "as is." We do our best to keep it reliable and accurate, but we
          don't guarantee uninterrupted service or that AI-generated content (study material,
          chat responses) is error-free — always verify anything important yourself. To the
          fullest extent permitted by law, we aren't liable for indirect, incidental, or
          consequential damages arising from your use of Nuvora.
        </p>
      </Section>

      <Section heading="7. Termination">
        <p>
          We may suspend or terminate accounts that violate these Terms. You may stop using
          Nuvora and delete your account at any time.
        </p>
      </Section>

      <Section heading="8. Changes to these Terms">
        <p>
          We may update these Terms as Nuvora grows. Meaningful changes will be reflected by
          updating the date at the top of this page.
        </p>
      </Section>

      <Section heading="9. Governing law">
        <p>
          These Terms are governed by the laws applicable in the seller's jurisdiction (State of
          Palestine), without regard to conflict-of-law principles, except where mandatory
          consumer-protection laws in your country of residence apply — particularly in relation
          to Paddle's role as Merchant of Record for your purchase.
        </p>
      </Section>

      <Section heading="10. Contact">
        <p>
          Questions about these Terms? Reach out at{' '}
          <a href="mailto:haneenturkieh@hotmail.com" style={{ textDecoration: 'underline' }}>
            haneenturkieh@hotmail.com
          </a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
