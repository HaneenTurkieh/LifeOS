import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

// Shared shell for the public legal pages (Terms, Privacy, Refund Policy,
// Pricing). These must be reachable WITHOUT logging in — Paddle's domain
// review explicitly checks for a clearly-navigable Terms & Conditions,
// Refund Policy, Privacy Policy, and pricing page — so this layout is
// deliberately kept outside <ProtectedRoute> in App.jsx.
//
// Content is English-only on purpose: legal text needs to be precise, and
// duplicating it through the app's EN/AR i18n system risks translation
// drift on wording that actually matters. dir="ltr" is forced so Arabic
// UI mode doesn't mirror this content.
export default function LegalLayout({ title, updated, children }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const cardBg     = isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.95)';
  const titleClr   = isDark ? 'white'                             : '#1a1430';
  const bodyClr    = isDark ? 'rgba(255,255,255,0.68)'            : 'rgba(30,34,51,0.72)';
  const mutedClr   = isDark ? 'rgba(255,255,255,0.38)'            : 'rgba(30,34,51,0.45)';
  const linkClr    = isDark ? 'rgba(255,255,255,0.55)'            : 'rgba(30,34,51,0.55)';

  return (
    <div dir="ltr" className="relative min-h-screen w-full flex justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl"
      >
        <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold mb-6 transition"
          style={{ color: linkClr }}>
          <ArrowLeft size={14} /> Back to Nuvora
        </Link>

        <div className="rounded-3xl p-8 sm:p-10"
          style={{ background: cardBg, backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: cardBorder }}>
          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: titleClr }}>{title}</h1>
          {updated && <p className="text-xs mb-8" style={{ color: mutedClr }}>Last updated: {updated}</p>}
          <div className="flex flex-col gap-5 text-sm leading-relaxed" style={{ color: bodyClr }}>
            {children}
          </div>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: mutedClr }}>
          Nuvora is operated by Haneen Turkieh, an individual seller based in Nablus, Palestine.
        </p>
      </motion.div>
    </div>
  );
}

export function Section({ heading, children }) {
  return (
    <section className="flex flex-col gap-2">
      {heading && <h2 className="font-display font-bold text-base" style={{ color: 'inherit' }}>{heading}</h2>}
      {children}
    </section>
  );
}
