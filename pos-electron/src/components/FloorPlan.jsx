import React, { useRef, useState } from 'react';
import { CANVAS_W, CANVAS_H, clampLayout, clampDecor, snapBox } from '../utils/tableLayout';
import './FloorPlan.css';

const boxStyle = (item) => ({
    left: `${(item.canvas_x / CANVAS_W) * 100}%`,
    top: `${(item.canvas_y / CANVAS_H) * 100}%`,
    width: `${(item.canvas_w / CANVAS_W) * 100}%`,
    height: `${(item.canvas_h / CANVAS_H) * 100}%`
});

const FloorPlan = ({ tables, decorations = [], editable = false, onChange, onDecorChange, onDecorRemove, onOpen }) => {
    const stageRef = useRef(null);
    const drag = useRef(null);
    const [guides, setGuides] = useState([]);

    const move = (event) => {
        const state = drag.current;
        if (!state || !editable) return;
        const dx = ((event.clientX - state.startX) / state.rect.width) * CANVAS_W;
        const dy = ((event.clientY - state.startY) / state.rect.height) * CANVAS_H;
        const origin = state.origin;
        const next = state.mode === 'resize'
            ? { ...origin, canvas_w: origin.canvas_w + dx, canvas_h: origin.canvas_h + dy }
            : { ...origin, canvas_x: origin.canvas_x + dx, canvas_y: origin.canvas_y + dy };
        const peers = [
            ...tables.filter(table => !(state.target === 'table' && table.id === state.id)),
            ...decorations.filter(decor => !(state.target === 'decor' && decor.id === state.id))
        ];
        const snapped = event.altKey ? { item: next, guides: [] } : snapBox(next, peers, state.mode);
        setGuides(snapped.guides);
        if (state.target === 'decor') {
            if (onDecorChange) onDecorChange(state.id, clampDecor(snapped.item));
            return;
        }
        if (onChange) onChange(state.id, clampLayout(snapped.item));
    };

    const start = (event, item, mode, target) => {
        if (!editable) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = stageRef.current.getBoundingClientRect();
        drag.current = {
            id: item.id,
            target,
            mode,
            startX: event.clientX,
            startY: event.clientY,
            origin: item,
            rect
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const end = () => {
        drag.current = null;
        setGuides([]);
    };

    return (
        <div className={`floor-fit ${editable ? 'floor-fit-editor' : ''}`}>
            <div
                className="floor-stage"
                ref={stageRef}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
            >
                {decorations.map((decor) => (
                    <div
                        key={decor.id}
                        className={`floor-decor ${decor.kind}`}
                        style={boxStyle(decor)}
                        onPointerDown={(event) => start(event, decor, 'move', 'decor')}
                    >
                        <span className="floor-decor-label">{decor.label}</span>
                        {editable && (
                            <>
                                <button
                                    type="button"
                                    className="floor-decor-remove"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={() => onDecorRemove && onDecorRemove(decor.id)}
                                >×</button>
                                <span
                                    className="floor-resize"
                                    onPointerDown={(event) => start(event, decor, 'resize', 'decor')}
                                />
                            </>
                        )}
                    </div>
                ))}
                {editable && guides.map(guide => (
                    <span
                        key={`${guide.axis}-${guide.at}`}
                        className={`floor-guide ${guide.axis}`}
                        style={guide.axis === 'x'
                            ? { left: `${(guide.at / CANVAS_W) * 100}%` }
                            : { top: `${(guide.at / CANVAS_H) * 100}%` }}
                    />
                ))}
                {tables.map((table) => (
                    <button
                        key={table.id}
                        type="button"
                        className={`floor-table ${table.status !== 'Boş' ? 'busy' : table.hold ? 'reserved' : 'empty'}`}
                        style={boxStyle(table)}
                        onPointerDown={(event) => start(event, table, 'move', 'table')}
                        onClick={() => { if (!editable && onOpen) onOpen(table); }}
                    >
                        <strong>{table.name}</strong>
                        <span className="floor-status">{table.hold ? `${table.hold.guest_name} · ${new Date(table.hold.starts_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · ${table.hold.party_size} kişi` : table.status}</span>
                        {editable && (
                            <span
                                className="floor-resize"
                                onPointerDown={(event) => start(event, table, 'resize', 'table')}
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FloorPlan;
