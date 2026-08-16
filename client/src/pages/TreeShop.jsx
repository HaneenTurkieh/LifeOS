import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lock, Check, Pencil } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PageLoader from '../components/Loader.jsx';
import MysticSvg  from '../components/MysticTreeIcon.jsx';

// ── Mystic Tree — shape + colour picker, not a fixed preset ────
const MYSTIC_SHAPES = ['spiral', 'crystal', 'orbs', 'bloom', 'bough'];
const MYSTIC_COLORS = ['#8B5CF6', '#F472B6', '#F59E0B', '#10B981', '#38BDF8', '#6366F1', '#FB7185', '#EAB308'];

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
        className="text-6xl mb-3 select-none"
        style={{ filter: !tree.owned && !tree.canAfford ? 'grayscale(0.75) opacity(0.7)' : 'none' }}>
        {tree.emoji}
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
        <div className="text-5xl mb-3">{tree.emoji}</div>
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

// A slot that's been earned (1000 more lifetime XP crossed) but not
// designed yet — free to fill, nothing to spend, just an invite.
function MysticDesignSlotCard({ onDesign, loading, t }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      className="relative flex flex-col items-center rounded-3xl p-6 text-center overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(139,92,246,0.16) 0%, rgba(244,114,182,0.10) 50%, rgba(56,189,248,0.14) 100%)',
        border:     '1px solid rgba(139,92,246,0.35)',
        boxShadow:  '0 12px 32px rgba(139,92,246,0.18), inset 0 2px 0 rgba(255,255,255,0.5)',
      }}
    >
      <motion.div
        className="absolute inset-0 opacity-30 pointer-events-none"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage: 'linear-gradient(120deg, #8B5CF6, #F472B6, #38BDF8, #8B5CF6)',
          backgroundSize:  '300% 300%',
          mixBlendMode:    'overlay',
        }}
      />
      <div className="absolute top-3 end-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
        style={{ background: 'rgba(139,92,246,0.18)', color: '#8B5CF6' }}>
        {t('shop.mysticBadge')}
      </div>
      <div className="relative text-5xl mb-3">🔮</div>
      <h3 className="relative font-display font-bold text-ink dark:text-white text-sm mb-1">{t('shop.mysticSlotReady')}</h3>
      <p className="relative text-xs text-ink/50 dark:text-white/40 mb-4 leading-snug">
        {t('shop.mysticLocked')}
      </p>
      <motion.button
        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        onClick={onDesign}
        disabled={loading}
        className="relative w-full rounded-2xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #F472B6 100%)', boxShadow: '0 6px 16px rgba(139,92,246,0.4)' }}>
        {t('shop.mysticDesign')}
      </motion.button>
    </motion.div>
  );
}

// One already-designed mystic tree — equip / edit, just like any
// other tree card once it exists.
function MysticTreeCard({ tree, onEdit, onEquip, loading, t }) {
  const fillColor = tree.color_hex;
  const glowColor = tree.glow_hex;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex flex-col items-center rounded-3xl p-6 text-center"
      style={{
        background: tree.equipped
          ? `linear-gradient(145deg, ${fillColor}22 0%, ${fillColor}0A 100%)`
          : 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.30) 100%)',
        border: tree.equipped ? `2px solid ${fillColor}55` : '1px solid rgba(255,255,255,0.60)',
        backdropFilter:       'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: tree.equipped
          ? `0 12px 32px ${fillColor}22, inset 0 2px 0 rgba(255,255,255,0.70)`
          : '0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.75)',
      }}
    >
      {tree.equipped && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold text-white"
          style={{ background: fillColor, boxShadow: `0 2px 8px ${fillColor}55` }}>
          <Check size={10} /> {t('shop.equipped')}
        </div>
      )}
      <div className="absolute top-3 end-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
        style={{ background: `${fillColor}22`, color: fillColor }}>
        {t('shop.mysticBadge')}
      </div>
      <button onClick={onEdit}
        className="absolute top-3 start-3 text-ink/25 hover:text-ink/50 dark:text-white/25 dark:hover:text-white/50 transition p-1">
        <Pencil size={13} />
      </button>
      <motion.div
        animate={tree.equipped ? { y: [0, -4, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-3"
        style={{ color: fillColor, filter: `drop-shadow(0 0 10px ${glowColor}99)` }}>
        <MysticSvg shapeKey={tree.shape_key} size={56} />
      </motion.div>
      <h3 className="font-display font-bold text-ink dark:text-white text-sm mb-1">{tree.custom_name}</h3>
      <p className="text-xs text-ink/45 dark:text-white/35 mb-4 leading-snug">{t('shop.mysticOneOfKind')}</p>
      {tree.equipped ? (
        <div className="w-full rounded-2xl py-2 text-xs font-semibold text-center"
          style={{ background: `${fillColor}22`, color: fillColor }}>
          {t('shop.currentlyEq')}
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onEquip}
          disabled={loading}
          className="w-full rounded-2xl py-2 text-xs font-bold text-white disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${fillColor} 0%, ${fillColor}CC 100%)`, boxShadow: `0 4px 12px ${fillColor}44` }}>
          {t('shop.equip')}
        </motion.button>
      )}
    </motion.div>
  );
}

