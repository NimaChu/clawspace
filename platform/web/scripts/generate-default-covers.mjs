import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const srcDir = path.join(root, 'public', 'default-covers-src');
const outDir = path.join(root, 'public', 'default-covers');
const coverSkillRoot = process.env.COVER_GENERATOR_SKILL_DIR
  || path.join(os.homedir(), '.codex', 'skills', 'svg-png-cover-generator');
const exportScript = path.join(coverSkillRoot, 'scripts', 'export_svg_to_png.sh');
const checkScript = path.join(coverSkillRoot, 'scripts', 'check_svg.py');

const lobster = (x, y, scale = 1, accent = '#FFB454') => `
<g transform="translate(${x} ${y}) scale(${scale})">
  <ellipse cx="88" cy="150" rx="66" ry="92" fill="var(--lobster)" />
  <ellipse cx="88" cy="86" rx="56" ry="52" fill="var(--lobster)" />
  <ellipse cx="88" cy="92" rx="34" ry="28" fill="var(--cream)" />
  <circle cx="72" cy="72" r="7" fill="#fff" />
  <circle cx="104" cy="72" r="7" fill="#fff" />
  <circle cx="72" cy="72" r="3" fill="#0f172a" />
  <circle cx="104" cy="72" r="3" fill="#0f172a" />
  <path d="M77 95 Q88 106 99 95" stroke="#0f172a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M58 40 Q36 12 18 28" stroke="${accent}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M118 40 Q140 12 158 28" stroke="${accent}" stroke-width="9" fill="none" stroke-linecap="round"/>
  <circle cx="18" cy="28" r="10" fill="${accent}" />
  <circle cx="158" cy="28" r="10" fill="${accent}" />
  <ellipse cx="36" cy="152" rx="24" ry="16" fill="${accent}" transform="rotate(-24 36 152)" />
  <ellipse cx="140" cy="152" rx="24" ry="16" fill="${accent}" transform="rotate(24 140 152)" />
  <path d="M53 206 Q34 228 18 214" stroke="var(--cream)" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M123 206 Q142 228 158 214" stroke="var(--cream)" stroke-width="9" fill="none" stroke-linecap="round"/>
</g>`;

const frame = ({ title, subtitle, vars, scene, align = 'left' }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="${vars.bg1}"/>
      <stop offset="55%" stop-color="${vars.bg2}"/>
      <stop offset="100%" stop-color="${vars.bg3}"/>
    </linearGradient>
    <radialGradient id="glowA" cx="20%" cy="18%" r="80%">
      <stop offset="0%" stop-color="${vars.glow}" stop-opacity=".92"/>
      <stop offset="100%" stop-color="${vars.glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="80%" cy="76%" r="70%">
      <stop offset="0%" stop-color="${vars.glow2 || vars.glow}" stop-opacity=".54"/>
      <stop offset="100%" stop-color="${vars.glow2 || vars.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <style>
      :root {
        --lobster: ${vars.lobster};
        --cream: ${vars.cream};
      }
      text { font-family: Arial, Helvetica, sans-serif; }
      .title { font-size: 66px; font-weight: 800; fill: white; letter-spacing: .02em; }
      .subtitle { font-size: 25px; fill: rgba(255,255,255,.82); }
      .kicker { font-size: 17px; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; fill: rgba(255,255,255,.55); }
    </style>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <circle cx="240" cy="150" r="250" fill="url(#glowA)" filter="url(#soft)"/>
  <circle cx="1090" cy="590" r="240" fill="url(#glowB)" filter="url(#soft)"/>
  <g opacity=".22" stroke="rgba(255,255,255,.38)" stroke-width="2" fill="none">
    <path d="M42 150 C270 60, 560 76, 830 182"/>
    <path d="M610 660 C860 520, 1110 520, 1236 612"/>
  </g>
  <rect x="78" y="54" width="1124" height="612" rx="42" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)"/>
  ${align === 'left' ? `
    <g transform="translate(136 122)">
      <text class="kicker" x="0" y="0">CLAWSPACE DEFAULT COVER</text>
      <text class="title" x="0" y="92">${title}</text>
      <text class="subtitle" x="0" y="144">${subtitle}</text>
    </g>
  ` : `
    <g transform="translate(640 116)">
      <text class="kicker" x="0" y="0" text-anchor="middle">CLAWSPACE DEFAULT COVER</text>
      <text class="title" x="0" y="92" text-anchor="middle">${title}</text>
      <text class="subtitle" x="0" y="144" text-anchor="middle">${subtitle}</text>
    </g>
  `}
  ${scene}
