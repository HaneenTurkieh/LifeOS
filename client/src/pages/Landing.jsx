import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListChecks, TreePine, Sparkles, GraduationCap, Rocket, Languages, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// Public, logged-out-friendly marketing homepage. Deliberately outside
// <ProtectedRoute> in App.jsx (same reasoning as the /pricing, /terms,
// /privacy, /refund-policy routes) so anyone — a visitor, a reviewer,
// Google's OAuth verification team — can see what Nuvora actually is
// without needing an account first. Set THIS route (not the bare "/",
// which stays the authenticated Dashboard for existing users) as the
// "Application home page" link in Cloud Console → OAuth consent screen
// → Branding.
//
// Content is intentionally self-contained (own EN/AR strings below)
// rather than routed through i18n/translations.js — same reasoning as
// Pricing.jsx keeping its own PLANS/PERKS local: this page's copy is
// small, marketing-specific, and shouldn't risk a collision in that
// already-large shared file.
const STRINGS = {
  en: {
    tagline: 'Your student life. One system.',
    subhead: 'Nuvora is a calm, bilingual Life OS for students — tasks, focus, habits, an AI study companion, and everything after graduation, in one place instead of five apps.',
    login: 'Log in',
    getStarted: 'Get started',
    featuresHeading: 'What’s inside',
    features: [
      { icon: 'tasks',   title: 'Tasks & Goals',      desc: 'Everyday to-dos, milestones, a real day planner.' },
      { icon: 'forest',  title: 'Focus & the Forest', desc: 'A focus timer that grows a real tree — break focus, and it can die.' },
      { icon: 'lumi',    title: 'Lumi',               desc: 'An AI companion woven through the app — remembers context, nudges deadlines, can act for you.' },
      { icon: 'exam',    title: 'Exam Assistant',     desc: 'Upload your notes, get a real AI-generated practice exam with a rubric and a timer.' },
      { icon: 'launch',  title: 'Launchpad',          desc: 'A CV builder plus internship and project tracking for after graduation.' },
      { icon: 'lang',    title: 'Bilingual, EN/AR',   desc: 'Built for Arabic and English from day one — not a translation pass bolted on later.' },
    ],
    footerBy: 'Nuvora is operated by Haneen Turkieh, an individual seller based in Nablus, Palestine.',
    footerLinks: { pricing: 'Pricing', terms: 'Terms', privacy: 'Privacy', refund: 'Refund Policy' },
    // Real numbers, pulled from legal/Pricing.jsx's own PLANS — keep these
    // two in sync if pricing ever changes there. Shown directly on the
    // homepage (not just linked) because a domain reviewer (Paddle,
    // Google) scanning this page needs to see an actual price without
    // clicking through — a footer link alone wasn't enough to pass
    // Paddle's "product and pricing visible" check.
    pricingTeaser: {
      heading: 'Free to start',
      body: 'Nuvora is free to use, no card required. Premium unlocks unlimited AI usage from $4.99/month.',
      cta: 'See full pricing',
    },
  },
  ar: {
    tagline: 'حياتك الدراسية، بنظام واحد.',
    subhead: 'نيفورا نظام تشغيل هادئ ثنائي اللغة للطلاب — المهام، التركيز، العادات، رفيق دراسي ذكي، وكل شي بعد التخرج، بمكان واحد بدل خمس تطبيقات.',
    login: 'تسجيل الدخول',
    getStarted: 'ابدأ الآن',
    featuresHeading: 'شو في داخلها',
    features: [
      { icon: 'tasks',   title: 'المهام والأهداف',         desc: 'مهام يومية، محطات إنجاز، ومخطط يوم حقيقي.' },
      { icon: 'forest',  title: 'التركيز والغابة',        desc: 'مؤقت تركيز بيزرع شجرة حقيقية — لو فقدت تركيزك بتموت.' },
      { icon: 'lumi',    title: 'لومي',                    desc: 'رفيق ذكي مدمج بالكامل — بيتذكر، بيذكرك بالمواعيد، وبيقدر ينفذ إلك.' },
      { icon: 'exam',    title: 'مساعد الامتحانات',    desc: 'ارفع ملاحظاتك واحصل على امتحان تجريبي حقيقي بوقت محدد.' },
      { icon: 'launch',  title: 'لونشباد',                  desc: 'منشئ سيرة ذاتية ومتابعة فرص تدريب ومشاريع.' },
      { icon: 'lang',    title: 'ثنائي اللغة',              desc: 'مبني للعربية والإنجليزية من اليوم الأول.' },
    ],
    footerBy: 'نيفورا يديرها حنين تركية، بائعة فردية من نابلس، فلسطين.',
    footerLinks: { pricing: 'الأسعار', terms: 'الشروط', privacy: 'الخصوصية', refund: 'سياسة الاسترداد' },
    pricingTeaser: {
      heading: 'مجاني للبدء',
      body: 'نيفورا مجاني للاستخدام، بدون أي بطاقة. Premium بيفتح استخدام غير محدود للذكاء الاصطناعي بدءًا من 4.99$ بالشهر.',
      cta: 'شوف كل الأسعار',
    },
  },
};

