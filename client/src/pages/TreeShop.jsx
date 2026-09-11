import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lock, Check, Landmark, Copy, Gift, CreditCard } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PageLoader from '../components/Loader.jsx';
import MysticSvg  from '../components/MysticTreeIcon.jsx';
import TreeSvg    from '../components/TreeSvg.jsx';

// ── Constellation — colour picker only; shape/position is fixed by
//    the user's own zodiac + which star comes next ─────────────
const MYSTIC_COLORS = ['#8B5CF6', '#F472B6', '#F59E0B', '#10B981', '#38BDF8', '#6366F1', '#FB7185', '#EAB308'];

// Every premium tree used to share one flat gold treatment regardless of
// which tree it was — that's a lot of why they read as "not attractive":
// three (now six) different trees all wearing the same color made the row
// look like one design repeated, not six distinct things worth Browse-ing.
// Each tree now carries its own accent, echoed through its border/glow/
// badge/button, the same way RARITY does for the earnable trees above.
const PREMIUM_COLORS = {
  aurora:  '#38BDF8',
  phoenix: '#FB923C',
  galaxy:  '#A855F7',
  nebula:  '#EC4899',
  eclipse: '#FBBF24',
  comet:   '#7DD3FC',
};
const RARITY = {
  seedling:       { label: 'shop.rarStarter',   color: '#4CC38A', bg: 'rgba(76,195,138,0.12)' },
  sprout:         { label: 'shop.rarCommon',    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  oak:            { label: 'shop.rarUncommon',  color: '#7C6AF0', bg: 'rgba(124,106,240,0.12)' },
  cherry_blossom: { label: 'shop.rarRare',      color: '#F472B6', bg: 'rgba(244,114,182,0.12)' },
  bamboo:         { label: 'shop.rarRare',      color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  palm:           { label: 'shop.rarEpic',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  pine:           { label: 'shop.rarEpic',      color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  crystal:        { label: 'shop.rarLegendary', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
};

function XPBar({ totalXp, t }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-5 py-3 mb-8"
      style={{
        background:   'linear-gradient(135deg, rgb(var(--accent-500) / 0.15) 0%, rgb(var(--accent-600) / 0.08) 100%)',
        border:       '1px solid rgb(var(--accent-500) / 0.25)',
        backdropFilter: 'blur(16px)',
      }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
        style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))', boxShadow: '0 4px 12px rgb(var(--accent-500) / 0.35)' }}>
        ⚡
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-ink dark:text-white">
          {totalXp.toLocaleString()} <span className="text-lavender-500 text-lg">XP</span>
        </p>
        <p className="text-xs text-ink/40 dark:text-white/35">{t('shop.available')}</p>
      </div>
    </div>
  );
}
function TreeCard({ tree, onUnlock, onEquip, loading, t }) {
  const rarity = RARITY[tree.key] || RARITY.seedling;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!tree.equipped ? { y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } } : {}}
      className="relative flex flex-col items-center rounded-3xl p-6 text-center transition-all"
      style={{
        background: tree.equipped
          ? `linear-gradient(145deg, ${rarity.color}22 0%, ${rarity.color}0A 100%)`
          : 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.30) 100%)',
        border: tree.equipped
          ? `2px solid ${rarity.color}55`
          : '1px solid rgba(255,255,255,0.60)',
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: tree.equipped
          ? `0 12px 32px ${rarity.color}22, inset 0 2px 0 rgba(255,255,255,0.70)`
          : '0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.75)',
      }}
    >
      {tree.equipped && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold text-white"
          style={{ background: rarity.color, boxShadow: `0 2px 8px ${rarity.color}55` }}>
          <Check size={10} /> {t('shop.equipped')}
        </div>
      )}
      {!tree.owned && !tree.canAfford && (
        <div className="absolute top-3 start-3 rounded-full p-1.5"
          style={{ background: 'rgba(255,255,255,0.75)' }}>
          <Lock size={13} className="text-ink/40" />
        </div>
      )}
      <div className="absolute top-3 end-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
        style={{ background: rarity.bg, color: rarity.color }}>
        {t(rarity.label)}
      </div>
      <motion.div
        animate={tree.equipped ? { y: [0, -4, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-3 select-none flex items-center justify-center"
        style={{ filter: !tree.owned && !tree.canAfford ? 'grayscale(0.75) opacity(0.7)' : 'none' }}>
        <TreeSvg speciesKey={tree.key} size={64} />
      </motion.div>
      <h3 className="font-display font-bold text-ink dark:text-white text-sm mb-1">{tree.name}</h3>
      <p className="text-xs text-ink/45 dark:text-white/35 mb-4 leading-snug">{tree.description}</p>
      {tree.cost > 0 && (
        <div className="flex items-center gap-1 mb-4 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: tree.owned ? 'rgba(76,195,138,0.12)' : tree.canAfford ? 'rgb(var(--accent-500) / 0.12)' : 'rgba(0,0,0,0.06)',
            color:      tree.owned ? '#2DA76E' : tree.canAfford ? 'rgb(var(--accent-500))' : 'rgba(30,34,51,0.35)',
          }}>
          ⚡ {tree.cost.toLocaleString()} XP
        </div>
      )}
      {tree.owned ? (
        tree.equipped ? (
          <div className="w-full rounded-2xl py-2 text-xs font-semibold text-center"
            style={{ background: rarity.bg, color: rarity.color }}>
            {t('shop.currentlyEq')}
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onEquip(tree.key)}
            disabled={loading}
            className="w-full rounded-2xl py-2 text-xs font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${rarity.color} 0%, ${rarity.color}CC 100%)`, boxShadow: `0 4px 12px ${rarity.color}44` }}>
            {t('shop.equip')}
          </motion.button>
        )
      ) : tree.canAfford ? (
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => onUnlock(tree)}
          disabled={loading}
          className="w-full rounded-2xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)',
            boxShadow:  '0 6px 16px rgb(var(--accent-500) / 0.38)',
          }}>
          {t('shop.unlock')}
        </motion.button>
      ) : (
        <div className="w-full rounded-2xl py-2 text-xs font-medium text-center text-ink/30 dark:text-white/25"
          style={{ background: 'rgba(0,0,0,0.04)' }}>
          {t('shop.needXp', { n: tree.cost.toLocaleString() })}
        </div>
      )}
    </motion.div>
  );
}
// Real-money tier — deliberately distinct visual language from TreeCard
// (gold/champagne instead of rarity colors, a price tag instead of an XP
// pill) so it reads as its own category, not just another rarity level.
function PremiumTreeCard({ tree, onBuy, onEquip, loading, requestStatus, t }) {
  const c = PREMIUM_COLORS[tree.key] || '#F59E0B';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!tree.owned ? { y: -4, scale: 1.015, transition: { type: 'spring', stiffness: 400, damping: 25 } } : {}}
      // h-full + flex column with the description set to flex-1 below is
      // what actually fixes the misalignment — cards in the same grid row
      // already stretch to equal height, but without something inside
      // absorbing the extra space, a card with a 1-line description had
      // its price/Buy button sitting noticeably higher than a card with a
      // 2-line one. flex-1 on the description pushes price+button to the
      // same baseline across every card in the row, regardless of how
      // long that tree's own description happens to be.
      className="relative flex h-full flex-col items-center rounded-3xl p-6 text-center overflow-hidden"
      style={{
        background: tree.owned
          ? `linear-gradient(145deg, ${c}29 0%, ${c}0D 100%)`
          : `linear-gradient(145deg, rgba(20,16,35,0.05) 0%, ${c}14 100%)`,
        border: tree.owned ? `2px solid ${c}73` : `1px solid ${c}4D`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        boxShadow: tree.owned ? `0 12px 32px ${c}2E, inset 0 2px 0 rgba(255,255,255,0.5)` : `0 4px 20px ${c}1A, inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
      {/* Soft ambient glow behind the icon, tinted to the tree's own
          color — same "gamified accent" language used elsewhere in the
          app, here doing double duty as what makes six cards actually
          look like six different things at a glance. */}
      <motion.div
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full"
        style={{ background: `radial-gradient(circle, ${c}55 0%, transparent 70%)` }}
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.12, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative flex flex-col items-center h-full w-full">
        <div className="absolute top-0 end-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: `${c}2E`, color: c }}>
          {t('shop.premiumBadge')}
        </div>
        {/* Premium trees can now be equipped just like earnable ones —
            "grown" instead of just owned (see handleEquip in TreeShop) —
            so an owned card needs to distinguish "this is what's
            currently showing on your Dashboard" from "you just own it
            but something else is equipped." */}
        {tree.owned && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold text-white"
            style={{ background: c, boxShadow: `0 2px 8px ${c}73` }}>
            <Check size={10} /> {tree.equipped ? t('shop.currentlyEq') : t('shop.currentlyOwned')}
          </div>
        )}
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative mt-2 mb-3 select-none flex items-center justify-center" style={{ filter: `drop-shadow(0 4px 14px ${c}88)` }}>
          <TreeSvg speciesKey={tree.key} size={76} />
        </motion.div>
        <h3 className="font-display font-bold text-ink dark:text-white text-sm mb-1">{tree.name}</h3>
        <p className="text-xs text-ink/45 dark:text-white/35 mb-4 leading-snug flex-1">{tree.description}</p>
        {!tree.owned && (
          <div className="flex items-center gap-1 mb-4 rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${c}29`, color: c }}>
            ${tree.priceUsd.toFixed(2)}
          </div>
        )}
        {tree.owned ? (
          tree.equipped ? (
            <div className="w-full rounded-2xl py-2 text-xs font-semibold text-center" style={{ background: `${c}29`, color: c }}>
              {t('shop.currentlyEq')}
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onEquip(tree.key)}
              disabled={loading}
              className="w-full rounded-2xl py-2 text-xs font-bold disabled:opacity-50"
              style={{ background: `${c}29`, color: c }}>
              {t('shop.equip')}
            </motion.button>
          )
        ) : requestStatus === 'pending' ? (
          <div className="w-full rounded-2xl py-2 text-xs font-semibold text-center" style={{ background: `${c}1F`, color: c }}>
            {t('shop.bankTransferPending')}
          </div>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onBuy(tree)}
              disabled={loading}
              className="w-full rounded-2xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${c} 0%, ${c}CC 100%)`, boxShadow: `0 6px 16px ${c}59` }}>
              {t('shop.addToShelf')}
            </motion.button>
            {requestStatus === 'rejected' && (
              <p className="mt-1.5 text-[10px] text-center" style={{ color: '#EF4444' }}>{t('shop.bankTransferRejected')}</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
// Your call — premium trees don't grow with the streak the way earnable
// ones do (no XP progress bar makes sense for a one-time purchase), so
// framing them as a single "equipped" swap the same way TreeCard works
// was a mismatch. This shows everything you own together, all at once,
// like a trophy shelf — buying a second or third one adds to the
// display instead of replacing whichever was "grown" before.
function ShelfDisplay({ ownedPremiumTrees, t }) {
  return (
    <div className="relative rounded-3xl p-6 mb-5 overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(20,16,35,0.85) 0%, rgba(42,26,74,0.75) 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={15} style={{ color: '#FACC15' }} />
        <h4 className="font-display font-semibold text-white text-sm">{t('shop.shelfTitle')}</h4>
      </div>
      <p className="text-xs text-white/45 mb-4">{t('shop.shelfSubtitle')}</p>
      {ownedPremiumTrees.length === 0 ? (
        <p className="text-xs text-white/35 italic">{t('shop.shelfEmpty')}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {ownedPremiumTrees.map((tree) => {
            const c = PREMIUM_COLORS[tree.key] || '#F59E0B';
            return (
              <div key={tree.key} className="flex flex-col items-center">
                {/* the "pedestal" — a small glowing base each item sits
                    on, same idea as a lit trophy-case shelf */}
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl mb-1.5"
                  style={{ background: `${c}26`, border: `1px solid ${c}55`, boxShadow: `0 6px 18px ${c}33` }}
                >
                  <TreeSvg speciesKey={tree.key} size={34} />
                </motion.div>
                <div className="h-1 w-8 rounded-full" style={{ background: `${c}55` }} />
                <span className="mt-1 max-w-[64px] truncate text-[10px] font-semibold text-white/70">{tree.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function CollectionCard({ collection, premiumTrees, onBuy, loading, requestStatus, t }) {
  const emojis = collection.treeKeys.map((k) => premiumTrees.find((pt) => pt.key === k)?.emoji || '🌳').join(' ');
  const individualTotal = collection.treeKeys.reduce((sum, k) => sum + (premiumTrees.find((pt) => pt.key === k)?.priceUsd || 0), 0);
  return (
    <div className="relative flex flex-col sm:flex-row items-center gap-5 rounded-3xl p-6 mb-4"
      style={{
        background: 'linear-gradient(135deg, rgba(124,106,240,0.12) 0%, rgba(250,204,21,0.10) 100%)',
        border: '1px solid rgba(124,106,240,0.25)', backdropFilter: 'blur(20px)',
      }}>
      <div className="text-4xl shrink-0">{emojis}</div>
      <div className="flex-1 min-w-0 text-center sm:text-start">
        <h3 className="font-display font-bold text-ink dark:text-white text-sm">{collection.name}</h3>
        <p className="text-xs text-ink/50 dark:text-white/40 mt-0.5">{collection.description}</p>
        {!collection.owned && individualTotal > 0 && (
          <p className="text-[11px] text-ink/35 dark:text-white/30 mt-1">
            {t('shop.collectionSavings', { individual: individualTotal.toFixed(2), bundle: collection.priceUsd.toFixed(2) })}
          </p>
        )}
      </div>
      {collection.owned ? (
        <div className="shrink-0 rounded-2xl px-5 py-2.5 text-xs font-semibold" style={{ background: 'rgba(124,106,240,0.15)', color: 'rgb(var(--accent-600))' }}>
          {t('shop.currentlyOwned')}
        </div>
      ) : requestStatus === 'pending' ? (
        <div className="shrink-0 rounded-2xl px-5 py-2.5 text-xs font-semibold text-center" style={{ background: 'rgba(124,106,240,0.15)', color: 'rgb(var(--accent-600))' }}>
          {t('shop.bankTransferPending')}
        </div>
      ) : (
        <div className="shrink-0 flex flex-col items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onBuy(collection)}
            disabled={loading}
            className="rounded-2xl px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)', boxShadow: '0 6px 16px rgb(var(--accent-500) / 0.35)' }}>
            {t('shop.buyCollection', { price: collection.priceUsd.toFixed(2) })}
          </motion.button>
          {requestStatus === 'rejected' && (
            <p className="text-[10px]" style={{ color: '#EF4444' }}>{t('shop.bankTransferRejected')}</p>
          )}
        </div>
      )}
    </div>
  );
}
function ConfirmModal({ tree, onConfirm, onCancel, loading, t }) {
  if (!tree) return null;
  const rarity = RARITY[tree.key] || RARITY.seedling;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(30,34,51,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-xs rounded-3xl p-7 text-center"
        style={{
          background:   'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(32px)',
          border:       '1px solid rgba(255,255,255,0.80)',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-center"><TreeSvg speciesKey={tree.key} size={56} /></div>
        <h3 className="font-display font-bold text-lg mb-1" style={{ color: '#1E2233' }}>{t('shop.unlockQ', { name: tree.name })}</h3>
        <p className="text-sm mb-5" style={{ color: 'rgba(30,34,51,0.50)' }}>{t('shop.spendText', { n: tree.cost.toLocaleString() })}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl py-2.5 text-sm font-semibold bg-ink/5" style={{ color: 'rgba(30,34,51,0.55)' }}>
            {t('common.cancel')}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${rarity.color}, ${rarity.color}CC)`, boxShadow: `0 4px 14px ${rarity.color}44` }}>
            {loading ? t('shop.unlocking') : `${t('shop.unlock')} ${tree.emoji}`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Tree Shop's only purchase path — same honor-system bank-transfer queue
// Premium uses (see SettingsModal's inline panel), just reached from a
// modal here instead of an inline card panel, since these cards don't
// have room to expand in place. Submitting creates a 'pending' row in
// the same bank_transfer_requests table (item_type 'tree'/'collection'),
// which shows up in Haneen's admin Bank Transfers queue exactly like a
// Premium request — approving it there grants user_trees instead of
// flipping is_premium (see server/routes/admin.js).
function BankTransferModal({ item, itemType, bankDetails, note, onNoteChange, onSubmit, onPayCard, payingWithCard, onCancel, loading, t }) {
  const [isGift, setIsGift]       = useState(false);
  const [giftEmail, setGiftEmail] = useState('');
  // Reset the gift toggle/email whenever a fresh item is opened, rather
  // than leaving a stale email typed for a previous purchase silently
  // attached to this one.
  useEffect(() => { setIsGift(false); setGiftEmail(''); }, [item?.key]);
  if (!item) return null;
  const c = PREMIUM_COLORS[item.key] || '#7C6AF0';
  const copyIban = () => {
    if (!bankDetails?.iban) return;
    navigator.clipboard?.writeText(bankDetails.iban).then(() => {}, () => {});
  };
  const giftEmailTrimmed = isGift ? giftEmail.trim() : null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(30,34,51,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-sm rounded-3xl p-6 text-start"
        style={{
          background:   'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(32px)',
          border:       '1px solid rgba(255,255,255,0.80)',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-bold text-base text-center mb-1" style={{ color: '#1E2233' }}>
          {t('shop.bankTransferModalTitle', { name: item.name })}
        </h3>
        <p className="text-center text-sm font-bold mb-4" style={{ color: c }}>${item.priceUsd.toFixed(2)} USD</p>

        {/* Gifting — buy it, someone else's shelf gets it. Shared between
            both payment paths below (card and bank transfer), so it sits
            once, up top, rather than duplicated per-method. Off by
            default: this is an extra step most purchases don't need, not
            something to nudge every buyer toward. */}
        <button
          onClick={() => setIsGift((v) => !v)}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-start"
          style={{
            background: isGift ? `${c}1F` : 'rgba(0,0,0,0.03)',
            color: isGift ? c : 'rgba(30,34,51,0.55)',
            border: `1px solid ${isGift ? `${c}55` : 'rgba(0,0,0,0.06)'}`,
          }}>
          <Gift size={14} className="shrink-0" />
          {t('shop.giftToggle')}
        </button>
        {isGift && (
          <input
            type="email"
            value={giftEmail}
            onChange={(e) => setGiftEmail(e.target.value)}
            placeholder={t('shop.giftEmailPh')}
            className="mt-2 w-full rounded-lg px-2.5 py-2 text-xs"
            style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${c}33`, color: 'inherit' }}
          />
        )}

        {/* Instant option — pay with card via Lahza, land back here with
            access already granted. This is the option most people want;
            the bank-transfer honor system below stays as a fallback for
            anyone whose card doesn't work with Lahza, or who'd rather. */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => onPayCard(itemType, item.key, giftEmailTrimmed)}
          disabled={payingWithCard || (isGift && !giftEmailTrimmed)}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${c}, ${c}CC)`, boxShadow: `0 4px 14px ${c}44` }}>
          <CreditCard size={15} />
          {payingWithCard ? t('shop.redirectingToLahza') : t('shop.payWithCard')}
        </motion.button>
        <p className="text-center text-[10px] mt-1.5" style={{ color: 'rgba(30,34,51,0.40)' }}>
          {t('shop.payWithCardHint')}
        </p>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(30,34,51,0.35)' }}>
            {t('shop.orDivider')}
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
        </div>

        <p className="text-[11px] font-semibold mb-2" style={{ color: 'rgba(30,34,51,0.55)' }}>
          {t('shop.payByBankTransfer')}
        </p>
        <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: `${c}14`, border: `1px solid ${c}33` }}>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: `${c}CC` }}>
            {t('settings.bankTransferAmount')}
          </p>
          <p className="text-sm font-bold" style={{ color: '#1E2233' }}>${item.priceUsd.toFixed(2)} USD</p>

          <p className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: `${c}CC` }}>
            {t('settings.bankTransferIban')}
          </p>
          <div className="flex items-center gap-1.5">
            <code className="text-[11px] font-mono break-all" style={{ color: 'rgba(30,34,51,0.80)' }}>{bankDetails?.iban}</code>
            <button onClick={copyIban} title={t('settings.copy')} className="shrink-0" style={{ color: 'rgba(30,34,51,0.40)' }}>
              <Copy size={13} />
            </button>
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(30,34,51,0.50)' }}>
            {bankDetails?.bankName} — {bankDetails?.accountName}
          </p>

          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t('settings.bankTransferNotePh')}
            rows={2}
            maxLength={500}
            className="mt-2 w-full rounded-lg px-2.5 py-2 text-xs resize-none"
            style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${c}33`, color: 'inherit' }}
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 rounded-2xl py-2.5 text-sm font-semibold bg-ink/5" style={{ color: 'rgba(30,34,51,0.55)' }}>
            {t('common.cancel')}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => onSubmit(itemType, item.key, giftEmailTrimmed)}
            disabled={loading || (isGift && !giftEmailTrimmed)}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${c}, ${c}CC)`, boxShadow: `0 4px 14px ${c}44` }}>
            {loading ? t('settings.sending') : t('settings.bankTransferSubmit')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// The Constellation — the user's own zodiac, always drawn as its full
// 7-point shape (starLayout, from the server's lib/zodiac.js) so the
// whole outline is visible as a guide from the very first star. Each
// point is one of three states: already claimed (a real MysticSvg,
// clickable to edit/equip), the next one up for grabs (a pulsing "+"),
// or still locked (a faint placeholder dot, further out to earn).
function ConstellationSky({ starLayout, zodiacGlyph, zodiacEmoji, complete, trees, pendingSlot, onEdit, onEquip, onDesign, loading, t }) {
  const bgStars = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    x: (i * 37) % 100, y: (i * 53 + 7) % 100, size: 1 + (i % 3), delay: (i % 5) * 0.4,
  })), []);
  const byIndex = useMemo(() => {
    const m = new Map();
    trees.forEach((tr) => m.set(tr.star_index, tr));
    return m;
  }, [trees]);
  const pendingIndex = pendingSlot ? trees.length : -1;

  return (
    <div className="relative rounded-3xl p-6 overflow-hidden" style={{
      minHeight: 260,
      background: complete
        ? 'linear-gradient(160deg, #1a1330 0%, #2a1a4a 55%, #3a2258 100%)'
        : 'linear-gradient(160deg, #14102b 0%, #1f1640 55%, #2a1a4a 100%)',
      border: complete ? '1px solid rgba(250,204,21,0.35)' : '1px solid rgba(139,92,246,0.30)',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.06)',
    }}>
      {/* Connect-the-dots alone doesn't read as "lion"/"scales"/whatever
          at 7 points in a small panel — real constellations barely read
          that way even in an actual night sky. A big, very faint
          silhouette of the sign's own emoji behind everything else gives
          instant recognition; `brightness(0) invert(1)` strips the
          emoji's color out entirely so it reads as a soft shape, not a
          tiny colorful sticker competing with the stars. */}
      {zodiacEmoji && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{
            fontSize: 'min(70%, 220px)',
            lineHeight: 1,
            filter: 'brightness(0) invert(1) blur(1px)',
            opacity: 0.07,
          }}>
          {zodiacEmoji}
        </div>
      )}
      {complete && (
        <div className="absolute top-3 end-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: 'rgba(250,204,21,0.16)', color: '#FACC15', border: '1px solid rgba(250,204,21,0.35)' }}>
          🏆 {t('shop.mysticComplete')}
        </div>
      )}
      {bgStars.map((s, i) => (
        <motion.span key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.12, 0.75, 0.12] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
        />
      ))}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {starLayout.slice(1).map(([x, y], i) => {
          const [px, py] = starLayout[i];
          const bothClaimed = byIndex.has(i) && byIndex.has(i + 1);
          return (
            <line key={i} x1={px} y1={py} x2={x} y2={y}
              stroke={bothClaimed ? 'rgba(196,181,253,0.40)' : 'rgba(196,181,253,0.14)'}
              strokeWidth="0.3" strokeDasharray={bothClaimed ? undefined : '1.6 1.6'} />
          );
        })}
      </svg>
      {starLayout.map(([x, y], i) => {
        const tree = byIndex.get(i);
        if (tree) {
          return (
            <div key={i} className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}>
              <button onClick={() => onEdit(tree)} className="relative" title={t('common.edit') || 'Edit'}>
                <MysticSvg shapeKey={tree.shape_key || tree.zodiac_key} size={48} colorHex={tree.color_hex} glowHex={tree.glow_hex} />
              </button>
              <span className="mt-1 max-w-[90px] truncate text-[10px] font-semibold text-white/85">{tree.custom_name}</span>
              {tree.equipped ? (
                <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: '#86EFAC' }}>
                  <Check size={9} /> {t('shop.equipped')}
                </span>
              ) : (
                <button onClick={() => onEquip(tree)} disabled={loading}
                  className="mt-0.5 text-[9px] font-semibold underline decoration-dotted disabled:opacity-50"
                  style={{ color: 'rgba(196,181,253,0.85)' }}>
                  {t('shop.equip')}
                </button>
              )}
            </div>
          );
        }
        if (i === pendingIndex) {
          return (
            <div key={i} className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}>
              <motion.button onClick={onDesign} disabled={loading}
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white/70 disabled:opacity-50"
                style={{ border: '1.5px dashed rgba(255,255,255,0.45)' }}
                animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2, repeat: Infinity }}>
                +
              </motion.button>
              <span className="mt-1 max-w-[90px] text-center text-[10px] font-semibold text-white/70">{t('shop.mysticDesign')}</span>
            </div>
          );
        }
        // Still locked — a faint placeholder so the full shape is
        // visible as a guide before it's earned.
        return (
          <div key={i} className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, width: 14, height: 14, border: '1px dashed rgba(255,255,255,0.18)' }}>
            <span className="text-[9px] opacity-30">{zodiacGlyph}</span>
          </div>
        );
      })}
    </div>
  );
}

// Shown once, the first time a user's zodiac actually resolves (see
// TreeShop's showZodiacIntro effect) — explains the mechanic before
// they hit a locked star and wonder why nothing's designable anymore.
function ZodiacIntroModal({ zodiacKey, zodiacGlyph, zodiacEmoji, onClose, t }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center px-4"
      style={{ background: 'rgba(20,16,43,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-sm rounded-3xl p-7 text-center"
        style={{
          background: 'linear-gradient(160deg, #14102b 0%, #1f1640 55%, #2a1a4a 100%)',
          border: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">{zodiacEmoji || '✨'}</div>
        <h3 className="font-display font-bold text-lg text-white mb-1">
          {t('shop.zodiacIntroTitle', { sign: zodiacKey ? t(`zodiac.${zodiacKey}`) : '' })}
        </h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {t('shop.zodiacIntroBody')}
        </p>
        <button onClick={onClose}
          className="w-full rounded-2xl py-2.5 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', boxShadow: '0 4px 14px rgba(139,92,246,0.44)' }}>
          {t('shop.zodiacIntroCta')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// Purchase-reveal celebration — shown once right after a Lahza card
// payment confirms (see the lahza_ref useEffect in TreeShop below),
// replacing what used to be just a plain toast. Haneen's call: an instant
// purchase deserves an actual payoff moment, not just a passing
// confirmation — a burst of particles, the item's own emoji front and
// center, and copy that's aware of whether this was bought for the
// buyer's own Shelf or sent as a gift to someone else.
function PurchaseRevealModal({ reveal, onClose, t }) {
  // Keyed on itemKey so a second purchase (a different item) re-rolls the
  // particle layout instead of silently reusing the previous burst.
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const dist = 68 + (i % 3) * 22;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: (i % 5) * 0.04,
      emoji: ['✨', '🎉', '⭐'][i % 3],
    };
  }), [reveal?.itemKey, reveal?.itemType]);
  if (!reveal) return null;
  const c = PREMIUM_COLORS[reveal.itemKey] || '#8B5CF6';
  const isPremium = reveal.itemType === 'premium';
  const centerEmoji = reveal.isGift ? '🎁' : isPremium ? '👑' : (reveal.emoji || '🌳');
  const title = reveal.isGift
    ? t('shop.revealGiftTitle')
    : t(isPremium ? 'shop.revealPremiumTitle' : 'shop.revealTreeTitle', { label: reveal.label || '' });
  const body = reveal.isGift
    ? (reveal.giftRecipientEmail
        ? t('shop.revealGiftBody', { label: reveal.label || '', email: reveal.giftRecipientEmail })
        : t('shop.revealGiftBodyGeneric', { label: reveal.label || '' }))
    : t(isPremium ? 'shop.revealPremiumBody' : 'shop.revealTreeBody');
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center px-4"
      style={{ background: 'rgba(20,16,35,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.75, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="relative w-full max-w-xs rounded-3xl p-8 text-center"
        style={{
          background:  'linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.90) 100%)',
          border:      `1px solid ${c}55`,
          boxShadow:   `0 30px 70px rgba(0,0,0,0.25), 0 0 0 1px ${c}22`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
          {particles.map((p, i) => (
            <motion.span
              key={i}
              className="absolute text-lg pointer-events-none select-none"
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
              transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
            >
              {p.emoji}
            </motion.span>
          ))}
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ background: `${c}22`, boxShadow: `0 0 0 1px ${c}44, 0 8px 24px ${c}33` }}
          >
            {centerEmoji}
          </motion.div>
        </div>
        <h3 className="font-display font-bold text-lg mb-1.5" style={{ color: '#1E2233' }}>{title}</h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(30,34,51,0.55)' }}>{body}</p>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full rounded-2xl py-2.5 text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${c}, ${c}CC)`, boxShadow: `0 4px 14px ${c}44` }}
        >
          {t('shop.revealCta')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function MysticModal({ open, mode, initial, zodiacKey, onSave, onCancel, loading, t }) {
  const [form, setForm] = useState(initial);
  // Real bug that used to live here: resetting on [open, initial] meant
  // ANY change to `initial` while the modal was already open reset the
  // form — not just the moment it opened. `initial` is now memoized
  // upstream (see TreeShop's mysticInitial) so this alone would already
  // help, but resetting only on the open:false→true transition is the
  // actually-correct behavior regardless of whether the parent object
  // happens to be stable — a form shouldn't silently reset while someone
  // is actively editing it, full stop.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) setForm(initial);
    wasOpenRef.current = open;
  }, [open, initial]);
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(30,34,51,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-sm rounded-3xl p-7"
        style={{
          background:   'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(32px)',
          border:       '1px solid rgba(255,255,255,0.80)',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center mb-5">
          {/* Preview matches where this actually lives — a patch of the
              same night sky as the real Constellation panel, not a
              light card frame that doesn't resemble the final spot. */}
          <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #14102b 0%, #1f1640 55%, #2a1a4a 100%)',
              border: '1px solid rgba(139,92,246,0.30)',
            }}>
            <MysticSvg shapeKey={zodiacKey} size={44} colorHex={form.color_hex} glowHex={form.glow_hex} />
          </div>
          <p className="font-display font-bold text-sm" style={{ color: '#1E2233' }}>{form.custom_name || t('shop.mysticNamePh')}</p>
        </div>

        {/* Colour tints both layers of the star's glow (core + halo —
            see MysticTreeIcon.jsx) — one pick, not two, since a star's
            own light and its corona reading as the same color is more
            true to how a real star actually looks than a mismatched pair. */}
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(30,34,51,0.35)' }}>{t('shop.mysticColor')}</p>
        <div className="flex gap-2.5 mb-4 flex-wrap">
          {MYSTIC_COLORS.map((c) => (
            <button key={c} onClick={() => setForm({ ...form, color_hex: c, glow_hex: c })}
              className="h-8 w-8 rounded-full transition"
              style={{
                background: `linear-gradient(145deg, ${c} 0%, ${c}CC 100%)`,
                boxShadow: form.color_hex === c
                  ? `0 0 0 2px white, 0 0 10px 3px ${c}, 0 0 18px 6px ${c}99`
                  : `0 0 8px 2px ${c}88`,
              }} />
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(30,34,51,0.35)' }}>{t('shop.mysticName')}</p>
        <input
          className="input-field input-field-light mb-5"
          maxLength={24}
          placeholder={t('shop.mysticNamePh')}
          value={form.custom_name}
          onChange={(e) => setForm({ ...form, custom_name: e.target.value })}
        />

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl py-2.5 text-sm font-semibold bg-ink/5" style={{ color: 'rgba(30,34,51,0.55)' }}>
            {t('common.cancel')}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => onSave(form)}
            disabled={loading || !form.custom_name.trim()}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${form.color_hex}, ${form.glow_hex})`, boxShadow: `0 4px 14px ${form.color_hex}44` }}>
            {loading ? t('shop.mysticSaving') : (mode === 'edit' ? t('shop.mysticSaveEdit') : t('shop.mysticSave'))}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function TreeShop() {
  const toast = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [mysticModalOpen, setMysticModalOpen] = useState(false);
  const [mysticEditingId, setMysticEditingId] = useState(null); // null = designing a new slot
  const [mysticActing,    setMysticActing]    = useState(false);
  const [showZodiacIntro, setShowZodiacIntro] = useState(false);
  const [buying, setBuying] = useState(false);
  // Bank transfer — same honor-system path Premium uses (see
  // SettingsModal). bankDetails is the shared IBAN/account info (one
  // endpoint, reused from focus.js rather than duplicated here);
  // myTreeRequests is every tree/collection request this user has ever
  // sent, so each card can show its OWN pending/rejected state rather
  // than just the single most-recent one the way Premium's /mine works.
  // buyTarget is which tree/collection the modal is currently open for
  // (with its itemType), null = closed.
  const [bankDetails, setBankDetails] = useState(null);
  const [myTreeRequests, setMyTreeRequests] = useState([]);
  const [buyTarget, setBuyTarget] = useState(null);
  const [transferNote, setTransferNote] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  // Lahza card checkout — instant alternative to the bank-transfer honor
  // system above. payingWithCard tracks the in-flight POST /lahza/checkout
  // call (before the redirect fires); verifyingLahza tracks the return
  // trip, right after Lahza sends the browser back here.
  const [payingWithCard, setPayingWithCard] = useState(false);
  const [verifyingLahza, setVerifyingLahza] = useState(false);
  // The purchase-reveal celebration (see PurchaseRevealModal above) — set
  // from the verify response itself (label/emoji/isGift/itemType, added
  // server-side in routes/lahza.js) the moment a Lahza purchase confirms,
  // null the rest of the time.
  const [reveal, setReveal] = useState(null);
  const load = useCallback(async () => {
    try { setData(await api.get('/trees')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/focus/premium/bank-transfer/details').then(setBankDetails).catch(() => setBankDetails(null));
    api.get('/trees/bank-transfer/mine').then((d) => setMyTreeRequests(d.requests || [])).catch(() => setMyTreeRequests([]));
  }, []);
  // Runs once on mount, whether the user arrived here fresh or just got
  // redirected back from Lahza's checkout page. routes/lahza.js's
  // callback_url always points at /trees?lahza_ref=..., regardless of
  // whether the purchase was a tree, collection, or Premium plan started
  // from Settings — this is the one place that param is ever handled.
  // This is the fast path (grants the moment the user is looking at the
  // screen); the webhook (server-side) is the reliable backstop for
  // anyone who closes the tab before this runs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('lahza_ref');
    if (!ref) return;
    // Strip the param immediately so a manual refresh doesn't re-verify
    // (harmless since completeLahzaPayment is idempotent, but pointless).
    params.delete('lahza_ref');
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState({}, '', cleanUrl);
    setVerifyingLahza(true);
    api.get(`/lahza/verify/${encodeURIComponent(ref)}`)
      .then((result) => {
        if (result?.ok) {
          // The reveal modal is the real celebration now; the toast stays
          // too since it's the same "confirmed" signal used everywhere
          // else in the app, and the modal can take a beat to notice on a
          // slow connection.
          toast.success(t('shop.lahzaSuccess'));
          setReveal(result);
          load();
          api.get('/trees/bank-transfer/mine').then((d) => setMyTreeRequests(d.requests || [])).catch(() => {});
        } else {
          toast.error(t('shop.lahzaFailed'));
        }
      })
      .catch(() => toast.error(t('shop.lahzaFailed')))
      .finally(() => setVerifyingLahza(false));
  }, []); // eslint-disable-line
  const requestStatusFor = (key) => {
    // Most recent request for this exact item — a rejected old request
    // shouldn't hide a newer pending one for the same tree/collection.
    // Gift requests are excluded: a "pending"/"rejected" badge here means
    // "your own shelf is affected", which isn't true for something you
    // bought to send to someone else — that status only matters to the
    // recipient, who doesn't have a request row of their own to look at.
    const reqs = myTreeRequests.filter((r) => r.item_key === key && !r.gift_recipient_email);
    return reqs[0]?.status || null;
  };
  const buyPremiumTree = (tree) => { setBuyTarget({ item: tree, itemType: 'tree' }); setTransferNote(''); };
  const buyCollection = (collection) => { setBuyTarget({ item: collection, itemType: 'collection' }); setTransferNote(''); };
  const submitTreeBankTransfer = async (itemType, itemKey, giftRecipientEmail) => {
    setSubmittingTransfer(true);
    try {
      await api.post('/trees/bank-transfer', {
        item_type: itemType, item_key: itemKey, reference_note: transferNote,
        gift_recipient_email: giftRecipientEmail || undefined,
      });
      const d = await api.get('/trees/bank-transfer/mine');
      setMyTreeRequests(d.requests || []);
      setBuyTarget(null);
      setTransferNote('');
      toast.success(giftRecipientEmail ? t('shop.giftSubmitted') : t('shop.bankTransferSubmitted'));
    } catch (e) { toast.error(e.message); }
    finally { setSubmittingTransfer(false); }
  };
  // Lahza card checkout — POST /lahza/checkout records a 'pending' row
  // (same table as bank transfer, item_type/item_key identical shape) and
  // hands back a hosted checkout URL. Redirecting the whole tab there is
  // deliberate, not a popup: Lahza's own page needs the full page context
  // for its own redirect back to callback_url once payment completes.
  const payWithCard = async (itemType, itemKey, giftRecipientEmail) => {
    setPayingWithCard(true);
    try {
      const res = await api.post('/lahza/checkout', {
        item_type: itemType, item_key: itemKey,
        gift_recipient_email: giftRecipientEmail || undefined,
      });
      if (res?.authorization_url) {
        toast.success(t('shop.redirectingToLahza'));
        window.location.href = res.authorization_url;
      } else {
        toast.error(t('shop.lahzaFailed'));
        setPayingWithCard(false);
      }
    } catch (e) {
      toast.error(e.status === 503 ? t('shop.lahzaNotConfigured') : (e.message || t('shop.lahzaFailed')));
      setPayingWithCard(false);
    }
  };
  // First time this account's zodiac actually resolves (birthday set,
  // sign derived), explain the mechanic once — same
  // "nuvora_onboarded_<id>" localStorage pattern used by Onboarding.jsx,
  // scoped per account so it doesn't nag again on every visit, but does
  // show again for a different account signed into the same browser.
  useEffect(() => {
    if (!data?.mystic || data.mystic.needsBirthday || !user?.id) return;
    const key = `nuvora_seen_zodiac_intro_${user.id}`;
    if (!localStorage.getItem(key)) setShowZodiacIntro(true);
  }, [data?.mystic?.needsBirthday, data?.mystic?.zodiacKey, user?.id]);
  const dismissZodiacIntro = () => {
    if (user?.id) { try { localStorage.setItem(`nuvora_seen_zodiac_intro_${user.id}`, '1'); } catch (_) {} }
    setShowZodiacIntro(false);
  };
  const handleUnlock = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await api.post('/trees/unlock', { tree_key: confirm.key });
      toast.success(`${confirm.emoji} −${confirm.cost} XP`);
      setConfirm(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(false); }
  };
  const handleEquip = async (key) => {
    setActing(true);
    try {
      await api.post('/trees/equip', { tree_key: key });
      const tree = data?.trees.find(tr => tr.key === key);
      toast.success(`${tree?.emoji || (key.startsWith('mystic') ? '🔮' : '🌳')} ✓`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(false); }
  };
  const openMysticDesign = () => {
    setMysticEditingId(null);
    setMysticModalOpen(true);
  };
  const openMysticEdit = (tree) => {
    setMysticEditingId(tree.id);
    setMysticModalOpen(true);
  };
  const handleMysticSave = async (form) => {
    setMysticActing(true);
    try {
      if (mysticEditingId != null) {
        await api.put(`/trees/mystic/${mysticEditingId}`, form);
        toast.success(`🔮 ${form.custom_name}`);
      } else {
        await api.post('/trees/mystic/create', form);
        toast.success(`🔮 ${form.custom_name} designed!`);
      }
      setMysticModalOpen(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setMysticActing(false); }
  };
  // These two used to sit AFTER the loading/error early-returns below.
  // That's a real Rules-of-Hooks violation, not just a style nit: the
  // very first render always hits `if (loading) return <PageLoader/>`
  // before ever reaching this useMemo (loading starts true), so React
  // records this mounted instance as calling N hooks. The moment data
  // actually comes back and the page renders for real, execution now
  // runs *past* both early returns and calls this useMemo too — N+1
  // hooks on the same instance. React always throws on that mismatch
  // (minified error #310, "Rendered fewer hooks than expected"), and
  // it's deterministic — not a rare edge case — which is why the page
  // crashed on essentially every real visit once data loaded, taking
  // the whole app down with it (only one ErrorBoundary, at the root).
  // Hooks must run unconditionally on every render, so this — and the
  // plain variable it depends on — move above both early returns.
  // `data` is optional-chained throughout, so this is safe to compute
  // before `data` even exists yet.
  const editingMysticTree = mysticEditingId != null
    ? data?.mystic?.trees.find((mt) => mt.id === mysticEditingId)
    : null;
  // Real bug that used to live here: this was a brand-new object literal
  // on every single render of TreeShop, not just when the editing target
  // actually changed. MysticModal's own effect resets its form whenever
  // `initial` changes by reference (see MysticModal below) — so ANY
  // re-render of TreeShop while the edit modal was open (a data reload,
  // an unrelated state toggle, even just ToastContext's own unmemoized
  // value causing extra re-renders app-wide) silently wiped out whatever
  // the user had already changed mid-edit, snapping back to the
  // originally-saved design. useMemo, keyed on the actual field values
  // (not the tree object's reference, which also changes every reload),
  // means this only produces a new object when the real editing target
  // changes.
  // Glow always mirrors Colour now (see MysticModal — the separate Glow
  // picker was removed), so this only reads color_hex even for a star
  // that was designed back when the two could differ.
  const mysticInitial = useMemo(() => (
    editingMysticTree
      ? { color_hex: editingMysticTree.color_hex, glow_hex: editingMysticTree.color_hex, custom_name: editingMysticTree.custom_name }
      : { color_hex: MYSTIC_COLORS[0], glow_hex: MYSTIC_COLORS[0], custom_name: '' }
  ), [
    mysticEditingId,
    editingMysticTree?.color_hex,
    editingMysticTree?.custom_name,
  ]);

  if (loading) return <PageLoader />;
  // Real bug that used to live here: if the /trees fetch failed, `data`
  // stayed null (the catch block only toasts, it never set any fallback),
  // but every `data?.trees.find/.filter/.map` below only guards the
  // `data` access itself — `?.trees` becomes `undefined`, and calling
  // `.find`/`.filter`/`.map` on `undefined` throws immediately. With only
  // one ErrorBoundary for the whole app, a single failed request here
  // used to blank the entire page, not just this one. Now it just shows
  // a retry state on this page instead.
  if (!data) {
    return (
      <div>
        <PageHeader eyebrow={t('shop.eyebrow')} title={t('shop.title')} subtitle={t('shop.subtitle')} />
        <div className="rounded-2xl px-5 py-6 text-sm text-ink/60 dark:text-white/50 text-center"
          style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.65)' }}>
          {t('shop.loadFailed')}
          <button
            onClick={() => { setLoading(true); load(); }}
            className="block mx-auto mt-3 px-4 py-2 rounded-xl font-semibold text-sm bg-lavender-500 text-white"
          >
            {t('exam.tryAgain')}
          </button>
        </div>
      </div>
    );
  }
  // Premium trees are equippable now too (see handleEquip/PremiumTreeCard
  // above), so "currently grown" needs to check both catalogues — a
  // premium tree being equipped used to be silently invisible here,
  // since this only ever looked at the free/earnable list.
  const equippedTree = data?.trees.find(tr => tr.equipped) || data?.premiumTrees?.find(tr => tr.equipped);
  const equippedMystic = data?.mystic?.trees.find((mt) => mt.equipped);
  const ownedCount   = data?.trees.filter(tr => tr.owned).length || 0;
  const EARN = [
    { icon: '✅', action: t('shop.earnTask'),  xp: '+20 XP' },
    { icon: '🔁', action: t('shop.earnHabit'), xp: '+5 XP'  },
    { icon: '🎯', action: t('shop.earnGoal'),  xp: '+100 XP'},
    { icon: '⏱', action: t('shop.earnFocus'), xp: '+2 XP'  },
  ];
  return (
    <div>
      <PageHeader eyebrow={t('shop.eyebrow')} title={t('shop.title')} subtitle={t('shop.subtitle')} />
      <XPBar totalXp={data?.totalXp || 0} t={t} />
      <div className="flex gap-3 mb-8 flex-wrap">
        {[
          { label: t('shop.treesOwned'),     value: `${ownedCount} / ${data?.trees.length}` },
          { label: t('shop.currentlyGrown'), value: equippedTree
              ? `${equippedTree.emoji} ${equippedTree.name}`
              : (equippedMystic ? `✦ ${equippedMystic.custom_name}` : '—') },
          { label: t('shop.totalEarned'),    value: ((data?.totalXp || 0) + data?.trees.filter(tr => tr.owned && tr.cost > 0).reduce((s, tr) => s + tr.cost, 0)).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col rounded-2xl px-5 py-3"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)' }}>
            <span className="text-xs text-ink/40 mb-0.5">{label}</span>
            <span className="font-display font-bold text-ink">{value}</span>
          </div>
        ))}
      </div>
      {data?.mystic && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{data.mystic.zodiacEmoji || '🌌'}</span>
              <div>
                <h3 className="font-display font-semibold text-ink dark:text-white text-sm">
                  {data.mystic.zodiacKey ? t(`zodiac.${data.mystic.zodiacKey}`) : t('shop.mysticTitle')}
                </h3>
                <span className="text-[11px] font-semibold" style={{ color: '#8B5CF6' }}>
                  {t('shop.mysticProgress', { designed: data.mystic.designedCount, unlocked: data.mystic.starCount })}
                </span>
              </div>
            </div>
            {!data.mystic.needsBirthday && (
              <span className="text-xs text-ink/40 dark:text-white/30">
                {data.mystic.complete
                  ? t('shop.mysticComplete')
                  : t('shop.mysticXpToNext', { n: (data.mystic.xpUntilNextStar || 0).toLocaleString() })}
              </span>
            )}
          </div>
          {data.mystic.needsBirthday ? (
            <div className="rounded-2xl px-5 py-4 text-xs text-ink/40 dark:text-white/30"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.25)' }}>
              {t('shop.mysticNeedsBirthday')}
            </div>
          ) : (
            <ConstellationSky
              starLayout={data.mystic.starLayout}
              zodiacGlyph={data.mystic.zodiacGlyph}
              zodiacEmoji={data.mystic.zodiacEmoji}
              complete={data.mystic.complete}
              trees={data.mystic.trees}
              pendingSlot={data.mystic.pendingSlot}
              onEdit={openMysticEdit}
              onEquip={(tree) => handleEquip(`mystic:${tree.id}`)}
              onDesign={openMysticDesign}
              loading={acting}
              t={t}
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.trees.map((tree) => (
          <TreeCard key={tree.key} tree={tree} onUnlock={(tr) => setConfirm(tr)} onEquip={handleEquip} loading={acting} t={t} />
        ))}
      </div>
      {/* Premium tier — every tree above tops out at 5000 XP (Crystal
          Tree); these three sit past that ceiling on purpose, real-money
          only, framed as the natural next step once someone's collected
          everything earnable rather than a random upsell dropped in. */}
      {data?.premiumTrees?.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} style={{ color: '#B45309' }} />
            <h3 className="font-display font-semibold text-ink dark:text-white text-sm">{t('shop.premiumTitle')}</h3>
          </div>
          <p className="text-xs text-ink/45 dark:text-white/35 mb-1">{t('shop.premiumSubtitle')}</p>
          <p className="text-[11px] font-medium mb-4" style={{ color: '#B45309' }}>{t('shop.treeAuraHint')}</p>
          <ShelfDisplay ownedPremiumTrees={data.premiumTrees.filter((tr) => tr.owned)} t={t} />
          {data.collections?.map((c) => (
            <CollectionCard key={c.key} collection={c} premiumTrees={data.premiumTrees} onBuy={buyCollection} loading={buying} requestStatus={requestStatusFor(c.key)} t={t} />
          ))}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.premiumTrees.map((tree) => (
              <PremiumTreeCard key={tree.key} tree={tree} onBuy={buyPremiumTree} onEquip={handleEquip} loading={buying || acting} requestStatus={requestStatusFor(tree.key)} t={t} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-10 rounded-3xl p-6"
        style={{ background: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-lavender-500" />
          <h3 className="font-display font-semibold text-ink dark:text-white text-sm">{t('shop.howToEarn')}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {EARN.map(({ icon, action, xp }) => (
            <div key={action} className="flex flex-col items-center text-center rounded-2xl p-3"
              style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.65)' }}>
              <span className="text-2xl mb-1">{icon}</span>
              <span className="text-xs text-ink/55 leading-tight mb-1">{action}</span>
              <span className="text-xs font-bold text-lavender-600">{xp}</span>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {confirm && (
          <ConfirmModal tree={confirm} onConfirm={handleUnlock} onCancel={() => setConfirm(null)} loading={acting} t={t} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {buyTarget && (
          <BankTransferModal
            item={buyTarget.item}
            itemType={buyTarget.itemType}
            bankDetails={bankDetails}
            note={transferNote}
            onNoteChange={setTransferNote}
            onSubmit={submitTreeBankTransfer}
            onPayCard={payWithCard}
            payingWithCard={payingWithCard}
            onCancel={() => setBuyTarget(null)}
            loading={submittingTransfer}
            t={t}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mysticModalOpen && (
          <MysticModal
            open
            mode={mysticEditingId != null ? 'edit' : 'create'}
            initial={mysticInitial}
            zodiacKey={data?.mystic?.zodiacKey}
            onSave={handleMysticSave}
            onCancel={() => setMysticModalOpen(false)}
            loading={mysticActing}
            t={t}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showZodiacIntro && (
          <ZodiacIntroModal
            zodiacKey={data?.mystic?.zodiacKey}
            zodiacGlyph={data?.mystic?.zodiacGlyph}
            zodiacEmoji={data?.mystic?.zodiacEmoji}
            onClose={dismissZodiacIntro}
            t={t}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reveal && (
          <PurchaseRevealModal reveal={reveal} onClose={() => setReveal(null)} t={t} />
        )}
      </AnimatePresence>
    </div>
  );
}