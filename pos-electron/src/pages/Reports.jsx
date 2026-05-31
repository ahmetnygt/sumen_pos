import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Reports.css';

const Reports = () => {
    const [sales, setSales] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [summary, setSummary] = useState({ total: 0, nakit: 0, kart: 0 });

    const fetchReports = async () => {
        try {
            const params = {};
            if (startDate && endDate) {
                params.startDate = startDate;
                params.endDate = endDate;
            }
            const response = await api.get('/reports/sales', { params });
            const data = response.data;
            setSales(data);

            // Ciro ve Nakit/Kart hesaplaması
            let t = 0, n = 0, k = 0;
            data.forEach(item => {
                const lineTotal = parseFloat(item.price) * item.quantity;
                t += lineTotal;
                if (item.Order.payment_method === 'Nakit') n += lineTotal;
                else if (item.Order.payment_method === 'Kredi Kartı') k += lineTotal;
                else { n += lineTotal / 2; k += lineTotal / 2; } // Karışık ödemeler için basit bölüştürme
            });
            setSummary({ total: t, nakit: n, kart: k });

        } catch (error) {
            alert('Raporlar alınırken hata oluştu!');
        }
    };

    // Parse options helper
    const renderOptions = (optString) => {
        if (!optString) return '-';
        try {
            const opts = JSON.parse(optString);
            return opts.map(o => o.name).join(', ');
        } catch (e) { return '-'; }
    };

    return (
        <div className="reports-container">
            <h2 className="text-warning mb-4">Satış & Ciro Raporu</h2>

            {/* FİLTRE BÖLÜMÜ */}
            <div className="filter-bar d-flex gap-3 mb-4 p-3 bg-dark rounded">
                <div>
                    <label className="text-muted d-block mb-1"><small>Başlangıç Tarihi/Saati</small></label>
                    <input
                        type="datetime-local"
                        className="form-control bg-secondary text-white border-0"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-muted d-block mb-1"><small>Bitiş Tarihi/Saati</small></label>
                    <input
                        type="datetime-local"
                        className="form-control bg-secondary text-white border-0"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="d-flex align-items-end">
                    <button className="btn btn-warning px-4" onClick={fetchReports}>
                        Filtrele
                    </button>
                </div>
            </div>

            {/* ÖZET KARTLARI */}
            <div className="summary-cards d-flex gap-4 mb-4">
                <div className="card bg-dark text-white flex-fill p-3 border-warning">
                    <h5 className="text-muted">Toplam Ciro</h5>
                    <h2 className="text-warning m-0">{summary.total.toFixed(2)} ₺</h2>
                </div>
                <div className="card bg-dark text-white flex-fill p-3 border-success">
                    <h5 className="text-muted">Nakit Toplamı</h5>
                    <h2 className="text-success m-0">{summary.nakit.toFixed(2)} ₺</h2>
                </div>
                <div className="card bg-dark text-white flex-fill p-3 border-info">
                    <h5 className="text-muted">Kredi Kartı Toplamı</h5>
                    <h2 className="text-info m-0">{summary.kart.toFixed(2)} ₺</h2>
                </div>
            </div>

            {/* DETAYLI SATIŞ TABLOSU */}
            <div className="table-responsive">
                <table className="table table-dark table-hover align-middle">
                    <thead>
                        <tr>
                            <th>Tarih & Saat</th>
                            <th>Ürün Adı</th>
                            <th>Ekstralar (Opsiyon)</th>
                            <th>Adet</th>
                            <th>Tutar</th>
                            <th>Ödeme Yöntemi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.map(sale => (
                            <tr key={sale.id}>
                                <td>{new Date(sale.Order.updatedAt || sale.Order.updated_at).toLocaleString('tr-TR')}</td>
                                <td>{sale.Product ? sale.Product.name : 'Silinmiş Ürün'}</td>
                                <td><small className="text-muted">{renderOptions(sale.selected_options)}</small></td>
                                <td>{sale.quantity}</td>
                                <td><strong className="text-white">{(parseFloat(sale.price) * sale.quantity).toFixed(2)} ₺</strong></td>
                                <td>
                                    <span className={`badge ${sale.Order.payment_method === 'Nakit' ? 'bg-success' : 'bg-info'}`}>
                                        {sale.Order.payment_method}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {sales.length === 0 && (
                            <tr><td colSpan="6" className="text-center py-4 text-muted">Bu tarih aralığında satış bulunamadı.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Reports;