const ICONS = { tasks: ListChecks, forest: TreePine, lumi: Sparkles, exam: GraduationCap, launch: Rocket, lang: Languages };

export default function Landing() {
  const { resolvedTheme } = useTheme();
  const { lang, isRTL } = useLanguage();
  const isDark = resolvedTheme === 'dark';
  const s = STRINGS[lang] || STRINGS.en;

  const cardBg     = isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.95)';
  const titleClr   = isDark ? 'white'                             : '#1a1430';
  const bodyClr    = isDark ? 'rgba(255,255,255,0.68)'            : 'rgba(30,34,51,0.72)';
  const mutedClr   = isDark ? 'rgba(255,255,255,0.38)'            : 'rgba(30,34,51,0.45)';
  const linkClr    = isDark ? 'rgba(255,255,255,0.55)'            : 'rgba(30,34,51,0.55)';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="relative min-h-screen w-full px-4 py-10 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-4xl mx-auto"
      >
        {/* ── Top nav ──────────────────────────────────────────
            Pricing, front and center, above the fold — not just a footer
            link. A domain reviewer skimming the page for a few seconds
            (Paddle explicitly checks for "product and pricing visible")
            needs to see this without scrolling or hunting for it. */}
        <div className="flex items-center justify-between mb-10">
          <span className="font-display font-bold text-sm tracking-wide" style={{ color: titleClr }}>
            NUVORA
          </span>
          <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: linkClr }}>
            <Link to="/pricing" className="hover:underline">{s.footerLinks.pricing}</Link>
            <Link to="/login" className="hover:underline">{s.login}</Link>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center gap-5 mb-14">
          <span className="text-4xl" style={{ color: 'rgb(var(--accent-500))' }}>&#10022;</span>
          <h1 className="font-display font-bold text-3xl sm:text-4xl max-w-2xl" style={{ color: titleClr }}>
            {s.tagline}
          </h1>
          <p className="text-sm sm:text-base max-w-xl" style={{ color: bodyClr }}>
            {s.subhead}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Link to="/login" className="btn-primary">
              {s.getStarted} <ArrowRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
            </Link>
            <Link to="/login" className="btn-secondary">
              {s.login}
            </Link>
          </div>
        </div>

        {/* ── Features ─────────────────────────────────────── */}
        <h2 className="font-display font-bold text-lg text-center mb-5" style={{ color: titleClr }}>
          {s.featuresHeading}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {s.features.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <div key={f.title} className="rounded-2xl p-5"
                style={{ background: cardBg, backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: cardBorder }}>
                <Icon size={20} style={{ color: 'rgb(var(--accent-500))' }} className="mb-2" />
                <p className="font-display font-bold text-sm mb-1" style={{ color: titleClr }}>{f.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: bodyClr }}>{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ── Pricing teaser ───────────────────────────────────
            An actual price, visible on the page itself — not just a link
            to click through to. See the STRINGS comment above for why. */}
        <div className="rounded-2xl p-6 text-center mb-14"
          style={{ background: cardBg, backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: cardBorder }}>
          <p className="font-display font-bold text-base mb-1.5" style={{ color: titleClr }}>{s.pricingTeaser.heading}</p>
          <p className="text-xs sm:text-sm max-w-md mx-auto mb-3" style={{ color: bodyClr }}>{s.pricingTeaser.body}</p>
          <Link to="/pricing" className="text-xs font-semibold hover:underline" style={{ color: 'rgb(var(--accent-500))' }}>
            {s.pricingTeaser.cta} →
          </Link>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold" style={{ color: linkClr }}>
            <Link to="/pricing" className="hover:underline">{s.footerLinks.pricing}</Link>
            <Link to="/terms" className="hover:underline">{s.footerLinks.terms}</Link>
            <Link to="/privacy" className="hover:underline">{s.footerLinks.privacy}</Link>
            <Link to="/refund-policy" className="hover:underline">{s.footerLinks.refund}</Link>
          </div>
          <p className="text-[11px]" style={{ color: mutedClr }}>{s.footerBy}</p>
        </div>
      </motion.div>
    </div>
  );
}
