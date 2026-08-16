import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, FileText } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import { useTheme } from '../context/ThemeContext.jsx';

const LEVEL_DOTS = { beginner: 1, intermediate: 2, advanced: 3 };

// ── Template definitions ──────────────────────────────────────
const TEMPLATES = [
  { key: 'minimal', label: 'Minimal',  desc: 'Clean, black & white'      },
  { key: 'modern',  label: 'Modern',   desc: 'Accent colour, two-column'  },
  { key: 'academic', label: 'Academic', desc: 'Serif, traditional layout' },
];

// ── Shared helpers ─────────────────────────────────────────────
// Every field below (role, company, description, project links, summary,
// skill names, etc.) is free text the person typed into the CV Builder —
// none of it was ever escaped before landing straight in a template
// string that gets rendered two ways: dangerouslySetInnerHTML for the
// live preview, and document.write() for the print/PDF window. Either
// way, a stray `<` or an unclosed tag in someone's own job description
// broke the generated document's structure (and in the preview path,
// dangerouslySetInnerHTML would happily execute anything script-shaped).
// Every user-entered value below is now run through this before it's
// interpolated into a template.
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Building a "contact line" (email · phone · location) is the same
// three-way join across all three templates, so it lives here once.
function contactLine(userEmail, profile) {
  return [userEmail, profile.cv_phone, profile.cv_location].filter(Boolean).map(esc).join('  ·  ');
}
function dateRange(start, end, isCurrent) {
  const from = start || '';
  const to   = isCurrent ? 'Present' : (end || '');
  return esc([from, to].filter(Boolean).join(' – '));
}

// ── Word (.docx) generator ──────────────────────────────────────
// The preview templates are raw HTML/CSS (including a two-column
// flex sidebar for Modern), which Word's format has no equivalent
// for. Rather than trying to convert that HTML, this builds a real
// Word document natively — same content, one clean single-column
// layout, editable and safe for any ATS regardless of which preview
// template is selected.
const SKILL_LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function docxHeading(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } });
}
function docxBody(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, size: 22, ...opts })], spacing: { after: 80 } });
}

// docx's ImageRun wants raw bytes, not a base64 data URL — the browser
// has no Buffer, so this decodes it manually via atob() instead of
// relying on a Node polyfill being present in the bundle.
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildDocxSections(userName, userEmail, profile, data, isPremium) {
  const { experience, education, projects, skills, certifications } = data;
  const children = [];

  // Photo is optional and best-effort — a bad/corrupt image should never
  // break the rest of the export, so this is wrapped defensively.
  if (profile.cv_photo) {
    try {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          data: dataUrlToUint8Array(profile.cv_photo),
          transformation: { width: 90, height: 90 },
          type: 'jpg',
        })],
        spacing: { after: 160 },
      }));
    } catch (err) {
      console.error('CV photo failed to embed in Word export, skipping:', err);
    }
  }

  children.push(new Paragraph({
    children: [new TextRun({ text: userName || 'Your Name', bold: true, size: 34 })],
    spacing: { after: 60 },
  }));
  if (profile.cv_headline) {
    children.push(new Paragraph({
      children: [new TextRun({ text: profile.cv_headline, bold: true, size: 22, color: '4B5563' })],
      spacing: { after: 60 },
    }));
  }
  const contact = contactLine(userEmail, profile);
  if (contact) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contact, size: 20, color: '6B7280' })],
      spacing: { after: 200 },
    }));
  }

  if (profile.cv_summary) {
    children.push(docxHeading('Professional Summary'));
    children.push(docxBody(profile.cv_summary));
  }

  if (experience.length) {
    children.push(docxHeading('Experience'));
    experience.forEach((x) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: [x.role, x.company].filter(Boolean).join(' · '), bold: true, size: 23 })],
        spacing: { before: 140 },
      }));
      const meta = [dateRange(x.start_date, x.end_date, x.is_current), x.location].filter(Boolean).join('  ·  ');
      if (meta) children.push(docxBody(meta, { italics: true, color: '6B7280', size: 20 }));
      (x.description || '').split('\n').filter(Boolean).forEach((line) => children.push(docxBody(line)));
    });
  }

  if (education.length) {
    children.push(docxHeading('Education'));
    education.forEach((ed) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: ed.school || '', bold: true, size: 23 })],
        spacing: { before: 140 },
      }));
      const meta = [
        [ed.degree, ed.field].filter(Boolean).join(', '),
        dateRange(ed.start_date, ed.end_date),
      ].filter(Boolean).join('  ·  ');
      if (meta) children.push(docxBody(meta, { italics: true, color: '6B7280', size: 20 }));
      if (ed.description) children.push(docxBody(ed.description));
    });
  }

  if (projects.length) {
    children.push(docxHeading('Projects'));
    projects.forEach((p) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: p.title || '', bold: true, size: 23 })],
        spacing: { before: 140 },
      }));
      if (p.tech) children.push(docxBody(p.tech, { italics: true, color: '6B7280', size: 20 }));
      if (p.description) children.push(docxBody(p.description));
      if (p.link) children.push(docxBody(p.link, { color: '6B7280', size: 20 }));
    });
  }

  if (skills.length) {
    children.push(docxHeading('Skills'));
    children.push(docxBody(
      skills.map((s) => `${s.name} (${SKILL_LEVEL_LABEL[s.level] || 'Beginner'})`).join('   ·   ')
    ));
  }

  if (certifications.length) {
    children.push(docxHeading('Certifications'));
    certifications.forEach((c) => {
      const line = [c.title, c.issuer].filter(Boolean).join(' — ') + (c.date ? `  (${c.date})` : '');
      children.push(docxBody(line));
    });
  }

  // Free-tier watermark — a small, unobtrusive credit line, gone
  // entirely for premium accounts. Never touches the actual CV content
  // above it.
  if (!isPremium) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: 'Made with Nuvora ✦', size: 16, color: '9CA3AF', italics: true })],
    }));
  }

  return children;
}

