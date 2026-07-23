import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lock, Check } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PageLoader from '../components/Loader.jsx';

const RARITY = {
  seedling:       { label: 'Starter',   color: '#4CC38A', bg: 'rgba(76,195,138,0.12)' },
  sprout:         { label: 'Common',    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  oak:            { label: 'Uncommon',  color: '#7C6AF0', bg: 'rgba(124,106,240,0.12)' },
  cherry_blossom: { label: 'Rare',      color: '#F472B6', bg: 'rgba(244,114,182,0.12)' },
  bamboo:         { label: 'Rare',      color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  palm:           { label: 'Epic',      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  pine:           { label: 'Epic',      color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  crystal:        { label: 'Legendary', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
};

function XPBar({ totalXp }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-5 py-3 mb-8"
      style={{
        background:   'linear-gradient(135deg, rgba(124,106,240,0.15) 0%, rgba(91,71,224,0.08) 100%)',
        border:       '1px solid rgba(124,106,240,0.25)',
        backdropFilter: 'blur(16px)',
      }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
        style={{ background: 'linear-gradient(135deg, #7C6AF0, #5B47E0)', boxShadow: '0 4px 12px rgba(124,106,240,0.35)' }}>
        ⚡
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-ink dark:text-white">
          {totalXp.toLocaleString()} <span className="text-lavender-500 text-lg">XP</span>
        </p>
        <p className="text-xs text-ink/40 dark:text-white/35">Available to spend</p>
      </div>
    </div>
  );
}

function TreeCard({ tree, onUnlock, onEquip, loading }) {
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
      {/* Equipped badge */}
      {tree.equipped && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold text-white"
          style={{ background: rarity.color, boxShadow: `0 2px 8px ${rarity.color}55` }}>
          <Check size={10} /> Equipped
        </div>
      )}

      {/* Lock overlay for unaffordable */}
      {!tree.owned && !tree.canAfford && (
        <div className="absolute inset-0 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(2px)' }}>
          <Lock size={20} className="text-ink/30" />
        </div>
      )}

      {/* Rarity badge */}
      <div className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
        style={{ background: rarity.bg, color: rarity.color }}>
        {rarity.label}
      </div>

      {/* Tree emoji */}
      <motion.div
        animate={tree.equipped ? { y: [0, -4, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-6xl mb-3 select-none"
        style={{ filter: !tree.owned && !tree.canAfford ? 'grayscale(1) opacity(0.4)' : 'none' }}>
        {tree.emoji}
      </motion.div>

      <h3 className="font-display font-bold text-ink dark:text-white text-sm mb-1">{tree.name}</h3>
      <p className="text-xs text-ink/45 dark:text-white/35 mb-4 leading-snug">{tree.description}</p>

      {/* Cost */}
      {tree.cost > 0 && (
        <div className="flex items-center gap-1 mb-4 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: tree.owned ? 'rgba(76,195,138,0.12)' : tree.canAfford ? 'rgba(124,106,240,0.12)' : 'rgba(0,0,0,0.06)',
            color:      tree.owned ? '#2DA76E' : tree.canAfford ? '#7C6AF0' : 'rgba(30,34,51,0.35)',
          }}>
          ⚡ {tree.cost.toLocaleString()} XP
        </div>
      )}

      {/* Action button */}
      {tree.owned ? (
        tree.equipped ? (
          <div className="w-full rounded-2xl py-2 text-xs font-semibold text-center"
            style={{ background: rarity.bg, color: rarity.color }}>
            ✓ Currently equipped
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onEquip(tree.key)}
            disabled={loading}
            className="w-full rounded-2xl py-2 text-xs font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${rarity.color} 0%, ${rarity.color}CC 100%)`, boxShadow: `0 4px 12px ${rarity.color}44` }}>
            Equip
          </motion.button>
        )
      ) : tree.canAfford ? (
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => onUnlock(tree)}
          disabled={loading}
          className="w-full rounded-2xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)',
            boxShadow:  '0 6px 16px rgba(124,106,240,0.38)',
          }}>
          ⚡ Unlock
        </motion.button>
      ) : (
        <div className="w-full rounded-2xl py-2 text-xs font-medium text-center text-ink/30 dark:text-white/25"
          style={{ background: 'rgba(0,0,0,0.04)' }}>
          Need {(tree.cost).toLocaleString()} XP
        </div>
      )}
    </motion.div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────
function ConfirmModal({ tree, onConfirm, onCancel, loading }) {
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
        <h3 className="font-display font-bold text-ink text-lg mb-1">Unlock {tree.name}?</h3>
        <p className="text-sm text-ink/50 mb-5">
          This will spend <span className="font-bold text-lavender-600">⚡ {tree.cost.toLocaleString()} XP</span> from your balance.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-ink/55 bg-ink/5">
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${rarity.color}, ${rarity.color}CC)`, boxShadow: `0 4px 14px ${rarity.color}44` }}>
            {loading ? 'Unlocking…' : `Unlock ${tree.emoji}`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function TreeShop() {
  const toast = useToast();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [confirm,  setConfirm]  = useState(null); // tree to confirm unlock

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
      const res = await api.post('/trees/unlock', { tree_key: confirm.key });
      toast.success(`${confirm.emoji} ${confirm.name} unlocked! −${confirm.cost} XP`);
      setConfirm(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(false); }
  };

  const handleEquip = async (key) => {
    setActing(true);
    try {
      await api.post('/trees/equip', { tree_key: key });
      const tree = data?.trees.find(t => t.key === key);
      toast.success(`${tree?.emoji || '🌳'} ${tree?.name} equipped!`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setActing(false); }
  };

  if (loading) return <PageLoader />;

  const equippedTree = data?.trees.find(t => t.equipped);
  const ownedCount   = data?.trees.filter(t => t.owned).length || 0;

  return (
    <div>
      <PageHeader
        eyebrow="Tree Shop"
        title="Grow your forest 🌳"
        subtitle="Spend XP earned from tasks, habits, and focus sessions to unlock tree species."
      />

      {/* XP balance */}
      <XPBar totalXp={data?.totalXp || 0} />

      {/* Stats row */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {[
          { label: 'Trees owned',    value: `${ownedCount} / ${data?.trees.length}` },
          { label: 'Currently grown', value: equippedTree ? `${equippedTree.emoji} ${equippedTree.name}` : '—' },
          { label: 'Total XP earned', value: ((data?.totalXp || 0) + data?.trees.filter(t => t.owned && t.cost > 0).reduce((s, t) => s + t.cost, 0)).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col rounded-2xl px-5 py-3"
            style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)' }}>
            <span className="text-xs text-ink/40 mb-0.5">{label}</span>
            <span className="font-display font-bold text-ink">{value}</span>
          </div>
        ))}
      </div>

      {/* Tree grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data?.trees.map((tree) => (
          <TreeCard
            key={tree.key}
            tree={tree}
            onUnlock={(t) => setConfirm(t)}
            onEquip={handleEquip}
            loading={acting}
          />
        ))}
      </div>

      {/* How to earn XP */}
      <div className="mt-10 rounded-3xl p-6"
        style={{ background: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-lavender-500" />
          <h3 className="font-display font-semibold text-ink dark:text-white text-sm">How to earn XP</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: '✅', action: 'Complete a task',       xp: '+20 XP' },
            { icon: '🔁', action: 'Log a recurring task',  xp: '+5 XP'  },
            { icon: '🎯', action: 'Complete a goal',       xp: '+100 XP'},
            { icon: '⏱', action: 'Focus session (5 min)', xp: '+2 XP'  },
          ].map(({ icon, action, xp }) => (
            <div key={action} className="flex flex-col items-center text-center rounded-2xl p-3"
              style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.65)' }}>
              <span className="text-2xl mb-1">{icon}</span>
              <span className="text-xs text-ink/55 leading-tight mb-1">{action}</span>
              <span className="text-xs font-bold text-lavender-600">{xp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            tree={confirm}
            onConfirm={handleUnlock}
            onCancel={() => setConfirm(null)}
            loading={acting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}