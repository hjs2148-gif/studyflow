import React, {useEffect, useMemo, useState} from 'react';
import './dailyday.css';

type Item = {
  id:string; name:string; category:string; expiry:string; location:string; emoji:string; photo?:string;
};

const categories=['전체','소스','식품','시즈닝','음료','신선식품','약','기타'];
const iconMap:Record<string,string>={소스:'🥫',식품:'🍱',시즈닝:'🧂',음료:'🥤',신선식품:'🥬',약:'💊',기타:'📦'};
const seed:Item[]=[
  {id:'1',name:'와사비',category:'소스',expiry:'2026-02-12',location:'냉장',emoji:'🟢'},
  {id:'2',name:'겨자',category:'소스',expiry:'2026-03-26',location:'냉장',emoji:'🟡'},
  {id:'3',name:'초장',category:'소스',expiry:'2026-08-04',location:'냉장',emoji:'🌶️'},
  {id:'4',name:'유즈코쇼',category:'소스',expiry:'2026-09-30',location:'냉장',emoji:'🍋'},
  {id:'5',name:'마요네즈',category:'소스',expiry:'2026-10-23',location:'냉장',emoji:'🥚'},
  {id:'6',name:'타바스코',category:'소스',expiry:'2026-12-01',location:'실온',emoji:'🌶️'},
  {id:'7',name:'소바장국',category:'소스',expiry:'2027-02-24',location:'냉장',emoji:'🍜'},
  {id:'8',name:'치킨스톡',category:'시즈닝',expiry:'2027-03-17',location:'실온',emoji:'🧂'},
  {id:'9',name:'참치액',category:'소스',expiry:'2027-12-30',location:'실온',emoji:'🐟'},
  {id:'10',name:'국간장',category:'소스',expiry:'2028-02-04',location:'실온',emoji:'🍶'}
];

function dayDiff(dateStr:string){
  const today=new Date(); today.setHours(0,0,0,0);
  const target=new Date(dateStr+'T00:00:00');
  return Math.round((target.getTime()-today.getTime())/86400000);
}
function formatDate(s:string){
  const d=new Date(s+'T00:00:00');
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function dday(d:number){ return d===0?'D-DAY':d>0?`D-${d}`:`D+${Math.abs(d)}`; }

async function compressImage(file:File){
  return await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const max=720; let w=img.width,h=img.height;
        if(w>h&&w>max){h=Math.round(h*max/w);w=max;}
        else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}
        const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d')?.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',.72));
      };
      img.onerror=reject; img.src=String(e.target?.result||'');
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}