// ── HTML generators ───────────────────────────────────────────
function buildMinimal(userName, userEmail, profile, data) {
  const { experience, education, projects, skills, certifications } = data;
  const LD = LEVEL_DOTS;

  return `
<div style="padding:56px 64px;max-width:794px;margin:0 auto;font-family:'Inter',-apple-system,sans-serif;color:#111827;font-size:13px;line-height:1.65">
  <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111827;display:flex;align-items:center;gap:20px">
    ${profile.cv_photo ? `<img src="${profile.cv_photo}" style="width:76px;height:76px;border-radius:50%;object-fit:cover;flex-shrink:0" />` : ''}
    <div>
      <div style="font-size:26px;font-weight:700;letter-spacing:-0.5px">${esc(userName) || 'Your Name'}</div>
      ${profile.cv_headline ? `<div style="font-size:14px;color:#374151;margin-top:3px;font-weight:600">${esc(profile.cv_headline)}</div>` : ''}
      <div style="font-size:11.5px;color:#6B7280;margin-top:6px">${contactLine(userEmail, profile)}</div>
    </div>
  </div>

  ${profile.cv_summary ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Professional Summary</div>
    <div style="font-size:12.5px;color:#374151">${esc(profile.cv_summary)}</div>
  </div>` : ''}

  ${experience.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Experience</div>
    ${experience.map(x=>`
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap">
        <div style="font-weight:600;font-size:13.5px">${esc(x.role)}${x.company?` · ${esc(x.company)}`:''}</div>
        <div style="font-size:11px;color:#9CA3AF">${dateRange(x.start_date, x.end_date, x.is_current)}</div>
      </div>
      ${x.location?`<div style="font-size:11px;color:#9CA3AF;margin-top:1px">${esc(x.location)}</div>`:''}
      ${x.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:4px;white-space:pre-line">${esc(x.description)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${education.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Education</div>
    ${education.map(ed=>`
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap">
        <div style="font-weight:600;font-size:13.5px">${esc(ed.school)}</div>
        <div style="font-size:11px;color:#9CA3AF">${dateRange(ed.start_date, ed.end_date)}</div>
      </div>
      ${ed.degree||ed.field?`<div style="font-size:12px;color:#6B7280;margin-top:1px">${esc([ed.degree,ed.field].filter(Boolean).join(', '))}</div>`:''}
      ${ed.description?`<div style="font-size:12px;color:#4B5563;margin-top:3px">${esc(ed.description)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${projects.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Projects</div>
    ${projects.map(p=>`
    <div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13.5px">${esc(p.title)}</div>
      ${p.tech?`<div style="display:inline-block;font-size:11px;font-weight:500;background:#F3F4F6;padding:2px 8px;border-radius:4px;margin:4px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:3px">${esc(p.description)}</div>`:''}
      ${p.link?`<div style="font-size:11px;color:#6B7280;margin-top:2px">${esc(p.link)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${skills.length ? `
  <div style="margin-bottom:28px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#6B7280;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Skills</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${skills.map(s=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:12px;font-weight:500">
        ${esc(s.name)}
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
        <div style="font-weight:600;font-size:13px">${esc(c.title)}</div>
        <div style="font-size:12px;color:#6B7280">${esc(c.issuer)}</div>
      </div>
      ${c.date?`<div style="font-size:11px;color:#9CA3AF">${esc(c.date)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #E5E7EB;font-size:11px;color:#D1D5DB;text-align:right">Created with Nuvora</div>
</div>`;
}

function buildModern(userName, userEmail, profile, data) {
  const { experience, education, projects, skills, certifications } = data;
  const accent = '#7C6AF0';
  const LD = LEVEL_DOTS;

  return `
<div style="font-family:'Inter',-apple-system,sans-serif;font-size:13px;line-height:1.65;display:flex;min-height:100vh">
  <!-- Sidebar — light tint + a coloured edge, not a solid colour block.
       Full saturated backgrounds are exactly what makes ATS parsers and
       black-and-white printing/scanning choke, so the accent here is
       restrained to text, the border, and small fills only. -->
  <div style="width:220px;min-width:220px;background:${accent}0A;border-right:3px solid ${accent};padding:48px 24px;color:#111827;flex-shrink:0">
    <!-- Avatar circle — real photo if the person uploaded one, otherwise
         falls back to an initial-letter placeholder like before. -->
    ${profile.cv_photo
      ? `<img src="${profile.cv_photo}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1.5px solid ${accent}44;margin-bottom:16px" />`
      : `<div style="width:64px;height:64px;border-radius:50%;background:${accent}1A;border:1.5px solid ${accent}44;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:${accent};margin-bottom:16px">
      ${esc((userName||'?')[0].toUpperCase())}
    </div>`}
    <div style="font-size:17px;font-weight:700;line-height:1.2;margin-bottom:4px;color:#111827">${esc(userName)||'Your Name'}</div>
    ${profile.cv_headline ? `<div style="font-size:11.5px;font-weight:600;margin-bottom:8px;color:${accent}">${esc(profile.cv_headline)}</div>` : ''}
    <div style="font-size:10.5px;color:#6B7280;margin-bottom:32px;line-height:1.6">${[userEmail, profile.cv_phone, profile.cv_location].filter(Boolean).map(esc).join('<br/>')}</div>

    ${skills.length ? `
    <div style="margin-bottom:28px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9CA3AF;margin-bottom:12px">Skills</div>
      ${skills.map(s=>`
      <div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#111827">${esc(s.name)}</div>
        <div style="display:flex;gap:3px">
          ${[1,2,3].map(d=>`<div style="flex:1;height:3px;border-radius:2px;background:${d<=(LD[s.level]||1)?accent:'#E5E7EB'}"></div>`).join('')}
        </div>
      </div>`).join('')}
    </div>` : ''}

    ${certifications.length ? `
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9CA3AF;margin-bottom:12px">Certifications</div>
      ${certifications.map(c=>`
      <div style="margin-bottom:10px">
        <div style="font-size:12px;font-weight:600;color:#111827">${esc(c.title)}</div>
        <div style="font-size:11px;color:#6B7280">${esc(c.issuer)}${c.date?` · ${esc(c.date)}`:''}</div>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- Main -->
  <div style="flex:1;padding:48px 44px;background:white;color:#111827">
    ${profile.cv_summary ? `
    <div style="margin-bottom:32px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${accent};margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid ${accent}">Summary</div>
      <div style="font-size:12.5px;color:#374151">${esc(profile.cv_summary)}</div>
    </div>` : ''}

    ${experience.length ? `
    <div style="margin-bottom:32px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${accent};margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid ${accent}">Experience</div>
      ${experience.map(x=>`
      <div style="margin-bottom:18px;padding-left:12px;border-left:3px solid #EDE9FE">
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap">
          <div style="font-weight:700;font-size:14px;color:#111827">${esc(x.role)}</div>
          <div style="font-size:11px;color:#9CA3AF">${dateRange(x.start_date, x.end_date, x.is_current)}</div>
        </div>
        <div style="font-size:11.5px;font-weight:600;color:${accent};margin:2px 0">${[x.company, x.location].filter(Boolean).map(esc).join(' · ')}</div>
        ${x.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:4px;white-space:pre-line">${esc(x.description)}</div>`:''}
      </div>`).join('')}
    </div>` : ''}

    ${education.length ? `
    <div style="margin-bottom:32px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${accent};margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid ${accent}">Education</div>
      ${education.map(ed=>`
      <div style="margin-bottom:16px;padding-left:12px;border-left:3px solid #EDE9FE">
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap">
          <div style="font-weight:700;font-size:14px;color:#111827">${esc(ed.school)}</div>
          <div style="font-size:11px;color:#9CA3AF">${dateRange(ed.start_date, ed.end_date)}</div>
        </div>
        ${ed.degree||ed.field?`<div style="font-size:11.5px;font-weight:600;color:${accent};margin:2px 0">${esc([ed.degree,ed.field].filter(Boolean).join(', '))}</div>`:''}
        ${ed.description?`<div style="font-size:12px;color:#4B5563;margin-top:3px">${esc(ed.description)}</div>`:''}
      </div>`).join('')}
    </div>` : ''}

    ${projects.length ? `
    <div style="margin-bottom:36px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${accent};margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid ${accent}">Projects</div>
      ${projects.map(p=>`
      <div style="margin-bottom:20px;padding-left:12px;border-left:3px solid #EDE9FE">
        <div style="font-weight:700;font-size:14px;color:#111827">${esc(p.title)}</div>
        ${p.tech?`<div style="font-size:11px;font-weight:600;color:${accent};margin:3px 0">${esc(p.tech)}</div>`:''}
        ${p.description?`<div style="font-size:12.5px;color:#4B5563;margin-top:4px">${esc(p.description)}</div>`:''}
        ${p.link?`<div style="font-size:11px;color:#9CA3AF;margin-top:3px">${esc(p.link)}</div>`:''}
      </div>`).join('')}
    </div>` : ''}

    ${!profile.cv_summary && !experience.length && !education.length && !projects.length && !skills.length && !certifications.length ? `
    <div style="text-align:center;padding:60px 0;color:#9CA3AF">
      <div style="font-size:32px;margin-bottom:12px">📄</div>
      <div style="font-weight:600;color:#6B7280">Your CV will appear here</div>
    </div>` : ''}

    <div style="margin-top:auto;padding-top:20px;border-top:1px solid #F3F4F6;font-size:11px;color:#D1D5DB;text-align:right">Created with Nuvora</div>
  </div>
</div>`;
}

function buildAcademic(userName, userEmail, profile, data) {
  const { experience, education, projects, skills, certifications } = data;
  const LD = LEVEL_DOTS;

  return `
<div style="padding:60px 72px;max-width:794px;margin:0 auto;font-family:'Georgia','Times New Roman',serif;color:#1a1a1a;font-size:13.5px;line-height:1.7">
  <!-- Header — centred -->
  <div style="text-align:center;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #1a1a1a">
    ${profile.cv_photo ? `<img src="${profile.cv_photo}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block" />` : ''}
    <div style="font-size:30px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${esc(userName)||'Your Name'}</div>
    ${profile.cv_headline ? `<div style="font-size:13px;color:#333;margin-top:8px;font-style:italic">${esc(profile.cv_headline)}</div>` : ''}
    <div style="font-size:11px;color:#555;margin-top:8px;letter-spacing:1px">
      ${contactLine(userEmail, profile)}
    </div>
  </div>

  ${profile.cv_summary ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:16px">Summary</div>
    <div style="font-size:13px;color:#333;text-align:justify">${esc(profile.cv_summary)}</div>
  </div>` : ''}

  ${education.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Education</div>
    ${education.map(ed=>`
    <div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-weight:700;font-size:14px;font-style:italic">${esc(ed.school)}</div>
        <div style="font-size:11px;color:#555">${dateRange(ed.start_date, ed.end_date)}</div>
      </div>
      ${ed.degree||ed.field?`<div style="font-size:12.5px;color:#555;margin-top:2px">${esc([ed.degree,ed.field].filter(Boolean).join(', '))}</div>`:''}
      ${ed.description?`<div style="font-size:12.5px;color:#333;margin-top:4px;text-align:justify">${esc(ed.description)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${experience.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Experience</div>
    ${experience.map(x=>`
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-weight:700;font-size:14px;font-style:italic">${esc(x.role)}${x.company?`, ${esc(x.company)}`:''}</div>
        <div style="font-size:11px;color:#555">${dateRange(x.start_date, x.end_date, x.is_current)}</div>
      </div>
      ${x.location?`<div style="font-size:11px;color:#777;margin-top:2px">${esc(x.location)}</div>`:''}
      ${x.description?`<div style="font-size:13px;color:#333;margin-top:4px;text-align:justify;white-space:pre-line">${esc(x.description)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${projects.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Projects & Work</div>
    ${projects.map(p=>`
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-weight:700;font-size:14px;font-style:italic">${esc(p.title)}</div>
        ${p.tech?`<div style="font-size:11px;color:#555">${esc(p.tech)}</div>`:''}
      </div>
      ${p.description?`<div style="font-size:13px;color:#333;margin-top:4px;text-align:justify">${esc(p.description)}</div>`:''}
      ${p.link?`<div style="font-size:11px;color:#777;margin-top:3px">${esc(p.link)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${skills.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Skills & Competencies</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 32px">
      ${skills.map(s=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #D1D5DB">
        <div style="font-size:13px">${esc(s.name)}</div>
        <div style="font-size:11px;color:#555;font-style:italic;text-transform:capitalize">${esc(s.level)}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${certifications.length ? `
  <div style="margin-bottom:32px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;text-align:center;margin-bottom:20px">Certifications & Awards</div>
    ${certifications.map(c=>`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted #E5E7EB">
      <div>
        <span style="font-weight:700;font-size:13px;font-style:italic">${esc(c.title)}</span>
        <span style="color:#555;font-size:12px;margin-left:8px">— ${esc(c.issuer)}</span>
      </div>
      ${c.date?`<div style="font-size:11px;color:#9CA3AF">${esc(c.date)}</div>`:''}
    </div>`).join('')}
  </div>` : ''}

  ${!profile.cv_summary && !experience.length && !education.length && !projects.length && !skills.length && !certifications.length ? `
  <div style="text-align:center;padding:60px 0;color:#9CA3AF">
    <div style="font-size:32px;margin-bottom:12px">📄</div>
    <div style="font-weight:600;color:#6B7280">Your CV will appear here</div>
  </div>` : ''}

  <div style="margin-top:40px;text-align:center;font-size:11px;color:#D1D5DB;font-style:italic">Created with Nuvora</div>
</div>`;
}

const BUILDERS = { minimal: buildMinimal, modern: buildModern, academic: buildAcademic };

const PRINT_FONTS = {
  minimal:  `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`,
  modern:   `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`,
  academic: `@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');`,
};

const EMPTY_PROFILE = { cv_summary: '', cv_headline: '', cv_phone: '', cv_location: '', cv_photo: '' };

// ── Component ─────────────────────────────────────────────────
export default function CVExportModal({ data, profile = EMPTY_PROFILE, userName, userEmail = '', onClose }) {
  const [template, setTemplate] = useState('minimal');
  const printRef = useRef(null);
  const { isPremium } = useTheme();

  const fullData = { experience: [], education: [], projects: [], skills: [], certifications: [], ...data };

  const handlePrint = () => {
    const content = BUILDERS[template](userName, userEmail, profile, fullData);
    // Free-tier watermark — a small fixed-position credit corner that
    // repeats on every printed page (position:fixed survives pagination
    // in every browser's print engine), gone entirely once premium.
    const watermark = isPremium ? '' : `
      <div style="position:fixed; bottom:0.3in; inset-inline-end:0.4in; font-size:9px; color:#9CA3AF; font-family:sans-serif; opacity:0.85;">
        Made with Nuvora ✦
      </div>`;
    const win     = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${esc(userName)} — CV</title>
  <style>
    ${PRINT_FONTS[template]}
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:white; }
    @media print { @page { margin:0.4in; } }
  </style>
</head>
<body>${content}${watermark}</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // "Save as PDF" only ever produces a flattened, non-editable file —
  // there was no way to get something you (or a recruiter) could
  // actually open and tweak afterward. This builds a real .docx
  // natively (docx.js), no server round-trip, no HTML-to-Word
  // conversion — so it's the same clean, single-column layout no
  // matter which preview template is selected.
  const handleDownloadDocx = async () => {
    const doc = new Document({
      sections: [{ properties: {}, children: buildDocxSections(userName, userEmail, profile, fullData, isPremium) }],
    });
    const blob = await Packer.toBlob(doc);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${userName || 'CV'} - CV.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewHtml = BUILDERS[template](userName, userEmail, profile, fullData);

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
          {/* This whole modal is deliberately light-only — it's previewing a
              printed document on white paper, so it should never follow the
              app's dark mode. But the app-wide `.dark .text-ink` CSS rule
              force-overrides that class to white everywhere, including here
              — so every text color in this file uses inline `style` instead
              of the `text-ink` className, which sidesteps that override
              entirely (the CSS rule only matches by class name). */}
          <span className="font-display font-bold text-sm" style={{ color: '#1E2233' }}>Export CV</span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#111827,#374151)', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}>
              <Printer size={14} /> Save as PDF
            </button>
            <button onClick={handleDownloadDocx}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold"
              style={{ background: 'rgba(17,24,39,0.06)', color: '#1E2233' }}>
              <FileText size={14} /> Download Word
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl hover:opacity-80 transition"
              style={{ color: 'rgba(30,34,51,0.40)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Template picker */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-ink/5 shrink-0">
          <span className="text-xs font-bold uppercase tracking-widest mr-2" style={{ color: 'rgba(30,34,51,0.30)' }}>Template</span>
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
              <span
                className={`text-xs font-bold ${template === t.key ? 'text-lavender-700' : ''}`}
                style={template === t.key ? {} : { color: 'rgba(30,34,51,0.60)' }}
              >
                {t.label}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(30,34,51,0.35)' }}>{t.desc}</span>
            </button>
          ))}
        </div>
        {template === 'modern' && (
          <div className="px-6 py-2 text-[11px] border-b border-ink/5 shrink-0" style={{ color: 'rgba(30,34,51,0.40)' }}>
            Heads up: some ATS résumé scanners misread two-column layouts regardless of colour. Minimal is still the safest bet for large-company applications. (The Word download below is always a clean single-column document, independent of the template you preview here.)
          </div>
        )}
        {!isPremium && (
          <div className="px-6 py-2 text-[11px] border-b border-ink/5 shrink-0" style={{ color: 'rgba(30,34,51,0.40)' }}>
            Free exports include a small "Made with Nuvora" credit in the corner. <span style={{ color: '#7C6AF0', fontWeight: 700 }}>Premium</span> removes it.
          </div>
        )}

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