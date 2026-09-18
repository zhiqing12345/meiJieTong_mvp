import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IconContext, ArrowUpRight, ArrowRight, ArrowLeft, ArrowUp, Plus, X, Check, CheckCircle, Circle, CaretDown, CaretRight, CalendarBlank, MapPin, MagnifyingGlass, SlidersHorizontal, SquaresFour, ListBullets, DotsThree, GearSix, Question, SignOut, Trash, PencilSimple, FileText, Files, ImageSquare, Paperclip, Sparkle, WarningCircle, ArrowClockwise, CloudCheck, Train, AirplaneTilt, User, UsersThree, Table, Link, Copy, DownloadSimple, ShieldCheck, ChatCircleDots, CheckSquare, EnvelopeSimple, CursorClick, Tray, SpinnerGap, Robot } from '@phosphor-icons/react';
import { EMPTY_FIELDS, FIELD_LABELS, SAMPLE_TEXT, SAMPLE_FILES, seedData, STATUS, uid, missingFields, maskPhone, dateShort } from './data';
import { getFeishuConfig, recognizeMedia, saveFeishuConfig, validateFeishu, writeFeishu } from './api';
import './styles.css';

const STORAGE_KEY = 'meijietong-prototype-v1';
function migrateFields(fields = {}) {
  return {
    ...EMPTY_FIELDS,
    ...fields,
    outboundRoute: fields.outboundRoute || [fields.outboundFrom, fields.outboundTo].filter(Boolean).join('-'),
    returnRoute: fields.returnRoute || [fields.returnFrom, fields.returnTo].filter(Boolean).join('-'),
  };
}
function initialData() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(value) && value.every(a => a.id && a.name && Array.isArray(a.people))) return value.map(a => ({ ...a, config: a.config?.url?.includes('/base/') || a.config?.url?.includes('example.feishu.cn') ? { ...a.config, connected: false, url: '' } : a.config, people: a.people.map(p => ({ ...p, fields: migrateFields(p.fields), status: ['recognizing', 'writing'].includes(p.status) ? (p.status === 'writing' ? 'confirmed' : 'ready') : p.status })) }));
  } catch { /* A blocked or empty storage does not prevent using the prototype. */ }
  return seedData();
}
function Badge({ status }) { const s = STATUS[status] || STATUS.draft; return <span className={`badge ${s.tone}`}>{['recognizing', 'writing'].includes(status) ? <SpinnerGap className="spin" size={12} /> : ['written', 'confirmed'].includes(status) ? <CheckCircle size={12} weight="fill" /> : <span className="status-dot" />}{s.label}</span>; }
function FeishuMark() { return <span className="feishu-mark"><ArrowUpRight weight="bold" size={19} /></span>; }
function Avatar({ person, large = false }) { return <span className={`avatar ${person.color || 'blue'} ${large ? 'large' : ''}`}>{person.fields.name?.slice(-2) || <User size={20} />}</span>; }
function Button({ children, className = '', variant = '', ...props }) { return <button className={`button ${variant} ${className}`} {...props}>{children}</button>; }
function Empty({ title, detail, children }) { return <div className="empty-state"><div className="empty-icon"><Tray size={32} /></div><h3>{title}</h3><p>{detail}</p>{children}</div>; }

function Overlay({ children, onClose, title, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    (el.querySelector('[autofocus]') || el.querySelector('input:not([type="file"]), textarea, select') || el.querySelector('button') || el).focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  function keyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key === 'Tab') {
      const focusables = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(n => n.getClientRects().length);
      const first = focusables[0], last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  return <div className={`overlay ${className.includes('drawer') ? 'drawer-overlay' : ''} ${className === 'feishu-drawer' ? 'feishu-drawer-overlay' : ''}`} onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={keyDown} className={`dialog ${className}`}>{children}</section></div>;
}
function ModalHeader({ title, subtitle, icon, onClose }) { return <div className="modal-header"><div className="modal-title-line">{icon && <span className="modal-icon">{icon}</span>}<div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20} /></button></div>; }

function MediaCard({ person, onOpen, onCancel }) {
  const f = person.fields;
  const failed = person.status === 'failed';
  const processing = ['recognizing', 'writing'].includes(person.status);
  const actionLabel = person.status === 'written' ? '已写入' : person.status === 'confirmed' ? '确认写入' : person.status === 'failed' ? '重新上传' : person.status === 'needs' ? '补充资料' : person.status === 'draft' ? '开始对话' : person.status === 'writing' ? '写入中' : person.status === 'recognizing' ? '识别中' : '核对信息';
  return <article className={`media-card ${person.status}`}>
    <div className="card-heading"><Avatar person={person} /><div className="card-person"><h3>{f.name || '新媒体老师'}<span>{f.role}</span></h3><p>{f.hotelDate ? `住宿 ${f.hotelDate}` : '等待录入住宿日期'}</p></div><div className="card-heading-actions"><Badge status={person.status} /><button className="card-cancel" aria-label={`取消并移除${f.name || '这条'}资料`} title="取消这条资料" onClick={onCancel}><X size={15} /></button></div></div>
    {failed ? <div className="card-failed"><WarningCircle size={25} /><div><strong>有些信息，还没看清</strong><p>图片较模糊，请重新上传或手动填写</p></div></div> : processing ? <div className="card-processing"><Sparkle size={26} className="pulse" /><strong>正在整理媒体资料</strong><p>人员、行程和住宿信息逐一归位</p><div className="progress-track"><span /></div></div> : <>
      <div className="contact-row"><span><User size={13} />{maskPhone(f.phone)}</span><span><Files size={13} />{person.messages?.reduce((n, m) => n + (m.files?.length || 0), 0) || 0} 份资料</span></div>
      <div className="journey-summary"><JourneyRow fields={f} direction="outbound" /><JourneyRow fields={f} direction="return" /></div>
    </>}
    <div className="card-bottom"><span className={person.status === 'needs' ? 'warning-text' : ''}>{person.status === 'written' ? <><CloudCheck size={14} /> 已回填飞书</> : person.status === 'confirmed' ? <><CheckCircle size={14} /> 业务老师已确认</> : person.status === 'needs' ? <><WarningCircle size={14} /> {missingFields(f).length || 1} 项信息待补充</> : failed ? '原始资料已保留' : f.outboundDate ? <>去程 <b>{f.outboundDate}</b></> : '等待上传资料'}</span><button className={`card-action ${processing || person.status === 'written' ? 'muted' : ''}`} disabled={processing || person.status === 'written'} onClick={onOpen}>{actionLabel}{!processing && person.status !== 'written' && <ArrowRight size={14} />}</button></div>
  </article>;
}
function JourneyRow({ fields: f, direction }) {
  const outbound = direction === 'outbound';
  const JourneyIcon = f[`${direction}Transport`] === '飞机' ? AirplaneTilt : Train;
  const route = f[`${direction}Route`];
  return <div className={`journey-row ${!route ? 'missing' : ''}`}><span className={`direction-dot ${outbound ? '' : 'return'}`}>{outbound ? '去' : '返'}</span><div className="journey-route">{route ? <><div><strong>{route.replace(/[-—→]/, ' → ')}</strong></div><p>{dateShort(f[`${direction}Date`])}<span>{f[`${direction}Time`]}</span><i />{f[`${direction}Train`] || '车次待补充'}</p></> : <><strong>行程信息待补充</strong><p>可继续粘贴截图或手动填写</p></>}</div><JourneyIcon size={17} className="journey-icon" /></div>;
}

