import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc, arrayUnion, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdZBseMjk0oyLp_R_vLrQEzmfI_jdtzlA",
  authDomain: "tonoy-portfolio.firebaseapp.com",
  projectId: "tonoy-portfolio",
  storageBucket: "tonoy-portfolio.firebasestorage.app",
  messagingSenderId: "317094529805",
  appId: "1:317094529805:web:15bdb13a4db2a6494d7e44"
};
const OWNER_UID = "VLmwbWuSs4S0uQfPzZ95oksjbft2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let owning = false;
let skills = [], projects = [], certs = [];

const ICONS = {
  html:'devicon-html5-plain colored', css:'devicon-css3-plain colored',
  javascript:'devicon-javascript-plain colored', js:'devicon-javascript-plain colored',
  typescript:'devicon-typescript-plain colored', python:'devicon-python-plain colored',
  java:'devicon-java-plain colored', 'c++':'devicon-cplusplus-plain colored',
  cpp:'devicon-cplusplus-plain colored', c:'devicon-c-plain colored',
  'c#':'devicon-csharp-plain colored', react:'devicon-react-original colored',
  node:'devicon-nodejs-plain colored', 'node.js':'devicon-nodejs-plain colored',
  firebase:'devicon-firebase-plain colored', git:'devicon-git-plain colored',
  github:'devicon-github-original colored', mongodb:'devicon-mongodb-plain colored',
  mysql:'devicon-mysql-plain colored', php:'devicon-php-plain colored',
  figma:'devicon-figma-plain colored', bootstrap:'devicon-bootstrap-plain colored',
  tailwind:'devicon-tailwindcss-plain colored', 'tailwind css':'devicon-tailwindcss-plain colored',
  docker:'devicon-docker-plain colored', flutter:'devicon-flutter-plain colored',
  kotlin:'devicon-kotlin-plain colored', dart:'devicon-dart-plain colored',
  angular:'devicon-angularjs-plain colored', vue:'devicon-vuejs-plain colored',
  linux:'devicon-linux-plain colored', android:'devicon-android-plain colored',
  postman:'devicon-postman-plain colored', vscode:'devicon-vscode-plain colored',
  wordpress:'devicon-wordpress-plain colored', django:'devicon-django-plain colored',
  express:'devicon-express-original', 'express.js':'devicon-express-original',
  swift:'devicon-swift-plain colored', ruby:'devicon-ruby-plain colored'
};

