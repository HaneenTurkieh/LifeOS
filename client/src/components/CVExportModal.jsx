import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Printer } from 'lucide-react';

const LEVEL_DOTS = { beginner: 1, intermediate: 2, advanced: 3 };

export default function CVExportModal({ data, userName, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win     = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${userName} — CV</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #111827;
      background: white;
      padding: 56px 64px;
      max-width: 794px;
      margin: 0 auto;
      font-size: 13px;
      line-height: 1.65;
    }
    /* Header */
    .header { margin-bottom: 36px; padding-bottom: 20px; border-bottom: 2px solid #111827; }
    .name { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #111827; }
    .meta { font-size: 12px; color: #6B7280; margin-top: 4px; }
    /* Section */
    .section { margin-bottom: 28px; }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #6B7280;
      margin-bottom: 14px;
      padding-bottom: 6px;
      border-bottom: 1px solid #E5E7EB;
    }
    /* Project */
    .project { margin-bottom: 16px; }
    .project-title { font-weight: 600; font-size: 13.5px; color: #111827; }
    .project-tech {
      display: inline-block;
      font-size: 11px;
      font-weight: 500;
      color: #374151;
      background: #F3F4F6;
      padding: 2px 8px;
      border-radius: 4px;
      margin: 4px 0;
    }
    .project-desc { font-size: 12.5px; color: #4B5563; margin-top: 3px; }
    .project-link { font-size: 11px; color: #6B7280; margin-top: 2px; display: block; }
    /* Skills */
    .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
    }
    .dots { display: flex; gap: 3px; }
    .dot { width: 5px; height: 5px; border-radius: 50%; background: #D1D5DB; }
    .dot.filled { background: #111827; }
    /* Cert */
    .cert { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .cert-title { font-weight: 600; font-size: 13px; color: #111827; }
    .cert-issuer { font-size: 12px; color: #6B7280; }
    .cert-date { font-size: 11px; color: #9CA3AF; text-align: right; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #D1D5DB; text-align: right; }
    @media print { body { padding: 40px 48px; } @page { margin: 0.4in; } }
  </style>
</head>
<body>${content}
</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const hasProjects = data.projects.length > 0;
  const hasSkills   = data.skills.length > 0;
  const hasCerts    = data.certifications.length > 0;

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
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl flex flex-col"
        style={{ background: 'rgba(255,255,255,0.98)', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/6 shrink-0">
          <div>
            <span className="font-display font-bold text-ink text-sm">CV Preview</span>
            <span className="ml-2 text-xs text-ink/35">Minimal professional template</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#111827,#374151)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <Printer size={14} /> Save as PDF
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 hover:text-ink/70">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 bg-white">
          <div ref={printRef} style={{ padding: '56px 64px', maxWidth: 794, margin: '0 auto', fontFamily: 'Inter, -apple-system, sans-serif', color: '#111827', fontSize: 13 }}>

            {/* Header */}
            <div style={{ marginBottom: 36, paddingBottom: 20, borderBottom: '2px solid #111827' }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: '#111827' }}>
                {userName || 'Your Name'}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Projects */}
            {hasProjects && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>
                  Projects
                </div>
                {data.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#111827' }}>{p.title}</div>
                    {p.tech && (
                      <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#374151', background: '#F3F4F6', padding: '2px 8px', borderRadius: 4, margin: '4px 0' }}>
                        {p.tech}
                      </div>
                    )}
                    {p.description && <div style={{ fontSize: 12.5, color: '#4B5563', marginTop: 3 }}>{p.description}</div>}
                    {p.link && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{p.link}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {hasSkills && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>
                  Skills
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.skills.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#374151' }}>
                      {s.name}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1,2,3].map((d) => (
                          <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: d <= (LEVEL_DOTS[s.level]||1) ? '#111827' : '#D1D5DB' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {hasCerts && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>
                  Certifications
                </div>
                {data.certifications.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{c.issuer}</div>
                    </div>
                    {c.date && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.date}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state in preview */}
            {!hasProjects && !hasSkills && !hasCerts && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>Your CV will appear here</div>
                <div style={{ fontSize: 12 }}>Add projects, skills, and certifications in the CV Builder tab</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 40, paddingTop: 14, borderTop: '1px solid #E5E7EB', fontSize: 11, color: '#D1D5DB', textAlign: 'right' }}>
              Created with Aurora · aurora.app
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}