</svg>`;

const sceneGameOrbit = (vars) => `
  ${lobster(170, 260, 1.08, vars.accent)}
  <g transform="translate(514 198)">
    <circle cx="180" cy="150" r="128" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="6" />
    <circle cx="180" cy="150" r="84" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="6" />
    <circle cx="180" cy="150" r="34" fill="${vars.accent}" />
    <rect x="354" y="34" width="110" height="110" rx="22" fill="#5B8CFF" transform="rotate(12 409 89)"/>
    <rect x="310" y="216" width="110" height="110" rx="22" fill="#FFB454" transform="rotate(-16 365 271)"/>
    <rect x="72" y="286" width="110" height="110" rx="22" fill="#FF6A5A" transform="rotate(8 127 341)"/>
    <path d="M278 74 C334 118, 356 184, 318 246" stroke="#7CF2C7" stroke-width="14" fill="none" stroke-linecap="round"/>
  </g>`;

const sceneGamePixel = (vars) => `
  ${lobster(134, 286, 1, vars.accent)}
  <g transform="translate(480 202)">
    <rect x="0" y="0" width="500" height="300" rx="28" fill="rgba(7,10,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <g transform="translate(42 38)">
      <rect x="0" y="150" width="398" height="32" fill="#325E3B"/>
      <rect x="22" y="126" width="34" height="24" fill="#74C26D"/>
      <rect x="94" y="98" width="34" height="52" fill="#74C26D"/>
      <rect x="166" y="110" width="34" height="40" fill="#74C26D"/>
      <rect x="252" y="88" width="34" height="62" fill="#74C26D"/>
      <rect x="58" y="56" width="52" height="52" fill="#5C87FF"/>
      <rect x="146" y="34" width="52" height="52" fill="#FFB454"/>
      <rect x="230" y="56" width="52" height="52" fill="#FF6A5A"/>
      <rect x="318" y="24" width="52" height="52" fill="#7EF1D0"/>
      <rect x="138" y="182" width="44" height="44" fill="#FFF1E8"/>
      <rect x="126" y="194" width="12" height="20" fill="#0F172A"/>
      <rect x="182" y="194" width="12" height="20" fill="#0F172A"/>
    </g>
  </g>`;

const sceneGameFactory = (vars) => `
  ${lobster(164, 250, 1.04, vars.accent)}
  <g transform="translate(528 188)">
    <rect x="0" y="0" width="470" height="320" rx="30" fill="rgba(10,16,25,.8)" stroke="rgba(255,255,255,.16)"/>
    <rect x="40" y="214" width="388" height="24" rx="12" fill="#3A4B63"/>
    <rect x="68" y="182" width="74" height="74" rx="18" fill="#5C87FF"/>
    <rect x="182" y="160" width="74" height="74" rx="18" fill="#FFB454"/>
    <rect x="292" y="192" width="74" height="74" rx="18" fill="#FF6A5A"/>
    <circle cx="392" cy="84" r="36" fill="#7EF1D0"/>
    <path d="M62 92 h188" stroke="rgba(255,255,255,.82)" stroke-width="14" stroke-linecap="round"/>
    <path d="M62 128 h150" stroke="rgba(255,255,255,.36)" stroke-width="14" stroke-linecap="round"/>
    <path d="M280 84 h70" stroke="rgba(255,255,255,.36)" stroke-width="14" stroke-linecap="round"/>
  </g>`;

const sceneAIEditor = (vars) => `
  ${lobster(164, 268, 1.04, vars.accent)}
  <g transform="translate(504 174)">
    <rect x="0" y="0" width="516" height="340" rx="30" fill="rgba(8,12,26,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="34" y="38" width="448" height="54" rx="16" fill="rgba(255,255,255,.08)"/>
    <path d="M70 64 h180" stroke="rgba(255,255,255,.82)" stroke-width="12" stroke-linecap="round"/>
    <circle cx="420" cy="65" r="14" fill="#7EF1D0"/>
    <g transform="translate(52 124)">
      <rect x="0" y="0" width="190" height="140" rx="20" fill="#1B2A52"/>
      <path d="M26 34 h136" stroke="#7DA9FF" stroke-width="12" stroke-linecap="round"/>
      <path d="M26 66 h116" stroke="#7DA9FF" stroke-width="12" stroke-linecap="round"/>
      <path d="M26 98 h90" stroke="#7DA9FF" stroke-width="12" stroke-linecap="round"/>
    </g>
    <g transform="translate(282 124)">
      <circle cx="82" cy="70" r="22" fill="#78F0D2"/>
      <circle cx="152" cy="42" r="18" fill="#8B7CFF"/>
      <circle cx="152" cy="112" r="18" fill="#63A6FF"/>
      <path d="M82 70 L152 42 L152 112 Z" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>`;

const sceneAIChat = (vars) => `
  ${lobster(186, 268, 1, vars.accent)}
  <g transform="translate(500 180)">
    <rect x="0" y="0" width="524" height="330" rx="30" fill="rgba(9,14,30,.8)" stroke="rgba(255,255,255,.16)"/>
    <rect x="40" y="44" width="198" height="90" rx="24" fill="#5C87FF"/>
    <rect x="284" y="104" width="196" height="90" rx="24" fill="#243A72"/>
    <rect x="60" y="212" width="244" height="72" rx="20" fill="rgba(255,255,255,.08)"/>
    <path d="M74 74 h116" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
    <path d="M74 102 h88" stroke="rgba(255,255,255,.72)" stroke-width="12" stroke-linecap="round"/>
    <path d="M316 136 h110" stroke="#7EF1D0" stroke-width="12" stroke-linecap="round"/>
    <path d="M316 164 h78" stroke="rgba(255,255,255,.72)" stroke-width="12" stroke-linecap="round"/>
    <circle cx="396" cy="248" r="42" fill="#FFD166"/>
    <path d="M370 248 h52" stroke="#1B2336" stroke-width="10" stroke-linecap="round"/>
  </g>`;

const sceneAICode = (vars) => `
  ${lobster(144, 278, 1.02, vars.accent)}
  <g transform="translate(480 176)">
    <rect x="0" y="0" width="540" height="334" rx="28" fill="rgba(9,14,30,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="0" y="0" width="540" height="46" rx="28" fill="rgba(255,255,255,.06)"/>
    <circle cx="38" cy="23" r="8" fill="#FF6A5A"/><circle cx="66" cy="23" r="8" fill="#FFB454"/><circle cx="94" cy="23" r="8" fill="#7EF1D0"/>
    <path d="M58 96 h150" stroke="#8B7CFF" stroke-width="12" stroke-linecap="round"/>
    <path d="M94 132 h236" stroke="#63A6FF" stroke-width="12" stroke-linecap="round"/>
    <path d="M130 168 h168" stroke="#7EF1D0" stroke-width="12" stroke-linecap="round"/>
    <path d="M94 210 h280" stroke="rgba(255,255,255,.74)" stroke-width="12" stroke-linecap="round"/>
    <path d="M58 262 h194" stroke="#FFB454" stroke-width="12" stroke-linecap="round"/>
    <path d="M404 104 l26 24 -26 24" fill="none" stroke="#7EF1D0" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const sceneOCRScan = (vars) => `
  ${lobster(152, 272, 1.02, vars.accent)}
  <g transform="translate(500 168)">
    <rect x="0" y="0" width="516" height="346" rx="30" fill="rgba(8,14,25,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="48" y="44" width="218" height="270" rx="18" fill="#EEF5FF"/>
    <path d="M84 102 h138" stroke="#4A6CF7" stroke-width="14" stroke-linecap="round"/>
    <path d="M84 146 h104" stroke="#7DA9FF" stroke-width="14" stroke-linecap="round"/>
    <path d="M84 190 h128" stroke="#4A6CF7" stroke-width="14" stroke-linecap="round"/>
    <path d="M68 60 h48 v48" fill="none" stroke="#FFB454" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M246 60 h-48 v48" fill="none" stroke="#FFB454" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M68 298 h48 v-48" fill="none" stroke="#FFB454" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M246 298 h-48 v-48" fill="none" stroke="#FFB454" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="370" cy="164" r="74" fill="none" stroke="#79F0D0" stroke-width="14"/>
    <path d="M422 216 L476 270" stroke="#79F0D0" stroke-width="16" stroke-linecap="round"/>
  </g>`;

