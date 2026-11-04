const HEX = /^#[0-9a-f]{6}$/;

function cleanAccent(value, { fallback = false } = {}) {
    if ((value == null || String(value).trim() === '') && fallback) return '#d4af37';
    const hex = String(value || '').trim().toLowerCase();
    if (!HEX.test(hex)) return false;
    return hex;
}

function cleanLogo(value) {
    if (value == null || String(value).trim() === '') return null;
    const svg = String(value).trim();
    if (svg.length > 100 * 1024) return false;
    if (!/^<svg[\s>]/i.test(svg)) return false;
    if (/<script/i.test(svg) || /javascript:/i.test(svg)) return false;
    return svg;
}

module.exports = { cleanAccent, cleanLogo };
