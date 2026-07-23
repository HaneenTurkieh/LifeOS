import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Printer } from 'lucide-react';

const LEVEL_DOTS = { beginner: 1, intermediate: 2, advanced: 3 };

export default function CVExportModal({ data, userName, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win     = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${userName} — CV</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              color: #1E2233;
              background: white;
              padding: 48px;
              max-width: 800px;
              margin: 0 auto;
              font-size: 13px;
              line-height: 1.6;
            }
            h1 { font-size: 28px; font-weight: 800; color: #1E2233; margin-bottom: 4px; }
            .subtitle { color: #6B7280; font-size: 13px; margin-bottom: 32px; }
            .section { margin-bottom: 28px; }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #7C6AF0;
              margin-bottom: 12px;
              padding-bottom: 6px;
              border-bottom: 2px solid #EBE8FF;
            }
            .project-card {
              margin-bottom: 14px;
              padding-bottom: 14px;
              border-bottom: 1px solid #F3F4F6;
            }
            .project-card:last-child { border-bottom: none; margin-bottom: 0; }
            .project-title { font-weight: 700; font-size: 14px; color: #1E2233; }
            .project-tech { color: #7C6AF0; font-size: 11px; font-weight: 600; margin: 3px 0; }
            .project-desc { color: #6B7280; font-size: 12px; }
            .project-link { color: #7C6AF0; font-size: 11px; text-decoration: none; }
            .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
            .skill-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 12px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 600;
              border: 1px solid #EBE8FF;
              background: #F4F3FF;
              color: #5B47E0;
            }
            .skill-level {
              display: flex;
              gap: 3px;
            }
            .dot {
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: #BBB0FF;
            }
            .dot.filled { background: #7C6AF0; }
            .cert-row {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 10px;
            }
            .cert-icon {
              width: 36px; height: 36px;
              border-radius: 10px;
              background: linear-gradient(135deg, #FFC773, #F59E0B);
              display: flex; align-items: center; justify-content: center;
              font-size: 16px;
              flex-shrink: 0;
            }
            .cert-title { font-weight: 700; font-size: 13px; }
            .cert-issuer { color: #6B7280; font-size: 12px; }
            .header-line {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 32px;
              padding-bottom: 20px;
              border-bottom: 3px solid #7C6AF0;
            }
            .badge {
              background: linear-gradient(135deg, #7C6AF0, #5B47E0);
              color: white;
              padding: 4px 12px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 700;
            }
            @media print {
              body { padding: 32px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(30,34,51,0.50)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-3xl flex flex-col"
        style={{
          background:   'rgba(255,255,255,0.97)',
          border:       '1px solid rgba(255,255,255,0.80)',
          boxShadow:    '0 32px 80px rgba(0,0,0,0.20)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/5 shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-lavender-500" />
            <span className="font-display font-bold text-ink">Export CV</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #7C6AF0, #5B47E0)',
                boxShadow:  '0 4px 14px rgba(124,106,240,0.35)',
              }}
            >
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 hover:text-ink/70 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* CV Preview */}
        <div className="overflow-y-auto flex-1 p-8 bg-white">
          <div ref={printRef}>
            {/* Header */}
            <div className="header-line" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32, paddingBottom:20, borderBottom:'3px solid #7C6AF0' }}>
              <div>
                <h1 style={{ fontSize:28, fontWeight:800, color:'#1E2233', marginBottom:4 }}>{userName}</h1>
                <p style={{ color:'#6B7280', fontSize:13 }}>Built with Aurora · {new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</p>
              </div>
              <span style={{ background:'linear-gradient(135deg,#7C6AF0,#5B47E0)', color:'white', padding:'4px 12px', borderRadius:999, fontSize:11, fontWeight:700 }}>
                ✦ Aurora CV
              </span>
            </div>

            {/* Projects */}
            {data.projects.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#7C6AF0', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #EBE8FF' }}>
                  Projects
                </div>
                {data.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid #F3F4F6' }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#1E2233' }}>{p.title}</div>
                    {p.tech && <div style={{ color:'#7C6AF0', fontSize:11, fontWeight:600, margin:'3px 0' }}>{p.tech}</div>}
                    {p.description && <div style={{ color:'#6B7280', fontSize:12 }}>{p.description}</div>}
                    {p.link && <a href={p.link} style={{ color:'#7C6AF0', fontSize:11 }}>{p.link}</a>}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {data.skills.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#7C6AF0', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #EBE8FF' }}>
                  Skills
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {data.skills.map((s) => (
                    <span key={s.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, border:'1px solid #EBE8FF', background:'#F4F3FF', color:'#5B47E0' }}>
                      {s.name}
                      <span style={{ display:'flex', gap:3 }}>
                        {[1,2,3].map((d) => (
                          <span key={d} style={{ width:5, height:5, borderRadius:'50%', background: d <= (LEVEL_DOTS[s.level]||1) ? '#7C6AF0' : '#BBB0FF', display:'inline-block' }} />
                        ))}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {data.certifications.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#7C6AF0', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #EBE8FF' }}>
                  Certifications
                </div>
                {data.certifications.map((c) => (
                  <div key={c.id} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#FFC773,#F59E0B)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      🏆
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#1E2233' }}>{c.title}</div>
                      <div style={{ color:'#6B7280', fontSize:12 }}>{c.issuer}{c.date && ` · ${c.date}`}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}