const sceneOCRReceipt = (vars) => `
  ${lobster(144, 280, 1, vars.accent)}
  <g transform="translate(514 174)">
    <rect x="0" y="0" width="500" height="338" rx="28" fill="rgba(9,13,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <path d="M78 44 h170 l24 18 24 -18 h132 v250 l-18 12 -18 -12 -18 12 -18 -12 -18 12 -18 -12 -18 12 -18 -12 -18 12 -18 -12 -18 12 V44z" fill="#F4F7FF"/>
    <path d="M120 108 h220" stroke="#365FF8" stroke-width="12" stroke-linecap="round"/>
    <path d="M120 144 h176" stroke="#7DA9FF" stroke-width="12" stroke-linecap="round"/>
    <path d="M120 188 h210" stroke="#365FF8" stroke-width="12" stroke-linecap="round"/>
    <path d="M120 232 h158" stroke="#7DA9FF" stroke-width="12" stroke-linecap="round"/>
    <circle cx="398" cy="120" r="24" fill="#FFD166"/>
    <circle cx="398" cy="188" r="24" fill="#7EF1D0"/>
  </g>`;

const sceneOCRDiagram = (vars) => `
  ${lobster(170, 272, 1.02, vars.accent)}
  <g transform="translate(510 184)">
    <rect x="0" y="0" width="500" height="320" rx="30" fill="rgba(10,16,25,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="48" y="48" width="184" height="112" rx="20" fill="#1A294D"/>
    <rect x="272" y="48" width="184" height="112" rx="20" fill="#1C3D4A"/>
    <rect x="160" y="204" width="184" height="78" rx="20" fill="#332950"/>
    <path d="M232 104 H272" stroke="#79F0D0" stroke-width="10" stroke-linecap="round"/>
    <path d="M252 160 V204" stroke="#79F0D0" stroke-width="10" stroke-linecap="round"/>
    <path d="M356 160 L316 204" stroke="#79F0D0" stroke-width="10" stroke-linecap="round"/>
    <path d="M82 104 h110" stroke="rgba(255,255,255,.8)" stroke-width="12" stroke-linecap="round"/>
    <path d="M306 104 h110" stroke="rgba(255,255,255,.8)" stroke-width="12" stroke-linecap="round"/>
    <path d="M202 244 h100" stroke="rgba(255,255,255,.8)" stroke-width="12" stroke-linecap="round"/>
  </g>`;