function InlineComposer({ target, onCancel, onSubmit, onPreview, notify }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);
  async function addFiles(incoming) {
    const list = [...incoming];
    const valid = list.filter(file => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type) && file.size <= 8 * 1024 * 1024);
    if (valid.length !== list.length) notify('支持常用图片格式，每张不超过 8MB', 'warning');
    setLoading(true);
    try {
      const converted = await Promise.all(valid.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: uid(), name: file.name, type: file.type, url: reader.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })));
      setFiles(previous => [...previous, ...converted].slice(0, 10));
    } catch { notify('图片读取失败，请重试', 'warning'); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function submit() {
    if (loading || (!text.trim() && !files.length)) return;
    onSubmit(text.trim(), files);
  }
  return <section className={`composer-card ${target ? 'target-composer' : ''}`} aria-label={target ? `补充${target.fields.name}的资料` : '新增媒体资料'}>
    <button className="inline-close" aria-label="关闭资料输入框" onClick={onCancel}><X size={17} /></button>
    {target ? <div className="draft-composer-heading"><Avatar person={target} /><div><h3>{target.fields.name}</h3><p>{target.fields.role || '等待上传媒体资料'}</p></div><Badge status="draft" /></div> : <div className="composer-title"><span className="composer-title-icon"><Plus size={17} /></span><div><h3>录入媒体资料</h3><p>粘贴截图或文字，自动识别整理</p></div></div>}
    <div className="inline-previews">{files.map((file, index) => <div className="inline-preview" key={file.id || index}><button onClick={() => onPreview(file)}><img src={file.url} alt={file.name} /></button><span>{file.name}</span><button aria-label={`移除${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={11} /></button></div>)}</div>
    <textarea ref={textareaRef} aria-label="媒体资料输入" placeholder={target ? `粘贴截图，或输入${target.fields.name}的资料…` : '粘贴截图，或输入媒体老师的资料…'} value={text} onChange={event => setText(event.target.value)} onPaste={event => { const pasted = [...event.clipboardData.items].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean); if (pasted.length) { event.preventDefault(); addFiles(pasted); } }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
    <div className="inline-actions"><div><input ref={fileRef} type="file" aria-label="上传图片" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple hidden onChange={event => addFiles(event.target.files)} /><button className="inline-upload" onClick={() => fileRef.current?.click()} disabled={loading}><ImageSquare size={22} /><span>添加图片</span></button><button className="inline-example" onClick={() => { setText(SAMPLE_TEXT); setFiles(SAMPLE_FILES); textareaRef.current?.focus(); }}>使用示例</button></div><button className="inline-send" aria-label="发送资料并识别" disabled={loading || (!text.trim() && !files.length)} onClick={submit}>{loading ? <SpinnerGap className="spin" size={21} /> : <ArrowUp size={23} weight="bold" />}</button></div>
  </section>;
}

function parseMediaList(value) {
  const source = value.trim();
  if (!source) return [];
  const rawRows = source.includes('\n') ? source.split(/\r?\n/) : source.split(/[，、,;；]+/);
  const seen = new Set();
  return rawRows.map(row => {
    const cells = row.split(/\t+/).map(cell => cell.trim()).filter(Boolean);
    const name = (cells[0] || '').replace(/^\s*(?:[-•·*]|\d+[.、）)])\s*/, '').trim();
    return { name, role: cells[1] || '' };
  }).filter(item => {
    const key = item.name.toLocaleLowerCase('zh-CN');
    if (!item.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);
}

function BulkMediaComposer({ existingPeople, onClose, onCreate }) {
  const [value, setValue] = useState('');
  const parsed = parseMediaList(value);
  const existing = new Set(existingPeople.map(person => person.fields.name.trim().toLocaleLowerCase('zh-CN')).filter(Boolean));
  const newItems = parsed.filter(item => !existing.has(item.name.toLocaleLowerCase('zh-CN')));
  const duplicateCount = parsed.length - newItems.length;
  function submit(event) { event.preventDefault(); if (newItems.length) onCreate(newItems); }
  return <form className="composer-card bulk-composer-card" aria-label="批量添加媒体" onSubmit={submit}>
    <button type="button" className="inline-close" aria-label="关闭批量添加" onClick={onClose}><X size={17} /></button>
    <div className="composer-title"><span className="composer-title-icon"><UsersThree size={18} /></span><div><h3>批量添加媒体</h3><p>粘贴名单，为每位媒体创建独立对话</p></div></div>
    <textarea autoFocus aria-label="媒体名单" placeholder={'每行一位媒体老师，例如：\n林知远\n李思远\n陈悦'} value={value} onChange={event => setValue(event.target.value)} />
    {parsed.length > 0 && <div className="bulk-composer-summary"><span>{newItems.length ? `识别到 ${newItems.length} 位新媒体` : '没有可新增的媒体'}</span>{duplicateCount > 0 && <small>{duplicateCount} 位已存在，自动跳过</small>}</div>}
    <div className="inline-actions bulk-composer-actions"><span>支持换行、顿号、逗号或 Excel 名单</span><button className="inline-send" type="submit" aria-label="创建媒体对话" disabled={!newItems.length}>{newItems.length > 0 ? <span>{newItems.length}</span> : <ArrowUp size={23} weight="bold" />}</button></div>
  </form>;
}

function App() {
  const [activities, setActivities] = useState(initialData);
  const [activeId, setActiveId] = useState(() => activities[0]?.id || '');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('default');
  const [personId, setPersonId] = useState(null);
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [composerFor, setComposerFor] = useState(null);
  const timers = useRef(new Set());
  const toastTimer = useRef(null);
  const active = activities.find(a => a.id === activeId);
  const person = active?.people.find(p => p.id === personId);
  const composerTarget = composerFor && !['new', 'bulk'].includes(composerFor) ? active?.people.find(p => p.id === composerFor) : null;
  const counts = { all: active?.people.length || 0, todo: active?.people.filter(p => ['ready', 'draft', 'recognizing'].includes(p.status)).length || 0, needs: active?.people.filter(p => ['needs', 'failed'].includes(p.status)).length || 0, confirmed: active?.people.filter(p => ['confirmed', 'written', 'writing'].includes(p.status)).length || 0 };
  const notify = useCallback((message, kind = 'success') => { clearTimeout(toastTimer.current); setToast({ message, kind }); toastTimer.current = setTimeout(() => setToast(null), 3800); }, []);
  useEffect(() => {
    try {
      const safeData = activities.map(a => ({ ...a, people: a.people.map(p => ({ ...p, messages: p.messages.map(m => ({ ...m, files: m.files?.map(f => ({ ...f, url: f.url?.startsWith('data:') && !f.demo ? '' : f.url })) })) })) }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
    } catch { notify('浏览器存储空间不足，本次修改仅保留在当前页面。', 'warning'); }
  }, [activities, notify]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(toastTimer.current); }, []);
  function later(fn, ms) { const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms); timers.current.add(t); }
  function updateActivity(id, updater) { setActivities(prev => prev.map(a => a.id === id ? updater(a) : a)); }
  function updatePerson(aid, pid, updater) { updateActivity(aid, a => ({ ...a, people: a.people.map(p => p.id === pid ? updater(p) : p) })); }
  function selectActivity(id) { setActiveId(id); setFilter('all'); setSearch(''); setPersonId(null); setComposerFor(null); setMenu(null); setMobileNav(false); }
  function newPerson() {
    if (!active) return;
    setFilter('all'); setSearch(''); setView('grid'); setComposerFor('new');
  }
  function createMediaConversations(items) {
    if (!active || !items.length) return;
    const colors = ['blue', 'teal', 'purple', 'orange'];
    const created = items.map((item, index) => ({
      id: uid(), fields: { ...EMPTY_FIELDS, name: item.name, role: item.role }, status: 'draft',
      color: colors[(active.people.length + index) % colors.length], messages: [], updatedAt: '刚刚',
    }));
    updateActivity(active.id, activity => ({ ...activity, people: [...created, ...activity.people] }));
    setFilter('all'); setSearch(''); setView('grid'); setComposerFor(null); setModal(null);
    notify(`已为 ${created.length} 位媒体创建独立对话`);
  }
  async function submitInline(text, files, targetOverride = null) {
    const aid = active.id;
    const target = targetOverride || composerTarget;
    const pid = target?.id || uid();
    const message = { id: uid(), role: 'user', text, files };
    if (target) updatePerson(aid, pid, p => ({ ...p, status: 'recognizing', messages: [...p.messages, message] }));
    else {
      const p = { id: pid, fields: { ...EMPTY_FIELDS }, status: 'recognizing', color: ['blue', 'teal', 'purple', 'orange'][active.people.length % 4], messages: [message], updatedAt: '刚刚' };
      updateActivity(aid, a => ({ ...a, people: [p, ...a.people] }));
    }
    setComposerFor(null);
    try {
      const result = await recognizeMedia({ text, files, existingFields: target?.fields || EMPTY_FIELDS });
      updatePerson(aid, pid, p => ({ ...p, recognitionId: result.id, fields: { ...p.fields, ...result.fields }, status: missingFields(result.fields).length ? 'needs' : 'ready', messages: [...p.messages, { id: uid(), role: 'assistant', text: result.message, result: true }] }));
      notify('资料识别完成，请核对字段');
    } catch (error) {
      updatePerson(aid, pid, p => ({ ...p, status: 'failed', messages: [...p.messages, { id: uid(), role: 'assistant', text: error.message || '识别失败，请稍后重试。' }] }));
      notify(error.message || '识别失败，请检查后端配置', 'warning');
    }
  }
  async function handleCardAction(cardPerson) {
    if (['recognizing', 'writing'].includes(cardPerson.status)) return;
    if (cardPerson.status === 'written') return;
    if (cardPerson.status === 'confirmed') {
      const aid = active.id;
      updatePerson(aid, cardPerson.id, p => ({ ...p, status: 'writing' }));
      try {
        const result = await writeFeishu({
          submissionKey: `${aid}:${cardPerson.id}`,
          recognitionId: cardPerson.recognitionId || null,
          tableUrl: active.config?.url || undefined,
          startRow: 2,
          startColumn: 'N',
          fields: cardPerson.fields,
        });
        updatePerson(aid, cardPerson.id, p => ({ ...p, status: 'written', writtenAt: new Date().toLocaleString('zh-CN', { hour12: false }), feishuRange: result.recordId }));
        notify(result.idempotent ? '这条资料此前已写入飞书' : '已成功回填飞书表格');
      } catch (error) {
        updatePerson(aid, cardPerson.id, p => ({ ...p, status: 'confirmed' }));
        notify(error.message || '飞书回填失败，请检查应用权限', 'warning');
      }
      return;
    }
    setPersonId(cardPerson.id);
  }
  async function recognize(text, files) {
    const aid = active.id, pid = person.id;
    const message = { id: uid(), role: 'user', text, files };
    updatePerson(aid, pid, p => ({ ...p, status: 'recognizing', messages: [...p.messages, message] }));
    try {
      const result = await recognizeMedia({ text, files, existingFields: person.fields });
      updatePerson(aid, pid, p => ({ ...p, recognitionId: result.id, fields: { ...p.fields, ...result.fields }, status: missingFields(result.fields).length ? 'needs' : 'ready', messages: [...p.messages, { id: uid(), role: 'assistant', text: result.message, result: true }] }));
      notify('资料识别完成，请核对字段');
    } catch (error) {
      updatePerson(aid, pid, p => ({ ...p, status: 'failed', messages: [...p.messages, { id: uid(), role: 'assistant', text: error.message || '识别失败，请稍后重试。' }] }));
      notify(error.message || '识别失败，请检查后端配置', 'warning');
    }
  }
  function confirmPerson() {
    const required = missingFields(person.fields);
    if (required.length) { notify(`请先补充${required.map(([, label]) => label).join('、')}`, 'warning'); return; }
    if (person.fields.phone && !/^1\d{10}$/.test(person.fields.phone)) { notify('请填写 11 位手机号码', 'warning'); return; }
    updatePerson(active.id, person.id, p => ({ ...p, status: 'confirmed', confirmedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }));
    notify('识别结果已确认');
    setPersonId(null);
  }
  function exportCSV() {
    const people = active.people.filter(p => ['confirmed', 'written'].includes(p.status));
    if (!people.length) return notify('还没有已确认的记录', 'warning');
    const cols = [...FIELD_LABELS, ['confirmedAt', '确认时间']];
    const cell = v => `"${String(v || '').replace(/^[=+\-@]/, "'$&").replaceAll('"', '""')}"`;
    const csv = '\uFEFF' + [cols.map(([, label]) => cell(label)).join(','), ...people.map(p => cols.map(([key]) => cell(key === 'confirmedAt' ? p.confirmedAt : p.fields[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${active.name}-已确认记录.csv`; document.body.appendChild(a); a.click(); a.remove(); later(() => URL.revokeObjectURL(url), 1500); notify('已导出记录');
  }
  let visible = (active?.people || []).filter(p => {
    const match = filter === 'all' || (filter === 'confirmed' ? ['confirmed', 'written', 'writing'].includes(p.status) : filter === 'needs' ? ['needs', 'failed'].includes(p.status) : ['ready', 'draft', 'recognizing'].includes(p.status));
    return match && `${p.fields.name} ${p.fields.role} ${p.fields.phone}`.toLowerCase().includes(search.toLowerCase());
  });
  if (sort === 'name') visible = [...visible].sort((a, b) => a.fields.name.localeCompare(b.fields.name, 'zh-CN'));
  if (sort === 'date') visible = [...visible].sort((a, b) => (a.fields.outboundDate || '9999').localeCompare(b.fields.outboundDate || '9999'));
  return <IconContext.Provider value={{ size: 18, weight: 'regular' }}><div className="app-shell" onClick={() => menu && setMenu(null)}>
    {mobileNav && <div className="nav-backdrop" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-symbol"><ChatCircleDots size={26} weight="bold" /></span><span>媒介通<small>MEDIA, CONNECTED.</small></span></div>
      <button className="new-activity" onClick={() => setModal({ type: 'activity' })}><Plus size={18} />新建活动</button>
      <div className="nav-label">活动空间 <span>{activities.length}</span></div>
      <nav className="activity-nav" aria-label="活动列表">{activities.map((a, i) => <div className={`activity-item ${activeId === a.id ? 'active' : ''}`} key={a.id}>
        <button className="activity-select" onClick={() => selectActivity(a.id)}><span className={`event-icon tone-${i % 3}`}><CalendarBlank size={17} /></span><span><strong>{a.name}</strong><small>{dateShort(a.date)} — {dateShort(a.endDate)}<i />{a.city.split(' · ').at(-1)}</small></span></button>
        <button className="activity-more" aria-label={`${a.name}的更多操作`} onClick={e => { e.stopPropagation(); setMenu(menu === a.id ? null : a.id); }}><DotsThree size={19} /></button>
        {menu === a.id && <div className="dropdown activity-dropdown" onClick={e => e.stopPropagation()}><button onClick={() => { setModal({ type: 'activity', activity: a }); setMenu(null); }}><PencilSimple size={15} />编辑活动</button><button className="danger-text" onClick={() => { setModal({ type: 'delete', activity: a }); setMenu(null); }}><Trash size={15} />删除活动</button></div>}
      </div>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span className="profile-avatar">晓</span><div><strong>小吴</strong><span>媒介工作者</span></div><button className="icon-button" aria-label="工作台设置" onClick={() => setModal({ type: 'settings' })}><GearSix size={19} /></button></div></div>
    </aside>
    <main className="main-area">
      {active ? <div className="workspace-content"><div className="workspace-head"><section className="page-heading"><button className="icon-button mobile-menu" aria-label="打开活动列表" onClick={() => setMobileNav(true)}><ListBullets /></button><div><div className="eyebrow"><span /> MEDIA WORKSPACE</div><h1>{active.name}</h1><div className="event-meta"><span><CalendarBlank size={14} />{active.date.replaceAll('-', '.')} — {active.endDate.slice(5).replace('-', '.')}</span><span><MapPin size={14} />{active.city}</span><span className="event-phase">资料识别中</span></div></div><div className="heading-actions"><Button variant={active.config?.connected ? 'success' : ''} onClick={() => setModal({ type: 'feishu', activity: active })}><FeishuMark />{active.config?.connected ? <><span className="connected-dot" />已连接飞书</> : '飞书配置'}</Button></div></section>
      <div className="toolbar"><div className="tabs" role="tablist" aria-label="媒体状态">{[['all', '全部媒体'], ['todo', '待核对'], ['needs', '需补充'], ['confirmed', '已确认']].map(([key, label]) => <button role="tab" aria-selected={filter === key} className={filter === key ? 'selected' : ''} key={key} onClick={() => setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div><div className="toolbar-controls"><label className="search-box"><MagnifyingGlass size={16} /><input aria-label="搜索出席人" placeholder="搜索姓名、职位或手机" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="clear-search" aria-label="清空搜索" onClick={() => setSearch('')}><X size={13} /></button>}</label><div className="sort-control"><SlidersHorizontal size={16} /><select aria-label="排序方式" value={sort} onChange={e => setSort(e.target.value)}><option value="default">默认排序</option><option value="name">姓名排序</option><option value="date">去程日期排序</option></select></div><div className="view-toggle"><button aria-label="卡片视图" aria-pressed={view === 'grid'} className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')}><SquaresFour size={17} /></button><button aria-label="列表视图" aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><ListBullets size={17} /></button></div></div></div></div><section className="media-section">
      {view === 'grid' ? <div className="media-grid">{filter === 'all' && !search && <>{composerFor !== 'bulk' && <div className="media-add-stack"><button className={`add-card ${composerFor === 'new' ? 'open' : ''}`} onClick={newPerson}><span className="add-card-icon"><Plus size={27} /></span><h3>新增媒体</h3><p>粘贴截图或文字，自动整理资料</p><span className="add-card-footer"><ImageSquare size={14} /> 批量图片 <span>·</span> <ChatCircleDots size={14} /> 文字描述</span></button><button className="bulk-add-button" onClick={() => setComposerFor('bulk')}><span className="bulk-add-icon"><UsersThree size={23} /></span><span><strong>批量添加媒体</strong><small>粘贴媒体名单，一次创建多个独立对话</small></span><ArrowRight size={17} /></button></div>}{composerFor === 'new' && <InlineComposer target={null} onCancel={() => setComposerFor(null)} onSubmit={submitInline} onPreview={setPreview} notify={notify} />}{composerFor === 'bulk' && <BulkMediaComposer existingPeople={active.people} onClose={() => setComposerFor(null)} onCreate={createMediaConversations} />}</>}{visible.map(p => p.status === 'draft' ? <InlineComposer key={p.id} target={p} onCancel={() => setModal({ type: 'deletePerson', person: p })} onSubmit={(text, files) => submitInline(text, files, p)} onPreview={setPreview} notify={notify} /> : <MediaCard key={p.id} person={p} onOpen={() => handleCardAction(p)} onCancel={() => setModal({ type: 'deletePerson', person: p })} />)}</div> : <div className="table-container"><div className="table-topline"><span>{filter === 'confirmed' ? '已确认记录' : '媒体资料列表'} · {visible.length} 位媒体</span><button className="text-button" onClick={exportCSV}><DownloadSimple size={15} />导出已确认</button></div><table><thead><tr><th>出席人</th><th>去程行程</th><th>返程行程</th><th>住宿日期</th><th>状态</th><th>操作</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><div className="table-person"><Avatar person={p} /><div><strong>{p.fields.name || '新媒体老师'}</strong><small>{p.fields.role || '待填写职位'}</small></div></div></td><td>{p.fields.outboundRoute ? <>{p.fields.outboundRoute.replace(/[-—→]/, ' → ')}<small>{dateShort(p.fields.outboundDate)} {p.fields.outboundTime} · {p.fields.outboundTrain}</small></> : '待补充'}</td><td>{p.fields.returnRoute ? <>{p.fields.returnRoute.replace(/[-—→]/, ' → ')}<small>{dateShort(p.fields.returnDate)} {p.fields.returnTime} · {p.fields.returnTrain}</small></> : '待补充'}</td><td>{p.fields.hotelDate || '待补充'}</td><td><Badge status={p.status} /></td><td><button className="text-button" disabled={['recognizing', 'writing', 'written'].includes(p.status)} onClick={() => handleCardAction(p)}>{p.status === 'written' ? '已写入' : p.status === 'writing' ? '写入中' : p.status === 'confirmed' ? '确认写入' : ['needs', 'failed', 'draft'].includes(p.status) ? '补充资料' : '核对信息'}</button></td></tr>)}</tbody></table></div>}
      {!visible.length && (filter !== 'all' || search || view === 'list') && <Empty title={search ? '没有找到相关媒体' : filter === 'confirmed' ? '还没有已确认的记录' : '这里暂时没有媒体资料'} detail={search ? '试试其他姓名、职位或手机号。' : '完成资料核对后，记录就会出现在这里。'}>{search && <Button onClick={() => setSearch('')}>清空搜索</Button>}</Empty>}
      <div className="workspace-footer"><span><ShieldCheck size={14} />资料仅用于当前活动，识别结果由业务老师确认</span><span><span className="footer-dot" />工作台已就绪</span></div></section></div> : <Empty title="从一场新活动开始" detail="创建活动，为每位媒体老师整理一份清晰的行程。"><Button variant="primary" onClick={() => setModal({ type: 'activity' })}><Plus />新建活动</Button></Empty>}
    </main>
    {person && <MediaDrawer person={person} activity={active} onClose={() => setPersonId(null)} onChange={fields => updatePerson(active.id, person.id, p => ({ ...p, fields, status: missingFields(fields).length ? 'needs' : 'ready' }))} onRecognize={recognize} onConfirm={confirmPerson} onPreview={setPreview} notify={notify} onDelete={() => setModal({ type: 'deletePerson', person })} />}
    {modal?.type === 'activity' && <ActivityModal activity={modal.activity} onClose={() => setModal(null)} onSave={data => { if (modal.activity) { updateActivity(modal.activity.id, a => ({ ...a, ...data })); notify('活动信息已更新'); } else { const a = { ...data, id: uid(), people: [], config: null }; setActivities(prev => [...prev, a]); selectActivity(a.id); notify('活动已创建，开始添加媒体资料吧'); } setModal(null); }} />}
    {modal?.type === 'feishu' && <FeishuConfigModal activity={modal.activity} onClose={() => setModal(null)} onSave={config => { updateActivity(modal.activity.id, a => ({ ...a, config })); setModal(null); notify(config.connected ? '飞书表格已连接' : '飞书配置已保存'); }} />}
    {['delete', 'deletePerson'].includes(modal?.type) && <Overlay title="确认删除" onClose={() => setModal(null)} className="small-modal"><ModalHeader title={modal.type === 'delete' ? '删除这个活动？' : '删除这位媒体老师？'} icon={<Trash />} onClose={() => setModal(null)} /><div className="modal-body"><p className="confirm-copy">{modal.type === 'delete' ? `“${modal.activity.name}”及其中的 ${modal.activity.people.length} 位媒体资料将从本地工作台移除。` : `“${modal.person.fields.name || '新媒体老师'}”的资料和对话将从当前活动移除。`}</p></div><div className="modal-footer"><Button onClick={() => setModal(null)}>取消</Button><Button variant="danger" onClick={() => { if (modal.type === 'delete') { setActivities(prev => prev.filter(a => a.id !== modal.activity.id)); if (activeId === modal.activity.id) selectActivity(activities.find(a => a.id !== modal.activity.id)?.id || ''); } else { updateActivity(active.id, a => ({ ...a, people: a.people.filter(p => p.id !== modal.person.id) })); setPersonId(null); } setModal(null); notify('已删除'); }}>确认删除</Button></div></Overlay>}
    {['help', 'settings', 'workspace'].includes(modal?.type) && <InfoModal type={modal.type} onClose={() => setModal(null)} onReset={() => { setActivities(seedData()); selectActivity('a1'); setView('grid'); setSort('default'); setModal(null); notify('已恢复初始演示数据'); }} />}
    {preview && <Overlay title="图片预览" className="image-preview" onClose={() => setPreview(null)}><div className="preview-title"><span>{preview.name}</span><button className="icon-button" aria-label="关闭图片预览" onClick={() => setPreview(null)}><X /></button></div><img src={preview.url} alt={preview.name} /></Overlay>}
    {toast && <div role="status" className={`toast ${toast.kind}`}>{toast.kind === 'warning' ? <WarningCircle size={19} /> : <CheckCircle size={19} weight="fill" />}{toast.message}<button aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button></div>}
  </div></IconContext.Provider>;
}

function MediaDrawer({ person, activity, onClose, onChange, onRecognize, onConfirm, onPreview, notify, onDelete }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [mobilePane, setMobilePane] = useState('chat');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fileRef = useRef(null), chatRef = useRef(null), textareaRef = useRef(null);
  const processing = person.status === 'recognizing';
  const confirmed = person.status === 'confirmed';
  const missing = missingFields(person.fields);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [person.messages.length, person.status]);
  async function addFiles(incoming) {
    if (processing) return;
    const list = [...incoming];
    const valid = list.filter(f => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(f.type) && f.size <= 8 * 1024 * 1024);
    if (valid.length !== list.length) notify('支持 PNG、JPG、WebP、GIF、SVG，每张图片不超过 8MB', 'warning');
    setLoadingFiles(true);
    try {
      const converted = await Promise.all(valid.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ id: uid(), name: file.name, type: file.type, url: reader.result }); reader.onerror = reject; reader.readAsDataURL(file); })));
      setFiles(prev => { if (prev.length + converted.length > 10) notify('每次最多上传 10 张图片', 'warning'); return [...prev, ...converted].slice(0, 10); });
    } catch { notify('图片读取失败，请重试', 'warning'); } finally { setLoadingFiles(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function send() { if ((!text.trim() && !files.length) || processing || loadingFiles) return; onRecognize(text.trim(), files); setText(''); setFiles([]); setMobilePane('fields'); }
  function demo() { setText(SAMPLE_TEXT); setFiles(SAMPLE_FILES); textareaRef.current?.focus(); }
  const f = person.fields;
  function field(key, label, type = 'text', required = false, placeholder = '待补充') { return <label className={`form-field ${required && !f[key] && person.status !== 'draft' ? 'field-warning' : ''}`} key={key}><span>{label}{required && <b>*</b>}</span><input aria-label={label} type={type} value={f[key]} disabled={processing} placeholder={placeholder} onChange={e => onChange({ ...f, [key]: e.target.value })} /></label>; }
  return <Overlay title={`${f.name || '新增媒体'} · 资料核对`} onClose={onClose} className="media-drawer"><div className="drawer-header"><div className="drawer-person"><Avatar person={person} /><div><h2>{f.name || '新增媒体老师'}<Badge status={person.status} /></h2><p>{f.role || '添加资料，开始整理'}<span> / </span>{activity.name}</p></div></div><div className="drawer-header-actions"><button className="icon-button" aria-label="删除媒体资料" onClick={onDelete}><Trash /></button><span /><button className="icon-button" aria-label="关闭媒体面板" onClick={onClose}><X size={21} /></button></div></div>
    <div className="drawer-steps"><span className="done"><CheckCircle size={16} />添加资料</span><i /><span className={confirmed ? 'done' : 'current'}>{confirmed ? <CheckCircle size={16} /> : <span className="step-number">2</span>}核对并确认</span><em>识别结果始终可以人工修改</em></div>
    <div className="mobile-pane-tabs"><button className={mobilePane === 'chat' ? 'selected' : ''} onClick={() => setMobilePane('chat')}>资料对话</button><button className={mobilePane === 'fields' ? 'selected' : ''} onClick={() => setMobilePane('fields')}>识别结果</button></div>
    <div className={`drawer-body show-${mobilePane}`}><section className={`conversation-pane ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (!processing) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
      <div className="pane-heading"><h3><ChatCircleDots size={17} />资料对话</h3><span>图片与文字，放在一起</span></div>
      <div className="messages" ref={chatRef}>{!person.messages.length ? <div className="chat-welcome"><span className="welcome-icon"><Sparkle size={29} weight="duotone" /></span><h3>把资料发来，剩下的交给我</h3><p>粘贴媒体老师的回执、车票或行程截图，<br />也可以直接描述需要补充的信息。</p><div className="welcome-examples"><span><ImageSquare size={16} />参会回执</span><span><Train size={16} />往返行程</span><span><FileText size={16} />文字信息</span></div><button className="sample-button" onClick={demo}><CursorClick size={16} />没有截图？试试示例资料<ArrowRight size={14} /></button></div> : <><div className="chat-date">当前活动 · 资料整理</div>{person.messages.map(m => <div className={`message ${m.role}`} key={m.id}>{m.role === 'assistant' && <span className="assistant-avatar"><Sparkle size={15} weight="fill" /></span>}<div className="message-content">{m.files?.length > 0 && <div className="message-images">{m.files.map((file, i) => file.url ? <button key={i} onClick={() => onPreview(file)}><img src={file.url} alt={file.name} /><span>{file.name}</span></button> : <div className="file-placeholder" key={i}><ImageSquare size={23} /><span>{file.name}</span><small>重新上传可查看原图</small></div>)}</div>}{m.text && <p>{m.text}</p>}{m.result && <div className="recognition-receipt"><CheckCircle size={14} />个人信息与往返行程已整理</div>}{m.written && <div className="recognition-receipt"><CloudCheck size={16} />{activity.config?.name}</div>}</div></div>)}</>}{person.status === 'recognizing' && <div className="message assistant"><span className="assistant-avatar"><Sparkle size={15} className="spin" /></span><div className="message-content recognizing-bubble"><span className="typing"><i /><i /><i /></span><p>正在提取并整理资料…</p></div></div>}</div>
      {confirmed && <div className="chat-completed"><CheckCircle size={20} weight="fill" /><div><strong>业务老师已确认这份资料</strong><p>确认于 {person.confirmedAt}</p></div></div>}<div className="composer-area"><div className="composer"><div className="pending-files">{files.map((file, i) => <div className="pending-file" key={file.id || i}><img src={file.url} alt={file.name} onClick={() => onPreview(file)} /><button aria-label={`移除${file.name}`} onClick={() => setFiles(prev => prev.filter((_, n) => n !== i))}><X size={11} /></button></div>)}</div><textarea ref={textareaRef} aria-label="媒体资料输入" placeholder="粘贴截图，或输入需要补充的资料…" value={text} disabled={processing} onChange={e => setText(e.target.value)} onPaste={e => { const pasted = [...e.clipboardData.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean); if (pasted.length) { e.preventDefault(); addFiles(pasted); } }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><div className="composer-actions"><div><input ref={fileRef} type="file" aria-label="上传图片" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple onChange={e => addFiles(e.target.files)} hidden /><button className="icon-button" aria-label="添加图片" disabled={processing || loadingFiles} onClick={() => fileRef.current?.click()}><ImageSquare size={20} /></button><button className="text-button" disabled={processing || loadingFiles} onClick={demo}>使用示例</button></div><button className="send-button" aria-label="发送资料并识别" disabled={processing || loadingFiles || (!files.length && !text.trim())} onClick={send}>{processing || loadingFiles ? <SpinnerGap className="spin" size={19} /> : <ArrowUp size={19} weight="bold" />}</button></div></div><div className="composer-hint"><span>支持批量粘贴、拖拽 · Enter 发送</span><span>真实 AI 识别</span></div></div>
      {dragging && <div className="drop-overlay"><ImageSquare size={45} /><strong>松开鼠标，添加图片</strong><p>一次最多 10 张</p></div>}
    </section><section className="results-pane"><div className="pane-heading"><h3><CheckSquare size={17} />识别结果</h3><span>{confirmed ? <><CheckCircle size={13} />已确认</> : '可直接编辑'}</span></div><div className="results-scroll"><div className={`result-notice ${confirmed ? 'success' : ''}`}>{confirmed ? <CheckCircle size={17} /> : <Sparkle size={17} />}<span>{confirmed ? '当前信息已经人工确认，仍可修改后再次确认。' : 'AI 已整理资料，请逐项核对并修正。'}</span></div>
      {person.status === 'needs' && missing.length > 0 && <div className="missing-notice"><WarningCircle size={15} />请补充{missing.map(([, label]) => label).join('、')}，再完成确认</div>}
      <div className="form-section-title"><User size={16} /><h4>人员信息</h4><span>01</span></div><div className="fields-grid">{field('name', '出席人', 'text', true)}{field('role', '职位')}{field('phone', '联系方式', 'tel', true)}{field('identity', '身份证号码')}</div>
      {['outbound', 'return'].map((dir, i) => <React.Fragment key={dir}><div className="form-section-title">{f[`${dir}Transport`] === '飞机' ? <AirplaneTilt size={16} /> : <Train size={16} />}<h4>{i === 0 ? '去程行程' : '返程行程'}</h4><span>0{i + 2}</span></div><div className="fields-grid">{field(`${dir}Transport`, '交通类型', 'text', false, '飞机 / 高铁')}{field(`${dir}Date`, '日期', 'date')}{field(`${dir}Route`, '出发地-抵达地', 'text', false, '例如：上海-武汉')}{field(`${dir}Train`, '航班 / 车次')}{field(`${dir}Station`, i === 0 ? '到达航站楼 / 高铁站' : '出发航站楼 / 高铁站')}{field(`${dir}Time`, '出发时间', 'time')}{field(`${dir}Arrival`, '抵达时间', 'time')}</div></React.Fragment>)}
      <div className="form-section-title"><FileText size={16} /><h4>住宿信息</h4><span>04</span></div><div className="fields-grid">{field('hotelDate', '住宿日期', 'date')}<label className="form-field full"><span>识别备注</span><textarea aria-label="识别备注" placeholder="模型发现冲突或不确定内容时显示在这里" value={f.notes} disabled={processing} onChange={e => onChange({ ...f, notes: e.target.value })} /></label></div><p className="fields-end">修改会自动保存在本机工作台，确认后可导出 CSV。</p></div></section></div>
    <footer className="drawer-footer"><div><CheckSquare size={22} /><span>共 19 个目标表格字段<small>日期在页面中统一显示为 yyyy-MM-dd</small></span></div><div><Button onClick={onClose}>稍后处理</Button><Button variant={confirmed ? 'success' : 'primary'} disabled={processing} onClick={onConfirm}><CheckCircle size={17} />{confirmed ? '再次确认' : '完成核对'}</Button></div></footer>
  </Overlay>;
}

function ActivityModal({ activity, onClose, onSave }) {
  const [form, setForm] = useState(activity || { name: '', city: '', date: '2026-09-12', endDate: '2026-09-14' });
  const [error, setError] = useState('');
  function submit(e) { e.preventDefault(); if (!form.name.trim() || !form.city.trim()) return setError('请填写活动名称和地点'); if (form.endDate < form.date) return setError('结束日期不能早于开始日期'); onSave({ name: form.name.trim(), city: form.city.trim(), date: form.date, endDate: form.endDate }); }
  return <Overlay title={activity ? '编辑活动' : '新建活动'} onClose={onClose} className="activity-modal"><ModalHeader title={activity ? '编辑活动' : '开启一场新活动'} subtitle="为这次相聚，准备一个有条理的工作空间。" icon={<CalendarBlank size={23} />} onClose={onClose} /><form onSubmit={submit}><div className="modal-body"><div className="fields-grid"><label className="form-field full"><span>活动名称 <b>*</b></span><input autoFocus required maxLength={40} aria-label="活动名称" placeholder="例如：向新而行 · 秋季媒体试驾会" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="form-field full"><span>活动地点 <b>*</b></span><input required maxLength={30} aria-label="活动地点" placeholder="例如：江西 · 上饶" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label><label className="form-field"><span>开始日期 <b>*</b></span><input required aria-label="开始日期" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label className="form-field"><span>结束日期 <b>*</b></span><input required aria-label="结束日期" type="date" min={form.date} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label></div><div className="activity-modal-note"><Files size={20} /><p>每个活动拥有独立的媒体资料和识别结果，<br />方便你在不同项目之间有序切换。</p></div>{error && <p className="inline-error" role="alert">{error}</p>}</div><div className="modal-footer"><Button type="button" onClick={onClose}>取消</Button><Button type="submit" variant="primary">{activity ? '保存修改' : '创建活动'}<ArrowRight size={16} /></Button></div></form></Overlay>;
}

function FeishuConfigModal({ activity, onClose, onSave }) {
  const [url, setUrl] = useState(activity.config?.url || '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(activity.config?.connected ? activity.config : null);
  const [error, setError] = useState('');
  const [botOpen, setBotOpen] = useState(false);
  const [botStatus, setBotStatus] = useState(null);
  const [botForm, setBotForm] = useState({ appId: '', appSecret: '' });
  const [botSaving, setBotSaving] = useState(false);
  const [botError, setBotError] = useState('');
  useEffect(() => {
    let live = true;
    getFeishuConfig().then(status => live && setBotStatus(status)).catch(() => live && setBotStatus({ configured: false, appIdMasked: '' }));
    return () => { live = false; };
  }, []);
  async function saveBot() {
    if (!botForm.appId.trim()) return setBotError('请填写 App ID');
    if (!botForm.appSecret.trim() && !botStatus?.configured) return setBotError('请填写 App Secret');
    setBotSaving(true); setBotError('');
    try {
      const status = await saveFeishuConfig(botForm.appId.trim(), botForm.appSecret);
      setBotStatus(status); setBotForm({ appId: '', appSecret: '' }); setBotOpen(false); setResult(null); setError('');
    } catch (exception) {
      setBotError(exception.message || '机器人凭证验证失败');
    } finally { setBotSaving(false); }
  }
  async function checkConnection() {
    setChecking(true); setError(''); setResult(null);
    try {
      const checked = await validateFeishu(url.trim());
      setResult({ connected: true, name: checked.sheetTitle, sheetId: checked.sheetId, spreadsheetToken: checked.spreadsheetToken });
    } catch (exception) {
      setError(exception.message || '连接失败，请检查链接和飞书应用权限');
    } finally { setChecking(false); }
  }
  function save() {
    onSave({ connected: Boolean(result?.connected), name: result?.name || activity.config?.name || '飞书电子表格', url: url.trim(), sheetId: result?.sheetId || '', startRow: 2, startColumn: 'N' });
  }
  return <Overlay title="飞书配置" onClose={onClose} className="feishu-drawer"><ModalHeader title={`${activity.name} · 飞书配置`} subtitle="每个活动独立连接一张回填表，不会影响其他活动。" icon={<FeishuMark />} onClose={onClose} /><div className="modal-body config-body"><div className="bot-config-row"><button className={`bot-config-trigger ${botStatus?.configured ? 'configured' : ''}`} aria-label="配置飞书机器人凭证" title="配置 App ID 与 App Secret" onClick={() => { setBotOpen(value => !value); setBotError(''); }}><Robot size={22} weight="duotone" /></button><div><strong>飞书回填机器人</strong><p>{botStatus === null ? '正在读取本机配置…' : botStatus.configured ? `已配置 ${botStatus.appIdMasked}` : '尚未配置 App ID 与 Secret'}</p></div><span className={`bot-state ${botStatus?.configured ? 'ready' : ''}`}>{botStatus?.configured ? '已配置' : '待配置'}</span></div>{botOpen && <div className="bot-credentials"><div className="fields-grid"><label className="form-field full"><span>App ID</span><input autoFocus autoComplete="off" placeholder="cli_xxxxxxxxxxxxxxxx" value={botForm.appId} onChange={event => setBotForm({ ...botForm, appId: event.target.value })} /></label><label className="form-field full"><span>App Secret</span><input type="password" autoComplete="new-password" placeholder={botStatus?.configured ? '留空将保留当前 Secret' : '输入 App Secret'} value={botForm.appSecret} onChange={event => setBotForm({ ...botForm, appSecret: event.target.value })} /></label></div>{botError && <p className="inline-error" role="alert">{botError}</p>}<div className="bot-credentials-actions"><span><ShieldCheck size={14} />凭证仅发送至本机后端，保存后不再显示</span><Button onClick={() => { setBotOpen(false); setBotForm({ appId: '', appSecret: '' }); setBotError(''); }}>取消</Button><Button variant="primary" onClick={saveBot} disabled={botSaving}>{botSaving ? <><SpinnerGap className="spin" size={15} />验证中</> : <>保存并隐藏<Check size={15} /></>}</Button></div></div>}<label className="form-field full"><span>飞书表格链接</span><div className="connection-input"><Link size={17} /><input aria-label="飞书表格链接" placeholder="留空使用本机默认表格，或粘贴带 sheet 参数的链接" value={url} onChange={event => { setUrl(event.target.value); setResult(null); setError(''); }} /><Button type="button" onClick={checkConnection} disabled={checking}>{checking ? <><SpinnerGap className="spin" size={15} />检测中</> : '检测连接'}</Button></div></label>{result?.connected && <div className="connected-table"><span className="table-symbol"><Table size={21} /></span><div><strong>{result.name || '飞书电子表格'}</strong><p><CheckCircle size={13} weight="fill" />连接成功 · Sheet {result.sheetId}</p></div><Badge status="written" /></div>}{error && <p className="inline-error" role="alert">{error}</p>}<div className="mapping-title"><h3>回填范围</h3><span>19 个字段 · 保留业务列</span></div><div className="mapping-table"><div className="mapping-head"><span>内容</span><span /><span>目标列</span></div>{[['人员信息', 'N — Q'], ['去程信息', 'U — AA'], ['返程信息', 'AD — AJ'], ['住宿日期', 'AM']].map(([label, columns]) => <div className="mapping-row" key={label}><span>{label}</span><ArrowRight size={14} /><span>{columns}</span></div>)}</div></div><div className="modal-footer"><span className="footer-note"><ShieldCheck size={14} />写入前仍需业务老师确认</span><Button onClick={onClose}>取消</Button><Button variant="primary" onClick={save}>保存配置<Check size={16} /></Button></div></Overlay>;
}

function InfoModal({ type, onClose, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return <Overlay title={type === 'help' ? '使用指南' : type === 'workspace' ? '我的工作空间' : '工作台设置'} onClose={onClose} className="info-modal"><ModalHeader title={type === 'help' ? '两步，把资料整理好' : type === 'workspace' ? '我的工作空间' : '工作台设置'} subtitle="媒介通，让每一次媒体沟通更从容。" icon={<Sparkle size={22} />} onClose={onClose} /><div className="modal-body">{type === 'help' ? <><div className="help-steps">{[['01', '发送原始资料', '批量粘贴回执、机票、车票或住宿截图，也可以直接发送文字。'], ['02', '核对识别结果', 'AI 提取 19 个目标字段，业务老师逐项修改并完成确认。']].map(([number, title, copy]) => <div key={number}><span>{number}</span><section><h3>{title}</h3><p>{copy}</p></section></div>)}</div><div className="info-note"><strong>关于本地版本</strong><p>AI 识别任务保存在本机 SQLite；活动、核对字段和确认状态保存在当前浏览器。上传图片只用于本次模型识别。</p></div></> : <><div className="workspace-profile"><span className="profile-avatar">晓</span><div><h3>小吴的工作空间</h3><p>本地个人工作台</p></div><span className="badge blue">本地保存</span></div><div className="setting-row"><div><strong>资料保存</strong><p>活动、字段及确认状态自动保存在当前浏览器</p></div><CloudCheck size={22} /></div><div className="setting-row"><div><strong>示例数据</strong><p>恢复预设活动和不同处理状态的虚拟案例</p></div><Button onClick={() => setConfirmReset(true)}><ArrowClockwise size={15} />重置</Button></div>{confirmReset && <div className="reset-confirm"><p>重置会清除你在当前浏览器中新建的活动和资料，恢复初始示例内容。</p><Button onClick={() => setConfirmReset(false)}>取消</Button><Button variant="danger" onClick={onReset}>确认重置</Button></div>}</>}</div><div className="modal-footer"><Button variant="primary" onClick={onClose}>{type === 'help' ? '开始整理' : '完成'}<ArrowRight size={16} /></Button></div></Overlay>;
}

createRoot(document.getElementById('root')).render(<App />);
