import { useEffect, useRef, useState } from 'react';
import { PHOTO_RATIO, encodeJpeg } from './menuIcons';

function frameOf(image, zoom, pan, frame) {
    if (!image?.naturalWidth || !frame?.w) return null;
    const base = Math.max(frame.w / image.naturalWidth, frame.h / image.naturalHeight);
    const scale = base * zoom;
    const dispW = image.naturalWidth * scale;
    const dispH = image.naturalHeight * scale;
    const maxX = Math.max(0, (dispW - frame.w) / 2);
    const maxY = Math.max(0, (dispH - frame.h) / 2);
    const x = Math.min(maxX, Math.max(-maxX, pan.x));
    const y = Math.min(maxY, Math.max(-maxY, pan.y));
    return {
        scale,
        dispW,
        dispH,
        frame,
        imgX: (frame.w - dispW) / 2 + x,
        imgY: (frame.h - dispH) / 2 + y
    };
}

export default function PhotoCrop({ src, onCancel, onConfirm }) {
    const imgRef = useRef(null);
    const frameRef = useRef(null);
    const drag = useRef(null);
    const [ready, setReady] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setReady(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, [src]);

    const frameSize = () => {
        const rect = frameRef.current?.getBoundingClientRect();
        return { w: rect?.width || 0, h: rect?.height || 0 };
    };

    const place = frameOf(imgRef.current, zoom, pan, frameSize());

    const onPointerDown = (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, pan };
    };

    const onPointerMove = (event) => {
        if (!drag.current) return;
        setPan({
            x: drag.current.pan.x + (event.clientX - drag.current.x),
            y: drag.current.pan.y + (event.clientY - drag.current.y)
        });
    };

    const confirm = () => {
        const image = imgRef.current;
        const box = frameOf(image, zoom, pan, frameSize());
        if (!image || !box) return;
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round(320 / PHOTO_RATIO);
        const sx = (0 - box.imgX) / box.scale;
        const sy = (0 - box.imgY) / box.scale;
        canvas.getContext('2d').drawImage(image, sx, sy, box.frame.w / box.scale, box.frame.h / box.scale, 0, 0, canvas.width, canvas.height);
        try {
            onConfirm(encodeJpeg(canvas));
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div className="photo-crop">
            <p>Satış kutusundaki alana göre kırp. Görseli sürükleyebilirsin.</p>
            <div
                ref={frameRef}
                className="crop-frame"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => { drag.current = null; }}
            >
                <img
                    ref={imgRef}
                    src={src}
                    alt=""
                    draggable={false}
                    onLoad={() => setReady(true)}
                    style={place ? { width: place.dispW, height: place.dispH, left: place.imgX, top: place.imgY } : undefined}
                />
            </div>
            <label className="crop-zoom">
                Yakınlaştır
                <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
            <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={onCancel}>Vazgeç</button>
                <button type="button" className="crop-use" onClick={confirm} disabled={!ready}>Kırp ve kullan</button>
            </div>
        </div>
    );
}