const sceneUtilityFocus = (vars) => `
  ${lobster(144, 274, 1.02, vars.accent)}
  <g transform="translate(492 176)">
    <rect x="0" y="0" width="532" height="336" rx="30" fill="rgba(10,16,25,.8)" stroke="rgba(255,255,255,.16)"/>
    <rect x="38" y="42" width="198" height="104" rx="22" fill="#7EF1D0"/>
    <text x="68" y="111" font-size="50" font-weight="800" fill="#0C172B">24:00</text>
    <rect x="276" y="42" width="202" height="104" rx="22" fill="#5C87FF"/>
    <text x="326" y="106" font-size="38" font-weight="800" fill="#fff">SHIP</text>
    <rect x="38" y="184" width="440" height="42" rx="21" fill="rgba(255,255,255,.08)"/>
    <rect x="38" y="184" width="318" height="42" rx="21" fill="#FFB454" opacity=".92"/>
    <path d="M54 276 h128" stroke="#FFB454" stroke-width="14" stroke-linecap="round"/>
    <path d="M202 276 h136" stroke="#7EF1D0" stroke-width="14" stroke-linecap="round"/>
  </g>`;

const sceneUtilityDashboard = (vars) => `
  ${lobster(162, 274, 1.02, vars.accent)}
  <g transform="translate(510 178)">
    <rect x="0" y="0" width="500" height="332" rx="30" fill="rgba(9,15,24,.8)" stroke="rgba(255,255,255,.16)"/>
    <rect x="42" y="42" width="194" height="112" rx="20" fill="#1C3450"/>
    <rect x="264" y="42" width="194" height="112" rx="20" fill="#214A4E"/>
    <rect x="42" y="186" width="416" height="96" rx="22" fill="rgba(255,255,255,.08)"/>
    <circle cx="118" cy="98" r="34" fill="#FFB454"/>
    <path d="M98 98 h40" stroke="#102030" stroke-width="8" stroke-linecap="round"/>
    <path d="M290 90 h110" stroke="#7EF1D0" stroke-width="12" stroke-linecap="round"/>
    <path d="M290 120 h74" stroke="rgba(255,255,255,.6)" stroke-width="12" stroke-linecap="round"/>
    <path d="M82 232 h284" stroke="rgba(255,255,255,.8)" stroke-width="14" stroke-linecap="round"/>
    <path d="M82 264 h196" stroke="rgba(255,255,255,.36)" stroke-width="14" stroke-linecap="round"/>
  </g>`;

