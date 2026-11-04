import React, { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { tr } from 'react-day-picker/locale';
import { format, parse } from 'date-fns';
import 'react-day-picker/style.css';
import './DateTimeField.css';

function parts(value) {
    if (!value || !value.includes('T')) return { day: '', time: '' };
    const [day, time] = value.split('T');
    return { day, time: (time || '').slice(0, 5) };
}

const DateTimeField = ({ value, onChange, placeholder = 'Tarih', dateOnly = false }) => {
    const parsed = dateOnly ? { day: String(value || '').slice(0, 10), time: '' } : parts(value);
    const { day, time } = parsed;
    const selected = day ? parse(day, 'yyyy-MM-dd', new Date()) : undefined;
    const [open, setOpen] = useState(false);
    const [place, setPlace] = useState(null);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);

    const placePopover = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        const height = 340;
        const openUp = window.innerHeight - rect.bottom < height && rect.top > window.innerHeight - rect.bottom;
        setPlace(openUp
            ? { left: rect.left, bottom: window.innerHeight - rect.top + 8 }
            : { left: rect.left, top: rect.bottom + 8 });
    };

    useEffect(() => {
        if (!open) return undefined;
        placePopover();
        const close = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        window.addEventListener('resize', placePopover);
        document.addEventListener('mousedown', close);
        return () => {
            window.removeEventListener('resize', placePopover);
            document.removeEventListener('mousedown', close);
        };
    }, [open]);

    const emit = (nextDay, nextTime) => {
        if (!nextDay) {
            onChange('');
            return;
        }
        onChange(dateOnly ? nextDay : `${nextDay}T${nextTime || '00:00'}`);
    };

    const pickDay = (date) => {
        if (!date) return;
        emit(format(date, 'yyyy-MM-dd'), time);
        setOpen(false);
    };

    return (
        <div className="dt-field" ref={rootRef}>
            <button type="button" className="dt-date" ref={buttonRef} onClick={() => setOpen(current => !current)}>
                {selected ? format(selected, 'd MMMM yyyy', { locale: tr }) : placeholder}
            </button>
            {open && place && (
                <div className="dt-pop" style={place}>
                    <DayPicker mode="single" selected={selected} onSelect={pickDay} locale={tr} weekStartsOn={1} />
                </div>
            )}
            {!dateOnly && (
                <input
                    type="time"
                    className="dt-time"
                    value={time}
                    onChange={(event) => emit(day, event.target.value)}
                />
            )}
        </div>
    );
};

export default DateTimeField;
