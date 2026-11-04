import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import FloorPlan from '../components/FloorPlan';
import { placeTables, clampDecor, DECOR_DEFAULTS } from '../utils/tableLayout';
import './Branches.css';

const Branches = () => {
    const navigate = useNavigate();
    const [branches, setBranches] = useState([]);
    const [tables, setTables] = useState([]);
    const [decorations, setDecorations] = useState([]);
    const [salons, setSalons] = useState([]);
    const [selectedSalon, setSelectedSalon] = useState({});
    const [selectedBranchId, setSelectedBranchId] = useState(null);
    const [editorView, setEditorView] = useState('tables');
    const [form, setForm] = useState({ name: '', code: '' });
    const [branchOpen, setBranchOpen] = useState(false);
    const [tableNames, setTableNames] = useState({});
    const [drafts, setDrafts] = useState({});
    const [error, setError] = useState('');
    const [areaPrompt, setAreaPrompt] = useState(null);
    const [salonPrompt, setSalonPrompt] = useState(null);
    const [movePrompt, setMovePrompt] = useState(null);
    const [renamePrompt, setRenamePrompt] = useState(null);
    const [notice, setNotice] = useState('');

    const load = async () => {
        const [branchRes, tableRes, decorRes, salonRes] = await Promise.all([
            api.get('/branches'),
            api.get('/tables/company'),
            api.get('/tables/decorations/company'),
            api.get('/tables/salons/company')
        ]);
        setBranches(branchRes.data);
        setTables(tableRes.data || []);
        setDecorations(decorRes.data || []);
        setSalons(salonRes.data || []);
    };

    useEffect(() => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.role !== 'Admin') {
            navigate('/dashboard');
            return;
        }
        load().catch(() => setError('Şubeler alınamadı.'));
    }, [navigate]);

    useEffect(() => {
        setDrafts(prev => {
            const next = {};
            for (const branch of branches) {
                if (prev[branch.id]?.dirty) {
                    next[branch.id] = prev[branch.id];
                    continue;
                }
                const branchTables = tables.filter(table => table.branch_id === branch.id);
                const branchDecor = decorations.filter(item => item.branch_id === branch.id);
                next[branch.id] = { dirty: false, items: placeTables(branchTables), decorations: branchDecor };
            }
            return next;
        });
    }, [branches, tables, decorations]);

    const saveBranch = async () => {
        const name = form.name.trim();
        const code = form.code.trim();
        if (!name || !code) {
            setError('Şube adı ve kod zorunludur.');
            return;
        }
        setError('');
        try {
            const created = await api.post('/branches', { name, code });
            setForm({ name: '', code: '' });
            setBranchOpen(false);
            if (created.data?.id) setSelectedBranchId(created.data.id);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Şube eklenemedi.');
        }
    };

    const remove = async (id) => {
        if (!window.confirm('Bu şube kapatılsın mı?')) return;
        try {
            await api.delete(`/branches/${id}`);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Şube silinemedi.');
        }
    };

    const salonOf = (branchId) => {
        const list = salons.filter(salon => salon.branch_id === branchId);
        return list.find(salon => salon.id === selectedSalon[branchId]) || list[0] || null;
    };

    const addTable = async (branchId) => {
        const name = (tableNames[branchId] || '').trim();
        const salon = salonOf(branchId);
        if (!name || !salon) return;
        setError('');
        try {
            await api.post('/tables', { name, branch_id: branchId, salon_id: salon.id });
            setTableNames(prev => ({ ...prev, [branchId]: '' }));
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Masa eklenemedi.');
        }
    };

    const saveTableName = async () => {
        const name = (renamePrompt?.text || '').trim();
        if (!name) {
            setError('Masa adı zorunludur.');
            return;
        }
        setError('');
        try {
            await api.put(`/tables/${renamePrompt.id}`, { name });
            setRenamePrompt(null);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Masa adlandırılamadı.');
        }
    };

    const updatePlan = (branchId, id, nextItem) => {
        setDrafts(prev => ({
            ...prev,
            [branchId]: {
                dirty: true,
                items: (prev[branchId]?.items || []).map(item => (item.id === id ? nextItem : item)),
                decorations: prev[branchId]?.decorations || []
            }
        }));
    };

    const updateDecor = (branchId, id, nextItem) => {
        setDrafts(prev => ({
            ...prev,
            [branchId]: {
                dirty: true,
                items: prev[branchId]?.items || [],
                decorations: (prev[branchId]?.decorations || []).map(item => (item.id === id ? nextItem : item))
            }
        }));
    };

    const removeDecor = (branchId, id) => {
        setDrafts(prev => ({
            ...prev,
            [branchId]: {
                dirty: true,
                items: prev[branchId]?.items || [],
                decorations: (prev[branchId]?.decorations || []).filter(item => item.id !== id)
            }
        }));
    };

    const addArea = (branchId, text) => {
        const salon = salonOf(branchId);
        if (!salon) return;
        const defaults = DECOR_DEFAULTS.label;
        const count = (drafts[branchId]?.decorations || []).filter(item => item.salon_id === salon.id).length;
        const item = clampDecor({
            id: `tmp-${Date.now()}`,
            branch_id: branchId,
            salon_id: salon.id,
            kind: 'label',
            label: String(text || '').trim().slice(0, 24),
            canvas_x: 40,
            canvas_y: 40 + count * 36,
            canvas_w: defaults.canvas_w,
            canvas_h: defaults.canvas_h
        });
        setDrafts(prev => ({
            ...prev,
            [branchId]: {
                dirty: true,
                items: prev[branchId]?.items || [],
                decorations: [...(prev[branchId]?.decorations || []), item]
            }
        }));
        setAreaPrompt(null);
    };

    const savePlan = async (branchId) => {
        const salon = salonOf(branchId);
        if (!salon) return;
        const items = (drafts[branchId]?.items || []).filter(item => item.salon_id === salon.id);
        const decorItems = (drafts[branchId]?.decorations || []).filter(item => item.salon_id === salon.id);
        if (!items.length && !decorItems.length) return;
        setError('');
        try {
            await api.put('/tables/layout', {
                branch_id: branchId,
                salon_id: salon.id,
                items: items.map(item => ({
                    id: item.id,
                    canvas_x: item.canvas_x,
                    canvas_y: item.canvas_y,
                    canvas_w: item.canvas_w,
                    canvas_h: item.canvas_h
                })),
                decorations: decorItems.map(item => ({
                    id: Number.isInteger(item.id) ? item.id : undefined,
                    kind: item.kind,
                    label: item.label,
                    canvas_x: item.canvas_x,
                    canvas_y: item.canvas_y,
                    canvas_w: item.canvas_w,
                    canvas_h: item.canvas_h
                }))
            });
            setDrafts(prev => ({
                ...prev,
                [branchId]: { ...prev[branchId], dirty: false }
            }));
            await load();
            setNotice('Plan kaydedildi');
        } catch (err) {
            setError(err.response?.data?.message || 'Masa planı kaydedilemedi.');
        }
    };

    const saveSalon = async () => {
        const name = String(salonPrompt?.text || '').trim();
        if (!name) {
            setError('Salon adı zorunludur.');
            return;
        }
        setError('');
        try {
            if (salonPrompt.id) {
                await api.put(`/tables/salons/${salonPrompt.id}`, { name });
            } else {
                const created = await api.post('/tables/salons', { branch_id: salonPrompt.branchId, name });
                setSelectedSalon(prev => ({ ...prev, [salonPrompt.branchId]: created.data.id }));
            }
            setSalonPrompt(null);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Salon kaydedilemedi.');
        }
    };

    const removeSalon = async (salon) => {
        if (!window.confirm('Bu salon silinsin mi?')) return;
        setError('');
        try {
            await api.delete(`/tables/salons/${salon.id}`);
            setSelectedSalon(prev => ({ ...prev, [salon.branch_id]: null }));
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Salon silinemedi.');
        }
    };

    const moveTable = async (salonId) => {
        if (!movePrompt) return;
        setError('');
        try {
            await api.put(`/tables/${movePrompt.id}`, { salon_id: salonId });
            setMovePrompt(null);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Masa taşınamadı.');
        }
    };

    const removeTable = async (id) => {
        if (!window.confirm('Bu masa silinsin mi?')) return;
        try {
            await api.delete(`/tables/${id}`);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Masa silinemedi.');
        }
    };

    return (
        <div className="branches-layout">
            <header className="branches-header">
                <button onClick={() => navigate('/admin')} className="branches-back">Geri</button>
                <h2>ŞUBELER</h2>
            </header>
            <main className={`branches-content ${editorView === 'plan' ? 'branches-content-plan' : ''}`}>
                <div className="branch-bar">
                    <div className="salon-tabs">
                        {branches.map(item => (
                            <button
                                type="button"
                                key={item.id}
                                className={item.id === (branches.find(entry => entry.id === selectedBranchId) || branches[0])?.id ? 'active' : ''}
                                onClick={() => setSelectedBranchId(item.id)}
                            >{item.name}</button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="table-tool"
                        onClick={() => { setForm({ name: '', code: '' }); setError(''); setBranchOpen(true); }}
                    >Yeni şube</button>
                </div>
                {error && <p className="branches-error">{error}</p>}
                {branches.length === 0 && <p className="branches-empty">Şube yok.</p>}
                {(() => {
                    const branch = branches.find(item => item.id === selectedBranchId) || branches[0];
                    if (!branch) return null;
                    const salon = salonOf(branch.id);
                    const branchSalons = salons.filter(item => item.branch_id === branch.id);
                    const branchTables = (drafts[branch.id]?.items || tables.filter(table => table.branch_id === branch.id))
                        .filter(table => table.salon_id === salon?.id);
                    const branchDecor = (drafts[branch.id]?.decorations || []).filter(item => item.salon_id === salon?.id);
                    return (
                        <section className="workspace">
                            <div className="table-panel-head">
                                <h3 className="workspace-title">
                                    <span>{branch.name}{salon ? ` · ${salon.name}` : ''}</span>
                                    {!branch.is_active && <span className="branches-status passive">Pasif</span>}
                                </h3>
                                {branch.is_active && (
                                    <button type="button" className="table-tool danger" onClick={() => remove(branch.id)}>Şubeyi kapat</button>
                                )}
                            </div>
                            <div className="salon-bar">
                                <div className="salon-tabs">
                                    {branchSalons.map(item => (
                                        <button
                                            type="button"
                                            key={item.id}
                                            className={item.id === salon?.id ? 'active' : ''}
                                            onClick={() => setSelectedSalon(prev => ({ ...prev, [branch.id]: item.id }))}
                                        >{item.name}</button>
                                    ))}
                                </div>
                                <div className="table-tools">
                                    <button type="button" className="table-tool" onClick={() => setSalonPrompt({ branchId: branch.id, id: null, text: '' })}>Salon ekle</button>
                                    {salon && (
                                        <>
                                            <button type="button" className="table-tool" onClick={() => setSalonPrompt({ branchId: branch.id, id: salon.id, text: salon.name })}>Salon adı</button>
                                            <button type="button" className="table-tool danger" onClick={() => removeSalon(salon)}>Salonu sil</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="editor-switch">
                                <button type="button" className={editorView === 'tables' ? 'active' : ''} onClick={() => setEditorView('tables')}>Masalar</button>
                                <button type="button" className={editorView === 'plan' ? 'active' : ''} onClick={() => setEditorView('plan')}>Plan</button>
                            </div>
                            {editorView === 'tables' ? (
                                <div className="workspace-scroll">
                                    <form className="table-add" onSubmit={(e) => { e.preventDefault(); addTable(branch.id); }}>
                                        <input
                                            placeholder="Masa adı"
                                            value={tableNames[branch.id] || ''}
                                            onChange={e => setTableNames(prev => ({ ...prev, [branch.id]: e.target.value }))}
                                        />
                                        <button type="submit" className="branches-submit">Masa ekle</button>
                                    </form>
                                    {branchTables.length === 0 && <p className="branches-empty">Bu salonda masa yok.</p>}
                                    <div className="table-list">
                                        {branchTables.map(table => (
                                            <div className="table-list-row" key={table.id}>
                                                <span className="table-list-name">{table.name}</span>
                                                <div className="table-tools">
                                                    <button type="button" className="table-tool" onClick={() => setRenamePrompt({ id: table.id, text: table.name })}>Masa adı</button>
                                                    <button type="button" className="table-tool" onClick={() => setMovePrompt(table)}>Başka salona taşı</button>
                                                    <button type="button" className="table-tool danger" onClick={() => removeTable(table.id)}>Masayı sil</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="branches-plan">
                                    <div className="branches-decor-actions">
                                        <button type="button" className="table-tool" onClick={() => setAreaPrompt({ branchId: branch.id, text: '' })}>Alan ekle</button>
                                        <div className="plan-save">
                                            {drafts[branch.id]?.dirty && <span className="plan-dirty">Kaydedilmedi</span>}
                                            <button type="button" className="branches-submit" onClick={() => savePlan(branch.id)}>Planı kaydet</button>
                                        </div>
                                    </div>
                                    <FloorPlan
                                        tables={branchTables}
                                        decorations={branchDecor}
                                        editable
                                        onChange={(id, next) => updatePlan(branch.id, id, next)}
                                        onDecorChange={(id, next) => updateDecor(branch.id, id, next)}
                                        onDecorRemove={(id) => removeDecor(branch.id, id)}
                                    />
                                </div>
                            )}
                        </section>
                    );
                })()}
            </main>
            {(areaPrompt || salonPrompt || movePrompt || renamePrompt || branchOpen || notice) && (
                <div className="branches-modal">
                    <div className={`branches-modal-card${notice ? ' branches-notice' : ''}`}>
                        {notice ? (
                            <>
                                <h3>{notice}</h3>
                                <div className="branches-modal-actions">
                                    <button type="button" className="branches-submit" onClick={() => setNotice('')}>Tamam</button>
                                </div>
                            </>
                        ) : movePrompt ? (
                            <>
                                <h3>Masayı taşı</h3>
                                <div className="branches-modal-actions">
                                    {salons.filter(item => item.branch_id === movePrompt.branch_id && item.id !== movePrompt.salon_id).map(item => (
                                        <button type="button" key={item.id} className="branches-ghost" onClick={() => moveTable(item.id)}>{item.name}</button>
                                    ))}
                                    <button type="button" className="branches-ghost" onClick={() => setMovePrompt(null)}>Vazgeç</button>
                                </div>
                            </>
                        ) : renamePrompt ? (
                            <>
                                <h3>Masa adı</h3>
                                <input
                                    className="name"
                                    placeholder="Masa adı"
                                    value={renamePrompt.text}
                                    onChange={e => setRenamePrompt({ ...renamePrompt, text: e.target.value })}
                                />
                                <div className="branches-modal-actions">
                                    <button type="button" className="branches-ghost" onClick={() => setRenamePrompt(null)}>Vazgeç</button>
                                    <button type="button" className="branches-submit" onClick={saveTableName}>Kaydet</button>
                                </div>
                            </>
                        ) : salonPrompt ? (
                            <>
                                <h3>{salonPrompt.id ? 'Salon adı' : 'Salon ekle'}</h3>
                                <input
                                    className="name"
                                    placeholder="Salon adı"
                                    maxLength={40}
                                    value={salonPrompt.text}
                                    onChange={e => setSalonPrompt({ ...salonPrompt, text: e.target.value })}
                                />
                                <div className="branches-modal-actions">
                                    <button type="button" className="branches-ghost" onClick={() => setSalonPrompt(null)}>Vazgeç</button>
                                    <button type="button" className="branches-submit" onClick={saveSalon}>Kaydet</button>
                                </div>
                            </>
                        ) : branchOpen ? (
                            <>
                                <h3>Yeni şube</h3>
                                <input
                                    className="name"
                                    placeholder="Şube adı"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                                <input
                                    className="code"
                                    placeholder="Kod"
                                    maxLength={4}
                                    value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value })}
                                />
                                <div className="branches-modal-actions">
                                    <button type="button" className="branches-ghost" onClick={() => setBranchOpen(false)}>Vazgeç</button>
                                    <button type="button" className="branches-submit" onClick={saveBranch}>Kaydet</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3>Alan ekle</h3>
                                <input
                                    className="name"
                                    placeholder="Yazı (isteğe bağlı)"
                                    maxLength={24}
                                    value={areaPrompt.text}
                                    onChange={e => setAreaPrompt({ ...areaPrompt, text: e.target.value })}
                                />
                                <div className="branches-modal-actions">
                                    <button type="button" className="branches-ghost" onClick={() => setAreaPrompt(null)}>Vazgeç</button>
                                    <button type="button" className="branches-submit" onClick={() => addArea(areaPrompt.branchId, areaPrompt.text)}>Ekle</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Branches;