const sceneUtilityCreator = (vars) => `
  ${lobster(148, 274, 1.02, vars.accent)}
  <g transform="translate(500 184)">
    <rect x="0" y="0" width="510" height="320" rx="30" fill="rgba(9,14,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="40" y="42" width="130" height="130" rx="24" fill="#5C87FF"/>
    <rect x="194" y="42" width="278" height="48" rx="16" fill="rgba(255,255,255,.08)"/>
    <path d="M220 66 h140" stroke="rgba(255,255,255,.82)" stroke-width="12" stroke-linecap="round"/>
    <path d="M220 118 h208" stroke="#7EF1D0" stroke-width="12" stroke-linecap="round"/>
    <rect x="40" y="202" width="432" height="70" rx="20" fill="rgba(255,255,255,.08)"/>
    <circle cx="98" cy="238" r="20" fill="#FFB454"/>
    <path d="M142 238 h124" stroke="rgba(255,255,255,.8)" stroke-width="12" stroke-linecap="round"/>
    <path d="M302 238 h110" stroke="#FF8A6B" stroke-width="12" stroke-linecap="round"/>
  </g>`;

const sceneStoryMystery = (vars) => `
  ${lobster(150, 270, 1.02, vars.accent)}
  <g transform="translate(506 176)">
    <rect x="0" y="0" width="512" height="334" rx="30" fill="rgba(12,10,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="44" y="44" width="168" height="232" rx="18" fill="#1C1B37" stroke="rgba(255,255,255,.14)"/>
    <circle cx="128" cy="116" r="38" fill="#FFD166"/>
    <path d="M94 192 Q128 158 162 192" fill="none" stroke="#79F0D0" stroke-width="10" stroke-linecap="round"/>
    <rect x="254" y="48" width="206" height="124" rx="18" fill="#14192F" stroke="rgba(255,255,255,.14)"/>
    <path d="M288 94 h136" stroke="rgba(255,255,255,.82)" stroke-width="12" stroke-linecap="round"/>
    <path d="M288 132 h88" stroke="#FF8A6B" stroke-width="12" stroke-linecap="round"/>
    <rect x="254" y="202" width="206" height="74" rx="18" fill="rgba(255,255,255,.08)"/>
    <path d="M286 238 h136" stroke="rgba(255,255,255,.74)" stroke-width="12" stroke-linecap="round"/>
  </g>`;