function esc(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function escAttr(s){ return esc(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ---------- project link helpers ---------- */
// Accepts "github.com/me/app" or a full URL; returns a safe https/http URL or null.
function cleanUrl(raw){
  let u = (raw||'').trim(); if(!u) return null;
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try{
    const x = new URL(u);
    if(!x.hostname.includes('.')) return null;
    return x.href;
  }catch(e){ return null; }
}
function linkLabel(label, url){
  if(label && label.trim()) return label.trim();
  try{ return new URL(url).hostname.replace(/^www\./,''); }catch(e){ return 'Link'; }
}
function linkIcon(url){
  let h = ''; try{ h = new URL(url).hostname; }catch(e){}
  if(/(^|\.)github\.com$/i.test(h)) return 'bi-github';
  if(/(^|\.)linkedin\.com$/i.test(h)) return 'bi-linkedin';
  if(/(^|\.)(youtube\.com|youtu\.be)$/i.test(h)) return 'bi-youtube';
  return 'bi-box-arrow-up-right';
}

/* ---------- rendering ---------- */
function renderSkills(){
  const grid = document.getElementById('skillsGrid');
  grid.innerHTML = skills.length===0 ? '<p class="hint">No skills added yet.</p>' : '';
  skills.forEach(s=>{
    const el = document.createElement('div'); el.className='skill-card';
    const iconHtml = s.image ? `<img src="${s.image}" alt="${esc(s.name)}">`
      : s.iconClass ? `<i class="${s.iconClass}"></i>`
      : `<i class="bi bi-code-square"></i>`;
    el.innerHTML = `<button class="del" data-id="${s.id}">×</button>${iconHtml}<div class="sk-name">${esc(s.name)}</div>`;
    el.querySelector('.del').onclick = ()=> deleteDoc(doc(db,'skills',s.id));
    grid.appendChild(el);
  });
}

function renderProjects(){
  const grid = document.getElementById('projectsGrid');
  grid.innerHTML = projects.length===0 ? '<p class="hint">No projects added yet.</p>' : '';
  projects.forEach(p=>{
    const el = document.createElement('div'); el.className='proj-card';
    const thumb = p.image ? `<img src="${p.image}" alt="${esc(p.title)}">` : '';
    const icon = p.image ? '' : `<i class="bi ${esc(p.icon||'bi-code-slash')}"></i>`;
    const links = Array.isArray(p.links) ? p.links : [];
    const linksHtml = links.map((l,i)=>
      `<span class="proj-link-wrap"><a class="proj-link" href="${escAttr(l.url)}" target="_blank" rel="noopener noreferrer"><i class="bi ${linkIcon(l.url)}"></i>${esc(l.label)}</a><button class="link-x" data-i="${i}" title="Remove link" type="button">×</button></span>`
    ).join('');
    el.innerHTML = `<button class="del" data-id="${p.id}">×</button>${thumb}${icon}
      <h1>${esc(p.title)}</h1><p>${esc(p.desc)}</p>
      <div class="proj-links${links.length?' has-links':''}">${linksHtml}<button class="add-link-btn" type="button">+ Link</button></div>`;
    el.querySelector('.del').onclick = ()=> deleteDoc(doc(db,'projects',p.id));
    el.querySelector('.add-link-btn').onclick = ()=> openLinkModal(p.id);
    el.querySelectorAll('.link-x').forEach(b=>{
      b.onclick = ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const i = Number(b.dataset.i);
        updateDoc(doc(db,'projects',p.id), {links: links.filter((_,k)=>k!==i)});
      };
    });
    grid.appendChild(el);
  });
}

function renderCerts(){
  const grid = document.getElementById('certsGrid');
  grid.innerHTML = certs.length===0 ? '<p class="empty-state">No certificates added yet.</p>' : '';
  certs.forEach(c=>{
    const el = document.createElement('div'); el.className='cert-card';
    const figure = c.image
      ? `<figure><img src="${c.image}" alt="${esc(c.title)}"></figure>`
      : `<figure class="no-img">No image</figure>`;
    el.innerHTML = `<button class="del" data-id="${c.id}">×</button>${figure}
      <h1>${esc(c.title)}</h1><p>${esc(c.issuer)}${c.date?' · '+esc(c.date):''}</p>`;
    el.querySelector('.del').onclick = ()=> deleteDoc(doc(db,'certs',c.id));
    grid.appendChild(el);
  });
}

/* ---------- live data ---------- */
onSnapshot(query(collection(db,'skills'), orderBy('order','asc')), snap=>{
  skills = snap.docs.map(d=>({id:d.id, ...d.data()})); renderSkills();
});
onSnapshot(query(collection(db,'projects'), orderBy('order','asc')), snap=>{
  projects = snap.docs.map(d=>({id:d.id, ...d.data()})); renderProjects();
});
onSnapshot(query(collection(db,'certs'), orderBy('order','asc')), snap=>{
  certs = snap.docs.map(d=>({id:d.id, ...d.data()})); renderCerts();
});

/* ---------- auth ---------- */
onAuthStateChanged(auth, user=>{
  owning = !!(user && user.uid === OWNER_UID);
  document.body.classList.toggle('owning', owning);
  document.getElementById('loginLink').textContent = owning ? 'Log out' : 'Owner login';
  applyTextEditability();
});

document.getElementById('loginLink').onclick = ()=>{
  if(owning){ signOut(auth); return; }
  document.getElementById('loginBack').classList.add('show');
};
document.getElementById('loginCancel').onclick = ()=> document.getElementById('loginBack').classList.remove('show');
document.getElementById('loginBack').addEventListener('click', e=>{ if(e.target.id==='loginBack') e.target.classList.remove('show'); });
document.getElementById('loginSubmit').onclick = async ()=>{
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    document.getElementById('loginBack').classList.remove('show');
    document.getElementById('loginErr').textContent = '';
  }catch(e){ document.getElementById('loginErr').textContent = 'Wrong email or password.'; }
};

/* ---------- skill form ---------- */
document.getElementById('addSkill').onclick = ()=>{
  document.getElementById('skName').value=''; document.getElementById('skImage').value='';
  document.getElementById('skillModalBack').classList.add('show');
};
document.getElementById('skCancel').onclick = ()=> document.getElementById('skillModalBack').classList.remove('show');
document.getElementById('skillModalBack').addEventListener('click', e=>{ if(e.target.id==='skillModalBack') e.target.classList.remove('show'); });
document.getElementById('skSave').onclick = async ()=>{
  const name = document.getElementById('skName').value.trim(); if(!name) return;
  const file = document.getElementById('skImage').files[0];
  const known = ICONS[name.toLowerCase().trim()];
  let image = null, iconClass = null;
  if(file){
    if(file.size > 150000){ alert('Please use a smaller image for logos (under ~150KB).'); return; }
    image = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); });
  } else if(known){
    iconClass = known;
  }
  await addDoc(collection(db,'skills'), {name, image, iconClass, order: Date.now()});
  document.getElementById('skillModalBack').classList.remove('show');
};