export default function DailyDay(){
  const [items,setItems]=useState<Item[]>(()=>{
    try { return JSON.parse(localStorage.getItem('dailyday-items-v3')||'null')||seed; } catch { return seed; }
  });
  const [cat,setCat]=useState('전체');
  const [q,setQ]=useState('');
  const [asc,setAsc]=useState(true);
  const [editing,setEditing]=useState<Item|null>(null);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState<Item>({id:'',name:'',category:'식품',expiry:new Date(Date.now()+30*86400000).toISOString().slice(0,10),location:'냉장',emoji:'🍱',photo:''});

  useEffect(()=>{ try{localStorage.setItem('dailyday-items-v3',JSON.stringify(items));}catch{} },[items]);

  const visible=useMemo(()=>items
    .filter(i=>(cat==='전체'||i.category===cat)&&i.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>(dayDiff(a.expiry)-dayDiff(b.expiry))*(asc?1:-1)),[items,cat,q,asc]);

  const counts={
    all:items.length,
    soon:items.filter(i=>{const d=dayDiff(i.expiry); return d>=0&&d<=7}).length,
    expired:items.filter(i=>dayDiff(i.expiry)<0).length
  };

  function startAdd(){
    const next={id:'',name:'',category:'식품',expiry:new Date(Date.now()+30*86400000).toISOString().slice(0,10),location:'냉장',emoji:'🍱',photo:''};
    setEditing(null); setForm(next); setOpen(true);
  }
  function startEdit(item:Item){ setEditing(item); setForm({...item}); setOpen(true); }
  function saveItem(e:React.FormEvent){
    e.preventDefault();
    const obj={...form,id:editing?.id||crypto.randomUUID(),emoji:form.emoji||iconMap[form.category]||'📦'};
    setItems(prev=>editing?prev.map(i=>i.id===editing.id?obj:i):[...prev,obj]);
    setOpen(false);
  }
  async function onPhoto(file?:File){
    if(!file)return;
    const photo=await compressImage(file);
    setForm(f=>({...f,photo}));
  }
  async function share(){
    const url=window.location.href;
    try{
      if(navigator.share) await navigator.share({title:'DAILY DAY',text:'유통기한 D-day 관리 웹앱',url});
      else { await navigator.clipboard.writeText(url); alert('공유 링크를 복사했습니다.'); }
    }catch{}
  }

  return <div className="dd-app">
    <main className="dd-shell">
      <header className="dd-topbar">
        <div><h1>DAILY DAY</h1><p>먹기 전에, 버리기 전에. 날짜부터 챙기기.</p></div>
        <button className="dd-icon" onClick={share} aria-label="공유">↗</button>
      </header>

      <section className="dd-summary">
        <div><span>전체</span><b>{counts.all}</b></div>
        <div><span>7일 이내</span><b>{counts.soon}</b></div>
        <div><span>기한 지남</span><b>{counts.expired}</b></div>
      </section>

      <section className="dd-toolbar">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="식품 이름 검색"/>
        <div className="dd-chips">{categories.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>
      </section>

      <div className="dd-sectionhead"><h2>{cat==='전체'?'전체 식품':cat}</h2><button onClick={()=>setAsc(v=>!v)}>{asc?'임박순 ↓':'여유순 ↑'}</button></div>

      <section className="dd-list">
        {visible.length?visible.map(item=>{
          const d=dayDiff(item.expiry);
          return <button className="dd-item" key={item.id} onClick={()=>startEdit(item)}>
            <div className="dd-thumb">{item.photo?<img src={item.photo} alt=""/>:<span>{item.emoji||iconMap[item.category]}</span>}</div>
            <div className="dd-copy"><strong>{item.name}</strong><small>{formatDate(item.expiry)} · {item.category} · {item.location}</small></div>
            <div className={'dd-dday '+(d<0?'expired':d<=7?'soon':'')}>{dday(d)}</div>
          </button>
        }):<div className="dd-empty">🧺<br/>등록된 식품이 없습니다.</div>}
      </section>
    </main>

    <button className="dd-fab" onClick={startAdd}>＋ 식품 추가</button>

    {open&&<div className="dd-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <form className="dd-sheet" onSubmit={saveItem}>
        <div className="dd-handle"/>
        <h3>{editing?'식품 수정':'식품 추가'}</h3>
        <div className="dd-photo-row">
          <label className="dd-photo">
            {form.photo?<img src={form.photo} alt=""/>:<span>📷</span>}
            <input type="file" accept="image/*" capture="environment" hidden onChange={e=>onPhoto(e.target.files?.[0])}/>
          </label>
          <div><label className="dd-upload-btn">사진 촬영 · 앨범에서 선택<input type="file" accept="image/*" capture="environment" hidden onChange={e=>onPhoto(e.target.files?.[0])}/></label>{form.photo&&<button type="button" className="dd-remove" onClick={()=>setForm(f=>({...f,photo:''}))}>사진 제거</button>}<p>사진은 자동 압축되어 이 기기에만 저장됩니다.</p></div>
        </div>

        <div className="dd-grid">
          <label className="full">식품 이름<input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="예: 우유, 고추장"/></label>
          <label>카테고리<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label>
          <label>유통기한 / 소비기한<input type="date" required value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></label>
          <label>보관 위치<select value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}><option>냉장</option><option>냉동</option><option>실온</option><option>기타</option></select></label>
          <label>사진 없을 때 아이콘<input value={form.emoji} maxLength={4} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}/></label>
        </div>
        <div className="dd-actions">
          {editing&&<button type="button" className="danger" onClick={()=>{setItems(prev=>prev.filter(i=>i.id!==editing.id));setOpen(false)}}>삭제</button>}
          <button type="button" onClick={()=>setOpen(false)}>취소</button>
          <button type="submit" className="primary">저장</button>
        </div>
      </form>
    </div>}
  </div>
}
