import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import DateTimeField from '../components/DateTimeField';
import './Reports.css';

const emptySummary = { total: 0, nakit: 0, kart: 0, unsplit: 0, indirim: 0 };

const Reports = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [summary, setSummary] = useState(emptySummary);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);
    const limit = 50;

    useEffect(() => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (!user || (user.role !== 'Admin' && user.role !== 'Kasa')) {
            navigate('/dashboard');
            return;
        }
        fetchReports();
    }, []);

    const fetchReports = async (range = { startDate, endDate }, nextPage = 1) => {
        setError('');
        setOpenId(null);
        try {
            const params = { page: nextPage, limit };
            if (range.startDate && range.endDate) {
                params.startDate = range.startDate;
                params.endDate = range.endDate;
            }
            const response = await api.get('/reports/sales', { params });
            setRecords(response.data.records || []);
            setSummary(response.data.summary || emptySummary);
            setPage(response.data.page || nextPage);
            setTotal(response.data.total || 0);
        } catch (err) {
            setError(err.response?.data?.message || 'Raporlar alınırken hata oluştu.');
        }
    };

    const renderOptions = (options) => {
        if (!options) return '-';
        let opts = options;
        if (typeof opts === 'string') {
            try { opts = JSON.parse(opts); } catch (e) { return '-'; }
        }
        if (!Array.isArray(opts) || opts.length === 0) return '-';
        return opts.map(option => option.name).join(', ');
    };

    const goBack = () => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        navigate(user?.role === 'Admin' ? '/admin' : '/dashboard');
    };

    const money = (value) => `${Number(value || 0).toFixed(2)} ₺`;
    const when = (value) => new Date(value).toLocaleString('tr-TR');

    return (
        <div className="reports-layout">
            <header className="reports-header">
                <div className="reports-header-left">
                    <button onClick={goBack} className="reports-back">Geri</button>
                    <h2>SATIŞ & CİRO</h2>
                </div>
            </header>

            <main className="reports-content">
                <div className="reports-filter">
                    <label>
                        <span>Başlangıç</span>
                        <DateTimeField value={startDate} onChange={setStartDate} />
                    </label>
                    <label>
                        <span>Bitiş</span>
                        <DateTimeField value={endDate} onChange={setEndDate} />
                    </label>
                    <button className="reports-filter-btn" onClick={() => fetchReports({ startDate, endDate }, 1)}>Filtrele</button>
                </div>

                {error && <p className="reports-error">{error}</p>}

                <div className="reports-summary">
                    <div className="reports-card reports-card-total">
                        <span>Toplam Ciro</span>
                        <strong>{money(summary.total)}</strong>
                    </div>
                    <div className="reports-card reports-card-cash">
                        <span>Nakit</span>
                        <strong>{money(summary.nakit)}</strong>
                    </div>
                    <div className="reports-card reports-card-card">
                        <span>Kredi Kartı</span>
                        <strong>{money(summary.kart)}</strong>
                    </div>
                    <div className="reports-card reports-card-discount">
                        <span>İndirim</span>
                        <strong>{money(summary.indirim)}</strong>
                    </div>
                    {Number(summary.unsplit) > 0 && (
                        <div className="reports-card reports-card-unsplit">
                            <span>Ayrıştırılamayan</span>
                            <strong>{money(summary.unsplit)}</strong>
                        </div>
                    )}
                </div>

                <div className="reports-table-wrap">
                    <table className="reports-table">
                        <thead>
                            <tr>
                                <th>Tarih & Saat</th>
                                <th>Kayıt açıklaması</th>
                                <th>Tutar</th>
                                <th>Ödeme</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map(record => (
                                <React.Fragment key={record.id}>
                                    <tr
                                        className={`reports-record ${openId === record.id ? 'open' : ''}`}
                                        onClick={() => setOpenId(openId === record.id ? null : record.id)}
                                    >
                                        <td>{when(record.at)}</td>
                                        <td>{record.description}</td>
                                        <td>{money(record.total_amount)}</td>
                                        <td className="reports-pay-cell">
                                            {Number(record.nakit) > 0 && <span className="reports-pay cash">Nakit {money(record.nakit)}</span>}
                                            {Number(record.kart) > 0 && <span className="reports-pay card">Kart {money(record.kart)}</span>}
                                            {Number(record.discount) > 0 && <span className="reports-pay discount">İndirim {money(record.discount)}</span>}
                                        </td>
                                    </tr>
                                    {openId === record.id && (
                                        <tr className="reports-detail-row">
                                            <td colSpan="4">
                                                <div className="reports-detail">
                                                    <div>
                                                        <h4>Tahsilatlar</h4>
                                                        {record.payments.length === 0 && <p className="reports-muted">Tahsilat kaydı yok.</p>}
                                                        {record.payments.map(payment => (
                                                            <div className="reports-detail-line" key={payment.id}>
                                                                <span>{when(payment.at)}</span>
                                                                <span className={`reports-pay ${payment.method === 'Nakit' ? 'cash' : 'card'}`}>{payment.method}</span>
                                                                <strong>{money(payment.amount)}</strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div>
                                                        <h4>Ürünler</h4>
                                                        {record.items.length === 0 && <p className="reports-muted">Ürün yok.</p>}
                                                        {record.items.map(item => (
                                                            <div className="reports-detail-line" key={item.id}>
                                                                <span>{item.name}</span>
                                                                <span className="reports-muted">{renderOptions(item.options)}</span>
                                                                <span>{item.quantity} adet</span>
                                                                <span>{item.status}</span>
                                                                <strong>{money(item.line_total)}</strong>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {records.length === 0 && (
                                <tr><td colSpan="4" className="reports-empty">Bu aralıkta kayıt bulunamadı.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="reports-pager">
                    <button type="button" disabled={page <= 1} onClick={() => fetchReports({ startDate, endDate }, page - 1)}>Önceki</button>
                    <span>{page} / {Math.max(1, Math.ceil(total / limit))}</span>
                    <button type="button" disabled={page >= Math.max(1, Math.ceil(total / limit))} onClick={() => fetchReports({ startDate, endDate }, page + 1)}>Sonraki</button>
                </div>
            </main>
        </div>
    );
};

export default Reports;
