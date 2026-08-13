import React from 'react';
import LegalLayout, { Section } from './LegalLayout.jsx';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 2026">
      <Section>
        <p>
          This Privacy Policy explains what data Nuvora collects, why, and how it's handled.
          Nuvora is operated by Haneen Turkieh ("we", "us", "our"), based in Nablus, Palestine.
        </p>
      </Section>

      <Section heading="1. What we collect">
        <p>
          <strong>Account data:</strong> name, email address, and a securely hashed password.{' '}
          <strong>Product data:</strong> the content you create in Nuvora — tasks, goals, habits,
          mood logs, focus sessions, projects, exam material you upload, and messages you send to
          Lumi (our AI assistant). <strong>Usage data:</strong> basic technical data like device/
          browser type and timestamps, used only to keep the Service working and to fix bugs.
        </p>
        <p>
          We do not collect or store your payment card details. Those go directly to Paddle (see
          below).
        </p>
      </Section>

      <Section heading="2. How we use it">
        <p>
          To provide and improve Nuvora's features, to authenticate you, to send you
          account-relevant notifications (deadlines, streaks, etc.), and to respond if you contact
          us for support.
        </p>
      </Section>

      <Section heading="3. Third parties we share data with">
        <p>
          <strong>AI providers:</strong> when you use Lumi chat or the AI exam study tool, the
          relevant text (and any files you upload for that feature) is sent to third-party AI
          providers we use to generate responses — currently Google (Gemini) and OpenRouter,
          which may route requests to models such as DeepSeek. These providers process the data
          to return a response; we don't control their retention practices beyond what they
          publish themselves.
        </p>
        <p>
          <strong>Payments:</strong> if you subscribe to Premium, your payment is handled entirely
          by <strong>Paddle.com Market Ltd</strong>, our Merchant of Record. Paddle collects your
          billing details (name, email, payment method, billing address for tax purposes) directly
          — we only receive confirmation that a subscription is active, not your card details. See{' '}
          <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            Paddle's Privacy Policy
          </a>{' '}
          for how they handle payment data.
        </p>
        <p>
          <strong>Hosting:</strong> our infrastructure runs on Vercel (frontend), Render (backend),
          and Turso (database) — standard infrastructure providers that store data on our behalf
          under their own security practices.
        </p>
        <p>We don't sell your data to anyone, ever.</p>
      </Section>

      <Section heading="4. Data retention and deletion">
        <p>
          We keep your data for as long as your account is active. You can permanently delete your
          account and all associated data at any time from Settings → Danger Zone. Deletion is
          immediate and cannot be undone.
        </p>
      </Section>

      <Section heading="5. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete
          your personal data (for example, under GDPR if you're in the EU/UK). You can exercise
          most of these directly from Settings, or contact us at the email below for anything else.
        </p>
      </Section>

      <Section heading="6. Cookies and local storage">
        <p>
          Nuvora uses browser local storage to keep you signed in and to remember your
          preferences (theme, language). We don't use third-party advertising trackers.
        </p>
      </Section>

      <Section heading="7. Children's privacy">
        <p>
          Nuvora isn't directed at children under 13, and we don't knowingly collect data from
          them. If you believe a child has created an account, contact us and we'll remove it.
        </p>
      </Section>

      <Section heading="8. Changes to this policy">
        <p>
          If this policy changes in a meaningful way, we'll update the date at the top of this
          page.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about your data? Email{' '}
          <a href="mailto:haneenturkieh@hotmail.com" style={{ textDecoration: 'underline' }}>
            haneenturkieh@hotmail.com
          </a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
