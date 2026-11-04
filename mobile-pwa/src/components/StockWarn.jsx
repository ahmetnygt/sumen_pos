import './StockWarn.css';

export function shortagesFor(availability, product, selectedOptions = []) {
    const seen = new Set();
    const rows = [];
    const push = (list) => {
        for (const row of list || []) {
            const key = `${row.name}|${row.unit}`;
            if (seen.has(key)) continue;
            seen.add(key);
            rows.push(row);
        }
    };
    if (product?.id != null) push(availability?.products?.[product.id]);
    for (const opt of selectedOptions) push(availability?.options?.[opt.id]);
    return rows;
}

export function stockShortages(error) {
    const data = error.response?.data;
    if (error.response?.status === 409 && data?.code === 'STOCK_SHORT') return data.shortages || [];
    return null;
}

export default function StockWarn({ warn, onCancel, onConfirm }) {
    if (!warn) return null;
    const adding = !warn.sale;
    return (
        <div className="stock-warn-modal" onClick={onCancel}>
            <div className="stock-warn-card" onClick={(event) => event.stopPropagation()}>
                <h3>Stok yetersiz</h3>
                <p>{adding ? `${warn.product.name} için stok yetmiyor.` : 'Sepetteki ürünler için stok yetmiyor.'}</p>
                <ul>
                    {warn.rows.map((row) => (
                        <li key={`${row.name}-${row.unit}`}>
                            {row.name}
                            <span>Gereken {row.need} {row.unit}, elde {row.have}</span>
                        </li>
                    ))}
                </ul>
                <div className="stock-warn-actions">
                    <button type="button" className="stock-warn-cancel" onClick={onCancel}>Vazgeç</button>
                    <button type="button" className="stock-warn-ok" onClick={onConfirm}>
                        {adding ? 'Yine de ekle' : 'Yine de sat'}
                    </button>
                </div>
            </div>
        </div>
    );
}
