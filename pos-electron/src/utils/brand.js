export const BRAND_KEY = 'sumen-brand';
export const DEFAULT_ACCENT = '#d4af37';

export function inkFor(hex) {
    const raw = String(hex || DEFAULT_ACCENT).replace('#', '');
    if (raw.length !== 6) return '#111';
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return y > 0.62 ? '#111' : '#f4f1e8';
}

export function readBrand() {
    try {
        const raw = localStorage.getItem(BRAND_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

export function applyBrand(brand) {
    const accent = brand?.accent_color || DEFAULT_ACCENT;
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-ink', inkFor(accent));
    root.style.setProperty('--primary-color', accent);
    document.title = brand?.name ? `${brand.name} POS` : 'Sümen POS';
}

export function writeBrand(brand) {
    const saved = {
        name: brand.name,
        code: brand.code,
        accent_color: brand.accent_color || DEFAULT_ACCENT,
        logo_svg: brand.logo_svg || null
    };
    localStorage.setItem(BRAND_KEY, JSON.stringify(saved));
    applyBrand(saved);
    return saved;
}

export function clearBrand() {
    localStorage.removeItem(BRAND_KEY);
    applyBrand(null);
}

export async function refreshBrand(api) {
    const saved = readBrand();
    if (!saved?.code) {
        applyBrand(null);
        return null;
    }
    applyBrand(saved);
    try {
        const res = await api.get(`/brand/${saved.code}`);
        return writeBrand(res.data);
    } catch (error) {
        if (error.response?.status === 404) {
            clearBrand();
            return null;
        }
        return saved;
    }
}