/* ---------- project form ---------- */
function addLinkRow(label='', url=''){
  const row = document.createElement('div'); row.className='link-row';
  row.innerHTML = `<input type="text" class="lr-label" placeholder="Text (e.g. GitHub)"><input type="text" class="lr-url" placeholder="https://…"><button type="button" class="link-row-x" title="Remove">×</button>`;
  row.querySelector('.lr-label').value = label;
  row.querySelector('.lr-url').value = url;
  row.querySelector('.link-row-x').onclick = ()=> row.remove();
  document.getElementById('prLinks').appendChild(row);
}
document.getElementById('prAddLinkRow').onclick = ()=> addLinkRow();

document.getElementById('addProject').onclick = ()=>{
  document.getElementById('prIcon').value='bi-code-slash';
  document.getElementById('prTitle').value=''; document.getElementById('prDesc').value='';
  document.getElementById('prImage').value='';
  document.getElementById('prLinks').innerHTML=''; addLinkRow();
  document.getElementById('prErr').textContent='';
  document.getElementById('projectModalBack').classList.add('show');
};
document.getElementById('prCancel').onclick = ()=> document.getElementById('projectModalBack').classList.remove('show');
document.getElementById('projectModalBack').addEventListener('click', e=>{ if(e.target.id==='projectModalBack') e.target.classList.remove('show'); });
document.getElementById('prSave').onclick = async ()=>{
  const title = document.getElementById('prTitle').value.trim(); if(!title) return;
  const icon = document.getElementById('prIcon').value.trim() || 'bi-code-slash';
  const desc = document.getElementById('prDesc').value.trim();
  const file = document.getElementById('prImage').files[0];

  const links = []; let badLink = false;
  document.querySelectorAll('#prLinks .link-row').forEach(row=>{
    const raw = row.querySelector('.lr-url').value.trim();
    if(!raw) return;                       // empty row, skip
    const url = cleanUrl(raw);
    if(!url){ badLink = true; return; }
    links.push({ label: linkLabel(row.querySelector('.lr-label').value, url), url });
  });
  if(badLink){ document.getElementById('prErr').textContent = 'One of the links is not a valid web address (e.g. github.com/you/app).'; return; }

  let image = null;
  if(file){
    if(file.size > 700000){ alert('That image is a bit large (keep it under ~700KB). Saving without the image — try a smaller file.'); }
    else { image = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
  }
  await addDoc(collection(db,'projects'), {title, icon, desc, image, links, order: Date.now()});
  document.getElementById('projectModalBack').classList.remove('show');
};

/* ---------- add a link to an existing project ---------- */
let linkTargetId = null;
function openLinkModal(id){
  linkTargetId = id;
  document.getElementById('lkLabel').value=''; document.getElementById('lkUrl').value='';
  document.getElementById('lkErr').textContent='';
  document.getElementById('linkModalBack').classList.add('show');
}
document.getElementById('lkCancel').onclick = ()=> document.getElementById('linkModalBack').classList.remove('show');
document.getElementById('linkModalBack').addEventListener('click', e=>{ if(e.target.id==='linkModalBack') e.target.classList.remove('show'); });
document.getElementById('lkSave').onclick = async ()=>{
  const url = cleanUrl(document.getElementById('lkUrl').value);
  if(!url){ document.getElementById('lkErr').textContent = 'Enter a valid web address (e.g. github.com/you/app).'; return; }
  const label = linkLabel(document.getElementById('lkLabel').value, url);
  try{
    await updateDoc(doc(db,'projects',linkTargetId), {links: arrayUnion({label, url})});
    document.getElementById('linkModalBack').classList.remove('show');
  }catch(e){ document.getElementById('lkErr').textContent = 'Could not save the link. Make sure you are logged in as owner.'; }
};

/* ---------- certificate form ---------- */
document.getElementById('addCert').onclick = ()=>{
  ['ceTitle','ceIssuer','ceDate','ceDesc'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('ceImage').value='';
  document.getElementById('certModalBack').classList.add('show');
};
document.getElementById('ceCancel').onclick = ()=> document.getElementById('certModalBack').classList.remove('show');
document.getElementById('certModalBack').addEventListener('click', e=>{ if(e.target.id==='certModalBack') e.target.classList.remove('show'); });
document.getElementById('ceSave').onclick = async ()=>{
  const title = document.getElementById('ceTitle').value.trim(); if(!title) return;
  const issuer = document.getElementById('ceIssuer').value.trim();
  const date = document.getElementById('ceDate').value.trim();
  const desc = document.getElementById('ceDesc').value.trim();
  const file = document.getElementById('ceImage').files[0];
  let image = null;
  if(file){
    if(file.size > 700000){ alert('That image is a bit large (keep it under ~700KB). Saving without the image — try a smaller file.'); }
    else { image = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); }); }
  }
  await addDoc(collection(db,'certs'), {title, issuer, date, desc, image, order: Date.now()});
  document.getElementById('certModalBack').classList.remove('show');
};

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); } });
}, {threshold:0.15});
document.querySelectorAll('.reveal').forEach(el=> io.observe(el));

