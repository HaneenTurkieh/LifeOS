import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer } from 'lucide-react';

const LEVEL_DOTS = { beginner: 1, intermediate: 2, advanced: 3 };

// ── Template definitions ──────────────────────────────────────
const TEMPLATES = [
  { key: 'minimal', label: 'Minimal',  desc: 'Clean, black & white'      },
  { key: 'modern',  label: 'Modern',   desc: 'Accent colour, two-column'  },
  { key: 'academic', label: 'Academic', desc: 'Serif, traditional layout' },
];

// ── HTML generators ───────────────────────────────────────────
function buildMinimal(userName, data) {
  const { projects, skills, certifications } = data;
  const LD = LEVEL_DOTS;

  return `
<div style="padding:56px 64px;max-width:794px;margin:0 auto;font-family:'Inter',-apple-system,sans-serif;color:#111827;font-size:13px;line-height:1.65">
  <div style="margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid #111827">
    <div style="font-size:26px;font-weight:700;letter-spacing:-0.5px">${userName || 'Your Name'}</div>
    <div style="font-size:12px;color:#6B7280;margin-top:4px">${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
  </div>

  ${projects.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Projects</div>
    ${projects.map(p=>`
    <div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13.5px">${p.title}</div>
      ${p.tech?`<div style="display:inline-block;font-size:11px;font-weight:500;background:#F3F4F6;padding:2px 8px;border-radius:4px;margin:4px 0">${p.tech}</div>`:''}
      ${p.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:3px">${p.description}</div>`:''}
      ${p.link?`<div style="font-size:11px;color:#6B7280;margin-top:2px">${p.link}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${skills.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Skills</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${skills.map(s=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:12px;font-weight:500">
        ${s.name}
        <div style="display:flex;gap:3px">
          ${[1,2,3].map(d=>`<div style="width:5px;height:5px;border-radius:50%;background:${d<=(LD[s.level]||1)?'#111827':'#D1D5DB'}"></div>`).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${certifications.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Certifications</div>
    ${certifications.map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-weight:600;font-size:13px">${c.title}</div>
        <div style="font-size:12px;color:#6B7280">${c.issuer}</div>
      </div>
      ${c.date?`<div style="font-size:11px;color:#9CA3AF">${c.date}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #E5E7EB;font-size:11px;color:#D1D5DB;text-align:right">Created with Aurora</div>
</div>`;
}

function buildModern(userName, data) {
  const { projects, skills, certifications } = data;
  const accent = '#7C6AF0';
  const LD = LEVEL_DOTS;

  return `
<div style="font-family:'Inter',-apple-system,sans-serif;font-size:13px;line-height:1.65;display:flex;min-height:100vh">
  <!-- Sidebar -->
  <div style="width:220px;min-width:220px;background:${accent};padding:48px 28px;color:white;flex-shrink:0">
    <!-- Avatar circle -->
    <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;margin-bottom:16px">
      ${(userName||'?')[0].toUpperCase()}
    </div>
    <div style="font-size:18px;font-weight:700;line-height:1.2;margin-bottom:4px">${userName||'Your Name'}</div>
    <div style="font-size:11px;opacity:0.65;margin-bottom:32px">${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>

    ${skills.length ? `
    <div style="margin-bottom:28px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;opacity:.55;margin-bottom:12px">Skills</div>
      ${skills.map(s=>`
      <div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px">${s.name}</div>
        <div style="display:flex;gap:3px">
          ${[1,2,3].map(d=>`<div style="flex:1;height:3px;border-radius:2px;background:${d<=(LD[s.level]||1)?'white':'rgba(255,255,255,0.25)'}"></div>`).join('')}
        </div>
      </div>`).join('')}
    </div>` : ''}

    ${certifications.length ? `
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;opacity:.55;margin-bottom:12px">Certifications</div>
      ${certifications.map(c=>`
      <div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600">${c.title}</div>
        <div style="font-size:11px;opacity:.65">${c.issuer}${c.date?` · ${c.date}`:''}</div>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- Main -->
  <div style="flex:1;padding:48px 44px;background:white;color:#111827">
    ${projects.length ? `
    <div style="margin-bottom:36px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${accent};margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid ${accent}">Projects</div>
      ${projects.map(p=>`
      <div style="margin-bottom:20px;padding-left:12px;border-left:3px solid #EDE9FE">
        <div style="font-weight:700;font-size:14px;color:#111827">${p.title}</div>
        ${p.tech?`<div style="font-size:11px;font-weight:600;color:${accent};margin:3px 0">${p.tech}</div>`:''}
        ${p.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:4px">${p.description}</div>`:''}
        ${p.link?`<div style="font-size:11px;color:#9CA3AF;margin-top:3px">${p.link}</div>`:''}
      </div>`).join('')}
    </div>` : ''}

    ${!projects.length && !skills.length && !certifications.length ? `
    <div style="text-align:center;padding:60px 0;color:#9CA3AF">
      <div style="font-size:32px;margin-bottom:12px">📄</div>
      <div style="font-weight:600;color:#6B7280">Your CV will appear here</div>
    </div>` : ''}

    <div style="margin-top:auto;padding-top:20px;border-top:1px solid #F3F4F6;font-size:11px;color:#D1D5DB;text-align:right">Created with Aurora</div>
  </div>
</div>`;
}

function buildAcademic(userName, data) {
  const { projects, skills, certifications } = data;
  const LD = LEVEL_DOTS;

  return `
<div style="padding:60px 72px;max-width:794px;margin:0 auto;font-family:'Georgia','Times New Roman',serif;color:#1a1a1a;font-size:13.5px;line-height:1.7">
  <!-- Header — centred -->
  <div style="text-align:center;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #1a1a1a">
    <div style="font-size:30px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${userName||'Your Name'}</div>
    <div style="font-size:11px;color:#555;margin-top:6px;letter-spacing:2px;text-transform:uppercase">
      ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}
    </div>
  </div>

  ${projects.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Projects & Work</div>
    ${projects.map(p=>`
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-weight:700;font-size:14px;font-style:italic">${p.title}</div>
        ${p.tech?`<div style="font-size:11px;color:#555">${p.tech}</div>`:''}
      </div>
      ${p.description?`<div style="font-size:13px;color:#333;margin-top:4px;text-align:justify">${p.description}</div>`:''}
      ${p.link?`<div style="font-size:11px;color:#777;margin-top:3px">${p.link}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${skills.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Skills & Competencies</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 32px">
      ${skills.map(s=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #D1D5DB">
        <div style="font-size:13px">${s.name}</div>
        <div style="font-size:11px;color:#555;font-style:italic;text-transform:capitalize">${s.level}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${certifications.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Certifications & Awards</div>
    ${certifications.map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted #E5E7EB">
      <div>
        <span style="font-weight:700;font-size:13px;font-style:italic">${c.title}</span>
        <span style="color:#555;font-size:12px;margin-left:8px">— ${c.issuer}</span>
      </div>
      ${c.date?`<div style="font-size:11px;color:#9CA3AF">${c.date}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${!projects.length && !skills.length && !certifications.length ? `
  <div style="text-align:center;padding:60px 0;color:#9CA3AF">
    <div style="font-size:32px;margin-bottom:12px">📄</div>
    <div style="font-weight:600;color:#6B7280">Your CV will appear here</div>
  </div>` : ''}

  <div style="margin-top:40px;text-align:center;font-size:11px;color:#D1D5DB;font-style:italic">Created with Aurora</div>
</div>`;
}

const BUILDERS = { minimal: buildMinimal, modern: buildModern, academic: buildAcademic };

const PRINT_FONTS = {
  minimal:  `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`,
  modern:   `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`,
  academic: `@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');`,
};

// ── Component ─────────────────────────────────────────────────
export default function CVExportModal({ data, userName, onClose }) {
  const [template, setTemplate] = useState('minimal');
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = BUILDERS[template](userName, data);
    const win     = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${userName} — CV</title>
  <style>
    ${PRINT_FONTS[template]}
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:white; }
    @media print { @page { margin:0.4in; } }
  </style>
</head>
<body>${content}</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const previewHtml = BUILDERS[template](userName, data);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(30,34,51,0.55)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl flex flex-col"
        style={{ background: 'rgba(255,255,255,0.98)', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/6 shrink-0">
          <span className="font-display font-bold text-ink text-sm">Export CV</span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#111827,#374151)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <Printer size={14} /> Save as PDF
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 hover:text-ink/70 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Template picker */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-ink/5 shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest text-ink/30 mr-2">Template</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplate(t.key)}
              className="flex flex-col items-start rounded-2xl px-4 py-2 transition-all text-left"
              style={template === t.key ? {
                background: 'rgba(124,106,240,0.10)',
                border:     '1px solid rgba(124,106,240,0.28)',
              } : {
                background: 'rgba(30,34,51,0.04)',
                border:     '1px solid rgba(30,34,51,0.07)',
              }}
            >
              <span className={`text-xs font-bold ${template === t.key ? 'text-lavender-700' : 'text-ink/60'}`}>
                {t.label}
              </span>
              <span className="text-[10px] text-ink/35">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 bg-gray-50">
          <div
            ref={printRef}
            className="bg-white shadow-sm mx-auto my-4"
            style={{ maxWidth: 794, minHeight: 400 }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}