function MysticModal({ open, mode, initial, onSave, onCancel, loading, t }) {
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
          <div className="mb-2" style={{ color: form.color_hex, filter: `drop-shadow(0 0 12px ${form.glow_hex}99)` }}>
            <MysticSvg shapeKey={form.shape_key} size={64} />
          </div>
          <p className="font-display font-bold text-sm" style={{ color: '#1E2233' }}>{form.custom_name || t('shop.mysticNamePh')}</p>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(30,34,51,0.35)' }}>{t('shop.mysticShape')}</p>
        <div className="flex gap-2 mb-4">
          {MYSTIC_SHAPES.map((s) => (
            <button key={s} onClick={() => setForm({ ...form, shape_key: s })}
              className="flex-1 flex items-center justify-center rounded-xl py-2.5"
              style={{
                background: form.shape_key === s ? `${form.color_hex}1A` : 'rgba(0,0,0,0.04)',
                border:     form.shape_key === s ? `1.5px solid ${form.color_hex}` : '1px solid transparent',
                color:      form.color_hex,
              }}>
              <MysticSvg shapeKey={s} size={22} />
            </button>
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(30,34,51,0.35)' }}>{t('shop.mysticColor')}</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {MYSTIC_COLORS.map((c) => (
            <button key={c} onClick={() => setForm({ ...form, color_hex: c })}
              className="h-7 w-7 rounded-full transition"
              style={{ background: c, boxShadow: form.color_hex === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }} />
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(30,34,51,0.35)' }}>{t('shop.mysticGlow')}</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {MYSTIC_COLORS.map((c) => (
            <button key={c} onClick={() => setForm({ ...form, glow_hex: c })}
              className="h-7 w-7 rounded-full transition"
              style={{ background: c, boxShadow: form.glow_hex === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }} />
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
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [mysticModalOpen, setMysticModalOpen] = useState(false);
  const [mysticEditingId, setMysticEditingId] = useState(null); // null = designing a new slot
  const [mysticActing,    setMysticActing]    = useState(false);
  const load = useCallback(async () => {
    try { setData(await api.get('/trees')); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
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
  const mysticInitial = useMemo(() => (
    editingMysticTree
      ? { shape_key: editingMysticTree.shape_key, color_hex: editingMysticTree.color_hex, glow_hex: editingMysticTree.glow_hex, custom_name: editingMysticTree.custom_name }
      : { shape_key: MYSTIC_SHAPES[0], color_hex: MYSTIC_COLORS[0], glow_hex: MYSTIC_COLORS[1], custom_name: '' }
  ), [
    mysticEditingId,
    editingMysticTree?.shape_key,
    editingMysticTree?.color_hex,
    editingMysticTree?.glow_hex,
    editingMysticTree?.custom_name,
  ]);
  const equippedTree = data?.trees.find(tr => tr.equipped);
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
              : (equippedMystic ? `🔮 ${equippedMystic.custom_name}` : '—') },
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
              <span className="text-lg">🔮</span>
              <div>
                <h3 className="font-display font-semibold text-ink dark:text-white text-sm">{t('shop.mysticTitle')}</h3>
                <span className="text-[11px] font-semibold" style={{ color: '#8B5CF6' }}>
                  {t('shop.mysticCost', { n: (data.mystic.xpPerSlot || 1000).toLocaleString() })}
                </span>
              </div>
            </div>
            <span className="text-xs text-ink/40 dark:text-white/30">
              {t('shop.mysticProgress', { designed: data.mystic.designedCount, unlocked: data.mystic.unlockedSlots })}
              {' · '}{t('shop.mysticXpToNext', { n: data.mystic.xpUntilNextSlot.toLocaleString() })}
            </span>
          </div>
          {(data.mystic.trees.length > 0 || data.mystic.pendingSlot) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.mystic.trees.map((tree) => (
                <MysticTreeCard
                  key={tree.id}
                  tree={tree}
                  onEdit={() => openMysticEdit(tree)}
                  onEquip={() => handleEquip(`mystic:${tree.id}`)}
                  loading={acting}
                  t={t}
                />
              ))}
              {data.mystic.pendingSlot && (
                <MysticDesignSlotCard onDesign={openMysticDesign} loading={acting} t={t} />
              )}
            </div>
          ) : (
            <div className="rounded-2xl px-5 py-4 text-xs text-ink/40 dark:text-white/30"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.25)' }}>
              {t('shop.mysticNoneYet', { n: data.mystic.xpUntilNextSlot.toLocaleString() })}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.trees.map((tree) => (
          <TreeCard key={tree.key} tree={tree} onUnlock={(tr) => setConfirm(tr)} onEquip={handleEquip} loading={acting} t={t} />
        ))}
      </div>
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
        {mysticModalOpen && (
          <MysticModal
            open
            mode={mysticEditingId != null ? 'edit' : 'create'}
            initial={mysticInitial}
            onSave={handleMysticSave}
            onCancel={() => setMysticModalOpen(false)}
            loading={mysticActing}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}