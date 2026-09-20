import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const txt = (x, y, size, text, options = '') => `<text x="${x}" y="${y}" font-size="${size}" ${options}>${esc(text)}</text>`;
const serif = 'font-family="Georgia, Times New Roman, serif"';
const sans = 'font-family="Arial, Helvetica, sans-serif"';
const svg = (w, h, content, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(title)}</title><g ${sans} fill="#111111">${content}</g></svg>`;
const white = '<rect width="1200" height="630" fill="#ffffff"/>';
const wordmark = (color = '#111111') => txt(72, 98, 30, '[ˈskriː.boː]', `fill="${color}" letter-spacing="2"`);
const rule = (y, color = '#d6d6d6') => `<path d="M72 ${y}H1128" stroke="${color}"/>`;
const footer = (left, right = 'SKRIBO', dark = false) => rule(520, dark ? '#4b4b4b' : '#d6d6d6') + txt(72, 568, 24, left, `fill="${dark ? '#d9d9d9' : '#5c5c5c'}"`) + txt(1128, 568, 22, right, `text-anchor="end" fill="${dark ? '#ffffff' : '#111111'}" letter-spacing="2"`);

const favicons = [
  { id: 'F1', slug: 'open-brackets', name: 'Open brackets', description: 'A sharper version of the current mark.', shape: '<rect width="64" height="64" fill="#fff"/><path d="M25 11H11V53H25M39 11H53V53H39" fill="none" stroke="#111" stroke-width="7"/>' },
  { id: 'F2', slug: 'ink-tile', name: 'Ink tile', description: 'A bold, compact signature in a busy tab bar.', shape: '<rect width="64" height="64" rx="12" fill="#111"/><path d="M26 16H16V48H26M38 16H48V48H38" fill="none" stroke="#fff" stroke-width="6"/>' },
  { id: 'F3', slug: 'ink-s', name: 'Ink S', description: 'A single flowing initial for Skribo.', shape: '<rect width="64" height="64" rx="12" fill="#fff"/><path d="M45 16C40 10 23 10 18 18C8 34 50 27 47 43C45 56 22 57 15 46" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/>' },
  { id: 'F4', slug: 'writing-cursor', name: 'Writing cursor', description: 'The original brackets, with a live writing cue.', shape: '<rect width="64" height="64" fill="#fff"/><path d="M22 12H10V52H22M42 12H54V52H42" fill="none" stroke="#111" stroke-width="6"/><path d="M32 22V42" stroke="#111" stroke-width="6"/>' },
  { id: 'F5', slug: 'draft-lines', name: 'Draft lines', description: 'A small piece of writing, still in progress.', shape: '<rect width="64" height="64" rx="12" fill="#111"/><path d="M15 19H49M15 32H49M15 45H35" stroke="#fff" stroke-width="6"/><path d="M44 39V51" stroke="#fff" stroke-width="4"/>' },
];

const previews = [
  { id: 'P1', slug: 'editorial', name: 'Editorial', description: 'The current motto, given room to breathe.', content: white + wordmark() + txt(72, 268, 90, 'Evidence for', serif) + txt(72, 378, 90, 'thoughtful feedback.', serif) + footer('Write. Replay. Respond.') },
  { id: 'P2', slug: 'ink', name: 'Ink', description: 'A strong dark card built around the writing process.', content: '<rect width="1200" height="630" fill="#111111"/>' + wordmark('#ffffff') + txt(72, 272, 89, 'The story behind', `${serif} fill="#ffffff"`) + txt(72, 382, 89, 'every essay.', `${serif} fill="#ffffff"`) + footer('Writing replay. Process insights. Thoughtful feedback.', 'SKRIBO', true) },
  { id: 'P3', slug: 'process', name: 'Process', description: 'Three simple stages make the product clear at a glance.', content: white + wordmark() + txt(72, 214, 70, 'See how ideas take shape.', serif) + rule(255) +
    txt(72, 300, 20, '01 / WRITE', 'letter-spacing="2"') + txt(450, 300, 20, '02 / REPLAY', 'letter-spacing="2"') + txt(828, 300, 20, '03 / RESPOND', 'letter-spacing="2"') +
    txt(72, 364, 31, 'An idea begins', serif) + '<path d="M72 389H316M72 417H266M72 445H298" stroke="#c9c9c9" stroke-width="5"/><path d="M321 340V370" stroke="#111" stroke-width="3"/>' +
    '<path d="M450 447H748" stroke="#d6d6d6"/><path d="M450 349H520M450 389H585M450 429H722" stroke="#111" stroke-width="10"/><circle cx="722" cy="429" r="8" fill="#111"/>' +
    txt(828, 364, 31, 'A clearer thought.', serif) + '<path d="M828 374Q955 381 1095 373" fill="none" stroke="#111" stroke-width="2"/>' + txt(828, 424, 23, 'Highlight. Comment.') + txt(828, 455, 23, 'Start a conversation.') + footer('Evidence for thoughtful feedback.') },
  { id: 'P4', slug: 'margin-notes', name: 'Margin notes', description: 'An editorial composition inspired by professor feedback.', content: white + wordmark() + txt(72, 266, 81, 'A closer look', serif) + txt(72, 363, 81, 'at writing.', serif) +
    '<path d="M650 178V470" stroke="#d6d6d6"/>' + txt(700, 210, 20, 'IN THE MARGINS', 'letter-spacing="2" fill="#666666"') +
    txt(700, 284, 34, 'Every draft begins', serif) + '<rect x="696" y="306" width="233" height="40" fill="#eeeeee"/>' + txt(700, 337, 34, 'with a thought.', serif) +
    '<path d="M700 362H1080M700 380H1060M700 398H985" stroke="#d6d6d6" stroke-width="4"/><path d="M952 324C1070 323 1110 368 1094 418M1094 418l-8-13M1094 418l15-5" fill="none" stroke="#111" stroke-width="2"/>' + txt(745, 454, 26, 'Where could this idea go?', `${serif} font-style="italic"`) + footer('Make room for thoughtful feedback.') },
  { id: 'P5', slug: 'signature', name: 'Signature', description: 'A dictionary-like identity led by the Skribo name.', content: white + txt(72, 98, 23, 'THE WRITING PROCESS, IN VIEW.', 'letter-spacing="2"') +
    txt(65, 327, 204, 'skribo', serif) + txt(738, 310, 44, '[ˈskriː.boː]', 'letter-spacing="1"') +
    txt(72, 433, 43, 'Writing is more than the final draft.', serif) + footer('Essay writing. Process insights. Professor response.') },
];

await fs.mkdir(path.join(root, 'favicons'), { recursive: true });
await fs.mkdir(path.join(root, 'previews'), { recursive: true });
for (const icon of favicons) {
  const name = `${icon.id.toLowerCase()}-${icon.slug}`;
  const source = svg(64, 64, icon.shape, `${icon.id} — ${icon.name}`);
  await fs.writeFile(path.join(root, 'favicons', `${name}.svg`), source);
  for (const size of [16, 32, 64, 180, 512]) {
    await sharp(Buffer.from(source), { density: 576 }).resize(size, size).png().toFile(path.join(root, 'favicons', `${name}-${size}.png`));
  }
  icon.src = `data:image/png;base64,${(await fs.readFile(path.join(root, 'favicons', `${name}-64.png`))).toString('base64')}`;
  delete icon.shape;
}
for (const preview of previews) {
  const name = `${preview.id.toLowerCase()}-${preview.slug}`;
  const source = svg(1200, 630, preview.content, `${preview.id} — ${preview.name}`);
  await fs.writeFile(path.join(root, 'previews', `${name}.svg`), source);
  const png = await sharp(Buffer.from(source)).png().toBuffer();
  await fs.writeFile(path.join(root, 'previews', `${name}.png`), png);
  preview.src = `data:image/png;base64,${png.toString('base64')}`;
  delete preview.content;
}

// Review sheets keep all ten options visible together outside the interactive picker.
let faviconSheet = '<rect width="1440" height="500" fill="#f5f5f5"/>' + txt(40, 52, 28, 'SKRIBO / FIVE FAVICON DIRECTIONS');
favicons.forEach((icon, i) => {
  const x = 40 + i * 280;
  faviconSheet += txt(x, 106, 19, `${icon.id} / ${icon.name}`) + `<image href="${icon.src}" x="${x}" y="140" width="96" height="96"/>` + txt(x, 283, 16, '16 px') + txt(x + 96, 283, 16, '32 px');
  faviconSheet += `<image href="${icon.src}" x="${x}" y="307" width="16" height="16"/><image href="${icon.src}" x="${x + 96}" y="302" width="32" height="32"/>`;
  faviconSheet += `<rect x="${x}" y="366" width="240" height="70" rx="8" fill="#242424"/><image href="${icon.src}" x="${x + 18}" y="393" width="16" height="16"/>` + txt(x + 47, 407, 18, 'Skribo', 'fill="#ffffff"');
});
await sharp(Buffer.from(svg(1440, 500, faviconSheet, 'Five favicon options'))).png().toFile(path.join(root, 'favicon-options.png'));
let previewSheet = '<rect width="1440" height="1290" fill="#eaeaea"/>' + txt(40, 52, 28, 'SKRIBO / FIVE LINK-PREVIEW DIRECTIONS');
previews.forEach((preview, i) => {
  const x = 40 + (i % 2) * 704;
  const y = 91 + Math.floor(i / 2) * 395;
  previewSheet += txt(x, y + 20, 22, `${preview.id} / ${preview.name}`) + `<image href="${preview.src}" x="${x}" y="${y + 40}" width="656" height="344.4"/>`;
});
await sharp(Buffer.from(svg(1440, 1290, previewSheet, 'Five link-preview options'))).png().toFile(path.join(root, 'preview-options.png'));
await fs.writeFile(path.join(root, 'options.json'), JSON.stringify({ favicons, previews }));
console.log('Created 5 SVG favicons with PNG sizes, 5 preview SVGs + 1200×630 PNGs, and 2 review sheets.');