/* ---------- editable site images (logo / hero / about) ---------- */
import { doc as siteDoc, setDoc as siteSetDoc, onSnapshot as siteOnSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const IMG_TARGETS = { logo:'logoImg', hero:'heroImg', about:'aboutImg' };
Object.keys(IMG_TARGETS).forEach(key=>{
  siteOnSnapshot(siteDoc(db,'site',key), snap=>{
    if(!snap.exists()) return;
    const d = snap.data();
    const img = document.getElementById(IMG_TARGETS[key]);
    if(d.image) img.src = d.image;
    if(d.width){ img.style.width = d.width+'px'; img.style.height = 'auto'; }
    if(d.offsetX){ img.dataset.offsetX = d.offsetX; img.style.transform = `translateX(${d.offsetX}px)`; }
  });
});
document.querySelectorAll('.edit-img-wrap').forEach(wrap=>{
  const key = wrap.dataset.key;
  const img = wrap.querySelector('img');
  let dragged = false;

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.addEventListener('click', e=> e.stopPropagation());
  wrap.appendChild(handle);

  handle.addEventListener('pointerdown', e=>{
    e.stopPropagation(); e.preventDefault();
    if(!owning) return;
    const startX = e.clientX;
    const startW = img.offsetWidth;
    handle.setPointerCapture(e.pointerId);
    function onMove(ev){
      const newW = Math.max(40, startW + (ev.clientX - startX));
      img.style.width = newW + 'px';
      img.style.height = 'auto';
    }
    function onUp(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      siteSetDoc(siteDoc(db,'site',key), {width: img.offsetWidth}, {merge:true});
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  img.addEventListener('pointerdown', e=>{
    if(!owning) return;
    e.stopPropagation();
    const startX = e.clientX;
    const baseOffset = parseFloat(img.dataset.offsetX || '0');
    dragged = false;
    img.setPointerCapture(e.pointerId);
    img.style.cursor = 'grabbing';
    function onMove(ev){
      const dx = ev.clientX - startX;
      if(Math.abs(dx) > 4) dragged = true;
      if(dragged){
        const newOffset = baseOffset + dx;
        img.style.transform = `translateX(${newOffset}px)`;
        img.dataset.offsetX = newOffset;
      }
    }
    function onUp(){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      img.style.cursor = 'grab';
      if(dragged){
        siteSetDoc(siteDoc(db,'site',key), {offsetX: parseFloat(img.dataset.offsetX||'0')}, {merge:true});
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  wrap.addEventListener('click', ()=>{
    if(!owning) return;
    if(dragged){ dragged = false; return; }
    const input = document.getElementById('siteImageInput');
    input.value = '';
    input.onchange = async ()=>{
      const file = input.files[0]; if(!file) return;
      if(file.size > 800000){ alert('Please use a smaller image (under ~800KB) — try compressing it first.'); return; }
      const base64 = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); });
      await siteSetDoc(siteDoc(db,'site',key), {image: base64});
    };
    input.click();
  });
});

/* ---------- editable text ---------- */
const textEls = Array.from(document.querySelectorAll('[data-tkey]'));

siteOnSnapshot(siteDoc(db,'site','texts'), snap=>{
  if(!snap.exists()) return;
  const data = snap.data();
  textEls.forEach(el=>{
    const key = el.dataset.tkey;
    if(data[key] !== undefined && document.activeElement !== el){
      el.textContent = data[key];
    }
  });
});

function applyTextEditability(){
  textEls.forEach(el=>{
    el.setAttribute('contenteditable', owning ? 'true' : 'false');
  });
}
applyTextEditability();

textEls.forEach(el=>{
  el.addEventListener('blur', async ()=>{
    if(!owning) return;
    const key = el.dataset.tkey;
    await siteSetDoc(siteDoc(db,'site','texts'), {[key]: el.textContent.trim()}, {merge:true});
  });
});
