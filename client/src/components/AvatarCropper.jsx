import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

export default function AvatarCropper({ imageSrc, onSave, onCancel }) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const [zoom,     setZoom]   = useState(1);
  const [offsetX,  setOffsetX] = useState(0);
  const [offsetY,  setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const SIZE = 280; // preview circle size

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = SIZE;
    canvas.height = SIZE;

    // Clear
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image centered with zoom and offset
    const scale  = (SIZE / Math.min(img.naturalWidth, img.naturalHeight)) * zoom;
    const w      = img.naturalWidth  * scale;
    const h      = img.naturalHeight * scale;
    const x      = (SIZE - w) / 2 + offsetX;
    const y      = (SIZE - h) / 2 + offsetY;

    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }, [zoom, offsetX, offsetY]);

  // Redraw whenever deps change
  React.useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) draw();
  }, [draw]);

  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };
  const handleMouseUp   = () => setDragging(false);

  // Touch support
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offsetX, y: t.clientY - offsetY });
  };
  const handleTouchMove = (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffsetX(t.clientX - dragStart.x);
    setOffsetY(t.clientY - dragStart.y);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    // Export as 400×400 high-quality JPEG
    const out = document.createElement('canvas');
    out.width  = 400;
    out.height = 400;
    const ctx  = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 400, 400);
    const dataURL = out.toDataURL('image/jpeg', 0.85);
    onSave(dataURL);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: 'rgba(7,11,20,0.80)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background:   'rgba(255,255,255,0.06)',
          border:       '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(40px)',
          boxShadow:    '0 32px 80px rgba(0,0,0,0.40)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="font-display font-bold text-white text-sm">Crop photo</span>
          <button onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-xl text-white/40 hover:text-white/70 transition">
            <X size={15} />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex flex-col items-center gap-5 p-6">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            {/* Hidden img for drawing */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              className="hidden"
              onLoad={draw}
            />

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="rounded-full cursor-grab active:cursor-grabbing"
              style={{
                border:    '3px solid rgba(124,106,240,0.60)',
                boxShadow: '0 0 0 6px rgba(124,106,240,0.15)',
                userSelect: 'none',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            />

            {/* Drag hint */}
            <p className="absolute -bottom-6 left-0 right-0 text-center text-[11px] text-white/30">
              Drag to reposition
            </p>
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 w-full mt-4">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="text-white/40 hover:text-white/70 transition">
              <ZoomOut size={16} />
            </button>
            <input
              type="range" min={0.5} max={3} step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-lavender-500"
            />
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              className="text-white/40 hover:text-white/70 transition">
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button onClick={onCancel}
              className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-white/50 transition"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg,#7C6AF0,#5B47E0)',
                boxShadow:  '0 4px 14px rgba(124,106,240,0.40)',
              }}
            >
              <Check size={15} /> Use photo
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}