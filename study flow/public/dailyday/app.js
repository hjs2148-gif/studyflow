const categories=["전체","소스","식품","시즈닝","음료","신선식품","약","기타"];
const iconMap={"소스":"🥫","식품":"🍱","시즈닝":"🧂","음료":"🥤","신선식품":"🥬","약":"💊","기타":"📦"};
const seed=[
  {id:crypto.randomUUID(),name:"와사비",category:"소스",expiry:"2026-02-12",location:"냉장",emoji:"🟢"},
  {id:crypto.randomUUID(),name:"겨자",category:"소스",expiry:"2026-03-26",location:"냉장",emoji:"🟡"},
  {id:crypto.randomUUID(),name:"초장",category:"소스",expiry:"2026-08-04",location:"냉장",emoji:"🌶️"},
  {id:crypto.randomUUID(),name:"유즈코쇼",category:"소스",expiry:"2026-09-30",location:"냉장",emoji:"🍋"},
  {id:crypto.randomUUID(),name:"마요네즈",category:"소스",expiry:"2026-10-23",location:"냉장",emoji:"🥚"},
  {id:crypto.randomUUID(),name:"타바스코",category:"소스",expiry:"2026-12-01",location:"실온",emoji:"🌶️"},
  {id:crypto.randomUUID(),name:"소바장국",category:"소스",expiry:"2027-02-24",location:"냉장",emoji:"🍜"},
  {id:crypto.randomUUID(),name:"치킨스톡",category:"시즈닝",expiry:"2027-03-17",location:"실온",emoji:"🧂"},
  {id:crypto.randomUUID(),name:"참치액",category:"소스",expiry:"2027-12-30",location:"실온",emoji:"🐟"},
  {id:crypto.randomUUID(),name:"국간장",category:"소스",expiry:"2028-02-04",location:"실온",emoji:"🍶"}
];
let items=JSON.parse(localStorage.getItem('dailyday-items-v2')||localStorage.getItem('dailyday-items')||'null')||seed;
let activeCategory='전체',searchTerm='',ascending=true,currentPhoto='';
const $=s=>document.querySelector(s);
function save(){try{localStorage.setItem('dailyday-items-v2',JSON.stringify(items));}catch(e){showToast('저장 공간이 부족합니다. 사진을 줄여주세요.');}}
function dayDiff(dateStr){const today=new Date();today.setHours(0,0,0,0);const target=new Date(dateStr+'T00:00:00');return Math.round((target-today)/86400000)}
function ddayText(d){return d===0?'D-DAY':d>0?`D-${d}`:`D+${Math.abs(d)}`}
function statusClass(d){return d<0?'expired':d<=7?'soon':'safe'}
function formatDate(s){const d=new Date(s+'T00:00:00');return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderChips(){$('#categoryChips').innerHTML=categories.map(c=>`<button class="chip ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;render()})}
function render(){
  renderChips();
  const filtered=items.filter(i=>(activeCategory==='전체'||i.category===activeCategory)&&i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  filtered.sort((a,b)=>ascending?dayDiff(a.expiry)-dayDiff(b.expiry):dayDiff(b.expiry)-dayDiff(a.expiry));
  $('#listTitle').textContent=activeCategory==='전체'?'전체 식품':activeCategory;$('#sortBtn').textContent=ascending?'임박순 ↓':'여유순 ↑';
  $('#itemList').innerHTML=filtered.length?filtered.map(i=>{const d=dayDiff(i.expiry);const thumb=i.photo?`<img src="${i.photo}" alt="${escapeHtml(i.name)} 사진">`:escapeHtml(i.emoji||iconMap[i.category]||'📦');return `<article class="item" data-id="${i.id}"><div class="thumb">${thumb}</div><div><div class="item-title">${escapeHtml(i.name)}</div><div class="item-meta"><span>${formatDate(i.expiry)}</span><span>·</span><span>${i.category}</span><span>·</span><span>${i.location}</span></div></div><div class="dday ${statusClass(d)}">${ddayText(d)}</div></article>`}).join(''):`<div class="empty"><div class="big">🧺</div><div>등록된 식품이 없습니다.</div></div>`;
  document.querySelectorAll('.item').forEach(el=>el.onclick=()=>openSheet(el.dataset.id));
  $('#countAll').textContent=items.length;$('#countSoon').textContent=items.filter(i=>{const d=dayDiff(i.expiry);return d>=0&&d<=7}).length;$('#countExpired').textContent=items.filter(i=>dayDiff(i.expiry)<0).length;
}
function setPhotoPreview(photo){currentPhoto=photo||'';$('#photoPreview').innerHTML=currentPhoto?`<img src="${currentPhoto}" alt="선택한 사진">`:'📷';$('#removePhotoBtn').style.display=currentPhoto?'block':'none'}
function openSheet(id){
  const item=id?items.find(x=>x.id===id):null;$('#sheetTitle').textContent=item?'식품 수정':'식품 추가';$('#editId').value=item?.id||'';$('#name').value=item?.name||'';$('#category').value=item?.category||'식품';$('#expiry').value=item?.expiry||new Date(Date.now()+30*86400000).toISOString().slice(0,10);$('#location').value=item?.location||'냉장';$('#emoji').value=item?.emoji||'';setPhotoPreview(item?.photo||'');
  $('#sheetActions').innerHTML=item?`<button type="button" class="btn danger" id="deleteBtn">삭제</button><button type="button" class="btn secondary" id="cancelBtn">취소</button><button type="submit" class="btn primary">저장</button>`:`<button type="button" class="btn secondary" id="cancelBtn">취소</button><button type="submit" class="btn primary">저장</button>`;
  $('#cancelBtn').onclick=closeSheet;if(item)$('#deleteBtn').onclick=()=>{if(confirm('이 식품을 삭제할까요?')){items=items.filter(x=>x.id!==item.id);save();closeSheet();render();showToast('삭제했습니다')}};$('#overlay').classList.add('open');setTimeout(()=>$('#name').focus(),120)
}
function closeSheet(){$('#overlay').classList.remove('open');$('#photoInput').value=''}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1700)}
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{const max=720;let w=img.width,h=img.height;if(w>h&&w>max){h=Math.round(h*max/w);w=max}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=e.target.result};reader.onerror=reject;reader.readAsDataURL(file)})}
async function shareApp(){const url=location.href;const data={title:'DAILY DAY',text:'유통기한을 D-day로 관리하는 간단한 웹앱',url};try{if(navigator.share){await navigator.share(data)}else{await navigator.clipboard.writeText(url);showToast('공유 링크를 복사했습니다')}}catch(e){if(e?.name!=='AbortError')showToast('공유하지 못했습니다')}}

$('#category').innerHTML=categories.filter(c=>c!=='전체').map(c=>`<option>${c}</option>`).join('');
$('#addBtn').onclick=()=>openSheet();$('#overlay').onclick=e=>{if(e.target.id==='overlay')closeSheet()};$('#searchInput').oninput=e=>{searchTerm=e.target.value;render()};$('#sortBtn').onclick=()=>{ascending=!ascending;render()};$('#shareBtn').onclick=shareApp;
$('#photoBtn').onclick=()=>$('#photoInput').click();$('#removePhotoBtn').onclick=()=>setPhotoPreview('');
$('#photoInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return showToast('이미지 파일을 선택해주세요');try{showToast('사진을 준비하는 중…');const photo=await compressImage(file);setPhotoPreview(photo);showToast('사진을 넣었습니다')}catch{showToast('사진을 불러오지 못했습니다')}};
$('#resetBtn').onclick=()=>{if(confirm('예시 데이터로 초기화할까요? 현재 데이터는 사라집니다.')){items=seed.map(i=>({...i,id:crypto.randomUUID()}));save();render();showToast('초기화했습니다')}};
$('#itemForm').onsubmit=e=>{e.preventDefault();const obj={id:$('#editId').value||crypto.randomUUID(),name:$('#name').value.trim(),category:$('#category').value,expiry:$('#expiry').value,location:$('#location').value,emoji:$('#emoji').value.trim()||iconMap[$('#category').value],photo:currentPhoto};const idx=items.findIndex(i=>i.id===obj.id);if(idx>=0)items[idx]=obj;else items.push(obj);save();closeSheet();render();showToast(idx>=0?'수정했습니다':'추가했습니다')};

save();render();