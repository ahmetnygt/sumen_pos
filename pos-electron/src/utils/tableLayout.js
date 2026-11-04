export const CANVAS_W = 1200;
export const CANVAS_H = 800;
const DEF_W = 140;
const DEF_H = 90;
const MIN_W = 80;
const MIN_H = 60;
const MIN_DECOR_W = 40;
const MIN_DECOR_H = 16;

export const DECOR_DEFAULTS = {
    wall: { label: 'Duvar', canvas_w: 480, canvas_h: 28 },
    bar: { label: 'Bar', canvas_w: 320, canvas_h: 90 },
    label: { label: '', canvas_w: 180, canvas_h: 48 }
};

export function clampLayout(item) {
    let width = Number(item.canvas_w);
    let height = Number(item.canvas_h);
    if (!Number.isFinite(width)) width = DEF_W;
    if (!Number.isFinite(height)) height = DEF_H;
    width = Math.min(CANVAS_W, Math.max(MIN_W, Math.round(width)));
    height = Math.min(CANVAS_H, Math.max(MIN_H, Math.round(height)));
    let x = Number(item.canvas_x);
    let y = Number(item.canvas_y);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    x = Math.min(CANVAS_W - width, Math.max(0, Math.round(x)));
    y = Math.min(CANVAS_H - height, Math.max(0, Math.round(y)));
    return { ...item, canvas_x: x, canvas_y: y, canvas_w: width, canvas_h: height };
}

export function clampDecor(item) {
    const defaults = DECOR_DEFAULTS[item.kind] || DECOR_DEFAULTS.label;
    let width = Number(item.canvas_w);
    let height = Number(item.canvas_h);
    if (!Number.isFinite(width)) width = defaults.canvas_w;
    if (!Number.isFinite(height)) height = defaults.canvas_h;
    width = Math.min(CANVAS_W, Math.max(MIN_DECOR_W, Math.round(width)));
    height = Math.min(CANVAS_H, Math.max(MIN_DECOR_H, Math.round(height)));
    let x = Number(item.canvas_x);
    let y = Number(item.canvas_y);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    x = Math.min(CANVAS_W - width, Math.max(0, Math.round(x)));
    y = Math.min(CANVAS_H - height, Math.max(0, Math.round(y)));
    let label = item.label;
    if (item.kind === 'wall' || item.kind === 'bar') label = defaults.label;
    else label = String(label || '').trim().slice(0, 24);
    return { ...item, label, canvas_x: x, canvas_y: y, canvas_w: width, canvas_h: height };
}

const SNAP = 8;
const GRID = 20;

function peerEdges(others) {
    const xs = [];
    const ys = [];
    others.forEach((other) => {
        const x = Number(other.canvas_x);
        const y = Number(other.canvas_y);
        const width = Number(other.canvas_w);
        const height = Number(other.canvas_h);
        if (![x, y, width, height].every(Number.isFinite)) return;
        xs.push(x, x + width / 2, x + width);
        ys.push(y, y + height / 2, y + height);
    });
    return { xs, ys };
}

function nearest(edge, targets) {
    let best = null;
    targets.forEach((target) => {
        const dist = Math.abs(edge - target);
        if (dist <= SNAP && (!best || dist < best.dist)) best = { dist, at: target };
    });
    return best;
}

function snapPosition(pos, size, targets) {
    const edges = [pos, pos + size / 2, pos + size];
    let best = null;
    edges.forEach((edge) => {
        const hit = nearest(edge, targets);
        if (!hit) return;
        const delta = hit.at - edge;
        if (!best || hit.dist < best.dist) best = { dist: hit.dist, pos: pos + delta, guide: hit.at };
    });
    if (best) return { pos: best.pos, guide: best.guide };
    return { pos: Math.round(pos / GRID) * GRID, guide: null };
}

function snapFarEdge(pos, size, targets) {
    const edge = pos + size;
    const hit = nearest(edge, targets);
    if (hit) return { size: hit.at - pos, guide: hit.at };
    return { size: Math.round(edge / GRID) * GRID - pos, guide: null };
}

export function snapBox(item, others, mode = 'move') {
    const { xs, ys } = peerEdges(others || []);
    const next = { ...item };
    const guides = [];
    if (mode === 'resize') {
        const right = snapFarEdge(Number(next.canvas_x), Number(next.canvas_w), xs);
        const bottom = snapFarEdge(Number(next.canvas_y), Number(next.canvas_h), ys);
        next.canvas_w = right.size;
        next.canvas_h = bottom.size;
        if (right.guide != null) guides.push({ axis: 'x', at: right.guide });
        if (bottom.guide != null) guides.push({ axis: 'y', at: bottom.guide });
    } else {
        const x = snapPosition(Number(next.canvas_x), Number(next.canvas_w), xs);
        const y = snapPosition(Number(next.canvas_y), Number(next.canvas_h), ys);
        next.canvas_x = x.pos;
        next.canvas_y = y.pos;
        if (x.guide != null) guides.push({ axis: 'x', at: x.guide });
        if (y.guide != null) guides.push({ axis: 'y', at: y.guide });
    }
    return { item: next, guides };
}

export function placeTables(tables) {
    const cols = Math.max(1, Math.floor((CANVAS_W - 20) / (DEF_W + 20)));
    let slot = 0;
    return tables.map((table) => {
        if (table.canvas_w != null && table.canvas_h != null) {
            return clampLayout(table);
        }
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        slot += 1;
        return clampLayout({
            ...table,
            canvas_x: 20 + col * (DEF_W + 20),
            canvas_y: 20 + row * (DEF_H + 20),
            canvas_w: DEF_W,
            canvas_h: DEF_H
        });
    });
}