const sceneStoryManor = (vars) => `
  ${lobster(176, 272, 1, vars.accent)}
  <g transform="translate(502 174)">
    <rect x="0" y="0" width="520" height="338" rx="30" fill="rgba(12,10,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <path d="M72 248 V150 L162 90 L252 150 V248 Z" fill="#2A224B"/>
    <path d="M122 248 V186 H202 V248" fill="#FFB454" opacity=".9"/>
    <rect x="302" y="62" width="150" height="212" rx="18" fill="#161A32"/>
    <path d="M334 102 h86" stroke="rgba(255,255,255,.82)" stroke-width="12" stroke-linecap="round"/>
    <path d="M334 138 h100" stroke="rgba(255,255,255,.42)" stroke-width="12" stroke-linecap="round"/>
    <path d="M334 182 h72" stroke="#79F0D0" stroke-width="12" stroke-linecap="round"/>
    <circle cx="420" cy="252" r="16" fill="#FFD166"/>
  </g>`;

const sceneStoryDialogue = (vars) => `
  ${lobster(154, 278, 1, vars.accent)}
  <g transform="translate(500 184)">
    <rect x="0" y="0" width="516" height="320" rx="30" fill="rgba(12,10,24,.82)" stroke="rgba(255,255,255,.16)"/>
    <rect x="40" y="46" width="214" height="92" rx="22" fill="#2A224B"/>
    <rect x="262" y="134" width="208" height="92" rx="22" fill="#3A275E"/>
    <rect x="72" y="238" width="222" height="42" rx="18" fill="rgba(255,255,255,.08)"/>
    <path d="M72 84 h126" stroke="rgba(255,255,255,.82)" stroke-width="12" stroke-linecap="round"/>
    <path d="M72 112 h84" stroke="#79F0D0" stroke-width="12" stroke-linecap="round"/>
    <path d="M292 170 h116" stroke="#FFD166" stroke-width="12" stroke-linecap="round"/>
    <path d="M292 198 h74" stroke="rgba(255,255,255,.65)" stroke-width="12" stroke-linecap="round"/>
  </g>`;

