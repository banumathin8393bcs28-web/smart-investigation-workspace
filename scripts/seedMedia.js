const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseDir = path.join(__dirname, '..', 'public');
const imgDir = path.join(baseDir, 'images');
const origDir = path.join(baseDir, 'uploads', 'originals');
const analDir = path.join(baseDir, 'uploads', 'analysis');
const suspDir = path.join(baseDir, 'uploads', 'suspects');
const avatDir = path.join(baseDir, 'uploads', 'avatars');

[imgDir, origDir, analDir, suspDir, avatDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Default Avatar SVG
const defaultAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#1e293b"/>
  <circle cx="100" cy="75" r="40" fill="#38bdf8"/>
  <path d="M 30 180 C 30 130, 170 130, 170 180 Z" fill="#0284c7"/>
  <circle cx="100" cy="70" r="10" fill="#0f172a"/>
</svg>`;

fs.writeFileSync(path.join(imgDir, 'default-avatar.svg'), defaultAvatarSvg);
fs.writeFileSync(path.join(imgDir, 'default-avatar.png'), defaultAvatarSvg);

// Default Suspect Mugshot SVG
const defaultSuspectSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
  <rect width="200" height="240" fill="#0f172a"/>
  <!-- Height Grid Lines -->
  <line x1="10" y1="40" x2="190" y2="40" stroke="#334155" stroke-width="1"/>
  <line x1="10" y1="70" x2="190" y2="70" stroke="#334155" stroke-width="1"/>
  <line x1="10" y1="100" x2="190" y2="100" stroke="#334155" stroke-width="1"/>
  <line x1="10" y1="130" x2="190" y2="130" stroke="#334155" stroke-width="1"/>
  <text x="15" y="65" fill="#64748b" font-size="10" font-family="monospace">6' 0"</text>
  <text x="15" y="95" fill="#64748b" font-size="10" font-family="monospace">5' 8"</text>
  <circle cx="100" cy="90" r="45" fill="#475569"/>
  <path d="M 35 220 C 35 155, 165 155, 165 220 Z" fill="#334155"/>
  <rect x="50" y="205" width="100" height="25" fill="#000" stroke="#ef4444" stroke-width="2"/>
  <text x="100" y="222" fill="#fff" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">SUSPECT #892</text>
</svg>`;

fs.writeFileSync(path.join(imgDir, 'default-suspect.svg'), defaultSuspectSvg);
fs.writeFileSync(path.join(imgDir, 'default-suspect.png'), defaultSuspectSvg);

// Generate sample evidence images
function createSampleEvidenceSvg(title, subtitle, iconCode, accentColor, filename) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0f1d"/>
        <stop offset="100%" stop-color="#152033"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#g)"/>
    <!-- Viewfinder grid -->
    <rect x="40" y="40" width="720" height="420" fill="none" stroke="#25354e" stroke-dasharray="10,10" stroke-width="2"/>
    <circle cx="400" cy="240" r="140" fill="none" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="2"/>
    <line x1="380" y1="240" x2="420" y2="240" stroke="${accentColor}" stroke-width="2"/>
    <line x1="400" y1="220" x2="400" y2="260" stroke="${accentColor}" stroke-width="2"/>
    <!-- Simulated CCTV Overlay -->
    <text x="60" y="80" fill="#38bdf8" font-family="monospace" font-size="18" font-weight="bold">CAM_04 // REC [●] 1080P</text>
    <text x="60" y="105" fill="#64748b" font-family="monospace" font-size="14">TIME: 2026-10-23T14:32:09.412Z</text>
    <!-- Center subject text -->
    <text x="400" y="245" fill="${accentColor}" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">${title}</text>
    <text x="400" y="280" fill="#cbd5e1" font-family="sans-serif" font-size="16" text-anchor="middle">${subtitle}</text>
    <!-- Forensic hash watermark -->
    <rect x="40" y="420" width="720" height="40" fill="#090d16" fill-opacity="0.9"/>
    <text x="60" y="445" fill="#94a3b8" font-family="monospace" font-size="12">ORIGINAL ARTIFACT // SHA-256 BASESEC VERIFIED // DIGITAL FORENSIC EVIDENCE</text>
  </svg>`;

  const origPath = path.join(origDir, filename);
  const analPath = path.join(analDir, `analysis_${filename}`);
  fs.writeFileSync(origPath, svg);
  fs.writeFileSync(analPath, svg);
  return origPath;
}

createSampleEvidenceSvg('COMMERCIAL VAULT CCTV', 'Suspect entering through rear vault breach doorway', 'CCTV', '#38bdf8', 'evidence-cctv-vault.png');
createSampleEvidenceSvg('SUSPECT VEHICLE - BLACK SEDAN', 'License plate obscured by reflective mud coating', 'CAR', '#fbbf24', 'evidence-getaway-car.png');
createSampleEvidenceSvg('FORENSIC WEAPON EXTRACTION', 'Tactical 9mm semi-automatic firearm recovered at scene', 'GUN', '#f87171', 'evidence-firearm.png');
createSampleEvidenceSvg('ENCRYPTED MOBILE DEVICE', 'Hardware seized during field interrogation search', 'PHONE', '#a78bfa', 'evidence-phone.png');

// Suspect sample mugshot
const suspect1Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
  <rect width="200" height="240" fill="#111827"/>
  <rect x="0" y="0" width="200" height="240" fill="none" stroke="#ef4444" stroke-width="4"/>
  <circle cx="100" cy="85" r="40" fill="#334155"/>
  <path d="M 30 210 C 30 145, 170 145, 170 210 Z" fill="#1e293b"/>
  <text x="100" y="90" fill="#fff" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle">M. VANCE</text>
  <rect x="30" y="195" width="140" height="30" fill="#991b1b"/>
  <text x="100" y="215" fill="#fff" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle">WANTED // ARMED</text>
</svg>`;

fs.writeFileSync(path.join(suspDir, 'suspect-marcus-vance.png'), suspect1Svg);

console.log('Seeded SVG visual assets successfully.');
