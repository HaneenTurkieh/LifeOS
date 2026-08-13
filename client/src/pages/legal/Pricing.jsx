import React from 'react';
import LegalLayout, { Section } from './LegalLayout.jsx';

// Static, logged-out-friendly pricing page. Deliberately hardcoded rather
// than pulled from GET /focus/premium/plans — that route sits behind
// `authenticate`, but Paddle's domain review needs pricing visible without
// logging in. Keep these numbers in sync with PLANS in server/routes/focus.js
// if prices ever change.
const PLANS = [
  { name: 'Monthly',  price: 10, period: '/ month',                 note: null },
  { name: 'Semester', price: 34, period: '/ semester (4 months)',   note: 'Most popular · ≈8.5 NIS/mo' },
  { name: 'Annual',   price: 96, period: '/ year (12 months)',      note: 'Save 20% · ≈8 NIS/mo' },
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
          extra perks, billed in New Israeli Shekels (NIS) through our payment processor,{' '}
          <strong>Paddle</strong>, which converts to your local currency automatically at
          checkout.
        </p>
      </Section>

      <Section heading="Plans">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
          {PLANS.map((p) => (
            <div key={p.name} className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <p className="text-xs font-bold opacity-70">{p.name}</p>
              <p className="text-2xl font-display font-bold mt-1">
                {p.price} <span className="text-xs font-semibold opacity-60">NIS</span>
              </p>
              <p className="text-xs opacity-60">{p.period}</p>
              {p.note && <p className="text-[11px] opacity-50 mt-1">{p.note}</p>}
            </div>
          ))}
        </div>
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