const variants = {
  game: [
    { key: 'game-1', title: 'LOBSTER ARCADE', subtitle: 'Default cover for playful games built by tiny claws.', scene: sceneGameOrbit, align: 'left' },
    { key: 'game-2', title: 'PIXEL CLAWS', subtitle: 'Default cover for fast, colorful, and gamey web experiences.', scene: sceneGamePixel, align: 'center' },
    { key: 'game-3', title: 'FACTORY MODE', subtitle: 'Default cover for management, puzzle, and score-chasing games.', scene: sceneGameFactory, align: 'left' },
  ],
  ai: [
    { key: 'ai-1', title: 'LOBSTER LAB', subtitle: 'Default cover for AI tools and assistant-style apps.', scene: sceneAIEditor, align: 'left' },
    { key: 'ai-2', title: 'CLAW CHAT', subtitle: 'Default cover for chat, rewrite, and text generation apps.', scene: sceneAIChat, align: 'center' },
    { key: 'ai-3', title: 'CODE SIGNAL', subtitle: 'Default cover for coding copilots and technical AI utilities.', scene: sceneAICode, align: 'left' },
  ],
  ocr: [
    { key: 'ocr-1', title: 'VISION CLAW', subtitle: 'Default cover for OCR, scan, and vision-powered apps.', scene: sceneOCRScan, align: 'left' },
    { key: 'ocr-2', title: 'RECEIPT RADAR', subtitle: 'Default cover for document parsing and extraction tools.', scene: sceneOCRReceipt, align: 'center' },
    { key: 'ocr-3', title: 'CHART SCAN', subtitle: 'Default cover for multimodal analysis and screenshot reading.', scene: sceneOCRDiagram, align: 'left' },
  ],
  utility: [
    { key: 'utility-1', title: 'CLAWSPACE TOOLS', subtitle: 'Default cover for practical utilities and lightweight helpers.', scene: sceneUtilityFocus, align: 'left' },
    { key: 'utility-2', title: 'DASH MODE', subtitle: 'Default cover for dashboards, timers, and workflow tools.', scene: sceneUtilityDashboard, align: 'center' },
    { key: 'utility-3', title: 'CREATOR OPS', subtitle: 'Default cover for creator workflows and publishing helpers.', scene: sceneUtilityCreator, align: 'left' },
  ],
  story: [
    { key: 'story-1', title: 'LOBSTER TALES', subtitle: 'Default cover for story, mystery, and dialogue-driven apps.', scene: sceneStoryMystery, align: 'left' },
    { key: 'story-2', title: 'MIDNIGHT MANOR', subtitle: 'Default cover for suspense, detective, and manor stories.', scene: sceneStoryManor, align: 'center' },
    { key: 'story-3', title: 'DIALOGUE NOIR', subtitle: 'Default cover for narrative and branching conversation play.', scene: sceneStoryDialogue, align: 'left' },
  ],
};

const palettes = {
  game: { bg1: '#11182F', bg2: '#22345E', bg3: '#0B1225', glow: '#5C87FF', glow2: '#7EF1D0', lobster: '#FF6A5A', cream: '#FFF1E3', accent: '#FFB454' },
  ai: { bg1: '#171738', bg2: '#243A72', bg3: '#0F1130', glow: '#8B7CFF', glow2: '#63A6FF', lobster: '#FF745F', cream: '#FFF1E8', accent: '#7EF1D0' },
  ocr: { bg1: '#10203A', bg2: '#204A78', bg3: '#0B1428', glow: '#63A6FF', glow2: '#79F0D0', lobster: '#FF765D', cream: '#FFF1E8', accent: '#FFB454' },
  utility: { bg1: '#112526', bg2: '#244E56', bg3: '#0A171A', glow: '#7EF1D0', glow2: '#5C87FF', lobster: '#FF785E', cream: '#FFF0E0', accent: '#FFB454' },
  story: { bg1: '#1C1833', bg2: '#3A275E', bg3: '#120E24', glow: '#FF8A6B', glow2: '#FFD166', lobster: '#FF745A', cream: '#FFF1E6', accent: '#79F0D0' },
};

await fs.mkdir(srcDir, { recursive: true });
await fs.mkdir(outDir, { recursive: true });

for (const [kind, items] of Object.entries(variants)) {
  const vars = palettes[kind];
  for (const item of items) {
    const svg = frame({
      title: item.title,
      subtitle: item.subtitle,
      vars,
      scene: item.scene(vars),
      align: item.align,
    });
    const svgPath = path.join(srcDir, `${item.key}.svg`);
    const pngPath = path.join(outDir, `${item.key}.png`);
    await fs.writeFile(svgPath, svg, 'utf8');
    execFileSync('python3', [checkScript, svgPath], { stdio: 'inherit' });
    execFileSync('bash', [exportScript, svgPath, pngPath, '1280', '720'], { stdio: 'inherit' });
  }
  await fs.copyFile(path.join(outDir, `${kind}-1.png`), path.join(outDir, `${kind}.png`));
}

console.log(`Generated ${Object.values(variants).flat().length} variant covers in ${outDir}`);
