import React from 'react';
import LegalLayout, { Section } from './LegalLayout.jsx';

// Static, logged-out-friendly pricing page. Deliberately hardcoded rather
// than pulled from GET /focus/premium/plans — that route sits behind
// `authenticate`, but pricing still needs to be visible without logging
// in (originally for Paddle's domain review; still true now that bank
// transfer is the primary path). Keep these numbers in sync with PLANS
// in server/routes/focus.js if prices ever change. Priced in USD (moved
// off NIS Sept 2026 alongside the switch to bank transfer as the primary
// payment method — see Pricing section below).
const PLANS = [
  { name: 'Monthly',  price: 4.99,  priceNis: 15,  period: '/ month',                 note: null },
  { name: 'Semester', price: 13.99, priceNis: 42,  period: '/ semester (4 months)',   note: 'Most popular · ≈$3.50/mo' },
  { name: 'Annual',   price: 39.99, priceNis: 120, period: '/ year (12 months)',      note: 'Save 33% · ≈$3.33/mo' },
];

const PERKS = [
  'Unlimited tasks, goals, habits, and AI usage',
  'Streak freeze — excuse one missed day without breaking your streak',
  'All app color themes',
  'Full AI exam study tool (unlimited generations)',
  'Watermark-free PDF/PPT exports',
];

export default function Pricing() {
  return (
    <LegalLayout title="Pricing">
      <Section>
        <p>
          Nuvora is free to use. <strong>Premium</strong> unlocks unlimited AI usage and a few
          extra perks, priced in US Dollars. The primary way to pay is a direct bank transfer to
          our USD account — see below — since our card processor, Paddle, has been unresponsive
          for a Palestine-based seller in practice.
        </p>
      </Section>

      <Section heading="Plans">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
          {PLANS.map((p) => (
            <div key={p.name} className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <p className="text-xs font-bold opacity-70">{p.name}</p>
              <p className="text-2xl font-display font-bold mt-1">
                ${p.price} <span className="text-xs font-semibold opacity-60">USD</span>
              </p>
              <p className="text-[10px] opacity-40 -mt-1">≈{p.priceNis} NIS</p>
              <p className="text-xs opacity-60">{p.period}</p>
              {p.note && <p className="text-[11px] opacity-50 mt-1">{p.note}</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section heading="How to pay">
        <p>
          After signing in, go to Settings → Premium and choose "Pay by bank transfer" on any
          plan. You'll see our IBAN and account details there — send the amount shown, add a short
          note (your name or the transfer time helps us match it), and submit. We manually confirm
          the transfer against our bank statement and activate Premium on your account, usually
          within a day.
        </p>
      </Section>

      <Section heading="What Premium includes">
        <ul className="list-disc ps-5 flex flex-col gap-1">
          {PERKS.map((perk) => <li key={perk}>{perk}</li>)}
        </ul>
      </Section>

      <Section heading="Cancel anytime">
        <p>
          Subscriptions auto-renew until cancelled. Cancel anytime from Settings → Premium — your
          access continues until the end of the period you already paid for. See our{' '}
          <a href="/refund-policy" style={{ textDecoration: 'underline' }}>Refund Policy</a> for
          details, including our 14-day money-back guarantee.
        </p>
      </Section>
    </LegalLayout>
  );
}
