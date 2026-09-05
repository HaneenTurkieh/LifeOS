import React from 'react';
import LegalLayout, { Section } from './LegalLayout.jsx';

export default function Refund() {
  return (
    <LegalLayout title="Refund Policy" updated="September 2026">
      <Section>
        <p>
          Most Nuvora Premium purchases are paid by direct bank transfer to our account, reviewed
          and activated manually — see "Bank transfer refunds" below for how that's handled. A
          smaller number of older purchases went through <strong>Paddle.com Market Ltd</strong>,
          our card-payment Merchant of Record; those refunds are issued by Paddle on our behalf,
          in line with the policy below.
        </p>
      </Section>

      <Section heading="14-day money-back guarantee">
        <p>
          If you're not happy with Nuvora Premium, email us within <strong>14 days</strong> of
          your first payment on any plan (monthly, semester, or annual) and we'll request a full
          refund from Paddle — no questions asked.
        </p>
      </Section>

      <Section heading="After the first 14 days">
        <p>
          Subscriptions renew automatically, and we don't offer partial refunds for time already
          used in a billing period. You can cancel anytime from Settings → Premium to stop future
          renewals — your Premium access continues until the end of the period you already paid
          for, then reverts to the free tier.
        </p>
      </Section>

      <Section heading="How to request a refund">
        <p>
          Email us at{' '}
          <a href="mailto:haneenturkieh@hotmail.com" style={{ textDecoration: 'underline' }}>
            haneenturkieh@hotmail.com
          </a>{' '}
          with the email address you used to subscribe. You can also request a refund directly
          through Paddle using the receipt emailed to you at checkout — see{' '}
          <a href="https://paddle.net" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            paddle.net
          </a>. Refunds typically take a few business days to appear on your statement, and your
          Premium access is removed once the refund is processed.
        </p>
      </Section>

      <Section heading="Bank transfer refunds">
        <p>
          The same <strong>14-day money-back guarantee</strong> applies to purchases made by bank
          transfer. Email us within 14 days of your transfer and we'll send the full amount back
          to the account it came from. After 14 days, subscriptions don't auto-renew from a bank
          transfer — you're simply billed the same way again if you choose to renew — so there's
          nothing to cancel, and no partial refund applies to time already used.
        </p>
      </Section>

      <Section heading="Billing issues">
        <p>
          If you were charged in error or notice a billing discrepancy, contact us right away and
          we'll sort it out.
        </p>
      </Section>
    </LegalLayout>
  );
}
