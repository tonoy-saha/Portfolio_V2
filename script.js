import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    el.innerHTML = `<button class="del" data-id="${p.id}">×</button>
      <i class="bi ${esc(p.icon||'bi-code-slash')}"></i>
      <h1>${esc(p.title)}</h1><p>${esc(p.desc)}</p>`;
    el.querySelector('.del').onclick = ()=> deleteDoc(doc(db,'projects',p.id));
    grid.appendChild(el);
  });
}

function driveThumb(link){
  if(!link) return null;
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) || link.match(/id=([a-zA-Z0-9_-]+)/);
  if(!m) return null;
  return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
}

function renderCerts(){
  const grid = document.getElementById('certsGrid');
  grid.innerHTML = certs.length===0 ? '<p class="empty-state">No certificates added yet.</p>' : '';
  certs.forEach(c=>{
    const el = document.createElement('div'); el.className='cert-card';
    const thumb = driveThumb(c.drive);
    const figure = thumb
      ? `<figure><img src="${thumb}" alt="${esc(c.title)}"></figure>`
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
document.getElementById('addProject').onclick = ()=>{
  document.getElementById('prIcon').value='bi-code-slash';
  document.getElementById('prTitle').value=''; document.getElementById('prDesc').value='';
  document.getElementById('projectModalBack').classList.add('show');
};
document.getElementById('prCancel').onclick = ()=> document.getElementById('projectModalBack').classList.remove('show');
document.getElementById('projectModalBack').addEventListener('click', e=>{ if(e.target.id==='projectModalBack') e.target.classList.remove('show'); });
document.getElementById('prSave').onclick = async ()=>{
  const title = document.getElementById('prTitle').value.trim(); if(!title) return;
  const icon = document.getElementById('prIcon').value.trim() || 'bi-code-slash';
  const desc = document.getElementById('prDesc').value.trim();
  await addDoc(collection(db,'projects'), {title, icon, desc, order: Date.now()});
  document.getElementById('projectModalBack').classList.remove('show');
};

/* ---------- certificate form ---------- */
document.getElementById('addCert').onclick = ()=>{
  ['ceTitle','ceIssuer','ceDate','ceDesc','ceDrive'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('certModalBack').classList.add('show');
};
document.getElementById('ceCancel').onclick = ()=> document.getElementById('certModalBack').classList.remove('show');
document.getElementById('certModalBack').addEventListener('click', e=>{ if(e.target.id==='certModalBack') e.target.classList.remove('show'); });
document.getElementById('ceSave').onclick = async ()=>{
  const title = document.getElementById('ceTitle').value.trim(); if(!title) return;
  const issuer = document.getElementById('ceIssuer').value.trim();
  const date = document.getElementById('ceDate').value.trim();
  const desc = document.getElementById('ceDesc').value.trim();
  const drive = document.getElementById('ceDrive').value.trim();
  await addDoc(collection(db,'certs'), {title, issuer, date, desc, drive, order: Date.now()});
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
    if(snap.exists() && snap.data().image){
      document.getElementById(IMG_TARGETS[key]).src = snap.data().image;
    }
  });
});
document.querySelectorAll('.edit-img-wrap').forEach(wrap=>{
  wrap.addEventListener('click', ()=>{
    if(!owning) return;
    const key = wrap.dataset.key;
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
