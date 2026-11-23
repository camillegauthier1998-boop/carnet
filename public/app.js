/*UTILS-START*/
const pad=n=>String(n).padStart(2,'0');
const toISO=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2],12)};
const realToday=()=>toISO(new Date());
function addUnit(iso,n,u){
  const d=parse(iso);
  if(u==='d')d.setDate(d.getDate()+n);
  else if(u==='w')d.setDate(d.getDate()+7*n);
  else{
    const day=d.getDate();d.setDate(1);
    if(u==='m')d.setMonth(d.getMonth()+n);else d.setFullYear(d.getFullYear()+n);
    const dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,dim));
  }
  return toISO(d);
}
const diffDays=(a,b)=>Math.round((parse(a)-parse(b))/864e5);
const fmt=(iso,o)=>iso?parse(iso).toLocaleDateString('fr-FR',o||{day:'numeric',month:'short',year:'numeric'}):'—';
const fmtShort=iso=>fmt(iso,{day:'numeric',month:'short'});
const fmtLong=iso=>fmt(iso,{weekday:'long',day:'numeric',month:'long'});
const unitWord=(u,n)=>({d:n>1?'jours':'jour',w:n>1?'semaines':'semaine',m:'mois',y:n>1?'ans':'an'})[u];
function freqLabel(f){
  if(!f)return 'Sans fréquence fixe';
  if(f.n===1)return ({d:'Tous les jours',w:'Toutes les semaines',m:'Tous les mois',y:'Tous les ans'})[f.unit];
  return (f.unit==='w'?'Toutes les ':'Tous les ')+f.n+' '+unitWord(f.unit,f.n);
}
const remLabel=r=>r?(r.n===0?'Le jour de l’échéance':r.n+' '+unitWord(r.unit,r.n)+' avant'):'Aucun rappel anticipé';
function careInfo(care,appts,today){
  const reals=[...care.realizations].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const last=reals.length?reals[0].date:null;
  const due=care.freq&&last?addUnit(last,care.freq.n,care.freq.unit):null;
  const rem=due?(care.remind?addUnit(due,-care.remind.n,care.remind.unit):due):null;
  const planned=appts.filter(a=>a.careId===care.id&&a.status==='planned').sort((a,b)=>a.date<b.date?-1:1);
  const appt=planned[0]||null;
  let status;
  if(care.archived)status='stopped';
  else if(appt)status=appt.date>=today?'booked':'toConfirm';
  else if(!last)status='new';
  else if(!care.freq)status='free';
  else if(due<today)status='overdue';
  else if(rem<=today)status=care.pending?'pending':'remind';
  else status='ok';
  return {last,due,rem,appt,status,reals};
}
function ageStr(b,t){
  if(!b)return '';
  const d1=parse(b),d2=parse(t);
  let m=(d2.getFullYear()-d1.getFullYear())*12+d2.getMonth()-d1.getMonth();
  if(d2.getDate()<d1.getDate())m--;
  if(m<0)return '';
  if(m<1)return 'moins d’un mois';
  if(m<24)return m+' mois';
  return Math.floor(m/12)+' ans';
}
const hex2=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const rgb2=a=>'#'+a.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const x=hex2(a),y=hex2(b);return rgb2(x.map((v,i)=>v+(y[i]-v)*t))};
const lum=h=>{const c=hex2(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
function ensure(fg,bgs,min,toward){
  bgs=[].concat(bgs);let c=fg;
  for(let i=0;i<24;i++){if(bgs.every(b=>contrast(c,b)>=min))return c;c=mix(c,toward,.12)}
  return toward;
}
function buildTheme(t){
  const dark=lum(t.bg)<.2;
  const ink=dark?'#EEF3F3':'#1F2B2A';
  const bg=t.bg,card=t.card,nav=t.nav;
  const ink2=ensure(mix(ink,card,.38),[bg,card],4.5,ink);
  const psoft=mix(t.primary,card,dark?.78:.86);
  const pink=ensure(t.primary,[card,psoft,nav,bg],4.5,ink);
  const ssoft=mix(t.secondary,card,dark?.78:.68);
  const sink=ensure(mix(t.secondary,ink,.5),ssoft,4.5,ink);
  const onp=contrast('#FFFFFF',t.primary)>=contrast('#14201F',t.primary)?'#FFFFFF':'#14201F';
  const sem=c=>{const b=mix(c,card,dark?.78:.84);return [b,ensure(c,b,4.5,ink)]};
  const g=sem('#4E9A6A'),w=sem('#D1962F'),b=sem('#C4584F'),i=sem('#4A7FB5');
  return {dark,vars:{'--bg':bg,'--card':card,'--nav':nav,'--page':mix(bg,dark?'#000000':ink,dark?.3:.05),
    '--primary':t.primary,'--secondary':t.secondary,'--onp':onp,'--ink':ink,'--ink2':ink2,
    '--line':mix(ink,card,dark?.86:.91),'--psoft':psoft,'--pink':pink,'--ssoft':ssoft,'--sink':sink,
    '--goodbg':g[0],'--good':g[1],'--warnbg':w[0],'--warn':w[1],'--badbg':b[0],'--bad':b[1],'--infobg':i[0],'--info':i[1],
    '--shadow':dark?'rgba(0,0,0,.4)':'rgba(30,50,50,.10)','--hi':dark?'rgba(255,255,255,.07)':'rgba(255,255,255,.85)'},
    report:{text:contrast(ink,card),btn:contrast(onp,t.primary),link:contrast(pink,card)}};
}
/* Mode sombre : adapte n'importe quelle palette claire en gardant sa teinte et sa lisibilité */
function effTheme(t,wantDark){
  if(!wantDark||lum(t.bg)<.2)return t;
  const base='#0E1214';
  const bg=mix(base,t.primary,.10),card=mix(base,t.primary,.17),nav=mix(base,t.primary,.14);
  let p=mix(t.primary,'#FFFFFF',.30);
  for(let i=0;i<12&&contrast(p,card)<4.5;i++)p=mix(p,'#FFFFFF',.15);
  return {...t,bg,card,nav,primary:p,secondary:mix(t.secondary,'#FFFFFF',.08)};
}
/*UTILS-END*/

const {useState,useEffect,useRef,useContext,createContext}=React;
const html=htm.bind(React.createElement);
const Ctx=createContext(null);
const useC=()=>useContext(Ctx);
const uid=()=>Math.random().toString(36).slice(2,9);
const D=s=>{const a=s.split('/');return a[2]+'-'+a[1]+'-'+a[0]};

const PALETTES=[
  {id:'sauge',em:'🌿',name:'Vert sauge et crème',primary:'#3E7C7E',secondary:'#EBC27A',bg:'#F1F5F4',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'rose',em:'🌸',name:'Rose poudré et ivoire',primary:'#B0587A',secondary:'#EBCBB0',bg:'#FBF5F1',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'lavande',em:'🪻',name:'Lavande et blanc cassé',primary:'#6B5AA6',secondary:'#D8CCF0',bg:'#F7F5F9',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'bleu',em:'🩵',name:'Bleu pastel et gris clair',primary:'#46739F',secondary:'#AFCFE3',bg:'#F0F3F6',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'peche',em:'🍑',name:'Pêche et beige',primary:'#B05842',secondary:'#F3CDAA',bg:'#FAF0E6',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'terracotta',em:'🤎',name:'Terracotta et sable',primary:'#A5502F',secondary:'#E5CBA0',bg:'#F4EADB',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'petrole',em:'🌊',name:'Bleu pétrole et crème',primary:'#2E6676',secondary:'#E4D0A2',bg:'#F7F1E3',card:'#FFFFFF',nav:'#FFFFFF'},
  {id:'ardoise',em:'🌙',name:'Ardoise (sombre)',primary:'#7FB4C4',secondary:'#E0B67A',bg:'#13191C',card:'#1D2529',nav:'#192125'}
];
const ICONMAP={'🩺':'stethoscope','🌸':'venus','🦷':'tooth','👁️':'eye','👓':'glasses','🤲':'hand-holding-medical','🩸':'droplet','💉':'syringe','🐾':'paw','🪱':'worm','🛡️':'shield-halved','🐎':'horse','✨':'wand-magic-sparkles',
 '🏠':'house','👨‍👩‍👧':'users','📅':'calendar-days','⚙️':'gear','📖':'book-medical','⚖️':'weight-scale','💊':'pills','🕘':'clock-rotate-left','⏰':'bell','🔔':'bell','⚠️':'triangle-exclamation','✅':'circle-check','📝':'pen-to-square','🌿':'leaf','🔍':'magnifying-glass','🎨':'palette','👪':'user-group','🙂':'user','✉️':'envelope','📋':'clipboard','♻️':'rotate-left','🚪':'right-from-bracket','🗄️':'box-archive','🗑️':'trash-can','✏️':'pen','＋':'plus','🩹':'bandage','🧴':'pump-soap','🧪':'flask','🫀':'heart-pulse','🧠':'brain','🦴':'bone','👂':'ear-listen','🥼':'user-doctor','🩻':'x-ray','🏥':'hospital','🧘':'spa','🪮':'scissors','🛁':'bath','✂️':'scissors',
 '🧑':'user','💞':'heart','🧒':'child','🐶':'dog','🐱':'cat','🐴':'horse','🐰':'paw','📎':'paperclip','‹':'chevron-left','⋯':'ellipsis','›':'chevron-right','✓':'check','📍':'location-dot','🕐':'clock','🐛':'bug','🔒':'lock','🏷️':'tag','👤':'user','✕':'xmark','📇':'user-doctor'};
const AV_BG=['#DCEBE8','#F6E3D3','#E6DFF2','#F7DDE3','#DDE8F5','#E9EFD3','#F4EBC9','#E5E0D8','#CFE3D4','#F3D3C7','#D3D9F0','#FBE7B5'];
const AV_ACC=['','🎀','🕶️','🧢','🌸','⭐','🩹'];
const TYPES={
  adult:{label:'Adulte',emoji:'🧑',human:true,k:'h',av:['👩','👨','🧑','👩‍🦰','👨‍🦱','👱‍♀️','👱‍♂️','👵','👴']},
  partner:{label:'Conjoint(e)',emoji:'💞',human:true,k:'h',av:['👩','👨','🧑','👩‍🦰','👨‍🦱','👱‍♀️','👱‍♂️','👩‍🦳','👨‍🦳']},
  child:{label:'Enfant',emoji:'🧒',human:true,k:'h',av:['👧','👦','🧒','👶','🧑‍🦱','👩‍🦰']},
  dog:{label:'Chien',emoji:'🐶',k:'a',species:'Chien',av:['🐶','🐕','🐩','🦮','🐕‍🦺']},
  cat:{label:'Chat',emoji:'🐱',k:'a',species:'Chat',av:['🐱','🐈','🐈‍⬛','😺']},
  horse:{label:'Cheval',emoji:'🐴',k:'e',species:'Cheval',av:['🐴','🐎','🦄']},
  other:{label:'Autre animal',emoji:'🐰',k:'a',species:'',av:['🐰','🐹','🐢','🦜','🐟','🐍','🐷','🐑']}
};
const CATS=[
  {id:'generaliste',label:'Médecin généraliste',emoji:'🩺',k:'h'},
  {id:'gyneco',label:'Gynécologue',emoji:'🌸',k:'h'},
  {id:'dentiste',label:'Dentiste',emoji:'🦷',k:'h'},
  {id:'ophtalmo',label:'Ophtalmologue',emoji:'👁️',k:'h'},
  {id:'lunettes',label:'Lunettes',emoji:'👓',k:'h'},
  {id:'osteo',label:'Ostéopathe',emoji:'🤲',k:'h,a,e'},
  {id:'sang',label:'Prises de sang',emoji:'🩸',k:'h'},
  {id:'vaccin',label:'Vaccinations',emoji:'💉',k:'h,a,e'},
  {id:'veto',label:'Vétérinaire',emoji:'🐾',k:'a,e'},
  {id:'vermifuge',label:'Vermifuge',emoji:'🪱',k:'a,e'},
  {id:'antiparasitaire',label:'Antiparasitaires',emoji:'🐛',k:'a'},
  {id:'marechal',label:'Maréchal-ferrant',emoji:'fa:horseshoe',k:'e'},
  {id:'dentiste-eq',label:'Dentiste équin',emoji:'🦷',k:'e'},
  {id:'autre',label:'Autre soin',emoji:'✨',k:'h,a,e'}
];
const CAT_EMOJIS=['🧴','🩹','💊','🧪','🫀','🧠','🦴','👂','🥼','🩻','🏥','🧘','🐾','🪮','🛁','✂️'];
/* Icônes supplémentaires pour les types de soin (Font Awesome Free, fer à cheval dessiné pour le carnet), avec leur nom en français */
const CAT_ICONS=[['fa:virus','Rage, maladie'],['fa:shield-virus','Vaccin, protection'],['fa:hands','Ostéopathe'],['fa:hand-holding-hand','Soins, massage'],
  ['fa:shoe-prints','Podologue'],['fa:socks','Pieds'],['fa:horseshoe','Maréchal-ferrant, ferrure'],['fa:hammer','Parage'],['fa:horse-head','Cheval'],
  ['fa:brush','Pansage, toilettage'],['fa:person-walking','Kinésithérapie'],['fa:dumbbell','Rééducation'],['fa:lungs','Respiration'],['fa:thermometer','Température'],
  ['fa:vial','Analyses'],['fa:baby','Pédiatre'],['fa:person-pregnant','Sage-femme'],['fa:hand-dots','Dermatologue, allergies'],['fa:mortar-pestle','Pharmacie, homéopathie'],
  ['fa:user-nurse','Infirmier'],['fa:prescription-bottle-medical','Ordonnance'],['fa:notes-medical','Bilan'],['fa:house-medical','Soins à domicile'],['fa:truck-medical','Urgences'],
  ['fa:wheelchair','Mobilité'],['fa:person-cane','Gériatrie'],['fa:shield-dog','Assurance animale'],['fa:cow','Ferme'],['fa:feather','Oiseaux'],['fa:dove','Oiseaux'],
  ['fa:kiwi-bird','Volailles'],['fa:fish','Poissons'],['fa:seedling','Phytothérapie'],['fa:apple-whole','Nutrition'],['fa:wheat-awn','Alimentation'],['fa:mosquito','Insectes'],['fa:spider','Tiques']];
const ICON_FR={stethoscope:'Médecin',venus:'Gynécologue',tooth:'Dentiste',eye:'Ophtalmologue',glasses:'Lunettes','hand-holding-medical':'Soins',droplet:'Prise de sang',syringe:'Vaccin',paw:'Vétérinaire',worm:'Vermifuge',bug:'Antiparasitaires',horse:'Cheval','wand-magic-sparkles':'Autre',
  'pump-soap':'Hygiène',bandage:'Pansement',pills:'Médicaments',flask:'Laboratoire','heart-pulse':'Cardiologue',brain:'Neurologue',bone:'Os, radiologie','ear-listen':'ORL','user-doctor':'Spécialiste','x-ray':'Radiographie',hospital:'Hôpital',spa:'Bien-être',scissors:'Toilettage, coupe',bath:'Bain'};
const iconLabel=e=>{const x=CAT_ICONS.find(y=>y[0]===e);return x?x[1]:ICON_FR[faName(e)]||faName(e)};
const PRESETS={
  h:[['generaliste','Médecin généraliste',1,'y',1,'m'],['dentiste','Dentiste',1,'y',1,'m'],['ophtalmo','Ophtalmologue',2,'y',2,'m'],['vaccin','Vaccinations',10,'y',3,'m']],
  a:[['veto','Vétérinaire',1,'y',1,'m'],['vaccin','Vaccinations annuelles',1,'y',1,'m'],['vermifuge','Vermifuge',3,'m',2,'w'],['antiparasitaire','Antiparasitaires',3,'m',2,'w']],
  e:[['marechal','Maréchal-ferrant',6,'w',2,'w'],['vermifuge','Vermifuge',6,'m',1,'m'],['dentiste-eq','Dentiste équin',1,'y',2,'m'],['vaccin','Vaccinations',1,'y',1,'m']]
};
const ROLES={admin:['Administrateur','Voit et modifie tout, gère les accès et le thème'],editor:['Peut modifier','Ajoute et modifie les soins, rendez-vous et pesées'],viewer:['Lecture seule','Consulte les carnets sans rien modifier']};
/* Types de soin de l'espace : types prédéfinis (renommables, supprimables sauf « Autre soin ») + types créés par la famille */
const allCats=fam=>{const ed=fam.catEdits||{},hid=fam.catHidden||[];
  return [...CATS.filter(c=>c.id==='autre'||!hid.includes(c.id)).map(c=>ed[c.id]?{...c,...ed[c.id]}:c),...(fam.cats||[])]};
const catsFor=(fam,p)=>allCats(fam).filter(c=>c.k.split(',').includes(TYPES[p.type].k));
const catOf=(fam,id)=>{const all=allCats(fam);return all.find(c=>c.id===id)||all.find(c=>c.id==='autre')};
/* Annuaire des professionnels et établissements */
const KINDS={doctor:['Médecin','🥼','Médecins'],vet:['Vétérinaire','🐾','Vétérinaires'],place:['Établissement','🏥','Établissements'],pro:['Autre professionnel','🩺','Autres']};
const contactOf=(fam,id)=>id?(fam.contacts||[]).find(x=>x.id===id)||null:null;
const proName=(fam,care)=>{const k=contactOf(fam,care.proId);return k?k.name:(care.pro||'')};
const CAT_COLOR={generaliste:'#4E8FB5',gyneco:'#C9739A',dentiste:'#3FA39C','dentiste-eq':'#3FA39C',ophtalmo:'#7A6CC2',lunettes:'#6F86D6',osteo:'#D0975A',sang:'#CF5D5D',vaccin:'#55A36B',veto:'#8A9A4B',vermifuge:'#C98F4A',antiparasitaire:'#9A6FB5',marechal:'#8C6B4F',autre:'#7E9690'};
const EXTRA_TINTS=['#4E8FB5','#C9739A','#3FA39C','#7A6CC2','#D0975A','#55A36B','#9A6FB5','#C98F4A'];
const catTint=cat=>CAT_COLOR[cat.id]||EXTRA_TINTS[[...String(cat.id)].reduce((s,ch)=>s+ch.charCodeAt(0),0)%EXTRA_TINTS.length];

const Y1={n:1,unit:'y'},M1={n:1,unit:'m'};
const AR=()=>[{days:7,on:true},{days:2,on:true}];
const R=(d,note,pro)=>({id:uid(),date:D(d),note:note||'',pro:pro||'',docs:[]});
const mkCare=(name,category,freq,remind,realizations)=>({id:uid(),name,category,pro:'',notes:'',freq,remind,apptReminders:AR(),realizations,pending:false,archived:false,freqLog:[]});
const mkProfile=o=>Object.assign({id:uid(),archived:false,avatar:{},birth:'',sex:'',info:{},notes:'',cares:[],treatments:[],weights:[],appointments:[]},o);
const W=(d,kg,note)=>({id:uid(),date:D(d),kg,note:note||''});

function seed(){
  const camille=mkProfile({id:'p-camille',type:'adult',name:'Camille',avatar:{kind:'emoji',emoji:'👩',bg:AV_BG[0],acc:''}});
  camille.cares=[
    mkCare('Ostéopathe','osteo',Y1,M1,[R('18/08/2023'),R('23/07/2024'),R('21/07/2025'),R('20/07/2026')]),
    mkCare('Prises de sang','sang',Y1,M1,[R('15/12/2025'),R('03/06/2026'),R('24/10/2026')]),
    mkCare('Gynécologue','gyneco',Y1,{n:6,unit:'m'},[R('28/08/2023'),R('23/07/2024','Frottis'),R('04/08/2025'),R('27/08/2026','Frottis'),R('28/09/2026','Examen / échographie')]),
    mkCare('Dentiste','dentiste',Y1,M1,[R('29/06/2026')]),
    mkCare('Ophtalmologue','ophtalmo',{n:5,unit:'y'},{n:6,unit:'m'},[R('01/08/2022','Validité de 5 ans. Date exacte non renseignée (08/2022).')]),
    mkCare('Lunettes','lunettes',{n:2,unit:'y'},{n:2,unit:'m'},[R('06/09/2024'),R('16/06/2026')])
  ];
  const poki=mkProfile({id:'p-poki',type:'dog',name:'Poki',avatar:{kind:'emoji',emoji:'🐶',bg:AV_BG[1],acc:''},info:{species:'Chien'}});
  poki.cares=[
    mkCare('Vaccination antirabique','vaccin',{n:3,unit:'y'},M1,[R('09/10/2023'),R('09/10/2026')]),
    mkCare('Vaccinations annuelles','vaccin',Y1,M1,[R('30/10/2023','Avec rappel'),R('18/10/2024'),R('07/10/2025'),R('09/10/2026')]),
    mkCare('Vermifuge','vermifuge',{n:3,unit:'m'},{n:2,unit:'w'},[R('23/04/2026'),R('10/10/2026')]),
    mkCare('Antiparasitaires','antiparasitaire',{n:3,unit:'m'},{n:2,unit:'w'},[R('21/04/2026'),R('12/10/2026')])
  ];
  poki.weights=[W('09/10/2026',17)];
  const herc=mkProfile({id:'p-hercule',type:'horse',name:'Hercule',avatar:{kind:'emoji',emoji:'🐴',bg:AV_BG[3],acc:''},info:{species:'Cheval',size:'1,64 m'}});
  const mar=mkCare('Maréchal-ferrant','marechal',{n:6,unit:'w'},{n:2,unit:'w'},[R('04/02/2026','Parage'),R('25/03/2026'),R('28/04/2026'),R('01/06/2026','Parage'),R('17/07/2026'),R('25/08/2026'),R('07/10/2026')]);
  herc.cares=[
    mar,
    mkCare('Vermifuge','vermifuge',{n:6,unit:'m'},M1,['21/01/2022','17/10/2022','30/03/2023','01/11/2023','25/03/2024','30/11/2024','06/01/2025','01/08/2025','01/01/2026','01/08/2026'].map(d=>R(d))),
    mkCare('Dentiste équin','dentiste-eq',Y1,{n:3,unit:'m'},['14/01/2022','04/04/2023','21/03/2024','03/12/2024','23/01/2026'].map(d=>R(d)))
  ];
  herc.weights=[W('03/04/2025',490),W('28/08/2025',530),W('01/01/2026',530)];
  herc.appointments=[{id:uid(),careId:mar.id,title:'',date:'2026-11-18',time:'10:30',place:'À l’écurie',note:'',status:'planned',reminders:AR(),inCalendar:false}];
  const f1={id:'f1',name:'Famille de Camille',theme:{...PALETTES[0]},profiles:[camille,poki,herc],
    users:[{email:'demo@exemple.fr',name:'Camille',role:'admin'}],
    invites:[{id:uid(),email:'partenaire@exemple.fr',role:'editor',status:'pending',date:realToday(),code:'K7Q2-M9XA'}],
    cats:[],settings:{apptDefaults:AR(),showReminders:true}};
  f1.contacts=[
    {id:'k-martin',kind:'doctor',name:'Dr Claire Martin',specialty:'Médecin généraliste',phone:'01 23 45 67 89',email:'',address:'12 rue des Lilas, 75011 Paris',notes:''},
    {id:'k-tilleuls',kind:'vet',name:'Clinique vétérinaire des Tilleuls',specialty:'Chiens, chats',phone:'01 98 76 54 32',email:'contact@tilleuls.exemple',address:'3 avenue des Tilleuls, 92100 Boulogne',notes:'Urgences le week-end sur rendez-vous'},
    {id:'k-ecurie',kind:'place',name:'Écurie du Moulin',specialty:'Pension de Hercule',phone:'',email:'',address:'Chemin du Moulin, 78120 Rambouillet',notes:''}
  ];
  poki.cares[0].proId='k-tilleuls';poki.cares[0].pro='Clinique vétérinaire des Tilleuls';
  const julie=mkProfile({id:'p-julie',type:'adult',name:'Julie',avatar:{kind:'emoji',emoji:'👩‍🦰',bg:AV_BG[4],acc:''}});
  julie.cares=[mkCare('Dentiste','dentiste',Y1,M1,[R('12/03/2026')])];
  const moust=mkProfile({id:'p-moust',type:'cat',name:'Moustache',avatar:{kind:'emoji',emoji:'🐈',bg:AV_BG[2],acc:'🎀'},info:{species:'Chat'}});
  moust.cares=[mkCare('Vaccination annuelle','vaccin',Y1,M1,[R('03/02/2026')])];
  moust.weights=[W('03/02/2026',4.2),W('15/09/2026',4.5)];
  const f2={id:'f2',name:'Famille Lambert',theme:{...PALETTES.find(x=>x.id==='peche')},profiles:[julie,moust],
    users:[{email:'lambert@exemple.fr',name:'Julie',role:'admin'}],invites:[],cats:[],settings:{apptDefaults:AR(),showReminders:true}};
  return {v:1,accounts:[{email:'demo@exemple.fr',password:'demo',name:'Camille',familyId:'f1'},{email:'lambert@exemple.fr',password:'demo',name:'Julie',familyId:'f2'}],
    families:{f1,f2},session:null,simToday:null,mode:'light'};
}
const KEY='carnet-sante-familial-v1';
const PKEY='carnet-prefs-v1';
function cloudInit(){let p={};try{p=JSON.parse(localStorage.getItem(PKEY)||'{}')}catch(e){}
  return {v:1,accounts:[],families:{},session:null,simToday:null,mode:p.mode||'light',modeSet:!!p.modeSet,seen:!!p.seen}}
function loadDb(){
  try{const s=localStorage.getItem(KEY);if(s){const d=JSON.parse(s);if(d&&d.families){if(!d.modeSet)d.mode='light';Object.values(d.families).forEach(f=>{if(f.theme&&f.theme.id==='brume'){f.theme.id='sauge';f.theme.name='Vert sauge et crème'}});return d}}}catch(e){}
  return seed();
}
const F=d=>d.families[d.session.familyId];
const P=(d,pid)=>F(d).profiles.find(x=>x.id===pid);

function collect(fam,today){
  const out=[];const seenG=new Set();
  for(const p of fam.profiles){
    if(p.archived)continue;
    for(const c of p.cares){
      if(c.archived)continue;
      const i=careInfo(c,p.appointments,today);
      if(['overdue','remind','pending','toConfirm'].includes(i.status))out.push({kind:'care',p,c,i,sort:i.status==='overdue'?0:1,date:i.appt?i.appt.date:(i.due||today)});
    }
    for(const a of p.appointments){
      if(a.status!=='planned'||a.date<today)continue;
      if(a.groupId){if(seenG.has(a.groupId))continue;seenG.add(a.groupId)}
      const act=(a.reminders||[]).filter(r=>r.on&&addUnit(a.date,-r.days,'d')<=today);
      if(act.length){const c=p.cares.find(x=>x.id===a.careId);
        const names=a.groupId?fam.profiles.filter(q=>!q.archived&&q.appointments.some(y=>y.groupId===a.groupId&&y.status==='planned')).map(q=>q.name):[p.name];
        out.push({kind:'appt',p,c,a,names,sort:2,date:a.date,days:diffDays(a.date,today)})}
    }
    for(const t of p.treatments||[]){
      if(t.status==='active'&&t.remind&&t.remind.on)out.push({kind:'dose',p,t,sort:3,date:today});
    }
  }
  return out.sort((x,y)=>x.sort-y.sort||(x.date<y.date?-1:x.date>y.date?1:0));
}
/* Rendez-vous commun à plusieurs membres (même groupId) : un seul élément, avec tous ses membres (ps) et rendez-vous (as) */
function groupAppts(items){const out=[],seen={};items.forEach(x=>{const g=x.a.groupId;if(g&&seen[g]){seen[g].ps.push(x.p);seen[g].as.push(x.a);return}const y={...x,ps:[x.p],as:[x.a]};if(g)seen[g]=y;out.push(y)});return out}
const andJoin=l=>l.length>1?l.slice(0,-1).join(', ')+' et '+l[l.length-1]:(l[0]||'');
const whoOf=x=>andJoin((x.ps||[x.p]).map(p=>p.name));
const upcomingAppts=(fam,today)=>groupAppts(fam.profiles.filter(p=>!p.archived).flatMap(p=>p.appointments.filter(a=>a.status==='planned').map(a=>({p,a}))).sort((x,y)=>(x.a.date+(x.a.time||''))<(y.a.date+(y.a.time||''))?-1:1));
const apptTitle=(a,p)=>a.title||((p.cares.find(c=>c.id===a.careId)||{}).name)||'Rendez-vous';
const lastWeight=p=>[...(p.weights||[])].sort((a,b)=>a.date<b.date?1:-1)[0];
function subtitle(p,today){
  const t=TYPES[p.type];let age=ageStr(p.birth,today);if(age&&p.birthApprox)age='≈ '+age;
  if(t.human)return [t.label,age].filter(Boolean).join(' · ');
  return [p.info.species||t.species||t.label,p.info.breed,age].filter(Boolean).join(' · ');
}
function readPhoto(file,cb){
  const fr=new FileReader();
  fr.onload=()=>{const img=new Image();img.onload=()=>{
    const s=256,c=document.createElement('canvas');c.width=c.height=s;
    const x=c.getContext('2d'),r=Math.max(s/img.width,s/img.height),w=img.width*r,h=img.height*r;
    x.drawImage(img,(s-w)/2,(s-h)/2,w,h);cb(c.toDataURL('image/jpeg',.82));
  };img.src=fr.result};
  fr.readAsDataURL(file);
}
function icsFor(a,p,title){
  const d=a.date.replace(/-/g,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Carnet de santé familial//FR','BEGIN:VEVENT','UID:'+a.id+'@carnet-sante','SUMMARY:'+title+' ('+p.name+')'];
  if(a.time){
    const h=parseInt(a.time.slice(0,2),10),m=a.time.slice(3,5);
    lines.push('DTSTART;TZID=Europe/Paris:'+d+'T'+a.time.replace(':','')+'00','DTEND;TZID=Europe/Paris:'+d+'T'+pad(Math.min(h+1,23))+m+'00');
  }else lines.push('DTSTART;VALUE=DATE:'+d);
  if(a.place)lines.push('LOCATION:'+a.place);
  (a.reminders||[]).filter(r=>r.on).forEach(r=>lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Rappel','TRIGGER:-P'+r.days+'D','END:VALARM'));
  lines.push('END:VEVENT','END:VCALENDAR');
  return lines.join('\n');
}

/* Icônes : Font Awesome Free (licence CC BY 4.0, fontawesome.com), intégrées en SVG */
const FAI={"virus":["0 0 512 512", "M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 11.5c0 49.9-60.3 74.9-95.6 39.6L120.2 75C107.7 62.5 87.5 62.5 75 75s-12.5 32.8 0 45.3l8.2 8.2C118.4 163.7 93.4 224 43.5 224L32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l11.5 0c49.9 0 74.9 60.3 39.6 95.6L75 391.8c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l8.2-8.2c35.3-35.3 95.6-10.3 95.6 39.6l0 11.5c0 17.7 14.3 32 32 32s32-14.3 32-32l0-11.5c0-49.9 60.3-74.9 95.6-39.6l8.2 8.2c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-8.2-8.2c-35.3-35.3-10.3-95.6 39.6-95.6l11.5 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-11.5 0c-49.9 0-74.9-60.3-39.6-95.6l8.2-8.2c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-8.2 8.2C348.3 118.4 288 93.4 288 43.5L288 32zM176 224a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm128 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"],"shield-virus":["0 0 512 512", "M269.4 2.9C265.2 1 260.7 0 256 0s-9.2 1-13.4 2.9L54.3 82.8c-22 9.3-38.4 31-38.3 57.2c.5 99.2 41.3 280.7 213.6 363.2c16.7 8 36.1 8 52.8 0C454.7 420.7 495.5 239.2 496 140c.1-26.2-16.3-47.9-38.3-57.2L269.4 2.9zM256 112c8.8 0 16 7.2 16 16c0 33 39.9 49.5 63.2 26.2c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6C334.5 200.1 351 240 384 240c8.8 0 16 7.2 16 16s-7.2 16-16 16c-33 0-49.5 39.9-26.2 63.2c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0C311.9 334.5 272 351 272 384c0 8.8-7.2 16-16 16s-16-7.2-16-16c0-33-39.9-49.5-63.2-26.2c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6C177.5 311.9 161 272 128 272c-8.8 0-16-7.2-16-16s7.2-16 16-16c33 0 49.5-39.9 26.2-63.2c-6.2-6.2-6.2-16.4 0-22.6s16.4-6.2 22.6 0C200.1 177.5 240 161 240 128c0-8.8 7.2-16 16-16zM232 256a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm72 32a16 16 0 1 0 -32 0 16 16 0 1 0 32 0z"],"hands":["0 0 576 512", "M544 160l-.1 72.6c-.1 52.2-24 101-64 133.1c.1-1.9 .1-3.8 .1-5.7l0-8c0-71.8-37-138.6-97.9-176.7l-60.2-37.6c-8.6-5.4-17.9-8.4-27.3-9.4L248.7 48.8c-6.6-11.5-2.7-26.2 8.8-32.8s26.2-2.7 32.8 8.8l78 135.1c3.3 5.7 10.7 7.7 16.4 4.4s7.7-10.7 4.4-16.4l-62-107.4c-6.6-11.5-2.7-26.2 8.8-32.8S362 5 368.6 16.5l68 117.8s0 0 0 0s0 0 0 0l43.3 75L480 160c0-17.7 14.4-32 32-32s32 14.4 32 32zM243.9 88.5L268.5 131c-13.9 4.5-26.4 13.7-34.7 27c-.9 1.4-1.7 2.9-2.5 4.4l-28.9-50c-6.6-11.5-2.7-26.2 8.8-32.8s26.2-2.7 32.8 8.8zm-46.4 63.7l26.8 46.4c.6 6 2.1 11.8 4.3 17.4l-4.7 0-13.3 0s0 0 0 0L179 216l-23-39.8c-6.6-11.5-2.7-26.2 8.8-32.8s26.2-2.7 32.8 8.8zM260.9 175c9.4-15 29.1-19.5 44.1-10.2l60.2 37.6C416.7 234.7 448 291.2 448 352l0 8c0 83.9-68.1 152-152 152l-176 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l92 0c6.6 0 12-5.4 12-12s-5.4-12-12-12L88 440c-13.3 0-24-10.7-24-24s10.7-24 24-24l124 0c6.6 0 12-5.4 12-12s-5.4-12-12-12L56 368c-13.3 0-24-10.7-24-24s10.7-24 24-24l156 0c6.6 0 12-5.4 12-12s-5.4-12-12-12L88 296c-13.3 0-24-10.7-24-24s10.7-24 24-24l136 0s0 0 0 0s0 0 0 0l93.2 0L271 219.1c-15-9.4-19.5-29.1-10.2-44.1z"],"hand-holding-hand":["0 0 576 512", "M7.8 207.7c-13.1-17.8-9.3-42.8 8.5-55.9L142.9 58.5C166.2 41.3 194.5 32 223.5 32L384 32l160 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l-36.8 0-44.9 36c-22.7 18.2-50.9 28-80 28L304 224l-16 0-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0 16 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-120.6 0L63.7 216.2c-17.8 13.1-42.8 9.3-55.9-8.5zM382.4 160c0 0 0 0 0 0l.9 0c-.3 0-.6 0-.9 0zM568.2 304.3c13.1 17.8 9.3 42.8-8.5 55.9L433.1 453.5c-23.4 17.2-51.6 26.5-80.7 26.5L192 480 32 480c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l36.8 0 44.9-36c22.7-18.2 50.9-28 80-28l78.3 0 16 0 64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0-16 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l120.6 0 119.7-88.2c17.8-13.1 42.8-9.3 55.9 8.5zM193.6 352c0 0 0 0 0 0l-.9 0c.3 0 .6 0 .9 0z"],"shoe-prints":["0 0 640 512", "M416 0C352.3 0 256 32 256 32l0 128c48 0 76 16 104 32s56 32 104 32c56.4 0 176-16 176-96S512 0 416 0zM128 96c0 35.3 28.7 64 64 64l32 0 0-128-32 0c-35.3 0-64 28.7-64 64zM288 512c96 0 224-48 224-128s-119.6-96-176-96c-48 0-76 16-104 32s-56 32-104 32l0 128s96.3 32 160 32zM0 416c0 35.3 28.7 64 64 64l32 0 0-128-32 0c-35.3 0-64 28.7-64 64z"],"socks":["0 0 512 512", "M175.2 476.6c-9.7-18-15.2-38.7-15.2-60.6c0-40.3 19-78.2 51.2-102.4l64-48c8.1-6 12.8-15.5 12.8-25.6l0-144L128 96l0 144c0 20.1-9.5 39.1-25.6 51.2l-64 48C14.2 357.3 0 385.8 0 416c0 53 43 96 96 96c20.8 0 41-6.7 57.6-19.2l21.6-16.2zM128 64l160 0 0-16c0-14.5 3.9-28.2 10.7-39.9C291 3 281.9 0 272 0L176 0c-26.5 0-48 21.5-48 48l0 16zM320 96l0 144c0 20.1-9.5 39.1-25.6 51.2l-64 48C206.2 357.3 192 385.8 192 416c0 53 43 96 96 96c20.8 0 41-6.7 57.6-19.2l115.2-86.4C493 382.2 512 344.3 512 304l0-208L320 96zM512 64l0-16c0-26.5-21.5-48-48-48L368 0c-26.5 0-48 21.5-48 48l0 16 192 0z"],"horse-head":["0 0 640 512", "M64 464l0-147.1c0-108.4 68.3-205.1 170.5-241.3L404.2 15.5C425.6 7.9 448 23.8 448 46.4c0 11-5.5 21.2-14.6 27.3L400 96c48.1 0 91.2 29.8 108.1 74.9l48.6 129.5c11.8 31.4 4.1 66.8-19.6 90.5c-16 16-37.8 25.1-60.5 25.1l-3.4 0c-26.1 0-50.9-11.6-67.6-31.7l-32.3-38.7c-11.7 4.1-24.2 6.4-37.3 6.4c0 0 0 0-.1 0c0 0 0 0 0 0c-6.3 0-12.5-.5-18.6-1.5c-3.6-.6-7.2-1.4-10.7-2.3c0 0 0 0 0 0c-28.9-7.8-53.1-26.8-67.8-52.2c-4.4-7.6-14.2-10.3-21.9-5.8s-10.3 14.2-5.8 21.9c24 41.5 68.3 70 119.3 71.9l47.2 70.8c4 6.1 6.2 13.2 6.2 20.4c0 20.3-16.5 36.8-36.8 36.8L112 512c-26.5 0-48-21.5-48-48zM392 224a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"],"hammer":["0 0 576 512", "M413.5 237.5c-28.2 4.8-58.2-3.6-80-25.4l-38.1-38.1C280.4 159 272 138.8 272 117.6l0-12.1L192.3 62c-5.3-2.9-8.6-8.6-8.3-14.7s3.9-11.5 9.5-14l47.2-21C259.1 4.2 279 0 299.2 0l18.1 0c36.7 0 72 14 98.7 39.1l44.6 42c24.2 22.8 33.2 55.7 26.6 86L503 183l8-8c9.4-9.4 24.6-9.4 33.9 0l24 24c9.4 9.4 9.4 24.6 0 33.9l-88 88c-9.4 9.4-24.6 9.4-33.9 0l-24-24c-9.4-9.4-9.4-24.6 0-33.9l8-8-17.5-17.5zM27.4 377.1L260.9 182.6c3.5 4.9 7.5 9.6 11.8 14l38.1 38.1c6 6 12.4 11.2 19.2 15.7L134.9 484.6c-14.5 17.4-36 27.4-58.6 27.4C34.1 512 0 477.8 0 435.7c0-22.6 10.1-44.1 27.4-58.6z"],"brush":["0 0 384 512", "M162.4 6c-1.5-3.6-5-6-8.9-6l-19 0c-3.9 0-7.5 2.4-8.9 6L104.9 57.7c-3.2 8-14.6 8-17.8 0L66.4 6c-1.5-3.6-5-6-8.9-6L48 0C21.5 0 0 21.5 0 48L0 224l0 22.4L0 256l9.6 0 364.8 0 9.6 0 0-9.6 0-22.4 0-176c0-26.5-21.5-48-48-48L230.5 0c-3.9 0-7.5 2.4-8.9 6L200.9 57.7c-3.2 8-14.6 8-17.8 0L162.4 6zM0 288l0 32c0 35.3 28.7 64 64 64l64 0 0 64c0 35.3 28.7 64 64 64s64-28.7 64-64l0-64 64 0c35.3 0 64-28.7 64-64l0-32L0 288zM192 432a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"],"person-walking":["0 0 320 512", "M160 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM126.5 199.3c-1 .4-1.9 .8-2.9 1.2l-8 3.5c-16.4 7.3-29 21.2-34.7 38.2l-2.6 7.8c-5.6 16.8-23.7 25.8-40.5 20.2s-25.8-23.7-20.2-40.5l2.6-7.8c11.4-34.1 36.6-61.9 69.4-76.5l8-3.5c20.8-9.2 43.3-14 66.1-14c44.6 0 84.8 26.8 101.9 67.9L281 232.7l21.4 10.7c15.8 7.9 22.2 27.1 14.3 42.9s-27.1 22.2-42.9 14.3L247 287.3c-10.3-5.2-18.4-13.8-22.8-24.5l-9.6-23-19.3 65.5 49.5 54c5.4 5.9 9.2 13 11.2 20.8l23 92.1c4.3 17.1-6.1 34.5-23.3 38.8s-34.5-6.1-38.8-23.3l-22-88.1-70.7-77.1c-14.8-16.1-20.3-38.6-14.7-59.7l16.9-63.5zM68.7 398l25-62.4c2.1 3 4.5 5.8 7 8.6l40.7 44.4-14.5 36.2c-2.4 6-6 11.5-10.6 16.1L54.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L68.7 398z"],"dumbbell":["0 0 640 512", "M96 64c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 160 0 64 0 160c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-64-32 0c-17.7 0-32-14.3-32-32l0-64c-17.7 0-32-14.3-32-32s14.3-32 32-32l0-64c0-17.7 14.3-32 32-32l32 0 0-64zm448 0l0 64 32 0c17.7 0 32 14.3 32 32l0 64c17.7 0 32 14.3 32 32s-14.3 32-32 32l0 64c0 17.7-14.3 32-32 32l-32 0 0 64c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-160 0-64 0-160c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32zM416 224l0 64-192 0 0-64 192 0z"],"lungs":["0 0 640 512", "M320 0c17.7 0 32 14.3 32 32l0 132.1c0 16.4 8.4 31.7 22.2 40.5l9.8 6.2 0-45.5C384 127 415 96 453.3 96c21.7 0 42.8 10.2 55.8 28.8c15.4 22.1 44.3 65.4 71 116.9c26.5 50.9 52.4 112.5 59.6 170.3c.2 1.3 .2 2.6 .2 4l0 7c0 49.1-39.8 89-89 89c-7.3 0-14.5-.9-21.6-2.7l-72.7-18.2C414 480.5 384 442.1 384 398l0-73 90.5 57.6c7.5 4.7 17.3 2.5 22.1-4.9s2.5-17.3-4.9-22.1L384 287.1l0-.4-44.1-28.1c-7.3-4.6-13.9-10.1-19.9-16.1c-5.9 6-12.6 11.5-19.9 16.1L256 286.7 161.2 347l-13.5 8.6c0 0 0 0-.1 0c-7.4 4.8-9.6 14.6-4.8 22.1c4.7 7.5 14.6 9.7 22.1 4.9l91.1-58 0 73.4c0 44.1-30 82.5-72.7 93.1l-72.7 18.2c-7.1 1.8-14.3 2.7-21.6 2.7c-49.1 0-89-39.8-89-89l0-7c0-1.3 .1-2.7 .2-4c7.2-57.9 33.1-119.4 59.6-170.3c26.8-51.5 55.6-94.8 71-116.9c13-18.6 34-28.8 55.8-28.8C225 96 256 127 256 165.3l0 45.5 9.8-6.2c13.8-8.8 22.2-24.1 22.2-40.5L288 32c0-17.7 14.3-32 32-32z"],"thermometer":["0 0 512 512", "M96 382.1l0-88.8c0-14.9 5.9-29.1 16.4-39.6l27.3-27.3 57 57c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6l-57-57 41.4-41.4 57 57c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6l-57-57 41.4-41.4 57 57c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6l-57-57 45.5-45.5C355.2 10.9 381.4 0 408.8 0C465.8 0 512 46.2 512 103.2c0 27.4-10.9 53.6-30.2 73L258.3 399.6c-10.5 10.5-24.7 16.4-39.6 16.4l-88.8 0L41 505c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l89-89z"],"vial":["0 0 512 512", "M342.6 9.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l9.4 9.4L28.1 342.6C10.1 360.6 0 385 0 410.5L0 416c0 53 43 96 96 96l5.5 0c25.5 0 49.9-10.1 67.9-28.1L448 205.3l9.4 9.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-32-32-96-96-32-32zM205.3 256L352 109.3 402.7 160l-96 96-101.5 0z"],"baby":["0 0 448 512", "M152 88a72 72 0 1 1 144 0A72 72 0 1 1 152 88zM39.7 144.5c13-17.9 38-21.8 55.9-8.8L131.8 162c26.8 19.5 59.1 30 92.2 30s65.4-10.5 92.2-30l36.2-26.4c17.9-13 42.9-9 55.9 8.8s9 42.9-8.8 55.9l-36.2 26.4c-13.6 9.9-28.1 18.2-43.3 25l0 36.3-192 0 0-36.3c-15.2-6.7-29.7-15.1-43.3-25L48.5 200.3c-17.9-13-21.8-38-8.8-55.9zm89.8 184.8l60.6 53-26 37.2 24.3 24.3c15.6 15.6 15.6 40.9 0 56.6s-40.9 15.6-56.6 0l-48-48C70 438.6 68.1 417 79.2 401.1l50.2-71.8zm128.5 53l60.6-53 50.2 71.8c11.1 15.9 9.2 37.5-4.5 51.2l-48 48c-15.6 15.6-40.9 15.6-56.6 0s-15.6-40.9 0-56.6L284 419.4l-26-37.2z"],"person-pregnant":["0 0 384 512", "M192 0a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM120 383c-13.8-3.6-24-16.1-24-31l0-55.1-4.6 7.6c-9.1 15.1-28.8 20-43.9 10.9s-20-28.8-10.9-43.9l58.3-97c15-24.9 40.3-41.5 68.7-45.6c4.1-.6 8.2-1 12.5-1l1.1 0 12.5 0 2.4 0c1.4 0 2.8 .1 4.1 .3c35.7 2.9 65.4 29.3 72.1 65l6.1 32.5c44.3 8.6 77.7 47.5 77.7 94.3l0 32c0 17.7-14.3 32-32 32l-16 0-40 0 0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-8 0-8 0 0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-97z"],"hand-dots":["0 0 512 512", "M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 272c0 1.5 0 3.1 .1 4.6L67.6 283c-16-15.2-41.3-14.6-56.6 1.4s-14.6 41.3 1.4 56.6L124.8 448c43.1 41.1 100.4 64 160 64l19.2 0c97.2 0 176-78.8 176-176l0-208c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 176c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208zM240 336a16 16 0 1 1 32 0 16 16 0 1 1 -32 0zm80 16a16 16 0 1 1 0 32 16 16 0 1 1 0-32zm48-16a16 16 0 1 1 32 0 16 16 0 1 1 -32 0zm-16 80a16 16 0 1 1 0 32 16 16 0 1 1 0-32zM240 432a16 16 0 1 1 32 0 16 16 0 1 1 -32 0zm-48-48a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"],"mortar-pestle":["0 0 512 512", "M504.3 11.1C493.3-1.6 474.5-3.7 461 6.2L252.3 160l144.9 0L502.6 54.6c11.8-11.8 12.6-30.8 1.6-43.5zM32 192c-17.7 0-32 14.3-32 32s14.3 32 32 32c0 82.5 43.4 147.7 123.9 176.2c-11.1 13.9-19.4 30.3-23.9 48.1C127.6 497.4 142.3 512 160 512l192 0c17.7 0 32.4-14.6 28.1-31.7c-4.5-17.8-12.8-34.1-23.9-48.1C436.6 403.7 480 338.5 480 256c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 192z"],"user-nurse":["0 0 448 512", "M96 128l0-57.8c0-13.3 8.3-25.3 20.8-30l96-36c7.2-2.7 15.2-2.7 22.5 0l96 36c12.5 4.7 20.8 16.6 20.8 30l0 57.8-.3 0c.2 2.6 .3 5.3 .3 8l0 40c0 70.7-57.3 128-128 128s-128-57.3-128-128l0-40c0-2.7 .1-5.4 .3-8l-.3 0zm48 48c0 44.2 35.8 80 80 80s80-35.8 80-80l0-16-160 0 0 16zM111.9 327.7c10.5-3.4 21.8 .4 29.4 8.5l71 75.5c6.3 6.7 17 6.7 23.3 0l71-75.5c7.6-8.1 18.9-11.9 29.4-8.5C401 348.6 448 409.4 448 481.3c0 17-13.8 30.7-30.7 30.7L30.7 512C13.8 512 0 498.2 0 481.3c0-71.9 47-132.7 111.9-153.6zM208 48l0 16-16 0c-4.4 0-8 3.6-8 8l0 16c0 4.4 3.6 8 8 8l16 0 0 16c0 4.4 3.6 8 8 8l16 0c4.4 0 8-3.6 8-8l0-16 16 0c4.4 0 8-3.6 8-8l0-16c0-4.4-3.6-8-8-8l-16 0 0-16c0-4.4-3.6-8-8-8l-16 0c-4.4 0-8 3.6-8 8z"],"cow":["0 0 640 512", "M96 224l0 32 0 160c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-88.2c9.9 6.6 20.6 12 32 16.1l0 24.2c0 8.8 7.2 16 16 16s16-7.2 16-16l0-16.9c5.3 .6 10.6 .9 16 .9s10.7-.3 16-.9l0 16.9c0 8.8 7.2 16 16 16s16-7.2 16-16l0-24.2c11.4-4 22.1-9.4 32-16.1l0 88.2c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-160 32 32 0 49.5c0 9.5 2.8 18.7 8.1 26.6L530 427c8.8 13.1 23.5 21 39.3 21c22.5 0 41.9-15.9 46.3-38l20.3-101.6c2.6-13-.3-26.5-8-37.3l-3.9-5.5 0-81.6c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 14.4-52.9-74.1C496 86.5 452.4 64 405.9 64L272 64l-16 0-64 0-48 0C77.7 64 24 117.7 24 184l0 54C9.4 249.8 0 267.8 0 288l0 17.6c0 8 6.4 14.4 14.4 14.4C46.2 320 72 294.2 72 262.4l0-6.4 0-32 0-40c0-24.3 12.1-45.8 30.5-58.9C98.3 135.9 96 147.7 96 160l0 64zM560 336a16 16 0 1 1 32 0 16 16 0 1 1 -32 0zM166.6 166.6c-4.2-4.2-6.6-10-6.6-16c0-12.5 10.1-22.6 22.6-22.6l178.7 0c12.5 0 22.6 10.1 22.6 22.6c0 6-2.4 11.8-6.6 16l-23.4 23.4C332.2 211.8 302.7 224 272 224s-60.2-12.2-81.9-33.9l-23.4-23.4z"],"feather":["0 0 512 512", "M278.5 215.6L23 471c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l57-57 68 0c49.7 0 97.9-14.4 139-41c11.1-7.2 5.5-23-7.8-23c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l81-24.3c2.5-.8 4.8-2.1 6.7-4l22.4-22.4c10.1-10.1 2.9-27.3-11.3-27.3l-32.2 0c-5.1 0-9.2-4.1-9.2-9.2c0-4.1 2.7-7.6 6.5-8.8l112-33.6c4-1.2 7.4-3.9 9.3-7.7C506.4 207.6 512 184.1 512 160c0-41-16.3-80.3-45.3-109.3l-5.5-5.5C432.3 16.3 393 0 352 0s-80.3 16.3-109.3 45.3L139 149C91 197 64 262.1 64 330l0 55.3L253.6 195.8c6.2-6.2 16.4-6.2 22.6 0c5.4 5.4 6.1 13.6 2.2 19.8z"],"fish":["0 0 576 512", "M180.5 141.5C219.7 108.5 272.6 80 336 80s116.3 28.5 155.5 61.5c39.1 33 66.9 72.4 81 99.8c4.7 9.2 4.7 20.1 0 29.3c-14.1 27.4-41.9 66.8-81 99.8C452.3 403.5 399.4 432 336 432s-116.3-28.5-155.5-61.5c-16.2-13.7-30.5-28.5-42.7-43.1L48.1 379.6c-12.5 7.3-28.4 5.3-38.7-4.9S-3 348.7 4.2 336.1L50 256 4.2 175.9c-7.2-12.6-5-28.4 5.3-38.6s26.1-12.2 38.7-4.9l89.7 52.3c12.2-14.6 26.5-29.4 42.7-43.1zM448 256a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"],"seedling":["0 0 512 512", "M512 32c0 113.6-84.6 207.5-194.2 222c-7.1-53.4-30.6-101.6-65.3-139.3C290.8 46.3 364 0 448 0l32 0c17.7 0 32 14.3 32 32zM0 96C0 78.3 14.3 64 32 64l32 0c123.7 0 224 100.3 224 224l0 32 0 160c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-160C100.3 320 0 219.7 0 96z"],"apple-whole":["0 0 448 512", "M224 112c-8.8 0-16-7.2-16-16l0-16c0-44.2 35.8-80 80-80l16 0c8.8 0 16 7.2 16 16l0 16c0 44.2-35.8 80-80 80l-16 0zM0 288c0-76.3 35.7-160 112-160c27.3 0 59.7 10.3 82.7 19.3c18.8 7.3 39.9 7.3 58.7 0c22.9-8.9 55.4-19.3 82.7-19.3c76.3 0 112 83.7 112 160c0 128-80 224-160 224c-16.5 0-38.1-6.6-51.5-11.3c-8.1-2.8-16.9-2.8-25 0c-13.4 4.7-35 11.3-51.5 11.3C80 512 0 416 0 288z"],"wheat-awn":["0 0 512 512", "M505 41c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L383 95c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l88-88zM305.5 27.3c-6.2-6.2-16.4-6.2-22.6 0L271.5 38.6c-37.5 37.5-37.5 98.3 0 135.8l10.4 10.4-30.5 30.5c-3.4-27.3-15.5-53.8-36.5-74.8l-11.3-11.3c-6.2-6.2-16.4-6.2-22.6 0l-11.3 11.3c-37.5 37.5-37.5 98.3 0 135.8l10.4 10.4-30.5 30.5c-3.4-27.3-15.5-53.8-36.5-74.8L101.8 231c-6.2-6.2-16.4-6.2-22.6 0L67.9 242.3c-37.5 37.5-37.5 98.3 0 135.8l10.4 10.4L9.4 457.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l68.9-68.9 12.2 12.2c37.5 37.5 98.3 37.5 135.8 0l11.3-11.3c6.2-6.2 6.2-16.4 0-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9 12.2 12.2c37.5 37.5 98.3 37.5 135.8 0l11.3-11.3c6.2-6.2 6.2-16.4 0-22.6l-11.3-11.3c-21.8-21.8-49.6-34.1-78.1-36.9l31.9-31.9 12.2 12.2c37.5 37.5 98.3 37.5 135.8 0L486.5 231c6.2-6.2 6.2-16.4 0-22.6L475.2 197c-5.2-5.2-10.6-9.8-16.4-13.9L505 137c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-59.4 59.4c-20.6-4.4-42-3.7-62.3 2.1c6.1-21.3 6.6-43.8 1.4-65.3L409 41c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L329.1 52.9c-3.7-5-7.8-9.8-12.4-14.3L305.5 27.3z"],"mosquito":["0 0 640 512", "M463.7 505.9c9.8-8.9 10.7-24.3 2.1-34.3l-42.1-49 0-54.7c0-5.5-1.8-10.8-5.1-15.1L352 266.3l0-.3L485.4 387.8C542.4 447.6 640 405.2 640 320.6c0-47.9-34-88.3-79.4-94.2l-153-23.9 40.8-40.9c7.8-7.8 9.4-20.1 3.9-29.8L428.5 90.1l38.2-50.9c8-10.6 6.1-25.9-4.3-34.1s-25.2-6.3-33.2 4.4l-48 63.9c-5.9 7.9-6.6 18.6-1.7 27.2L402.2 140 352 190.3l0-38.2c0-14.9-10.2-27.4-24-31l0-57.2c0-4.4-3.6-8-8-8s-8 3.6-8 8l0 57.2c-13.8 3.6-24 16.1-24 31l0 38.1L237.8 140l22.6-39.5c4.9-8.6 4.2-19.3-1.7-27.2l-48-63.9c-8-10.6-22.8-12.6-33.2-4.4s-12.2 23.5-4.3 34.1l38.2 50.9-23.9 41.7c-5.5 9.7-3.9 22 3.9 29.8l40.8 40.9-153 23.9C34 232.3 0 272.7 0 320.6c0 84.6 97.6 127 154.6 67.1L288 266l0 .3-66.5 86.4c-3.3 4.3-5.1 9.6-5.1 15.1l0 54.7-42.1 49c-8.6 10.1-7.7 25.5 2.1 34.3s24.7 7.9 33.4-2.1l48-55.9c3.8-4.4 5.9-10.2 5.9-16.1l0-55.4L288 344.7l0 63.1c0 17.7 14.3 32 32 32s32-14.3 32-32l0-63.1 24.3 31.6 0 55.4c0 5.9 2.1 11.7 5.9 16.1l48 55.9c8.6 10.1 23.6 11 33.4 2.1z"],"spider":["0 0 512 512", "M158.4 32.6c4.8-12.4-1.4-26.3-13.8-31s-26.3 1.4-31 13.8L81.1 100c-7.9 20.7-3 44.1 12.7 59.7l57.4 57.4L70.8 190.3c-2.4-.8-4.3-2.7-5.1-5.1L46.8 128.4C42.6 115.8 29 109 16.4 113.2S-3 131 1.2 143.6l18.9 56.8c5.6 16.7 18.7 29.8 35.4 35.4L116.1 256 55.6 276.2c-16.7 5.6-29.8 18.7-35.4 35.4L1.2 368.4C-3 381 3.8 394.6 16.4 398.8s26.2-2.6 30.4-15.2l18.9-56.8c.8-2.4 2.7-4.3 5.1-5.1l80.4-26.8L93.7 352.3C78.1 368 73.1 391.4 81.1 412l32.5 84.6c4.8 12.4 18.6 18.5 31 13.8s18.5-18.6 13.8-31l-32.5-84.6c-1.1-3-.4-6.3 1.8-8.5L160 353.9c1 52.1 43.6 94.1 96 94.1s95-41.9 96-94.1l32.3 32.3c2.2 2.2 2.9 5.6 1.8 8.5l-32.5 84.6c-4.8 12.4 1.4 26.3 13.8 31s26.3-1.4 31-13.8L430.9 412c7.9-20.7 3-44.1-12.7-59.7l-57.4-57.4 80.4 26.8c2.4 .8 4.3 2.7 5.1 5.1l18.9 56.8c4.2 12.6 17.8 19.4 30.4 15.2s19.4-17.8 15.2-30.4l-18.9-56.8c-5.6-16.7-18.7-29.8-35.4-35.4L395.9 256l60.5-20.2c16.7-5.6 29.8-18.7 35.4-35.4l18.9-56.8c4.2-12.6-2.6-26.2-15.2-30.4s-26.2 2.6-30.4 15.2l-18.9 56.8c-.8 2.4-2.7 4.3-5.1 5.1l-80.4 26.8 57.4-57.4c15.6-15.6 20.6-39 12.7-59.7L398.4 15.4C393.6 3 379.8-3.2 367.4 1.6s-18.5 18.6-13.8 31l32.5 84.6c1.1 3 .4 6.3-1.8 8.5L336 174.1l0-14.1c0-31.8-18.6-59.3-45.5-72.2c-9.1-4.4-18.5 3.3-18.5 13.4l0 10.8c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-10.8c0-10.1-9.4-17.7-18.5-13.4C194.6 100.7 176 128.2 176 160l0 14.1-48.3-48.3c-2.2-2.2-2.9-5.6-1.8-8.5l32.5-84.6z"],"dove":["0 0 512 512", "M160.8 96.5c14 17 31 30.9 49.5 42.2c25.9 15.8 53.7 25.9 77.7 31.6l0-31.5C265.8 108.5 250 71.5 248.6 28c-.4-11.3-7.5-21.5-18.4-24.4c-7.6-2-15.8-.2-21 5.8c-13.3 15.4-32.7 44.6-48.4 87.2zM320 144l0 30.6s0 0 0 0l0 1.3s0 0 0 0l0 32.1c-60.8-5.1-185-43.8-219.3-157.2C97.4 40 87.9 32 76.6 32c-7.9 0-15.3 3.9-18.8 11C46.8 65.9 32 112.1 32 176c0 116.9 80.1 180.5 118.4 202.8L11.8 416.6C6.7 418 2.6 421.8 .9 426.8s-.8 10.6 2.3 14.8C21.7 466.2 77.3 512 160 512c3.6 0 7.2-1.2 10-3.5L245.6 448l74.4 0c88.4 0 160-71.6 160-160l0-160 29.9-44.9c1.3-2 2.1-4.4 2.1-6.8c0-6.8-5.5-12.3-12.3-12.3L400 64c-44.2 0-80 35.8-80 80zm80-16a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"],"kiwi-bird":["0 0 576 512", "M291.2 388.4c31.2-18.8 64.7-36.4 101.1-36.4l55.7 0c4.6 0 9.1-.2 13.6-.7l85.3 121.9c4 5.7 11.3 8.2 17.9 6.1s11.2-8.3 11.2-15.3l0-240c0-70.7-57.3-128-128-128l-55.7 0c-36.4 0-69.9-17.6-101.1-36.4C262.3 42.1 228.3 32 192 32C86 32 0 118 0 224c0 71.1 38.6 133.1 96 166.3L96 456c0 13.3 10.7 24 24 24s24-10.7 24-24l0-46c15.3 3.9 31.4 6 48 6c5.4 0 10.7-.2 16-.7l0 40.7c0 13.3 10.7 24 24 24s24-10.7 24-24l0-50.9c12.4-4.4 24.2-10 35.2-16.7zM448 200a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"],"prescription-bottle-medical":["0 0 384 512", "M0 32C0 14.3 14.3 0 32 0L352 0c17.7 0 32 14.3 32 32l0 32c0 17.7-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64L0 32zm32 96l320 0 0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zM160 240l0 48-48 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l48 0 0 48c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-48 48 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-48 0 0-48c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"],"notes-medical":["0 0 512 512", "M96 352L96 96c0-35.3 28.7-64 64-64l256 0c35.3 0 64 28.7 64 64l0 197.5c0 17-6.7 33.3-18.7 45.3l-58.5 58.5c-12 12-28.3 18.7-45.3 18.7L160 416c-35.3 0-64-28.7-64-64zM272 128c-8.8 0-16 7.2-16 16l0 48-48 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l48 0 0 48c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-48 48 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-48 0 0-48c0-8.8-7.2-16-16-16l-32 0zm24 336c13.3 0 24 10.7 24 24s-10.7 24-24 24l-160 0C60.9 512 0 451.1 0 376L0 152c0-13.3 10.7-24 24-24s24 10.7 24 24l0 224c0 48.6 39.4 88 88 88l160 0z"],"wheelchair":["0 0 512 512", "M192 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM120.5 247.2c12.4-4.7 18.7-18.5 14-30.9s-18.5-18.7-30.9-14C43.1 225.1 0 283.5 0 352c0 88.4 71.6 160 160 160c61.2 0 114.3-34.3 141.2-84.7c6.2-11.7 1.8-26.2-9.9-32.5s-26.2-1.8-32.5 9.9C240 440 202.8 464 160 464C98.1 464 48 413.9 48 352c0-47.9 30.1-88.8 72.5-104.8zM259.8 176l-1.9-9.7c-4.5-22.3-24-38.3-46.8-38.3c-30.1 0-52.7 27.5-46.8 57l23.1 115.5c6 29.9 32.2 51.4 62.8 51.4l5.1 0c.4 0 .8 0 1.3 0l94.1 0c6.7 0 12.6 4.1 15 10.4L402 459.2c6 16.1 23.8 24.6 40.1 19.1l48-16c16.8-5.6 25.8-23.7 20.2-40.5s-23.7-25.8-40.5-20.2l-18.7 6.2-25.5-68c-11.7-31.2-41.6-51.9-74.9-51.9l-68.5 0-9.6-48 63.4 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-76.2 0z"],"person-cane":["0 0 448 512", "M272 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm-8 187.3l47.4 57.1c11.3 13.6 31.5 15.5 45.1 4.2s15.5-31.5 4.2-45.1l-73.7-88.9c-18.2-22-45.3-34.7-73.9-34.7l-35.9 0c-33.7 0-64.9 17.7-82.3 46.6l-58.3 97c-9.1 15.1-4.2 34.8 10.9 43.9s34.8 4.2 43.9-10.9L120 256.9 120 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 16 0 0 128c0 17.7 14.3 32 32 32s32-14.3 32-32l0-244.7zM352 376c0-4.4 3.6-8 8-8s8 3.6 8 8l0 112c0 13.3 10.7 24 24 24s24-10.7 24-24l0-112c0-30.9-25.1-56-56-56s-56 25.1-56 56l0 8c0 13.3 10.7 24 24 24s24-10.7 24-24l0-8z"],"house-medical":["0 0 576 512", "M543.8 287.6c17 0 32-14 32-32.1c1-9-3-17-11-24L309.5 7c-6-5-14-7-21-7s-15 1-22 8L10 231.5c-7 7-10 15-10 24c0 18 14 32.1 32 32.1l32 0 0 160.4c0 35.3 28.7 64 64 64l320.4 0c35.5 0 64.2-28.8 64-64.3l-.7-160.2 32 0zM256 208c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 48 48 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-48 0 0 48c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-48-48 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16l48 0 0-48z"],"truck-medical":["0 0 640 512", "M0 48C0 21.5 21.5 0 48 0L368 0c26.5 0 48 21.5 48 48l0 48 50.7 0c17 0 33.3 6.7 45.3 18.7L589.3 192c12 12 18.7 28.3 18.7 45.3l0 18.7 0 32 0 64c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0c0 53-43 96-96 96s-96-43-96-96l-128 0c0 53-43 96-96 96s-96-43-96-96l-16 0c-26.5 0-48-21.5-48-48L0 48zM416 256l128 0 0-18.7L466.7 160 416 160l0 96zM160 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm368-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM176 80l0 48-48 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l48 0 0 48c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-48 48 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-48 0 0-48c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"],"shield-dog":["0 0 512 512", "M269.4 2.9C265.2 1 260.7 0 256 0s-9.2 1-13.4 2.9L54.3 82.8c-22 9.3-38.4 31-38.3 57.2c.5 99.2 41.3 280.7 213.6 363.2c16.7 8 36.1 8 52.8 0C454.7 420.7 495.5 239.2 496 140c.1-26.2-16.3-47.9-38.3-57.2L269.4 2.9zM160.9 286.2c4.8 1.2 9.9 1.8 15.1 1.8c35.3 0 64-28.7 64-64l0-64 44.2 0c12.1 0 23.2 6.8 28.6 17.7L320 192l64 0c8.8 0 16 7.2 16 16l0 32c0 44.2-35.8 80-80 80l-48 0 0 50.7c0 7.3-5.9 13.3-13.3 13.3c-1.8 0-3.6-.4-5.2-1.1l-98.7-42.3c-6.6-2.8-10.8-9.3-10.8-16.4c0-2.8 .6-5.5 1.9-8l15-30zM160 160l40 0 8 0 0 32 0 32c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-48c0-8.8 7.2-16 16-16zm128 48a16 16 0 1 0 -32 0 16 16 0 1 0 32 0z"],"horseshoe":["0 0 512 512", "M144.7 450.1A210 210 0 1 1 367.3 450.1L318.5 372.1A118 118 0 1 0 193.5 372.1ZM107.7 366.1a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM376.3 366.1a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM78.0 272.0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM406.0 272.0a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM107.7 177.9a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM376.3 177.9a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM180.6 119.9a14 14 0 1 0 28 0a14 14 0 1 0 -28 0ZM303.4 119.9a14 14 0 1 0 28 0a14 14 0 1 0 -28 0Z", "evenodd"],"stethoscope":["0 0 576 512","M32 48C32 21.5 53.5 0 80 0l48 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32 0 0 128c0 53 43 96 96 96s96-43 96-96l0-128-32 0c-17.7 0-32-14.3-32-32S238.3 0 256 0l48 0c26.5 0 48 21.5 48 48l0 144c0 77.4-55 142-128 156.8l0 19.2c0 61.9 50.1 112 112 112s112-50.1 112-112l0-85.5c-37.3-13.2-64-48.7-64-90.5 0-53 43-96 96-96s96 43 96 96c0 41.8-26.7 77.4-64 90.5l0 85.5c0 97.2-78.8 176-176 176S160 465.2 160 368l0-19.2C87 334 32 269.4 32 192L32 48zM480 224a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"],"venus":["0 0 384 512","M80 176a112 112 0 1 1 224 0 112 112 0 1 1 -224 0zM223.9 349.1C305.9 334.1 368 262.3 368 176 368 78.8 289.2 0 192 0S16 78.8 16 176c0 86.3 62.1 158.1 144.1 173.1-.1 1-.1 1.9-.1 2.9l0 64-32 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l32 0 0 32c0 17.7 14.3 32 32 32s32-14.3 32-32l0-32 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-32 0 0-64c0-1 0-1.9-.1-2.9z"],"tooth":["0 0 448 512","M145 5.7L224 32 303 5.7C314.3 1.9 326 0 337.9 0 398.7 0 448 49.3 448 110.1l0 68.5c0 29.4-9.5 58.1-27.2 81.6l-1.1 1.5c-12.9 17.2-21.3 37.4-24.3 58.7L373.7 471.9c-3.3 23-23 40.1-46.2 40.1-22.8 0-42.3-16.5-46-39L261.3 351.6c-3-18.2-18.8-31.6-37.3-31.6s-34.2 13.4-37.3 31.6L166.5 473c-3.8 22.5-23.2 39-46 39-23.2 0-42.9-17.1-46.2-40.1L52.6 320.5c-3-21.3-11.4-41.5-24.3-58.7l-1.1-1.5C9.5 236.7 0 208.1 0 178.7l0-68.5C0 49.3 49.3 0 110.1 0 122 0 133.7 1.9 145 5.7z"],"eye":["0 0 576 512","M288 32c-80.8 0-145.5 36.8-192.6 80.6-46.8 43.5-78.1 95.4-93 131.1-3.3 7.9-3.3 16.7 0 24.6 14.9 35.7 46.2 87.7 93 131.1 47.1 43.7 111.8 80.6 192.6 80.6s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1 3.3-7.9 3.3-16.7 0-24.6-14.9-35.7-46.2-87.7-93-131.1-47.1-43.7-111.8-80.6-192.6-80.6zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64-11.5 0-22.3-3-31.7-8.4-1 10.9-.1 22.1 2.9 33.2 13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-12.2-45.7-55.5-74.8-101.1-70.8 5.3 9.3 8.4 20.1 8.4 31.7z"],"glasses":["0 0 576 512","M143.3 96c-14 0-26.5 9.2-30.6 22.6L70.4 256 224 256c17.7 0 32 14.3 32 32l64 0c0-17.7 14.3-32 32-32l153.6 0-42.3-137.4C459.2 105.2 446.8 96 432.7 96L400 96c-17.7 0-32-14.3-32-32s14.3-32 32-32l32.7 0c42.1 0 79.4 27.5 91.8 67.8l45.4 147.5c4.1 13.2 6.1 26.9 6.1 40.7l0 96c0 53-43 96-96 96l-64 0c-53 0-96-43-96-96l0-32-64 0 0 32c0 53-43 96-96 96l-64 0c-53 0-96-43-96-96l0-96c0-13.8 2.1-27.5 6.1-40.7L51.5 99.8C63.9 59.5 101.1 32 143.3 32L176 32c17.7 0 32 14.3 32 32s-14.3 32-32 32l-32.7 0zM64 320l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64-128 0zm416 96c17.7 0 32-14.3 32-32l0-64-128 0 0 64c0 17.7 14.3 32 32 32l64 0z"],"hand-holding-medical":["0 0 576 512","M240 24c0-13.3 10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 56 56 0c13.3 0 24 10.7 24 24l0 48c0 13.3-10.7 24-24 24l-56 0 0 56c0 13.3-10.7 24-24 24l-48 0c-13.3 0-24-10.7-24-24l0-56-56 0c-13.3 0-24-10.7-24-24l0-48c0-13.3 10.7-24 24-24l56 0 0-56zM66.7 384l42.5-42.5c24-24 56.6-37.5 90.5-37.5L352 304c17.7 0 32 14.3 32 32s-14.3 32-32 32l-72 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l112.6 0 119.7-88.2c17.8-13.1 42.8-9.3 55.9 8.5s9.3 42.8-8.5 55.9L433.1 485.5c-23.4 17.2-51.6 26.5-80.7 26.5L32 512c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l34.7 0z"],"droplet":["0 0 384 512","M192 512C86 512 0 426 0 320 0 228.8 130.2 45.9 166.6-3.5 172.5-11.5 181.8-16 191.8-16l.4 0c10 0 19.3 4.5 25.2 12.5 36.4 49.4 166.6 232.3 166.6 323.5 0 106-86 192-192 192zM112 312c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 75.1 60.9 136 136 136 13.3 0 24-10.7 24-24s-10.7-24-24-24c-48.6 0-88-39.4-88-88z"],"syringe":["0 0 576 512","M497.5-17c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l15 15-46.1 46.1-63-63c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l7 7-78.1 78.1 41 41c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-41-41-46.1 46.1 41 41c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-41-41-37.7 37.7c-10.5 10.5-16.4 24.7-16.4 39.6l0 88.8-57 57c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l57-57 88.8 0c14.9 0 29.1-5.9 39.6-16.4l229.7-229.7 7 7c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-63-63 46.1-46.1 15 15c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-64-64z"],"paw":["0 0 512 512","M234.5 92.9c14.3 42.9-.3 86.2-32.6 96.8s-70.1-15.6-84.4-58.5 .3-86.2 32.6-96.8 70.1 15.6 84.4 58.5zM100.4 198.6c18.9 32.4 14.3 70.1-10.2 84.1s-59.7-.9-78.5-33.3-14.3-70.1 10.2-84.1 59.7 .9 78.5 33.3zM69.2 401.2C121.6 259.9 214.7 224 256 224s134.4 35.9 186.8 177.2c3.6 9.7 5.2 20.1 5.2 30.5l0 1.6c0 25.8-20.9 46.7-46.7 46.7-11.5 0-22.9-1.4-34-4.2l-88-22c-15.3-3.8-31.3-3.8-46.6 0l-88 22c-11.1 2.8-22.5 4.2-34 4.2-25.8 0-46.7-20.9-46.7-46.7l0-1.6c0-10.4 1.6-20.8 5.2-30.5zM421.8 282.7c-24.5-14-29.1-51.7-10.2-84.1s54-47.3 78.5-33.3 29.1 51.7 10.2 84.1-54 47.3-78.5 33.3zM310.1 189.7c-32.3-10.6-46.9-53.9-32.6-96.8s52.1-69.1 84.4-58.5 46.9 53.9 32.6 96.8-52.1 69.1-84.4 58.5z"],"worm":["0 0 448 512","M224 96c0-53 43-96 96-96l38.4 0C407.9 0 448 40.1 448 89.6L448 376c0 75.1-60.9 136-136 136S176 451.1 176 376l0-80c0-22.1-17.9-40-40-40s-40 17.9-40 40l0 168c0 26.5-21.5 48-48 48S0 490.5 0 464L0 296c0-75.1 60.9-136 136-136s136 60.9 136 136l0 80c0 22.1 17.9 40 40 40s40-17.9 40-40l0-184-32 0c-53 0-96-43-96-96zm144-8a24 24 0 1 0 -48 0 24 24 0 1 0 48 0z"],"shield-halved":["0 0 512 512","M256 0c4.6 0 9.2 1 13.4 2.9L457.8 82.8c22 9.3 38.4 31 38.3 57.2-.5 99.2-41.3 280.7-213.6 363.2-16.7 8-36.1 8-52.8 0-172.4-82.5-213.1-264-213.6-363.2-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.9 1 251.4 0 256 0zm0 66.8l0 378.1c138-66.8 175.1-214.8 176-303.4l-176-74.6 0 0z"],"horse":["0 0 576 512","M448 238.1l0-78.1 16 0 9.8 19.6c12.5 25.1 42.2 36.4 68.3 26 20.5-8.2 33.9-28 33.9-50.1L576 80c0-19.1-8.4-36.3-21.7-48l5.7 0c8.8 0 16-7.2 16-16S568.8 0 560 0L448 0C377.3 0 320 57.3 320 128l-171.2 0C118.1 128 91.2 144.3 76.3 168.8 33.2 174.5 0 211.4 0 256l0 56c0 13.3 10.7 24 24 24s24-10.7 24-24l0-56c0-13.4 6.6-25.2 16.7-32.5 1.6 13 6.3 25.4 13.6 36.4l28.2 42.4c8.3 12.4 6.4 28.7-1.2 41.6-16.5 28-20.6 62.2-10 93.9l17.5 52.4c4.4 13.1 16.6 21.9 30.4 21.9l33.7 0c21.8 0 37.3-21.4 30.4-42.1l-20.8-62.5c-2.1-6.4-.5-13.4 4.3-18.2l12.7-12.7c13.2-13.2 20.6-31.1 20.6-49.7 0-2.3-.1-4.6-.3-6.9l84 24c4.1 1.2 8.2 2.1 12.3 2.8L320 480c0 17.7 14.3 32 32 32l32 0c17.7 0 32-14.3 32-32l0-164.3c19.2-19.2 31.5-45.7 32-75.7l0 0 0-1.9zM496 64a16 16 0 1 1 0 32 16 16 0 1 1 0-32z"],"wand-magic-sparkles":["0 0 576 512","M263.4-27L278.2 9.8 315 24.6c3 1.2 5 4.2 5 7.4s-2 6.2-5 7.4L278.2 54.2 263.4 91c-1.2 3-4.2 5-7.4 5s-6.2-2-7.4-5L233.8 54.2 197 39.4c-3-1.2-5-4.2-5-7.4s2-6.2 5-7.4L233.8 9.8 248.6-27c1.2-3 4.2-5 7.4-5s6.2 2 7.4 5zM110.7 41.7l21.5 50.1 50.1 21.5c5.9 2.5 9.7 8.3 9.7 14.7s-3.8 12.2-9.7 14.7l-50.1 21.5-21.5 50.1c-2.5 5.9-8.3 9.7-14.7 9.7s-12.2-3.8-14.7-9.7L59.8 164.2 9.7 142.7C3.8 140.2 0 134.4 0 128s3.8-12.2 9.7-14.7L59.8 91.8 81.3 41.7C83.8 35.8 89.6 32 96 32s12.2 3.8 14.7 9.7zM464 304c6.4 0 12.2 3.8 14.7 9.7l21.5 50.1 50.1 21.5c5.9 2.5 9.7 8.3 9.7 14.7s-3.8 12.2-9.7 14.7l-50.1 21.5-21.5 50.1c-2.5 5.9-8.3 9.7-14.7 9.7s-12.2-3.8-14.7-9.7l-21.5-50.1-50.1-21.5c-5.9-2.5-9.7-8.3-9.7-14.7s3.8-12.2 9.7-14.7l50.1-21.5 21.5-50.1c2.5-5.9 8.3-9.7 14.7-9.7zM460 0c11 0 21.6 4.4 29.5 12.2l42.3 42.3C539.6 62.4 544 73 544 84s-4.4 21.6-12.2 29.5l-88.2 88.2-101.3-101.3 88.2-88.2C438.4 4.4 449 0 460 0zM44.2 398.5L308.4 134.3 409.7 235.6 145.5 499.8C137.6 507.6 127 512 116 512s-21.6-4.4-29.5-12.2L44.2 457.5C36.4 449.6 32 439 32 428s4.4-21.6 12.2-29.5z"],"house":["0 0 512 512","M277.8 8.6c-12.3-11.4-31.3-11.4-43.5 0l-224 208c-9.6 9-12.8 22.9-8 35.1S18.8 272 32 272l16 0 0 176c0 35.3 28.7 64 64 64l288 0c35.3 0 64-28.7 64-64l0-176 16 0c13.2 0 25-8.1 29.8-20.3s1.6-26.2-8-35.1l-224-208zM240 320l32 0c26.5 0 48 21.5 48 48l0 96-128 0 0-96c0-26.5 21.5-48 48-48z"],"users":["0 0 640 512","M320 16a104 104 0 1 1 0 208 104 104 0 1 1 0-208zM96 88a72 72 0 1 1 0 144 72 72 0 1 1 0-144zM0 416c0-70.7 57.3-128 128-128 12.8 0 25.2 1.9 36.9 5.4-32.9 36.8-52.9 85.4-52.9 138.6l0 16c0 11.4 2.4 22.2 6.7 32L32 480c-17.7 0-32-14.3-32-32l0-32zm521.3 64c4.3-9.8 6.7-20.6 6.7-32l0-16c0-53.2-20-101.8-52.9-138.6 11.7-3.5 24.1-5.4 36.9-5.4 70.7 0 128 57.3 128 128l0 32c0 17.7-14.3 32-32 32l-86.7 0zM472 160a72 72 0 1 1 144 0 72 72 0 1 1 -144 0zM160 432c0-88.4 71.6-160 160-160s160 71.6 160 160l0 16c0 17.7-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32l0-16z"],"calendar-days":["0 0 448 512","M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l32 0 0-32c0-17.7 14.3-32 32-32zM64 240l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm128 0l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM64 368l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zm112 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"],"gear":["0 0 512 512","M195.1 9.5C198.1-5.3 211.2-16 226.4-16l59.8 0c15.2 0 28.3 10.7 31.3 25.5L332 79.5c14.1 6 27.3 13.7 39.3 22.8l67.8-22.5c14.4-4.8 30.2 1.2 37.8 14.4l29.9 51.8c7.6 13.2 4.9 29.8-6.5 39.9L447 233.3c.9 7.4 1.3 15 1.3 22.7s-.5 15.3-1.3 22.7l53.4 47.5c11.4 10.1 14 26.8 6.5 39.9l-29.9 51.8c-7.6 13.1-23.4 19.2-37.8 14.4l-67.8-22.5c-12.1 9.1-25.3 16.7-39.3 22.8l-14.4 69.9c-3.1 14.9-16.2 25.5-31.3 25.5l-59.8 0c-15.2 0-28.3-10.7-31.3-25.5l-14.4-69.9c-14.1-6-27.2-13.7-39.3-22.8L73.5 432.3c-14.4 4.8-30.2-1.2-37.8-14.4L5.8 366.1c-7.6-13.2-4.9-29.8 6.5-39.9l53.4-47.5c-.9-7.4-1.3-15-1.3-22.7s.5-15.3 1.3-22.7L12.3 185.8c-11.4-10.1-14-26.8-6.5-39.9L35.7 94.1c7.6-13.2 23.4-19.2 37.8-14.4l67.8 22.5c12.1-9.1 25.3-16.7 39.3-22.8L195.1 9.5zM256.3 336a80 80 0 1 0 -.6-160 80 80 0 1 0 .6 160z"],"book-medical":["0 0 448 512","M96 512l320 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-66.7c18.6-6.6 32-24.4 32-45.3l0-288c0-26.5-21.5-48-48-48L96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96zM64 416c0-17.7 14.3-32 32-32l256 0 0 64-256 0c-17.7 0-32-14.3-32-32zM192 120c0-8.8 7.2-16 16-16l32 0c8.8 0 16 7.2 16 16l0 40 40 0c8.8 0 16 7.2 16 16l0 32c0 8.8-7.2 16-16 16l-40 0 0 40c0 8.8-7.2 16-16 16l-32 0c-8.8 0-16-7.2-16-16l0-40-40 0c-8.8 0-16-7.2-16-16l0-32c0-8.8 7.2-16 16-16l40 0 0-40z"],"weight-scale":["0 0 448 512","M116.6 192c-3-10.1-4.6-20.9-4.6-32 0-61.9 50.1-112 112-112S336 98.1 336 160c0 11.1-1.6 21.9-4.6 32l-71 0 24.6-44.3c6.4-11.6 2.3-26.2-9.3-32.6s-26.2-2.3-32.6 9.3l-37.6 67.7-88.8 0zM128 32L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64l-64 0C293.3 11.9 260 0 224 0s-69.3 11.9-96 32z"],"pills":["0 0 512 512","M64 112c0-26.5 21.5-48 48-48s48 21.5 48 48l0 112-96 0 0-112zM176 368c0-48.7 18.1-93.2 48-127l0-129C224 50.1 173.9 0 112 0S0 50.1 0 112L0 400c0 61.9 50.1 112 112 112 37.3 0 70.3-18.2 90.7-46.3-17-28.6-26.7-62-26.7-97.7zm64.7 67.4c4.6 8.7 16.3 9.7 23.3 2.7L438.1 264c7-7 6-18.7-2.7-23.3-20.1-10.7-43-16.7-67.4-16.7-79.5 0-144 64.5-144 144 0 24.3 6 47.3 16.7 67.4zM297.9 472c-7 7-6 18.7 2.7 23.3 20.1 10.7 43 16.7 67.4 16.7 79.5 0 144-64.5 144-144 0-24.3-6-47.3-16.7-67.4-4.6-8.7-16.3-9.7-23.3-2.7L297.9 472z"],"clock-rotate-left":["0 0 576 512","M288 64c106 0 192 86 192 192S394 448 288 448c-65.2 0-122.9-32.5-157.6-82.3-10.1-14.5-30.1-18-44.6-7.9s-18 30.1-7.9 44.6C124.1 468.6 201 512 288 512 429.4 512 544 397.4 544 256S429.4 0 288 0C202.3 0 126.5 42.1 80 106.7L80 80c0-17.7-14.3-32-32-32S16 62.3 16 80l0 112c0 17.7 14.3 32 32 32l24.6 0c.5 0 1 0 1.5 0l86 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-38.3 0C154.9 102.6 217 64 288 64zm24 88c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 104c0 6.4 2.5 12.5 7 17l72 72c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-65-65 0-94.1z"],"bell":["0 0 448 512","M224 0c-17.7 0-32 14.3-32 32l0 3.2C119 50 64 114.6 64 192l0 21.7c0 48.1-16.4 94.8-46.4 132.4L7.8 358.3C2.7 364.6 0 372.4 0 380.5 0 400.1 15.9 416 35.5 416l376.9 0c19.6 0 35.5-15.9 35.5-35.5 0-8.1-2.7-15.9-7.8-22.2l-9.8-12.2C400.4 308.5 384 261.8 384 213.7l0-21.7c0-77.4-55-142-128-156.8l0-3.2c0-17.7-14.3-32-32-32zM162 464c7.1 27.6 32.2 48 62 48s54.9-20.4 62-48l-124 0z"],"triangle-exclamation":["0 0 512 512","M256 0c14.7 0 28.2 8.1 35.2 21l216 400c6.7 12.4 6.4 27.4-.8 39.5S486.1 480 472 480L40 480c-14.1 0-27.2-7.4-34.4-19.5s-7.5-27.1-.8-39.5l216-400c7-12.9 20.5-21 35.2-21zm0 352a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.5 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"],"circle-check":["0 0 512 512","M256 512a256 256 0 1 1 0-512 256 256 0 1 1 0 512zM374 145.7c-10.7-7.8-25.7-5.4-33.5 5.3L221.1 315.2 169 263.1c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l72 72c5 5 11.8 7.5 18.8 7s13.4-4.1 17.5-9.8L379.3 179.2c7.8-10.7 5.4-25.7-5.3-33.5z"],"pen-to-square":["0 0 512 512","M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L368 46.1 465.9 144 490.3 119.6c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L432 177.9 334.1 80 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"],"leaf":["0 0 512 512","M471.3 6.7C477.7 .6 487-1.6 495.6 1.2 505.4 4.5 512 13.7 512 24l0 186.9c0 131.2-108.1 237.1-238.8 237.1-77 0-143.4-49.5-167.5-118.7-35.4 30.8-57.7 76.1-57.7 126.7 0 13.3-10.7 24-24 24S0 469.3 0 456C0 381.1 38.2 315.1 96.1 276.3 131.4 252.7 173.5 240 216 240l80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-80 0c-39.7 0-77.3 8.8-111 24.5 23.3-70 89.2-120.5 167-120.5 66.4 0 115.8-22.1 148.7-44 19.2-12.8 35.5-28.1 50.7-45.3z"],"magnifying-glass":["0 0 512 512","M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376C296.3 401.1 253.9 416 208 416 93.1 416 0 322.9 0 208S93.1 0 208 0 416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"],"palette":["0 0 512 512","M512 256c0 .9 0 1.8 0 2.7-.4 36.5-33.6 61.3-70.1 61.3L344 320c-26.5 0-48 21.5-48 48 0 3.4 .4 6.7 1 9.9 2.1 10.2 6.5 20 10.8 29.9 6.1 13.8 12.1 27.5 12.1 42 0 31.8-21.6 60.7-53.4 62-3.5 .1-7 .2-10.6 .2-141.4 0-256-114.6-256-256S114.6 0 256 0 512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"],"user-group":["0 0 576 512","M64 128a112 112 0 1 1 224 0 112 112 0 1 1 -224 0zM0 464c0-97.2 78.8-176 176-176s176 78.8 176 176l0 6c0 23.2-18.8 42-42 42L42 512c-23.2 0-42-18.8-42-42l0-6zM432 64a96 96 0 1 1 0 192 96 96 0 1 1 0-192zm0 240c79.5 0 144 64.5 144 144l0 22.4c0 23-18.6 41.6-41.6 41.6l-144.8 0c6.6-12.5 10.4-26.8 10.4-42l0-6c0-51.5-17.4-98.9-46.5-136.7 22.6-14.7 49.6-23.3 78.5-23.3z"],"user":["0 0 448 512","M224 248a120 120 0 1 0 0-240 120 120 0 1 0 0 240zm-29.7 56C95.8 304 16 383.8 16 482.3 16 498.7 29.3 512 45.7 512l356.6 0c16.4 0 29.7-13.3 29.7-29.7 0-98.5-79.8-178.3-178.3-178.3l-59.4 0z"],"envelope":["0 0 512 512","M48 64c-26.5 0-48 21.5-48 48 0 15.1 7.1 29.3 19.2 38.4l208 156c17.1 12.8 40.5 12.8 57.6 0l208-156c12.1-9.1 19.2-23.3 19.2-38.4 0-26.5-21.5-48-48-48L48 64zM0 196L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-188-198.4 148.8c-34.1 25.6-81.1 25.6-115.2 0L0 196z"],"clipboard":["0 0 384 512","M320 32l-8.6 0C300.4 12.9 279.7 0 256 0L128 0C104.3 0 83.6 12.9 72.6 32L64 32C28.7 32 0 60.7 0 96L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-352c0-35.3-28.7-64-64-64zM136 112c-13.3 0-24-10.7-24-24s10.7-24 24-24l112 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-112 0z"],"rotate-left":["0 0 512 512","M24 192l144 0c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2l-46.7-46.7c75.3-58.6 184.3-53.3 253.5 15.9 75 75 75 196.5 0 271.5s-196.5 75-271.5 0c-10.2-10.2-19-21.3-26.4-33-9.5-14.9-29.3-19.3-44.2-9.8s-19.3 29.3-9.8 44.2C49.7 408.7 61.4 423.5 75 437 175 537 337 537 437 437S537 175 437 75C342.8-19.3 193.3-24.7 92.7 58.8L41 7C34.1 .2 23.8-1.9 14.8 1.8S0 14.3 0 24L0 168c0 13.3 10.7 24 24 24z"],"right-from-bracket":["0 0 512 512","M505 273c9.4-9.4 9.4-24.6 0-33.9L361 95c-6.9-6.9-17.2-8.9-26.2-5.2S320 102.3 320 112l0 80-112 0c-26.5 0-48 21.5-48 48l0 32c0 26.5 21.5 48 48 48l112 0 0 80c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2L505 273zM160 96c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 32C43 32 0 75 0 128L0 384c0 53 43 96 96 96l64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l64 0z"],"box-archive":["0 0 512 512","M0 64C0 46.3 14.3 32 32 32l448 0c17.7 0 32 14.3 32 32l0 32c0 17.7-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96L0 64zM32 176l448 0 0 240c0 35.3-28.7 64-64 64L96 480c-35.3 0-64-28.7-64-64l0-240zm152 64c-13.3 0-24 10.7-24 24s10.7 24 24 24l144 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-144 0z"],"trash-can":["0 0 448 512","M136.7 5.9C141.1-7.2 153.3-16 167.1-16l113.9 0c13.8 0 26 8.8 30.4 21.9L320 32 416 32c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 8.7-26.1zM32 144l384 0 0 304c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-304zm88 64c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24z"],"pen":["0 0 512 512","M352.9 21.2L308 66.1 445.9 204 490.8 159.1C504.4 145.6 512 127.2 512 108s-7.6-37.6-21.2-51.1L455.1 21.2C441.6 7.6 423.2 0 404 0s-37.6 7.6-51.1 21.2zM274.1 100L58.9 315.1c-10.7 10.7-18.5 24.1-22.6 38.7L.9 481.6c-2.3 8.3 0 17.3 6.2 23.4s15.1 8.5 23.4 6.2l127.8-35.5c14.6-4.1 27.9-11.8 38.7-22.6L412 237.9 274.1 100z"],"plus":["0 0 448 512","M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z"],"bandage":["0 0 576 512","M464 416l48 0c35.3 0 64-28.7 64-64l0-192c0-35.3-28.7-64-64-64l-48 0 0 320zM416 96l-256 0 0 320 256 0 0-320zM64 96C28.7 96 0 124.7 0 160L0 352c0 35.3 28.7 64 64 64l48 0 0-320-48 0zM216 208a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm120-24a24 24 0 1 1 0 48 24 24 0 1 1 0-48zM216 304a24 24 0 1 1 48 0 24 24 0 1 1 -48 0zm120-24a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"],"pump-soap":["0 0 320 512","M96 0l0 80 128 0 0-24 72 0c13.3 0 24-10.7 24-24S309.3 8 296 8l-72 0 0-8c0-17.7-14.3-32-32-32l-64 0C110.3-32 96-17.7 96 0zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L64 128zM224 344c0 35.3-28.7 56-64 56s-64-20.7-64-56c0-32.5 37-80.9 50.9-97.9 3.2-3.9 8.1-6.1 13.1-6.1s9.9 2.2 13.1 6.1C187 263.1 224 311.5 224 344z"],"flask":["0 0 448 512","M288 0L128 0C110.3 0 96 14.3 96 32s14.3 32 32 32L128 215.5 7.5 426.3C2.6 435 0 444.7 0 454.7 0 486.4 25.6 512 57.3 512l333.4 0c31.6 0 57.3-25.6 57.3-57.3 0-10-2.6-19.8-7.5-28.4L320 215.5 320 64c17.7 0 32-14.3 32-32S337.7 0 320 0L288 0zM192 215.5l0-151.5 64 0 0 151.5c0 11.1 2.9 22.1 8.4 31.8l41.6 72.7-164 0 41.6-72.7c5.5-9.7 8.4-20.6 8.4-31.8z"],"heart-pulse":["0 0 512 512","M256 107.9L241 87.1C216 52.5 175.9 32 133.1 32 59.6 32 0 91.6 0 165.1l0 2.6c0 23.6 6.2 48 16.6 72.3l106 0c3.2 0 6.1-1.9 7.4-4.9l31.8-76.3c3.7-8.8 12.3-14.6 21.8-14.8s18.3 5.4 22.2 14.1l51.3 113.9 41.4-82.8c4.1-8.1 12.4-13.3 21.5-13.3s17.4 5.1 21.5 13.3l23.2 46.3c1.4 2.7 4.1 4.4 7.2 4.4l123.6 0c10.5-24.3 16.6-48.7 16.6-72.3l0-2.6C512 91.6 452.4 32 378.9 32 336.2 32 296 52.5 271 87.1l-15 20.7zM469.6 288l-97.8 0c-21.2 0-40.6-12-50.1-31l-1.7-3.4-42.5 85.1c-4.1 8.3-12.7 13.5-22 13.3s-17.6-5.7-21.4-14.1l-49.3-109.5-10.5 25.2c-8.7 20.9-29.1 34.5-51.7 34.5l-80.2 0c47.2 73.8 123 141.7 170.4 177.9 12.4 9.4 27.6 14.1 43.1 14.1s30.8-4.6 43.1-14.1C346.6 429.7 422.4 361.8 469.6 288z"],"brain":["0 0 512 512","M120 56c0-30.9 25.1-56 56-56l24 0c17.7 0 32 14.3 32 32l0 448c0 17.7-14.3 32-32 32l-32 0c-29.8 0-54.9-20.4-62-48-.7 0-1.3 0-2 0-44.2 0-80-35.8-80-80 0-18 6-34.6 16-48-19.4-14.6-32-37.8-32-64 0-30.9 17.6-57.8 43.2-71.1-7.1-12-11.2-26-11.2-40.9 0-44.2 35.8-80 80-80l0-24zm272 0l0 24c44.2 0 80 35.8 80 80 0 15-4.1 29-11.2 40.9 25.7 13.3 43.2 40.1 43.2 71.1 0 26.2-12.6 49.4-32 64 10 13.4 16 30 16 48 0 44.2-35.8 80-80 80-.7 0-1.3 0-2 0-7.1 27.6-32.2 48-62 48l-32 0c-17.7 0-32-14.3-32-32l0-448c0-17.7 14.3-32 32-32l24 0c30.9 0 56 25.1 56 56z"],"bone":["0 0 640 512","M197.4 160c-3.9 0-7.2-2.8-8.1-6.6-10.2-42.1-48.1-73.4-93.3-73.4-53 0-96 43-96 96 0 29.1 12.9 55.1 33.3 72.7 4.3 3.7 4.3 10.8 0 14.5-20.4 17.6-33.3 43.7-33.3 72.7 0 53 43 96 96 96 45.2 0 83.1-31.3 93.3-73.4 .9-3.8 4.2-6.6 8.1-6.6l245.1 0c3.9 0 7.2 2.8 8.1 6.6 10.2 42.1 48.1 73.4 93.3 73.4 53 0 96-43 96-96 0-29.1-12.9-55.1-33.3-72.7-4.3-3.7-4.3-10.8 0-14.5 20.4-17.6 33.3-43.7 33.3-72.7 0-53-43-96-96-96-45.2 0-83.1 31.3-93.3 73.4-.9 3.8-4.2 6.6-8.1 6.6l-245.1 0z"],"ear-listen":["0 0 512 512","M379.6 .3c-8.9 1.2-17.2 6.2-22.4 14.1-6.8 10.4-7 24.1-.4 34.6 5.6 8.9 15.5 12.7 23.8 18.5 7.5 5.2 17.6 13.2 27.7 24.2 20 21.7 39.5 54.3 39.5 100.3 0 17.7 14.3 32 32 32s32-14.3 32-32c0-66-28.5-113.4-56.5-143.7-13.9-15.1-27.8-26.1-38.3-33.3-11-7.6-23.5-16.6-37.6-14.7zM240 128c-57.6 0-105.1 43.6-111.3 99.5-1.9 17.6-17.8 30.2-35.3 28.3s-30.2-17.8-28.3-35.3c9.7-88 84.3-156.5 174.9-156.5 97.2 0 176 78.8 176 176 0 46-17.7 87.9-46.6 119.3-12 13-17.4 24.8-17.4 34.7l0 6.1c0 61.9-50.1 112-112 112-17.7 0-32-14.3-32-32s14.3-32 32-32c26.5 0 48-21.5 48-48l0-6.1c0-32.9 17.4-59.6 34.4-78 18.4-20 29.6-46.6 29.6-75.9 0-61.9-50.1-112-112-112zM0 480a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm160-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l64 64c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-64-64zM240 208c-17.7 0-32 14.3-32 32 0 13.3-10.7 24-24 24s-24-10.7-24-24c0-44.2 35.8-80 80-80s80 35.8 80 80c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-17.7-14.3-32-32-32z"],"user-doctor":["0 0 448 512","M224 8a120 120 0 1 0 0 240 120 120 0 1 0 0-240zm60 312.8c-5.4-.5-11-.8-16.6-.8l-86.9 0c-5.6 0-11.1 .3-16.6 .8l0 67.5c16.5 7.6 28 24.3 28 43.6 0 26.5-21.5 48-48 48s-48-21.5-48-48c0-19.4 11.5-36.1 28-43.6l0-58.4C61 353 16 413.6 16 484.6 16 499.7 28.3 512 43.4 512l361.1 0c15.1 0 27.4-12.3 27.4-27.4 0-71-45-131.5-108-154.6l0 37.4c23.3 8.2 40 30.5 40 56.6l0 32c0 11-9 20-20 20s-20-9-20-20l0-32c0-11-9-20-20-20s-20 9-20 20l0 32c0 11-9 20-20 20s-20-9-20-20l0-32c0-26.1 16.7-48.3 40-56.6l0-46.6z"],"x-ray":["0 0 512 512","M0 64C0 46.3 14.3 32 32 32l448 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l0 320c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32L32 96C14.3 96 0 81.7 0 64zm280 56c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 16-64 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l64 0 0 48-80 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l80 0 0 48-64 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l64 0 0 16c0 13.3 10.7 24 24 24s24-10.7 24-24l0-16 64 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-64 0 0-48 80 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-80 0 0-48 64 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-64 0 0-16z"],"hospital":["0 0 576 512","M128 64c0-35.3 28.7-64 64-64L384 0c35.3 0 64 28.7 64 64l0 64 64 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 192c0-35.3 28.7-64 64-64l64 0 0-64zM272 352c-17.7 0-32 14.3-32 32l0 80 96 0 0-80c0-17.7-14.3-32-32-32l-32 0zM128 368l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16zM112 256c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0zM512 368l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16zM496 256c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0zM264 104l0 32-32 0c-8.8 0-16 7.2-16 16l0 16c0 8.8 7.2 16 16 16l32 0 0 32c0 8.8 7.2 16 16 16l16 0c8.8 0 16-7.2 16-16l0-32 32 0c8.8 0 16-7.2 16-16l0-16c0-8.8-7.2-16-16-16l-32 0 0-32c0-8.8-7.2-16-16-16l-16 0c-8.8 0-16 7.2-16 16z"],"spa":["0 0 576 512","M169.7 227.5c34.3 18.7 64.5 44.1 88.8 74.5 11.1 13.9 21 28.9 29.4 44.8 8.5-15.9 18.3-30.8 29.4-44.8 24.3-30.5 54.5-55.9 88.8-74.5 41.7-22.7 89.4-35.5 139.7-35.5l9.9 0c11.1 0 20.1 9 20.1 20.1 0 148-119.9 267.9-267.9 267.9l-40.2 0C119.9 480 0 360.1 0 212.1 0 201 9 192 20.1 192l9.9 0c50.4 0 98.1 12.8 139.7 35.5zM303.9 38c16.9 15.9 61.4 63.4 89 142.3-40.1 20.2-75.8 48.2-104.9 82.1-29.2-33.9-64.8-61.8-104.9-82.1 27.6-78.9 72.2-126.4 89-142.3 4.3-4.1 10-6 15.9-6s11.6 2 15.9 6z"],"scissors":["0 0 512 512","M192 256l-39.5 39.5c-12.6-4.9-26.2-7.5-40.5-7.5-61.9 0-112 50.1-112 112s50.1 112 112 112 112-50.1 112-112c0-14.3-2.7-27.9-7.5-40.5L499.2 76.8c7.1-7.1 7.1-18.5 0-25.6-28.3-28.3-74.1-28.3-102.4 0L256 192 216.5 152.5c4.9-12.6 7.5-26.2 7.5-40.5 0-61.9-50.1-112-112-112S0 50.1 0 112 50.1 224 112 224c14.3 0 27.9-2.7 40.5-7.5L192 256zm97.9 97.9L396.8 460.8c28.3 28.3 74.1 28.3 102.4 0 7.1-7.1 7.1-18.5 0-25.6l-145.3-145.3-64 64zM64 112a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm48 240a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"],"bath":["0 0 512 512","M96 77.3c0-7.3 5.9-13.3 13.3-13.3 3.5 0 6.9 1.4 9.4 3.9l14.9 14.9c-3.6 9.1-5.5 18.9-5.5 29.2 0 19.9 7.2 38 19.2 52-5.3 9.2-4 21.1 3.8 29 9.4 9.4 24.6 9.4 33.9 0L289 89c9.4-9.4 9.4-24.6 0-33.9-7.8-7.9-19.8-9.1-29-3.8-14-12-32.1-19.2-52-19.2-10.3 0-20.2 2-29.2 5.5L163.9 22.6C149.4 8.1 129.7 0 109.3 0 66.6 0 32 34.6 32 77.3L32 256c-17.7 0-32 14.3-32 32s14.3 32 32 32l0 48c0 28.4 12.4 54 32 71.6L64 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-16 256 0 0 16c0 17.7 14.3 32 32 32s32-14.3 32-32l0-40.4c19.6-17.6 32-43.1 32-71.6l0-48c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 256 96 77.3z"],"heart":["0 0 512 512","M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"],"child":["0 0 320 512","M96 64A64 64 0 1 1 224 64 64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32L80 287.8 59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z"],"dog":["0 0 576 512","M32 112c16.6 0 30.2 12.6 31.8 28.7l.3 6.6C65.8 163.4 79.4 176 96 176l179.1 0 140.9 60.4 0 243.6c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-131.3C296 361 268.8 368 240 368s-56-7-80-19.3L160 480c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-245.6c-37.3-13.2-64-48.6-64-90.4 0-17.7 14.3-32 32-32zM355.8-32c7.7 0 14.9 3.6 19.6 9.8L392 0 444.1 0c12.7 0 24.9 5.1 33.9 14.1L496 32 552 32c13.3 0 24 10.7 24 24l0 24c0 44.2-35.8 80-80 80l-64 0-7 28-124.7-53.4 31.6-147.2C334.3-23.9 344.2-32 355.8-32zM448 44a20 20 0 1 0 0 40 20 20 0 1 0 0-40z"],"cat":["0 0 576 512","M64 96c53 0 96 43 96 96l0 85.8c29.7-44.7 77.8-76.2 133.4-84 25.6 60 85.2 102.1 154.6 102.1 10.9 0 21.6-1.1 32-3.1L480 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-140.8-136 108.8 56 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-144 0c-53 0-96-43-96-96l0-224c0-16.6-12.6-30.2-28.7-31.8l-6.6-.3C44.6 158.2 32 144.6 32 128 32 110.3 46.3 96 64 96zM533.8 3.2C544.2-5.5 560 1.9 560 15.5L560 128c0 61.9-50.1 112-112 112S336 189.9 336 128l0-112.5c0-13.6 15.8-21 26.2-12.3L416 48 480 48 533.8 3.2zM400 108a20 20 0 1 0 0 40 20 20 0 1 0 0-40zm96 0a20 20 0 1 0 0 40 20 20 0 1 0 0-40z"],"paperclip":["0 0 512 512","M224.6 12.8c56.2-56.2 147.4-56.2 203.6 0s56.2 147.4 0 203.6l-164 164c-34.4 34.4-90.1 34.4-124.5 0s-34.4-90.1 0-124.5L292.5 103.3c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L185 301.3c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l164-164c31.2-31.2 31.2-81.9 0-113.1s-81.9-31.2-113.1 0l-164 164c-53.1 53.1-53.1 139.2 0 192.3s139.2 53.1 192.3 0L428.3 284.3c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L343.4 459.6c-78.1 78.1-204.7 78.1-282.8 0s-78.1-204.7 0-282.8l164-164z"],"chevron-left":["0 0 320 512","M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"],"chevron-right":["0 0 320 512","M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"],"ellipsis":["0 0 448 512","M0 256a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm168 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm224-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z"],"lock":["0 0 384 512","M128 96l0 64 128 0 0-64c0-35.3-28.7-64-64-64s-64 28.7-64 64zM64 160l0-64C64 25.3 121.3-32 192-32S320 25.3 320 96l0 64c35.3 0 64 28.7 64 64l0 224c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 224c0-35.3 28.7-64 64-64z"],"tag":["0 0 512 512","M32.5 96l0 149.5c0 17 6.7 33.3 18.7 45.3l192 192c25 25 65.5 25 90.5 0L483.2 333.3c25-25 25-65.5 0-90.5l-192-192C279.2 38.7 263 32 246 32L96.5 32c-35.3 0-64 28.7-64 64zm112 16a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"],"bug":["0 0 576 512","M192 96c0-53 43-96 96-96s96 43 96 96l0 3.6c0 15.7-12.7 28.4-28.4 28.4l-135.1 0c-15.7 0-28.4-12.7-28.4-28.4l0-3.6zm345.6 12.8c10.6 14.1 7.7 34.2-6.4 44.8l-97.8 73.3c5.3 8.9 9.3 18.7 11.8 29.1l98.8 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-96 0 0 32c0 2.6-.1 5.3-.2 7.9l83.4 62.5c14.1 10.6 17 30.7 6.4 44.8s-30.7 17-44.8 6.4l-63.1-47.3c-23.2 44.2-66.5 76.2-117.7 83.9L312 280c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 230.2c-51.2-7.7-94.5-39.7-117.7-83.9L83.2 473.6c-14.1 10.6-34.2 7.7-44.8-6.4s-7.7-34.2 6.4-44.8l83.4-62.5c-.1-2.6-.2-5.2-.2-7.9l0-32-96 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l98.8 0c2.5-10.4 6.5-20.2 11.8-29.1L44.8 153.6c-14.1-10.6-17-30.7-6.4-44.8s30.7-17 44.8-6.4L192 184c12.3-5.1 25.8-8 40-8l112 0c14.2 0 27.7 2.8 40 8l108.8-81.6c14.1-10.6 34.2-7.7 44.8 6.4z"],"calendar-check":["0 0 448 512","M320 0c17.7 0 32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l32 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32zm22 161.7c-10.7-7.8-25.7-5.4-33.5 5.3L189.1 331.2 137 279.1c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l72 72c5 5 11.9 7.5 18.8 7s13.4-4.1 17.5-9.8L347.3 195.2c7.8-10.7 5.4-25.7-5.3-33.5z"],"calendar-plus":["0 0 448 512","M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 32 0c35.3 0 64 28.7 64 64l0 288c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 128C0 92.7 28.7 64 64 64l32 0 0-32c0-17.7 14.3-32 32-32zm96 192c-13.3 0-24 10.7-24 24l0 48-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l48 0 0 48c0 13.3 10.7 24 24 24s24-10.7 24-24l0-48 48 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-48c0-13.3-10.7-24-24-24z"],"location-dot":["0 0 384 512","M0 188.6C0 84.4 86 0 192 0S384 84.4 384 188.6c0 119.3-120.2 262.3-170.4 316.8-11.8 12.8-31.5 12.8-43.3 0-50.2-54.5-170.4-197.5-170.4-316.8zM192 256a64 64 0 1 0 0-128 64 64 0 1 0 0 128z"],"clock":["0 0 512 512","M256 0a256 256 0 1 1 0 512 256 256 0 1 1 0-512zM232 120l0 136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2 280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"],"check":["0 0 448 512","M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"],"xmark":["0 0 384 512","M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z"]};

/* ---------- Couche « nuage » : comptes + synchronisation avec le serveur (Cloudflare Workers + D1, voir src/) ----------
   Mode démonstration (données d'exemple, sur l'appareil uniquement) : ajouter ?demo à l'adresse. */
const QS=(()=>{try{return new URLSearchParams(location.search)}catch(e){return new URLSearchParams('')}})();
const DEMO=QS.has('demo')||!/^https?:$/.test(location.protocol);
const CLOUD=!DEMO;
const CLOUD_BROKEN=false;
const JOIN=(QS.get('join')||'').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,20);
const RESET=(QS.get('reset')||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,100);
const newCode=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';const b=new Uint8Array(12);crypto.getRandomValues(b);let s='';b.forEach((x,i)=>{s+=A[x%A.length];if(i%4===3&&i<11)s+='-'});return s};
const Cloud=CLOUD?(()=>{
  /* Copie locale du dernier état reçu : l'appli s'ouvre aussi hors connexion */
  const CACHE='carnet-cache-v1';
  const POLL_MS=20000;
  let st=null,me=null,remoteCb=()=>{},errCb=()=>{},authCb=()=>{};
  let pending=null,inflight=false,timer=0,pollTimer=0,polling=false;
  const split=f=>{const {profiles,users,invites,...meta}=f;return {profiles,users,invites,meta}};
  const MSG={'auth/invalid-credential':'E-mail ou mot de passe incorrect.',
    'auth/email-already-in-use':'Un compte existe déjà avec cet e-mail.','auth/weak-password':'Mot de passe trop court (6 caractères minimum).','auth/invalid-email':'Adresse e-mail invalide.',
    'auth/too-many-requests':'Trop d’essais. Patientez quelques minutes puis réessayez.','auth/network-request-failed':'Pas de connexion Internet.',
    'code-invalide':'Ce code d’invitation n’existe pas ou a déjà été utilisé.','code-autre-email':'Cette invitation est réservée à une autre adresse e-mail.','permission-denied':'Accès refusé.',
    'non-connecte':'Votre session a expiré. Reconnectez-vous.','lien-expire':'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau depuis l’écran de connexion.',
    'reset-indisponible':'La réinitialisation par e-mail n’est pas encore activée. Demandez à la personne qui gère l’application.',
    'fiche-trop-lourde':'Fiche trop lourde (photos ou documents) : allégez-la puis réessayez.','donnees-invalides':'Modification refusée par le serveur.',
    'configuration':'Le serveur n’est pas encore configuré.','erreur-serveur':'Erreur du serveur. Réessayez dans un instant.'};
  const msg=e=>MSG[e&&(e.code||e.message)]||('Une erreur est survenue ('+((e&&(e.code||e.message))||'inconnue')+').');
  async function api(path,body){
    let res;
    try{res=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store'})}
    catch(e){throw {code:'auth/network-request-failed',offline:true}}
    let j={};try{j=await res.json()}catch(e){}
    if(!res.ok)throw {code:j.error||('http-'+res.status),status:res.status};
    return j;
  }
  const saveCache=()=>{try{if(st&&me)localStorage.setItem(CACHE,JSON.stringify({me,st:{...st}}))}catch(e){}};
  const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch(e){return null}};
  const clearCache=()=>{try{localStorage.removeItem(CACHE)}catch(e){}};
  function build(){
    const meta=JSON.parse(st.meta);
    const profiles=Object.entries(st.profiles).sort((a,b)=>a[1].ord-b[1].ord).map(x=>JSON.parse(x[1].json));
    const users=Object.entries(st.members).sort((a,b)=>(a[1].at||0)-(b[1].at||0)).map(([uid,m])=>({uid,email:m.email,name:m.name,role:m.role,owner:!!m.owner}));
    const invites=Object.entries(st.invites).sort((a,b)=>(a[1].at||0)-(b[1].at||0)).map(([code,i])=>({id:code,code,email:i.email,role:i.role,status:'pending',date:i.date||''}));
    return {...meta,id:st.fid,profiles,users,invites};
  }
  function apply(s){
    st.rev=s.rev;st.role=s.role;st.meta=s.meta;
    st.profiles={};s.profiles.forEach(p=>{st.profiles[p.id]={json:p.json,ord:p.ord}});
    st.members={};s.members.forEach(m=>{st.members[m.uid]=m});
    st.invites={};s.invites.forEach(i=>{st.invites[i.code]=i});
    saveCache();
  }
  function detach(){clearTimeout(pollTimer);clearTimeout(timer);st=null;pending=null}
  function sessionLost(){detach();me=null;clearCache();authCb(null)}
  /* Rechargement : seulement si l'espace a changé sur le serveur et qu'aucune modification locale n'attend d'être envoyée */
  async function poll(){
    clearTimeout(pollTimer);
    if(!st)return;
    if(pending||inflight||polling){if(pending)flush();pollTimer=setTimeout(poll,POLL_MS);return}
    const s0=st;polling=true;
    try{
      const r=await api('family?rev='+s0.rev);
      if(st===s0&&!pending&&!inflight&&!r.unchanged){apply(r);remoteCb(build())}
    }catch(e){
      if(e.status===401){polling=false;sessionLost();return}
      if(e.status===403||e.status===404)errCb({code:'permission-denied'});
    }
    polling=false;
    if(st===s0)pollTimer=setTimeout(poll,document.visibilityState==='hidden'?POLL_MS*3:POLL_MS);
  }
  const wake=()=>{if(st){if(pending)flush();else poll()}};
  window.addEventListener('online',wake);
  window.addEventListener('focus',wake);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake()});
  async function attach(fid,uid){
    detach();
    const s=st={fid,uid,rev:0,role:'viewer',meta:'{}',profiles:{},members:{},invites:{}};
    try{
      const r=await api('family');
      if(st!==s)return;
      st.fid=r.id;apply(r);
    }catch(e){
      const c=readCache();
      if(!e.offline||!c||!c.st||c.st.fid!==fid||c.st.uid!==uid)throw e;
      Object.assign(s,c.st); /* hors connexion : dernière copie connue */
    }
    remoteCb(build());
    pollTimer=setTimeout(poll,POLL_MS);
  }
  /* Différences entre l'état affiché et la dernière version confirmée par le serveur */
  function diff(f,role){
    const {profiles,users,invites,meta}=split(f);const b={};let n=0;
    const mj=JSON.stringify(meta);if(mj!==st.meta){b.meta=mj;n++}
    const set=[],del=[],seen={};
    profiles.forEach((p,i)=>{seen[p.id]=1;const pj=JSON.stringify(p),cur=st.profiles[p.id];if(!cur||cur.json!==pj||cur.ord!==i)set.push({id:p.id,json:pj,ord:i})});
    Object.keys(st.profiles).forEach(id=>{if(!seen[id])del.push(id)});
    if(set.length||del.length){b.profiles={set,del};n++}
    if(role==='admin'){
      const roles=[];users.forEach(u=>{const m=st.members[u.uid];if(m&&u.uid!==st.uid&&m.role!==u.role)roles.push({uid:u.uid,role:u.role})});
      if(roles.length){b.roles=roles;n++}
      const add=[],dl=[],have={};
      invites.forEach(i=>{have[i.code]=1;if(!st.invites[i.code])add.push({code:i.code,email:i.email,role:i.role,date:i.date})});
      Object.keys(st.invites).forEach(c=>{if(!have[c])dl.push(c)});
      if(add.length||dl.length){b.invites={add,del:dl};n++}
    }
    return n?b:null;
  }
  /* Envoie uniquement ce qui a changé (par fiche) : deux personnes peuvent modifier des fiches différentes en même temps.
     Hors connexion, les modifications restent en attente et partent au retour du réseau. */
  async function flush(){
    clearTimeout(timer);
    if(inflight||!pending||!st)return;
    const s0=st,p0=pending,b=diff(p0.f,p0.role);
    if(!b){if(pending===p0)pending=null;return}
    inflight=true;
    let refetch=false;
    try{
      const r=await api('family/push',b);
      if(st!==s0)return;
      if(b.meta)st.meta=b.meta;
      if(b.profiles){b.profiles.set.forEach(p=>{st.profiles[p.id]={json:p.json,ord:p.ord}});b.profiles.del.forEach(id=>{delete st.profiles[id]})}
      if(b.roles)b.roles.forEach(x=>{if(st.members[x.uid])st.members[x.uid]={...st.members[x.uid],role:x.role}});
      if(b.invites){b.invites.add.forEach(i=>{st.invites[i.code]={...i,at:Date.now()}});b.invites.del.forEach(c=>{delete st.invites[c]})}
      /* Si quelqu'un d'autre a modifié l'espace entre-temps, la version locale reste en retard : le prochain rechargement complète */
      if(r.rev===st.rev+1)st.rev=r.rev;
      saveCache();
      if(pending===p0)pending=null;
    }catch(e){
      if(e.offline)return; /* reste en attente */
      if(e.status===401){sessionLost();return}
      /* Modification refusée : on revient à la version du serveur */
      pending=null;refetch=true;errCb(e);
      if(st===s0)st.rev=0;
    }finally{inflight=false}
    if(st!==s0)return;
    if(pending&&!refetch)timer=setTimeout(flush,250);
    else poll();
  }
  function push(f,realRole){
    if(!st||!f||f.id!==st.fid||!realRole||realRole==='viewer')return;
    pending={f,role:realRole};
    clearTimeout(timer);timer=setTimeout(flush,300);
  }
  const signedIn=u=>{me=u;authCb(u)};
  return {
    msg,onRemote:f=>{remoteCb=f},onError:f=>{errCb=f},push,attach,api,
    watchAuth(cb){
      authCb=u=>{if(!u){detach();cb(null);return}cb({uid:u.uid,email:u.email,name:u.name,familyId:u.familyId||null})};
      api('me').then(signedIn,e=>{
        const c=readCache();
        if(e.offline&&c&&c.me){signedIn(c.me);return}
        if(e.status===401)clearCache();
        authCb(null);
      });
    },
    async signUp(email,pw,name){signedIn(await api('auth/register',{email,password:pw,name}))},
    async signIn(email,pw){signedIn(await api('auth/login',{email,password:pw}))},
    reset:email=>api('auth/reset-request',{email}),
    async confirmReset(token,pw){signedIn(await api('auth/reset',{token,password:pw}))},
    async signOut(){detach();me=null;clearCache();try{await api('auth/logout',{})}catch(e){}authCb(null)},
    async createFamily(f,u){
      const {profiles,meta}=split(f);
      const r=await api('family',{meta:JSON.stringify(meta),name:u.name,profiles:profiles.map((p,i)=>({id:p.id,json:JSON.stringify(p),ord:i}))});
      me={...me,familyId:r.familyId,name:u.name};
      await attach(r.familyId,u.uid);return r.familyId;
    },
    async join(code,u){
      const r=await api('family/join',{code:(code||'').trim().toUpperCase()});
      me={...me,familyId:r.familyId};
      await attach(r.familyId,u.uid);return r.familyId;
    },
    async updateName(name){const u=await api('account',{name});me={...me,...u};if(st)poll()},
    async changePassword(pw){await api('account',{password:pw})}
  };
})():null;

/* ---------- Composants de base ---------- */
const FAOK=()=>true;
const Fa=({n})=>{const d=FAI[n];return d?html`<svg className="fa-svg" viewBox=${d[0]} aria-hidden="true" focusable="false"><path fill="currentColor" fillRule=${d[2]||undefined} d=${d[1]}/></svg>`:null};
/* Icône : emoji associé à une icône (ICONMAP) ou nom d'icône direct (« fa:horseshoe ») */
const faName=e=>ICONMAP[e]||(typeof e==='string'&&e.startsWith('fa:')&&FAI[e.slice(3)]?e.slice(3):null);
const Pic=({e})=>{const n=faName(e);return n&&FAOK()?html`<${Fa} n=${n}/>`:e};
const Ico=({e,s,k,t})=>{const n=faName(e);const ok=!!n&&FAOK();const st={};if(s){st.width=s;st.height=s;st.fontSize=s*(ok?.46:.52);st.borderRadius=s*.34}if(t)st['--tint']=t;return html`<span className=${'ico '+(k||'')+(t?' t':'')+(ok?' fa':'')} style=${(s||t)?st:null}>${ok?html`<${Fa} n=${n}/>`:e}</span>`};
const CatIco=({cat,s})=>html`<${Ico} e=${cat.emoji} t=${catTint(cat)} s=${s}/>`;
const tintInk=t=>'color-mix(in srgb,'+t+' 72%,var(--ink))';
const Chip=({k,children})=>html`<span className=${'chip '+(k||'mute')}>${children}</span>`;
const Btn=({kind,sm,block,children,...r})=>html`<button type="button" className=${'btn'+(kind?' '+kind:'')+(sm?' sm':'')+(block?' block':'')} ...${r}>${children}</button>`;
const Field=({label,hint,children})=>html`<label className="fld"><span>${label}</span>${children}${hint?html`<em>${hint}</em>`:null}</label>`;
const Switch=({on,set,label})=>html`<button type="button" role="switch" aria-checked=${on} aria-label=${label} className=${'sw'+(on?' on':'')} onClick=${()=>set(!on)}><i></i></button>`;
const Section=({title,right,children})=>html`<section className="sec"><div className="sech"><h2>${title}</h2>${right||null}</div>${children}</section>`;
const Empty=({e,title,text,children})=>html`<div className="empty"><${Ico} e=${e}/><b>${title}</b><span>${text}</span>${children}</div>`;
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const kgFmt=n=>n.toLocaleString('fr-FR')+' kg';

const SKIN_TONES=[['#FBE3CF','Très clair'],['#F3CBA8','Clair'],['#E0A878','Hâlé'],['#C48A5A','Mat'],['#8F5C3A','Brun'],['#5B3A26','Foncé']];
const HAIR_COLORS=[['#1F1A17','Noir'],['#4A3326','Brun foncé'],['#7A5236','Marron'],['#A67B4F','Châtain clair'],['#D8B26A','Blond'],['#B5532D','Roux'],['#9A9A9A','Gris'],['#F1EFEA','Blanc'],['#C45A8A','Rose']];
const HAIR_STYLES=[['short','Courts'],['long','Longs'],['curly','Bouclés'],['bun','Chignon'],['bald','Chauve']];
const TOP_COLORS=['#6F9FB5','#C98F8F','#8FB58F','#B5A06F','#9B8FC9','#7A8F94'];
const DRAWN_DEFAULT={kind:'drawn',skin:'#E0A878',hair:'#4A3326',style:'short',top:'#6F9FB5',beard:false};
function Drawn({a}){
  const skin=a.skin||'#E0A878',hair=a.hair||'#4A3326',top=a.top||'#6F9FB5',st=a.style||'short';
  const shade=mix(skin,'#000000',.14);
  const curls=[[33,34,9],[42,25,9.5],[53,23,9.5],[63,27,9],[69,37,8.5],[30,46,7],[70,47,7],[50,31,8]];
  return html`<svg viewBox="0 0 100 100" width="100%" height="100%" style=${{display:'block'}} aria-hidden="true" focusable="false">
    ${st==='long'?html`<path d="M28 48 C25 22 39 14 50 14 C62 14 75 22 72 48 L74 84 L26 84 Z" fill=${hair}/>`:null}
    ${st==='bun'?html`<circle cx="50" cy="14" r="9" fill=${hair}/>`:null}
    <path d="M10 100 C12 80 30 71 50 71 C70 71 88 80 90 100 Z" fill=${top}/>
    <rect x="43" y="60" width="14" height="16" rx="6" fill=${shade}/>
    <circle cx="31.5" cy="48" r="4.5" fill=${skin}/><circle cx="68.5" cy="48" r="4.5" fill=${skin}/>
    <ellipse cx="50" cy="46" rx="19" ry="22" fill=${skin}/>
    ${a.beard?html`<path d="M31 50 C31 71 69 71 69 50 C66 60 58 64 50 64 C42 64 34 60 31 50 Z" fill=${hair}/>`:null}
    <circle cx="37" cy="54" r="3.6" fill="#E57373" opacity=".16"/><circle cx="63" cy="54" r="3.6" fill="#E57373" opacity=".16"/>
    <circle cx="42" cy="47" r="2.4" fill="#2D211C"/><circle cx="58" cy="47" r="2.4" fill="#2D211C"/>
    <path d="M43 56.5 Q50 62 57 56.5" stroke=${a.beard?skin:'#2D211C'} strokeWidth="2" fill="none" strokeLinecap="round"/>
    ${st==='curly'?html`<g fill=${hair}>${curls.map((c,n)=>html`<circle key=${n} cx=${c[0]} cy=${c[1]} r=${c[2]}/>`)}</g>`
      :st==='bald'?null
      :html`<path d="M30 47 C27 25 40 17 50 17 C61 17 73 25 70 47 C66 37 58 32 50 32 C42 32 34 37 30 47 Z" fill=${hair}/>`}
  </svg>`;
}
function Avatar({p,size=48}){
  const a=p.avatar||{};
  const em=a.emoji||TYPES[p.type].emoji;
  const inner=a.kind==='photo'&&a.photo
    ?html`<img className="av" alt="" src=${a.photo} style=${{width:size,height:size}}/>`
    :a.kind==='drawn'
    ?html`<span className="av" style=${{width:size,height:size,background:a.bg||AV_BG[0],overflow:'hidden'}}><${Drawn} a=${a}/></span>`
    :html`<span className="av" style=${{width:size,height:size,fontSize:size*.55,background:a.bg||AV_BG[0]}}>${em}</span>`;
  return html`<span className="avw">${inner}${a.acc?html`<span className="acc" style=${{width:size*.38,height:size*.38,fontSize:size*.24}}>${a.acc}</span>`:null}</span>`;
}
function Top({title,sub,back,right,onBack,gear,lead}){
  const c=useC();
  return html`<div className="top">${back?html`<button className="iconbtn" aria-label="Retour" onClick=${onBack||c.back}><${Pic} e="‹"/></button>`:null}${lead||null}<div className="tt"><h1>${title}</h1>${sub?html`<p>${sub}</p>`:null}</div><div className="tr">${right||null}${gear?html`<${GearBtn}/>`:null}</div></div>`;
}
function GearBtn(){const c=useC();return html`<button className="iconbtn" aria-label="Réglages" onClick=${()=>c.go('settings')}><${Pic} e="⚙️"/></button>`}
const GoneSheet=({what})=>{const c=useC();return html`<${Sh} title="Introuvable"><${Empty} e="🔍" title=${(what||'Cet élément')+' n’existe plus'} text="Il a peut-être été supprimé depuis un autre appareil."/><${Btn} block onClick=${c.closeSheet}>Fermer<//><//>`};
const Gone=()=>{const c=useC();return html`<${Top} title="Introuvable" back=${true}/><div className="scroll"><${Empty} e="🔍" title="Cet élément n’existe plus" text="Il a peut-être été supprimé."/></div>`};
const STAT={ok:['ok','À jour','✅'],remind:['warn','À prévoir','🔔'],pending:['info','RDV à fixer','📝'],overdue:['bad','En retard','⚠️'],toConfirm:['warn','À confirmer','🔔'],free:['mute','Sans échéance',''],new:['mute','À démarrer',''],stopped:['mute','Arrêté','']};
function Stat({i}){
  if(i.status==='booked')return html`<${Chip} k="info"><${Pic} e="📅"/> ${fmtShort(i.appt.date)}<//>`;
  const s=STAT[i.status];
  return html`<${Chip} k=${s[0]}>${s[2]?html`<${Pic} e=${s[2]}/>`:null} ${s[1]}<//>`;
}
function summary(p,today){
  let late=0,todo=0,booked=0,fresh=0;
  p.cares.forEach(c=>{if(c.archived)return;const s=careInfo(c,p.appointments,today).status;
    if(s==='overdue')late++;else if(s==='remind'||s==='pending'||s==='toConfirm')todo++;else if(s==='booked')booked++;else if(s==='new')fresh++});
  return {late,todo,booked,fresh};
}
function SumChips({p}){
  const c=useC();const s=summary(p,c.today);
  if(!s.late&&!s.todo&&!s.booked)return html`<${Chip} k="ok">Tout est à jour<//>`;
  return html`<div className="chips">${s.late?html`<${Chip} k="bad">${s.late} en retard<//>`:null}${s.todo?html`<${Chip} k="warn">${s.todo} à prévoir<//>`:null}${s.booked?html`<${Chip} k="info">${s.booked} RDV<//>`:null}</div>`;
}

/* ---------- Authentification et création de famille ---------- */
function AuthScreen(){
  const c=useC();
  const [mode,setMode]=useState(RESET&&CLOUD?'reset':JOIN?'register':'login');
  const [email,setEmail]=useState(CLOUD?'':'demo@exemple.fr');
  const [pw,setPw]=useState(CLOUD?'':'demo');
  const [name,setName]=useState('');
  const [err,setErr]=useState('');
  const [info,setInfo]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async e=>{
    e.preventDefault();
    const em=email.trim().toLowerCase();
    setErr('');setInfo('');
    if(CLOUD&&mode==='reset'){
      if(pw.length<6){setErr('Choisissez un mot de passe de 6 caractères minimum.');return}
      setBusy(true);
      try{await Cloud.confirmReset(RESET,pw);try{history.replaceState(null,'',location.pathname)}catch(x){}}catch(ex){setErr(Cloud.msg(ex))}
      setBusy(false);return;
    }
    if(CLOUD){
      if(!/^\S+@\S+\.\S+$/.test(em)||pw.length<6||(mode==='register'&&!name.trim())){setErr(mode==='register'?'Renseignez un prénom, un e-mail valide et un mot de passe de 6 caractères minimum.':'Renseignez votre e-mail et votre mot de passe.');return}
      setBusy(true);
      try{if(mode==='login')await Cloud.signIn(em,pw);else await Cloud.signUp(em,pw,name.trim())}catch(ex){setErr(Cloud.msg(ex))}
      setBusy(false);return;
    }
    if(mode==='login'){
      const acc=c.db.accounts.find(a=>a.email===em&&a.password===pw);
      if(!acc){setErr('E-mail ou mot de passe incorrect.');return}
      c.mut(d=>{d.session={email:em,familyId:acc.familyId,simRole:null}});
      c.tab(acc.familyId?'home':'createFamily');
    }else{
      if(!name.trim()||!/^\S+@\S+\.\S+$/.test(em)||pw.length<6){setErr('Renseignez un prénom, un e-mail valide et un mot de passe de 6 caractères minimum.');return}
      if(c.db.accounts.some(a=>a.email===em)){setErr('Un compte existe déjà avec cet e-mail.');return}
      c.mut(d=>{d.accounts.push({email:em,password:pw,name:name.trim(),familyId:null});d.session={email:em,familyId:null,simRole:null}});
      c.tab('createFamily');
    }
  };
  const forgot=async()=>{
    const em=email.trim().toLowerCase();setErr('');setInfo('');
    if(!/^\S+@\S+\.\S+$/.test(em)){setErr('Saisissez d’abord votre adresse e-mail ci-dessus.');return}
    try{await Cloud.reset(em);setInfo('Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.')}catch(ex){setErr(Cloud.msg(ex))}
  };
  return html`<div className="scroll" style=${{justifyContent:'center',gap:22}}>
    <div style=${{display:'flex',flexDirection:'column',alignItems:'center',gap:12,textAlign:'center'}}>
      <${Ico} e="🩺" s=${76}/>
      <h1 style=${{font:'800 28px/1.1 var(--font-d)',textWrap:'balance'}}>Carnet de santé familial</h1>
      <p className="muted" style=${{maxWidth:300}}>Les soins de toute la famille, enfants et animaux compris, au même endroit.</p>
      <div style=${{display:'flex',gap:8}}><${Ico} e="🐶" s=${34}/><${Ico} e="🐱" s=${34} k="s"/><${Ico} e="🐴" s=${34}/><${Ico} e="💉" s=${34} k="i"/><${Ico} e="📅" s=${34} k="w"/></div>
    </div>
    <form className="card pad form" onSubmit=${submit}>
      ${mode==='reset'?html`<div className="note">Choisissez votre nouveau mot de passe. Vous serez connecté(e) automatiquement.</div>`:html`<div className="seg"><button type="button" className=${mode==='login'?'on':''} onClick=${()=>{setMode('login');setErr('');setInfo('')}}>Connexion</button><button type="button" className=${mode==='register'?'on':''} onClick=${()=>{setMode('register');setErr('');setInfo('')}}>Créer un compte</button></div>`}
      ${JOIN&&mode==='register'?html`<div className="note">Vous avez reçu une invitation : créez votre compte avec <b>l’adresse e-mail à laquelle elle a été envoyée</b>, le code sera repris automatiquement.</div>`:null}
      ${mode==='register'?html`<${Field} label="Prénom"><input id="au-name" type="text" value=${name} onChange=${e=>setName(e.target.value)} autoComplete="given-name"/><//>`:null}
      ${mode==='reset'?null:html`<${Field} label="Adresse e-mail"><input id="au-mail" type="email" value=${email} onChange=${e=>setEmail(e.target.value)} autoComplete="email" autoCapitalize="none"/><//>`}
      <${Field} label=${mode==='reset'?'Nouveau mot de passe':'Mot de passe'}><input id="au-pw" type="password" value=${pw} onChange=${e=>setPw(e.target.value)} autoComplete=${mode==='login'?'current-password':'new-password'}/><//>
      ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
      ${info?html`<div className="chip ok" style=${{whiteSpace:'normal',borderRadius:12}}>${info}</div>`:null}
      <button className="btn block" type="submit" disabled=${busy}>${busy?'Patientez…':mode==='login'?'Se connecter':mode==='reset'?'Enregistrer et me connecter':'Créer mon compte'}</button>
      ${CLOUD&&mode==='login'?html`<button type="button" className="btn ghost block" onClick=${forgot}>Mot de passe oublié ?</button>`:null}
    </form>
    ${CLOUD?html`<div className="note">Vos données sont enregistrées en ligne, chiffrées pendant le transfert, et visibles uniquement par les membres de votre famille.</div>`
      :html`<div className="note">Mode démonstration : comptes simulés sur cet appareil. Essayez <b>demo@exemple.fr</b> (mot de passe demo) ou <b>lambert@exemple.fr</b>.</div>`}
  </div>`;
}
function CreateFamilyScreen(){
  const c=useC();
  const acc=c.db.accounts.find(a=>a.email===(c.db.session&&c.db.session.email))||{name:''};
  const [name,setName]=useState('');
  const [first,setFirst]=useState(acc.name||'');
  const [pal,setPal]=useState('sauge');
  const [code,setCode]=useState(JOIN);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const who=()=>({uid:c.db.session.uid,email:c.db.session.email,name:(acc.name||first||'').trim()||c.db.session.email.split('@')[0]});
  const create=async e=>{
    e.preventDefault();
    if(!name.trim()||!first.trim()||busy)return;
    const t=PALETTES.find(x=>x.id===pal);
    const fid=uid();
    const fam={id:fid,name:name.trim(),theme:{...t},users:[{email:c.db.session.email,name:first.trim(),role:'admin'}],invites:[],cats:[],
      settings:{apptDefaults:AR(),showReminders:true},
      profiles:[mkProfile({type:'adult',name:first.trim(),avatar:{kind:'emoji',emoji:'🧑',bg:AV_BG[0],acc:''}})]};
    if(CLOUD){
      setBusy(true);setErr('');
      let realId;
      try{realId=await Cloud.createFamily(fam,{...who(),name:first.trim()})}catch(ex){setErr(Cloud.msg(ex));setBusy(false);return}
      c.mut(d=>{d.session.familyId=realId;d.accounts[0].familyId=realId;d.accounts[0].name=first.trim()});
    }else{
      c.mut(d=>{
        d.families[fid]=fam;
        d.session.familyId=fid;
        d.accounts.find(a=>a.email===d.session.email).familyId=fid;
      });
    }
    c.tab('home');c.toast('Votre espace familial est prêt');
  };
  const joinNow=async()=>{
    if(!code.trim()||busy)return;
    setBusy(true);setErr('');
    try{const fid=await Cloud.join(code,who());c.mut(d=>{d.session.familyId=fid;d.accounts[0].familyId=fid});c.tab('home');c.toast('Bienvenue dans l’espace familial')}
    catch(ex){setErr(Cloud.msg(ex))}
    setBusy(false);
  };
  return html`<${Top} title="Votre espace familial" sub="Privé, partagé uniquement avec les personnes que vous invitez"/>
    <form className="scroll" onSubmit=${create}>
      ${CLOUD?html`<${Section} title="J’ai reçu une invitation"><div className="card pad form">
        <${Field} label="Code d’invitation" hint="Créez d’abord votre compte avec l’adresse e-mail à laquelle l’invitation a été envoyée."><input id="cf-code" type="text" value=${code} onChange=${e=>setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off"/><//>
        <${Btn} block onClick=${joinNow} disabled=${busy||!code.trim()}>Rejoindre la famille<//></div>
        <div className="muted" style=${{textAlign:'center'}}>— ou créez votre propre espace —</div><//>`:null}
      <div className="card pad form">
        <${Field} label="Nom de la famille"><input id="cf-name" type="text" value=${name} onChange=${e=>setName(e.target.value)} placeholder="Famille Martin"/><//>
        <${Field} label="Votre prénom"><input id="cf-first" type="text" value=${first} onChange=${e=>setFirst(e.target.value)}/><//>
      </div>
      <${Section} title="Couleurs de l’espace">
        <div className="grid">${PALETTES.map(x=>html`<button type="button" key=${x.id} className=${'tile'+(pal===x.id?' on':'')} onClick=${()=>setPal(x.id)}><div className="swatches"><i style=${{background:x.primary}}></i><i style=${{background:x.secondary}}></i><i style=${{background:x.bg}}></i></div>${x.name}</button>`)}</div>
      <//>
      ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
      <div className="note">Vous ajouterez ensuite votre conjoint(e), vos enfants, même s’il n’y en a pas encore, et vos animaux. Tout reste modifiable.</div>
      <button className="btn block" type="submit" disabled=${!name.trim()||!first.trim()||busy}>${busy?'Patientez…':'Créer l’espace'}</button>
      ${CLOUD?html`<button type="button" className="btn ghost block" onClick=${()=>Cloud.signOut()}>Changer de compte</button>`:null}
    </form>`;
}

/* ---------- Accueil ---------- */
/* Ligne compacte pour l'accueil : un seul bouton d'action, le reste via le clic sur la ligne */
function RemRow({r}){
  const c=useC();const {p}=r;
  let ico='🔔',k='w',title='',sub='',act=null,go=null;
  if(r.kind==='care'){
    const i=r.i;title=r.c.name+' · '+p.name;go=()=>c.go('care',{pid:p.id,cid:r.c.id});
    if(i.status==='overdue'){ico='⚠️';k='b';sub='En retard de '+diffDays(c.today,i.due)+' j';act=['Noter le RDV',()=>c.openSheet('appt',{pid:p.id,cid:r.c.id})]}
    else if(i.status==='remind'){ico='🔔';k='w';sub='À prévoir avant le '+fmtShort(i.due);act=['Prendre RDV',()=>c.setPending(p.id,r.c.id,true)]}
    else if(i.status==='pending'){ico='📝';k='i';sub='RDV à fixer avant le '+fmtShort(i.due);act=['Noter le RDV',()=>c.openSheet('appt',{pid:p.id,cid:r.c.id})]}
    else{ico='✅';k='g';sub='RDV du '+fmtShort(i.appt.date)+' passé';act=['Fait le…',()=>c.openSheet('real',{pid:p.id,cid:r.c.id,aid:i.appt.id,date:i.appt.date})]}
  }else if(r.kind==='appt'){
    ico='📅';k='i';title=apptTitle(r.a,p)+' · '+andJoin(r.names||[p.name]);go=()=>c.tab('appts');
    sub=(r.days===0?'Aujourd’hui':r.days===1?'Demain':'Dans '+r.days+' jours')+(r.a.time?' à '+r.a.time:'');
  }else{
    ico='💊';k='g';title=r.t.name+' · '+p.name;go=()=>c.go('treatments',{pid:p.id});sub='Prise à '+r.t.remind.time+(r.t.dose?' · '+r.t.dose:'');
  }
  const quick=r.kind==='care'&&c.canEdit&&r.i.status!=='toConfirm';
  return html`<div className="row act rr" role="button" tabIndex="0" onClick=${go} onKeyDown=${e=>{if(e.key==='Enter')go()}}><${Ico} e=${ico} k=${k}/><div className="grow"><b>${title}</b><small>${sub}</small></div>${quick?html`<button type="button" className="donebtn" aria-label=${'Fait aujourd’hui : '+r.c.name} title="Fait aujourd’hui" onClick=${e=>{e.stopPropagation();c.quickDone(p.id,r.c.id)}}><${Pic} e="✓"/></button>`:null}${act?html`<${Btn} sm onClick=${e=>{e.stopPropagation();act[1]()}}>${act[0]}<//>`:null}</div>`;
}
function upcomingDues(fam,today){
  const out=[];
  fam.profiles.forEach(p=>{if(p.archived)return;p.cares.forEach(care=>{if(care.archived)return;const i=careInfo(care,p.appointments,today);
    if(i.status==='ok'&&i.due&&i.due>=today)out.push({p,c:care,i})})});
  return out.sort((a,b)=>a.i.due<b.i.due?-1:1);
}
/* « dans 12 jours », « dans 3 mois », « dans 1 an et 7 mois » */
function inLabel(d,today){
  const n=diffDays(d,today);
  if(n<=0)return 'aujourd’hui';if(n===1)return 'demain';if(n<45)return 'dans '+n+' jours';
  const a=parse(today),b=parse(d);let m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth();if(b.getDate()<a.getDate())m--;
  if(m<12)return 'dans '+Math.max(1,m)+' mois';
  const y=Math.floor(m/12),r=m%12;return 'dans '+y+' an'+(y>1?'s':'')+(r?' et '+r+' mois':'');
}
const monthLabel=iso=>cap(parse(iso).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}));
function byMonth(items,dateOf){const g=[];items.forEach(x=>{const k=dateOf(x).slice(0,7);let l=g[g.length-1];if(!l||l.k!==k){l={k,label:monthLabel(dateOf(x)),items:[]};g.push(l)}l.items.push(x)});return g}
function allDues(fam,today){
  const out=[];
  fam.profiles.forEach(p=>{if(p.archived)return;p.cares.forEach(care=>{if(care.archived)return;const i=careInfo(care,p.appointments,today);
    if(i.due&&['ok','remind','pending','overdue'].includes(i.status))out.push({p,c:care,i})})});
  return out.sort((a,b)=>a.i.due<b.i.due?-1:1);
}
function DueRow({x}){
  const c=useC();const st=x.i.status;
  const chip=st==='overdue'?html`<${Chip} k="bad"><${Pic} e="⚠️"/> En retard<//>`:st==='remind'?html`<${Chip} k="warn"><${Pic} e="🔔"/> À prévoir<//>`:st==='pending'?html`<${Chip} k="info"><${Pic} e="📝"/> RDV à fixer<//>`:html`<${Chip} k="mute">${inLabel(x.i.due,c.today)}<//>`;
  return html`<button className="row" onClick=${()=>c.go('care',{pid:x.p.id,cid:x.c.id})}><${CatIco} cat=${catOf(c.fam,x.c.category)}/><div className="grow"><b>${x.c.name} · ${x.p.name}</b><small>Échéance le ${fmt(x.i.due)}</small></div>${chip}</button>`;
}
function ApptRow({p,a,ps,onClick}){
  const c=useC();
  const care=p.cares.find(x=>x.id===a.careId);
  return html`<button className="row" onClick=${onClick}>${care?html`<${CatIco} cat=${catOf(c.fam,care.category)}/>`:html`<${Ico} e="📅" k="i"/>`}<div className="grow"><b>${apptTitle(a,p)} · ${andJoin((ps||[p]).map(x=>x.name))}</b><small>${fmt(a.date,{weekday:'short',day:'numeric',month:'short'})}${a.time?' à '+a.time:''}${a.place?' · '+a.place:''}</small></div></button>`;
}
function memberStat(p,today){
  let total=0,good=0,late=0,todo=0,fresh=0;
  p.cares.forEach(x=>{if(x.archived)return;const st=careInfo(x,p.appointments,today).status;
    if(st==='ok'||st==='booked'){total++;good++}else if(st==='overdue'){total++;late++}else if(st==='remind'||st==='pending'||st==='toConfirm'){total++;todo++}else if(st==='new')fresh++});
  return {total,good,late,todo,fresh};
}
function MemberChip({p}){
  const c=useC();const st=memberStat(p,c.today);
  if(st.late)return html`<${Chip} k="bad"><${Pic} e="⚠️"/> ${st.late} en retard<//>`;
  if(st.todo)return html`<${Chip} k="warn"><${Pic} e="🔔"/> ${st.todo} à prévoir<//>`;
  if(st.fresh)return html`<${Chip} k="mute">${st.fresh} sans date<//>`;
  if(st.total)return html`<${Chip} k="ok"><${Pic} e="✅"/> À jour<//>`;
  return html`<${Chip} k="mute">Aucun soin suivi<//>`;
}
function HomeScreen(){
  const c=useC();const {fam,today}=c;
  const [showArch,setShowArch]=useState(false);
  const act=fam.profiles.filter(p=>!p.archived),arch=fam.profiles.filter(p=>p.archived);
  const all=fam.settings.showReminders?collect(fam,today):[];
  const rems=all.slice(0,5);
  const appts=upcomingAppts(fam,today).filter(x=>x.a.date>=today).slice(0,3);
  const ttl=(e,t)=>html`<span style=${{display:'inline-flex',alignItems:'center',gap:8}}><${Pic} e=${e}/>${t}</span>`;
  return html`<${Top} title=${fam.name} sub=${cap(fmtLong(today))} gear=${true}/>
    <div className="scroll pb">
      <div className="fgrid">
        ${act.map(p=>html`<button key=${p.id} className="fcard" onClick=${()=>c.go('book',{pid:p.id})}><${Avatar} p=${p} size=${64}/><b>${p.name}</b><small>${subtitle(p,today)}</small><${MemberChip} p=${p}/></button>`)}
        ${c.canEdit?html`<button className="fcard add" onClick=${()=>c.openSheet('addMember')} aria-label="Ajouter un membre ou un animal"><${Ico} e="＋" s=${48}/><b>Ajouter</b><small>Personne ou animal</small></button>`:null}
      </div>
      <${Section} title=${ttl('🔔','À faire')} right=${all.length>5?html`<button className="link" onClick=${()=>c.tab('appts')}>Tout voir (${all.length})</button>`:null}>
        ${rems.length?html`<div className="card">${rems.map((r,n)=>html`<${RemRow} key=${n+r.kind+r.p.id+(r.c?r.c.id:r.t?r.t.id:r.a.id)} r=${r}/>`)}</div>`
          :html`<div className="card"><${Empty} e="🌿" title="Rien à signaler" text="Aucun soin à prévoir pour le moment."/></div>`}
      <//>
      <${Section} title=${ttl('📅','Prochains rendez-vous')} right=${html`<button className="link" onClick=${()=>c.tab('appts')}>Agenda</button>`}>
        ${appts.length?html`<div className="card">${appts.map(x=>html`<${ApptRow} key=${x.a.id} p=${x.p} a=${x.a} ps=${x.ps} onClick=${()=>c.tab('appts')}/>`)}</div>`
          :html`<div className="card"><${Empty} e="📅" title="Aucun rendez-vous programmé" text="Notez un rendez-vous pour recevoir ses rappels."/></div>`}
      <//>
      ${arch.length?html`<div className="sec"><button className="link" style=${{textAlign:'left'}} onClick=${()=>setShowArch(!showArch)}>${showArch?'Masquer':'Afficher'} les profils archivés (${arch.length})</button>
        ${showArch?html`<div className="card">${arch.map(p=>html`<div key=${p.id} className="row"><${Avatar} p=${p} size=${42}/><div className="grow"><b>${p.name}</b><small>Données conservées</small></div>${c.canAdmin?html`<${Btn} sm kind="soft" onClick=${()=>{c.mut(d=>{P(d,p.id).archived=false});c.toast(p.name+' est de nouveau actif')}}>Réactiver<//>`:null}</div>`)}</div>`:null}</div>`:null}
    </div>`;
}

/* ---------- Profil ---------- */
function infoRows(p,fam){
  const i=p.info||{},t=TYPES[p.type],r=[];
  const add=(l,v)=>{if(v)r.push([l,v])};
  const nb=p.birth?(p.birthApprox?'≈ '+parse(p.birth).getFullYear()+' (approximatif)':fmt(p.birth)):'';
  /* Médecin ou vétérinaire relié à l'annuaire : affiché à part, avec ses coordonnées */
  const linked=fam&&contactOf(fam,t.human?i.doctorId:i.vetId);
  if(t.human){add('Naissance',nb);add('Sexe',p.sex);add('Groupe sanguin',i.blood);add('Allergies',i.allergies);if(!linked)add('Médecin traitant',i.doctor)}
  else{add('Espèce',i.species||t.species);add('Race',i.breed);add('Robe',i.coat);add('Sexe',p.sex);add('Naissance',nb);add('Taille',i.size);add('N° de puce',i.chip);add('Stérilisé(e) / castré(e)',i.neutered?'Oui':'');if(!linked)add('Vétérinaire',i.vet)}
  return r;
}
function careInfos(p,today){
  const s=summary(p,today);return {late:s.late,todo:s.todo+0};
}

/* ---------- Carnet de soins ---------- */
function CareRow({p,c:care}){
  const c=useC();const i=careInfo(care,p.appointments,c.today);const cat=catOf(c.fam,care.category);
  const go=()=>c.canEdit?c.openSheet('careEdit',{pid:p.id,cid:care.id}):c.go('care',{pid:p.id,cid:care.id});
  return html`<div className=${'row act rr'+(c.flash===care.id?' flash':'')} role="button" tabIndex="0" onClick=${go} onKeyDown=${e=>{if(e.key==='Enter')go()}}><${CatIco} cat=${cat}/><div className="grow"><b>${care.name}</b><small>${i.last?'Dernier : '+fmt(i.last):'Jamais fait'}${i.due?' · Prochain : '+fmt(i.due):''}</small>${i.status!=='ok'?html`<div style=${{marginTop:6}}><${Stat} i=${i}/></div>`:null}</div>${c.canEdit&&!care.archived?html`<button type="button" className="donebtn" aria-label=${'Fait aujourd’hui : '+care.name} title="Fait aujourd’hui" onClick=${e=>{e.stopPropagation();c.quickDone(p.id,care.id)}}><${Pic} e="✓"/></button>`:null}</div>`;
}
function BookScreen({p:q}){
  const c=useC();const p=c.prof(q.pid);
  if(!p)return html`<${Gone}/>`;
  const live=p.cares.filter(x=>!x.archived),stopped=p.cares.filter(x=>x.archived);
  const order=allCats(c.fam).map(x=>x.id);
  const groups={};live.forEach(x=>{(groups[x.category]=groups[x.category]||[]).push(x)});
  const keys=Object.keys(groups).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  const s=summary(p,c.today);
  const lw=lastWeight(p);const showW=!TYPES[p.type].human||lw;
  const active=(p.treatments||[]).filter(t=>t.status==='active');
  const rows=infoRows(p,c.fam).filter(x=>x[0]!=='Espèce');
  const pk=contactOf(c.fam,TYPES[p.type].human?(p.info||{}).doctorId:(p.info||{}).vetId);
  return html`<${Top} back=${true} lead=${html`<${Avatar} p=${p} size=${44}/>`} title=${p.name} sub=${subtitle(p,c.today)} right=${c.canEdit?html`<button className="iconbtn" aria-label="Plus d’actions" onClick=${()=>c.openSheet('profileMenu',{pid:p.id})}><${Pic} e="⋯"/></button>`:null}/>
    <div className="scroll pb">
      ${(rows.length||p.notes)?html`<div className="card pad"><dl className="kv">${rows.map(x=>html`<${React.Fragment} key=${x[0]}><dt>${x[0]}</dt><dd>${x[1]}</dd><//>`)}${p.notes?html`<dt>Notes</dt><dd>${p.notes}</dd>`:null}</dl></div>`:null}
      ${pk?html`<div className="card"><div className="row"><button type="button" className="grow linkrow" onClick=${()=>c.go('contact',{id:pk.id})}><small>${TYPES[p.type].human?'Médecin traitant':'Vétérinaire'}</small><b>${pk.name}</b>${pk.specialty?html`<small>${pk.specialty}</small>`:null}</button>${pk.phone?html`<a className="btn sm soft" href=${telHref(pk.phone)} aria-label=${'Appeler '+pk.name}>📞 Appeler</a>`:null}</div></div>`:null}
      <div className="scs">
        ${showW?html`<button className="sc" onClick=${()=>c.go('weight',{pid:p.id})}><${Ico} e="⚖️" k="s" s=${38}/>Poids<small>${lw?kgFmt(lw.kg):'Ajouter'}</small></button>`:null}
        <button className="sc" onClick=${()=>c.go('treatments',{pid:p.id})}><${Ico} e="💊" k="g" s=${38}/>Traitements<small>${active.length?active.length+' en cours':'Aucun'}</small></button>
      </div>
      ${live.length?html`<div className="chips">${s.late?html`<${Chip} k="bad">${s.late} en retard<//>`:null}${s.todo?html`<${Chip} k="warn">${s.todo} à prévoir<//>`:null}${s.booked?html`<${Chip} k="info">${s.booked} rendez-vous<//>`:null}${s.fresh?html`<${Chip} k="mute">${s.fresh} sans date<//>`:null}${!s.late&&!s.todo&&!s.fresh?html`<${Chip} k="ok">Tout est à jour<//>`:null}</div>`:null}
      ${keys.map(k=>{const cat=catOf(c.fam,k);if(groups[k].length===1&&groups[k][0].name.trim().toLowerCase()===cat.label.trim().toLowerCase())return html`<section key=${k} className="sec"><div className="card"><${CareRow} p=${p} c=${groups[k][0]}/></div></section>`;return html`<${Section} key=${k} title=${html`<span style=${{display:'inline-flex',alignItems:'center',gap:8}}><span style=${{color:tintInk(catTint(cat)),display:'inline-flex'}}><${Pic} e=${cat.emoji}/></span>${cat.label}</span>`}><div className="card">${groups[k].map(x=>html`<${CareRow} key=${x.id} p=${p} c=${x}/>`)}</div><//>`})}
      ${!live.length?html`<div className="card"><${Empty} e="📖" title="Le carnet est vide" text="Ajoutez un premier soin : un rendez-vous, un vaccin, un vermifuge…"/></div>`:null}
      ${stopped.length?html`<${Section} title="Suivis arrêtés"><div className="card">${stopped.map(x=>html`<${CareRow} key=${x.id} p=${p} c=${x}/>`)}</div><//>`:null}
    </div>
    ${c.canEdit?html`<button className="btn fab" onClick=${()=>c.go('careForm',{pid:p.id})}><${Pic} e="＋"/> Ajouter un soin</button>`:null}`;
}
function CareScreen({p:q}){
  const c=useC();const p=c.prof(q.pid);const care=p&&p.cares.find(x=>x.id===q.cid);
  if(!care)return html`<${Gone}/>`;
  const i=careInfo(care,p.appointments,c.today);const cat=catOf(c.fam,care.category);
  /* Seul le message de l'état actuel est calculé (un soin jamais fait n'a pas d'échéance) */
  const msgs={
    ok:()=>'Prochaine échéance le '+fmt(i.due)+(care.remind?'. Rappel dès le '+fmt(i.rem)+'.':'.'),
    remind:()=>'Échéance le '+fmt(i.due)+'. C’est le moment de prendre rendez-vous.',
    pending:()=>'Rendez-vous à fixer avant le '+fmt(i.due)+'.',
    overdue:()=>'Échéance dépassée depuis le '+fmt(i.due)+' ('+diffDays(c.today,i.due)+' jours).',
    booked:()=>i.appt?'Rendez-vous le '+fmt(i.appt.date)+(i.appt.time?' à '+i.appt.time:'')+'.':'',
    toConfirm:()=>i.appt?'Le rendez-vous du '+fmt(i.appt.date)+' est passé. Confirmez qu’il a eu lieu.':'',
    free:()=>'Fréquence non fixe : aucune échéance calculée.',
    new:()=>'Pas encore fait : touchez « Fait le… » pour noter la première fois.',
    stopped:()=>'Suivi arrêté. L’historique reste consultable.'
  };
  const msg=msgs[i.status]?msgs[i.status]():'';
  const k={ok:'g',remind:'w',pending:'i',overdue:'b',booked:'i',toConfirm:'w',free:'',new:'',stopped:''}[i.status];
  const ask=()=>c.openSheet('confirm',{title:'Supprimer ce soin ?',text:'« '+care.name+' » et son historique ('+care.realizations.length+' fois) seront définitivement supprimés. Pour garder l’historique, arrêtez plutôt le suivi.',label:'Supprimer définitivement',danger:true,
    run:()=>{c.mut(d=>{const pr=P(d,p.id);pr.cares=pr.cares.filter(x=>x.id!==care.id);pr.appointments=pr.appointments.filter(a=>a.careId!==care.id)});c.back();c.toast('Soin supprimé')},
    altLabel:care.archived?null:'Arrêter le suivi (garder l’historique)',alt:()=>{c.mut(d=>{P(d,p.id).cares.find(x=>x.id===care.id).archived=true});c.toast('Suivi arrêté')}});
  return html`<${Top} back=${true} title=${care.name} sub=${p.name+' · '+cat.label}/>
    <div className="scroll">
      <div className="card rem"><div className="top2"><${CatIco} cat=${cat}/><div className="tx"><div style=${{marginBottom:4}}><${Stat} i=${i}/></div><span>${msg}</span></div></div>
        ${c.canEdit&&!care.archived?html`<div className="btns">
          ${i.status==='remind'?html`<${Btn} onClick=${()=>c.setPending(p.id,care.id,true)}>Je dois prendre RDV<//>`:null}
          ${['remind','pending','overdue','new','free','ok'].includes(i.status)?html`<${Btn} kind=${i.status==='remind'?'soft':(['pending','overdue'].includes(i.status)?'':'soft')} onClick=${()=>c.openSheet('appt',{pid:p.id,cid:care.id})}>Noter un RDV<//>`:null}
          ${i.status==='booked'?html`<${Btn} onClick=${()=>c.openSheet('real',{pid:p.id,cid:care.id,aid:i.appt.id,date:i.appt.date})}>Fait le…<//><${Btn} kind="soft" onClick=${()=>c.openSheet('cal',{})}>Agenda du téléphone<//>`:null}
          ${i.status==='toConfirm'?html`<${Btn} onClick=${()=>c.openSheet('real',{pid:p.id,cid:care.id,aid:i.appt.id,date:i.appt.date})}>Fait le…<//><${Btn} kind="soft" onClick=${()=>c.openSheet('appt',{pid:p.id,aid:i.appt.id})}>Reprogrammer<//>`:null}
          ${!['booked','toConfirm'].includes(i.status)?html`<${Btn} kind=${['pending','overdue'].includes(i.status)?'soft':''} onClick=${()=>c.openSheet('real',{pid:p.id,cid:care.id})}>Fait le…<//>`:null}
        </div>`:null}
      </div>
      <${Section} title="Réglages du soin" right=${c.canEdit?html`<button className="link" onClick=${()=>c.go('careForm',{pid:p.id,cid:care.id})}>Modifier le soin</button>`:null}>
        ${(()=>{const body=html`<dl className="kv">
          <dt>Périodicité</dt><dd>${freqLabel(care.freq)}</dd>
          <dt>Rappel RDV</dt><dd>${care.freq?remLabel(care.remind):'Sans échéance'}</dd>
          <dt>Avant un RDV</dt><dd>${(care.apptReminders||[]).filter(r=>r.on).map(r=>'J-'+r.days).join(' · ')||'Désactivés'}</dd>
        </dl>`;
          return c.canEdit?html`<button type="button" className="card pad tapcard" onClick=${()=>c.openSheet('freq',{pid:p.id,cid:care.id})}>${body}<span className="tapedit"><${Pic} e="✏️"/> Modifier la périodicité et les rappels</span></button>`:html`<div className="card pad">${body}</div>`})()}
        ${proName(c.fam,care)||care.notes?html`<div className="card">
          ${proName(c.fam,care)?(contactOf(c.fam,care.proId)?html`<button className="row" onClick=${()=>c.go('contact',{id:care.proId})}><${Ico} e=${KINDS[contactOf(c.fam,care.proId).kind][1]} k="i"/><div className="grow"><b>${proName(c.fam,care)}</b><small>${[KINDS[contactOf(c.fam,care.proId).kind][0],contactOf(c.fam,care.proId).phone].filter(Boolean).join(' · ')}</small></div><span className="go"><${Pic} e="›"/></span></button>`
            :html`<div className="row"><${Ico} e="🥼" k="i"/><div className="grow"><b>${care.pro}</b><small>Professionnel (sans fiche dans l’annuaire)</small></div></div>`):null}
          ${care.notes?html`<div className="row"><${Ico} e="📝"/><div className="grow"><small>Observations</small><span>${care.notes}</span></div></div>`:null}
        </div>`:null}
      <//>
      <${Section} title=${'Historique ('+i.reals.length+')'}>
        <div className="card">${i.reals.length?i.reals.map(r=>html`<button key=${r.id} className="row" onClick=${()=>c.canEdit&&c.openSheet('real',{pid:p.id,cid:care.id,rid:r.id})}><span className="dateblk"><b>${parse(r.date).getDate()}</b><span>${parse(r.date).toLocaleDateString('fr-FR',{month:'short'}).replace('.','')}</span></span><div className="grow"><b>${fmt(r.date)}</b><small>${[r.note,r.pro,r.docs&&r.docs.length?'📎 '+r.docs.length+' document'+(r.docs.length>1?'s':''):''].filter(Boolean).join(' · ')||'Sans observation'}</small></div></button>`)
          :html`<${Empty} e="🕘" title="Pas encore d’historique" text="Chaque « fait le » s’ajoutera ici, sans effacer les précédents."/>`}</div>
        ${(care.freqLog||[]).length?html`<div className="note">${care.freqLog.slice().reverse().map((l,n)=>html`<div key=${n}>Le ${fmt(l.date)} : ${l.from} → ${l.to}</div>`)}</div>`:null}
      <//>
      ${c.canEdit?html`<div className="btns">
        ${care.archived?html`<${Btn} kind="soft" onClick=${()=>{c.mut(d=>{P(d,p.id).cares.find(x=>x.id===care.id).archived=false});c.toast('Suivi repris')}}>Reprendre le suivi<//>`:html`<${Btn} kind="ghost" onClick=${()=>{c.mut(d=>{P(d,p.id).cares.find(x=>x.id===care.id).archived=true});c.toast('Suivi arrêté, historique conservé')}}>Arrêter le suivi<//>`}
        <${Btn} kind="danger" onClick=${ask}>Supprimer<//></div>`:null}
    </div>`;
}

/* ---------- Fréquences et rappels (champs partagés) ---------- */
const vFrom=(care,def)=>({freqOn:care?!!care.freq:true,fn:String(care&&care.freq?care.freq.n:1),fu:care&&care.freq?care.freq.unit:'y',
  remOn:care?!!care.remind:true,rn:String(care&&care.remind?care.remind.n:1),ru:care&&care.remind?care.remind.unit:'m',ar:(care?care.apptReminders:def).map(x=>({...x}))});
const toFreq=v=>v.freqOn?{n:Math.max(1,parseInt(v.fn)||1),unit:v.fu}:null;
const toRem=v=>v.freqOn&&v.remOn?{n:Math.max(0,parseInt(v.rn)||0),unit:v.ru}:null;
const toAr=v=>v.ar.map(x=>({days:Math.max(1,parseInt(x.days)||1),on:!!x.on}));
const UNITS=[['d','jours'],['w','semaines'],['m','mois'],['y','années']];
function RemFields({v,set,last}){
  const u=(k,x)=>set({...v,[k]:x});
  const fr=toFreq(v),rm=toRem(v);
  const due=fr&&last?addUnit(last,fr.n,fr.unit):null;
  const setAr=(n,k,x)=>set({...v,ar:v.ar.map((r,j)=>j===n?{...r,[k]:x}:r)});
  return html`<div className="form">
    <div className="swrow"><div><b style=${{font:'700 15px var(--font-d)'}}>Fréquence fixe</b><div className="muted">Calcule l’échéance suivante chaque fois que c’est fait</div></div><${Switch} on=${v.freqOn} set=${x=>u('freqOn',x)} label="Fréquence fixe"/></div>
    ${v.freqOn?html`<div className="inl"><span>Tous les</span><input id="rf-n" className="num" type="number" min="1" inputMode="numeric" value=${v.fn} onChange=${e=>u('fn',e.target.value)} aria-label="Nombre"/><select id="rf-u" value=${v.fu} onChange=${e=>u('fu',e.target.value)} aria-label="Unité">${UNITS.map(x=>html`<option key=${x[0]} value=${x[0]}>${x[1]}</option>`)}</select></div>`:null}
    ${v.freqOn?html`<div className="swrow"><div><b style=${{font:'700 15px var(--font-d)'}}>Rappel pour prendre RDV</b><div className="muted">Délai propre à ce soin</div></div><${Switch} on=${v.remOn} set=${x=>u('remOn',x)} label="Rappel anticipé"/></div>`:html`<div className="note">Sans fréquence fixe, aucune échéance n’est calculée : pas de rappel de renouvellement.</div>`}
    ${v.freqOn&&v.remOn?html`<div className="inl"><span>Me prévenir</span><input id="rf-rn" className="num" type="number" min="0" inputMode="numeric" value=${v.rn} onChange=${e=>u('rn',e.target.value)} aria-label="Délai du rappel"/><select id="rf-ru" value=${v.ru} onChange=${e=>u('ru',e.target.value)} aria-label="Unité du rappel">${UNITS.map(x=>html`<option key=${x[0]} value=${x[0]}>${x[1]}</option>`)}</select><span>avant l’échéance</span></div>`:null}
    <hr/>
    <div><b style=${{font:'700 15px var(--font-d)'}}>Une fois le RDV fixé</b><div className="muted">Deux rappels indépendants, modifiables ou désactivables</div></div>
    ${v.ar.map((r,n)=>html`<div key=${n} className="swrow"><div className="inl"><input id=${'rf-ar'+n} className="num" type="number" min="1" inputMode="numeric" value=${r.days} onChange=${e=>setAr(n,'days',e.target.value)} aria-label=${'Jours avant, rappel '+(n+1)}/><span>jour(s) avant le RDV</span></div><${Switch} on=${r.on} set=${x=>setAr(n,'on',x)} label=${'Rappel '+(n+1)}/></div>`)}
    ${due?html`<div className="note">Prochaine échéance : <b>${fmt(due)}</b>${rm?html` · rappel dès le <b>${fmt(addUnit(due,-rm.n,rm.unit))}</b>`:null}</div>`:null}
  </div>`;
}
/* ---------- Ajout et modification d'un soin ---------- */
function CareFormScreen({p:q}){
  const c=useC();const p=c.prof(q.pid);const ex=p&&q.cid?p.cares.find(x=>x.id===q.cid):null;
  const [name,setName]=useState(ex?ex.name:'');
  const [cat,setCat]=useState(ex?ex.category:'');
  const [pro,setPro]=useState(ex?(contactOf(c.fam,ex.proId)?'':ex.pro):'');
  const [proId,setProId]=useState(ex&&contactOf(c.fam,ex.proId)?ex.proId:'');
  const [notes,setNotes]=useState(ex?ex.notes:'');
  const [last,setLast]=useState('');
  const [v,setV]=useState(()=>vFrom(ex,c.fam.settings.apptDefaults));
  const [err,setErr]=useState('');
  const dirty=useDirty([name,cat,pro,proId,notes,last,v]);
  if(!p)return html`<${Gone}/>`;
  const cats=catsFor(c.fam,p);
  const contacts=(c.fam.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  /* Le nom du soin suit le type choisi tant qu'il n'a pas été personnalisé */
  const pick=(id,label)=>{const prev=cat?catOf(c.fam,cat):null;if(!name||(prev&&name===prev.label))setName(label||catOf(c.fam,id).label);setCat(id)};
  const save=()=>{
    if(!name.trim()){setErr('Donnez un nom à ce soin.');return}
    if(!cat){setErr('Choisissez un type de soin.');return}
    const k=contactOf(c.fam,proId);const proTxt=k?k.name:pro.trim();
    const freq=toFreq(v),remind=toRem(v),ar=toAr(v);
    c.mut(d=>{
      const pr=P(d,p.id);
      if(ex){
        const t=pr.cares.find(x=>x.id===ex.id);
        const before=freqLabel(t.freq),after=freqLabel(freq);
        if(before!==after){t.freqLog=t.freqLog||[];t.freqLog.push({date:c.today,from:before,to:after})}
        Object.assign(t,{name:name.trim(),category:cat,pro:proTxt,proId:k?k.id:null,notes,freq,remind,apptReminders:ar});
      }else{
        pr.cares.push({id:uid(),name:name.trim(),category:cat,pro:proTxt,proId:k?k.id:null,notes,freq,remind,apptReminders:ar,pending:false,archived:false,freqLog:[],
          realizations:last?[{id:uid(),date:last,note:'',pro:proTxt,docs:[]}]:[]});
      }
    });
    c.back();c.toast(ex?'Soin modifié':'Soin ajouté au carnet');
  };
  return html`<${FormTop} title=${ex?'Modifier le soin':'Nouveau soin'} sub=${p.name} dirty=${dirty} onSave=${save}/>
    <div className="scroll">
      <div className="card pad form">
        <div><div className="sech" style=${{marginBottom:8}}><span className="lbl">Type de soin</span><button type="button" className="link" onClick=${()=>c.go('cats')}>Gérer les types</button></div>
          <div className="grid">${cats.map(x=>html`<button type="button" key=${x.id} className=${'tile'+(cat===x.id?' on':'')} onClick=${()=>pick(x.id)}><${CatIco} cat=${x} s=${36}/>${x.label}</button>`)}
            <button type="button" className="tile" onClick=${()=>c.openSheet('cat',{k:TYPES[p.type].k,onSaved:(id,label)=>pick(id,label)})}><${Ico} e="＋" s=${36}/>Nouveau type</button></div></div>
        <${Field} label="Nom du soin"><input id="cf-nom" type="text" value=${name} onChange=${e=>setName(e.target.value)} placeholder="Ex. Vaccination annuelle"/><//>
        <div className="fld"><div className="sech"><span className="lbl">Professionnel ou établissement</span><button type="button" className="link" onClick=${()=>c.openSheet('contact',{kind:TYPES[p.type].human?'doctor':'vet',onSaved:id=>setProId(id)})}>＋ Nouvelle fiche</button></div>
          <select id="cf-proid" aria-label="Fiche de l’annuaire" value=${proId} onChange=${e=>setProId(e.target.value)}><option value="">Aucune fiche (saisie libre)</option>${contacts.map(k=>html`<option key=${k.id} value=${k.id}>${k.name}${k.specialty?' · '+k.specialty:''}</option>`)}</select>
          ${!proId?html`<input id="cf-pro" type="text" aria-label="Nom du professionnel" placeholder="Nom (facultatif)" value=${pro} onChange=${e=>setPro(e.target.value)}/>`:null}</div>
        ${!ex?html`<${Field} label="Dernière fois fait le" hint="Facultatif. Crée la première ligne de l’historique."><input id="cf-last" type="date" max=${c.today} value=${last} onChange=${e=>setLast(e.target.value)}/><//>`:null}
        <${Field} label="Observations"><textarea id="cf-notes" value=${notes} onChange=${e=>setNotes(e.target.value)}></textarea><//>
      </div>
      <${Section} title="Périodicité et rappels"><div className="card pad"><${RemFields} v=${v} set=${setV} last=${ex?careInfo(ex,p.appointments,c.today).last:last}/></div><//>
      ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
      <button className="btn block" onClick=${save}>${ex?'Enregistrer':'Ajouter au carnet'}</button>
    </div>`;
}

/* ---------- Rendez-vous ---------- */
function ApptsScreen(){
  const c=useC();const {fam,today}=c;
  const [who,setWho]=useState('all');
  const act=fam.profiles.filter(p=>!p.archived);
  const keep=x=>who==='all'||x.p.id===who;
  const list=upcomingAppts(fam,today).filter(keep);
  const dues=allDues(fam,today).filter(keep);
  const late=dues.filter(x=>x.i.due<today),next=dues.filter(x=>x.i.due>=today);
  const cancel=(p,a)=>{c.mut(d=>{const x=P(d,p.id).appointments.find(y=>y.id===a.id);if(x)x.status='cancelled'});c.toast('Rendez-vous annulé')};
  const ttl=(e,t)=>html`<span style=${{display:'inline-flex',alignItems:'center',gap:8}}><${Pic} e=${e}/>${t}</span>`;
  return html`<${Top} title="Agenda" sub="Rendez-vous et échéances" gear=${true} right=${c.canEdit?html`<${Btn} sm onClick=${()=>c.openSheet('appt',{})}><${Pic} e="＋"/> RDV<//>`:null}/>
    <div className="scroll pb">
      ${act.length>1?html`<div className="seg scrollx" role="group" aria-label="Filtrer par membre">${[['all','Toute la famille'],...act.map(p=>[p.id,p.name])].map(x=>html`<button key=${x[0]} type="button" className=${who===x[0]?'on':''} aria-pressed=${who===x[0]} onClick=${()=>setWho(x[0])}>${x[1]}</button>`)}</div>`:null}
      <${Section} title=${ttl('📅','Rendez-vous programmés')} right=${CLOUD?html`<button className="link" onClick=${()=>c.openSheet('cal',{})}>Agenda du téléphone</button>`:null}>
        ${list.length?byMonth(list,x=>x.a.date).map(g=>html`<div key=${g.k} className="mgrp"><div className="mh">${g.label}</div>${g.items.map(({p,a,ps,as})=>{
          const past=a.date<today;
          const multi=as.length>1;
          return html`<div key=${a.id} className="card"><${ApptRow} p=${p} a=${a} ps=${ps} onClick=${()=>c.canEdit&&c.openSheet('appt',{pid:p.id,aid:a.id})}/>
            <div className="row" style=${{paddingTop:0,flexWrap:'wrap'}}>
              <div className="chips">${(a.reminders||[]).map((r,n)=>{const fire=addUnit(a.date,-r.days,'d');return html`<${Chip} key=${n} k=${!r.on?'mute':fire<=today?'warn':'pri'}>${r.on?html`<${Pic} e="🔔"/>`:null} ${r.on?'J-'+r.days+(fire<=today?' passé':' le '+fmtShort(fire)):'J-'+r.days+' désactivé'}<//>`})}${past?html`<${Chip} k="warn">Passé<//>`:html`<${Chip} k="mute">${inLabel(a.date,today)}<//>`}</div>
            </div>
            ${c.canEdit?html`<div className="row" style=${{paddingTop:0}}><div className="btns">${multi?html`<${Btn} sm onClick=${()=>c.openSheet('groupDone',{items:as.map((y,n)=>({pid:ps[n].id,aid:y.id}))})}><${Pic} e="✅"/> Fait le…<//>`
              :a.careId||a.title?html`<${Btn} sm onClick=${()=>a.careId?c.openSheet('real',{pid:p.id,cid:a.careId,aid:a.id,date:a.date}):cancel(p,a)}><${Pic} e="✅"/> ${a.careId?'Fait le…':'Terminer'}<//>`:null}<${Btn} sm kind="ghost" onClick=${()=>as.forEach((y,n)=>cancel(ps[n],y))}>Annuler le RDV<//></div></div>`:null}
          </div>`})}</div>`)
          :html`<div className="card"><${Empty} e="📅" title="Aucun rendez-vous programmé" text="Notez un rendez-vous : deux rappels indépendants vous préviendront avant la date."/></div>`}
      <//>
      <${Section} title=${ttl('🕐','Échéances des soins')}>
        ${late.length?html`<div className="mgrp"><div className="mh late">En retard</div><div className="card">${late.map(x=>html`<${DueRow} key=${x.p.id+x.c.id} x=${x}/>`)}</div></div>`:null}
        ${byMonth(next,x=>x.i.due).map(g=>html`<div key=${g.k} className="mgrp"><div className="mh">${g.label}</div><div className="card">${g.items.map(x=>html`<${DueRow} key=${x.p.id+x.c.id} x=${x}/>`)}</div></div>`)}
        ${!dues.length?html`<div className="card"><${Empty} e="🌿" title="Aucune échéance" text=${who==='all'?'Elles apparaîtront dès qu’un soin a une fréquence.':'Aucune échéance pour ce membre.'}/></div>`:null}
      <//>
    </div>`;
}

/* ---------- Traitements ---------- */
function TreatmentsScreen({p:q}){
  const c=useC();const p=c.prof(q.pid);
  const [open,setOpen]=useState('');
  if(!p)return html`<${Gone}/>`;
  const tr=p.treatments||[];
  const act=tr.filter(t=>t.status==='active'),done=tr.filter(t=>t.status!=='active');
  const setSt=(t,st)=>{c.mut(d=>{const x=P(d,p.id).treatments.find(y=>y.id===t.id);x.status=st;
    if(st==='stopped'){if(!x.end)x.end=c.today;x.events.push({date:c.today,text:'Traitement arrêté'})}else{x.end='';x.events.push({date:c.today,text:'Traitement repris'})}});
    c.toast(st==='stopped'?'Traitement arrêté, historique conservé':'Traitement repris')};
  const card=t=>html`<div key=${t.id} className="card">
    <button className="row" onClick=${()=>setOpen(open===t.id?'':t.id)}><${Ico} e="💊" k=${t.status==='active'?'g':''}/><div className="grow"><b>${t.name}</b><small>${[t.dose,t.freq].filter(Boolean).join(' · ')||'Sans posologie'}</small><small>${fmt(t.start)}${t.end?' → '+fmt(t.end):' → en cours'}${t.remind&&t.remind.on?' · 🔔 '+t.remind.time:''}</small></div><span className="go">${open===t.id?'⌃':'⌄'}</span></button>
    ${open===t.id?html`<div className="rem" style=${{borderTop:'1px solid var(--line)'}}>
      ${t.notes?html`<span>${t.notes}</span>`:null}
      <div className="muted">${t.events.slice().reverse().map((e,n)=>html`<div key=${n}>${fmt(e.date)} · ${e.text}</div>`)}</div>
      ${c.canEdit?html`<div className="btns"><${Btn} sm kind="soft" onClick=${()=>c.openSheet('treat',{pid:p.id,tid:t.id})}>Modifier<//>${t.status==='active'?html`<${Btn} sm kind="ghost" onClick=${()=>setSt(t,'stopped')}>Arrêter<//>`:html`<${Btn} sm kind="ghost" onClick=${()=>setSt(t,'active')}>Reprendre<//>`}</div>`:null}
    </div>`:null}</div>`;
  return html`<${Top} back=${true} title="Traitements" sub=${p.name} right=${c.canEdit?html`<${Btn} sm onClick=${()=>c.openSheet('treat',{pid:p.id})}><${Pic} e="＋"/> Ajouter<//>`:null}/>
    <div className="scroll">
      <div className="note">Les traitements sont distincts des soins périodiques du carnet. Arrêter un traitement conserve son historique.</div>
      <${Section} title="En cours">${act.length?html`<div style=${{display:'flex',flexDirection:'column',gap:10}}>${act.map(card)}</div>`:html`<div className="card"><${Empty} e="💊" title="Aucun traitement en cours" text="Ajoutez un traitement avec sa posologie et un rappel de prise."/></div>`}<//>
      ${done.length?html`<${Section} title="Terminés"><div style=${{display:'flex',flexDirection:'column',gap:10}}>${done.map(card)}</div><//>`:null}
    </div>`;
}

/* ---------- Poids ---------- */
function WeightChart({pts,sel,setSel}){
  const Wd=340,Ht=210,L=46,Rr=16,T=16,B=34;
  const ts=pts.map(x=>parse(x.date).getTime());
  const t0=Math.min(...ts),t1=Math.max(...ts);
  const kg=pts.map(x=>x.kg);let lo=Math.min(...kg),hi=Math.max(...kg);
  const pv=(hi-lo)*.25||Math.max(hi*.05,1);lo-=pv;hi+=pv;
  const raw=(hi-lo)/4,mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw);
  const y0=Math.floor(lo/step)*step,y1=Math.ceil(hi/step)*step;
  const ticks=[];for(let v=y0;v<=y1+1e-9;v+=step)ticks.push(+v.toFixed(4));
  const X=t=>t1===t0?L+(Wd-L-Rr)/2:L+(t-t0)/(t1-t0)*(Wd-L-Rr);
  const Y=v=>T+(1-(v-y0)/(y1-y0))*(Ht-T-B);
  const xs=ts.map(X),ys=kg.map(Y);
  const line=xs.map((x,i)=>(i?'L':'M')+x.toFixed(1)+' '+ys[i].toFixed(1)).join(' ');
  const area=line+' L'+xs[xs.length-1].toFixed(1)+' '+Y(y0).toFixed(1)+' L'+xs[0].toFixed(1)+' '+Y(y0).toFixed(1)+' Z';
  const short=(t1-t0)/864e5<150;
  const xt=t1===t0?[t0]:[0,1,2,3].map(k=>t0+(t1-t0)*k/3);
  const lab=t=>new Date(t).toLocaleDateString('fr-FR',short?{day:'numeric',month:'short'}:{month:'short',year:'2-digit'});
  return html`<svg className="chart" viewBox=${'0 0 '+Wd+' '+Ht} role="img" aria-label="Courbe de poids">
    ${ticks.map(v=>html`<g key=${v}><line className="gl" x1=${L} x2=${Wd-Rr} y1=${Y(v)} y2=${Y(v)}/><text className="tx" x=${L-8} y=${Y(v)+4} textAnchor="end">${v.toLocaleString('fr-FR')}</text></g>`)}
    ${xt.map((t,n)=>html`<text key=${n} className="tx" x=${X(t)} y=${Ht-10} textAnchor=${xt.length===1?'middle':n===0?'start':n===xt.length-1?'end':'middle'}>${lab(t)}</text>`)}
    ${pts.length>1?html`<path className="ar" d=${area}/><path className="ln" d=${line}/>`:null}
    ${sel>=0&&sel<pts.length?html`<circle className="hl" cx=${xs[sel]} cy=${ys[sel]} r="13"/>`:null}
    ${pts.map((x,i)=>html`<g key=${x.id} onClick=${()=>setSel(i)} style=${{cursor:'pointer'}}><circle cx=${xs[i]} cy=${ys[i]} r="16" fill="transparent"/><circle className=${'pt'+(i===pts.length-1?' last':'')} cx=${xs[i]} cy=${ys[i]} r=${i===pts.length-1?6:5}/></g>`)}
  </svg>`;
}
function WeightScreen({p:q}){
  const c=useC();const p=c.prof(q.pid);
  const [sel,setSel]=useState(-1);
  if(!p)return html`<${Top} back=${true} title="Introuvable"/>`;
  const pts=[...(p.weights||[])].sort((a,b)=>a.date<b.date?-1:1);
  const s=sel>=0&&sel<pts.length?pts[sel]:pts[pts.length-1];
  const diff=pts.length>1?pts[pts.length-1].kg-pts[0].kg:null;
  return html`<${Top} back=${true} title="Poids" sub=${p.name} right=${c.canEdit?html`<${Btn} sm onClick=${()=>c.openSheet('weight',{pid:p.id})}><${Pic} e="＋"/> Pesée<//>`:null}/>
    <div className="scroll">
      ${pts.length?html`<div className="card pad" style=${{display:'flex',flexDirection:'column',gap:10}}>
        <div style=${{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,flexWrap:'wrap'}}><div><div style=${{font:'800 28px var(--font-d)'}}>${kgFmt(s.kg)}</div><div className="muted">${fmt(s.date)}${s.note?' · '+s.note:''}</div></div>${diff!==null?html`<${Chip} k=${diff>0?'warn':diff<0?'info':'ok'}>${(diff>0?'+':'')+diff.toLocaleString('fr-FR',{maximumFractionDigits:2})+' kg depuis '+fmt(pts[0].date)}<//>`:null}</div>
        <${WeightChart} pts=${pts} sel=${sel} setSel=${setSel}/>
        ${pts.length<2?html`<div className="note">Ajoutez d’autres pesées pour tracer la courbe d’évolution.</div>`:html`<span className="muted">Touchez un point pour voir la pesée.</span>`}
      </div>`:html`<div className="card"><${Empty} e="⚖️" title="Aucune pesée" text="Chaque pesée alimente automatiquement la courbe."/></div>`}
      <${Section} title="Pesées"><div className="card">${[...pts].reverse().map(x=>html`<button key=${x.id} className="row" onClick=${()=>c.canEdit&&c.openSheet('weight',{pid:p.id,wid:x.id})}><div className="grow"><b>${kgFmt(x.kg)}</b><small>${fmt(x.date)}${x.note?' · '+x.note:''}</small></div>${c.canEdit?html`<span className="go"><${Pic} e="›"/></span>`:null}</button>`)}</div><//>
    </div>`;
}

/* ---------- Accès et invitations ---------- */
function AccessScreen(){
  const c=useC();const {fam}=c;
  const setRole=(email,role)=>{c.mut(d=>{F(d).users.find(u=>u.email===email).role=role});c.toast('Droits mis à jour')};
  const sim=c.db.session.simRole;
  const shareInvite=iv=>{
    const url=location.origin+location.pathname+'?join='+iv.code;
    const text='Rejoins notre carnet de santé familial : '+url+'\nCrée ton compte avec l’adresse '+iv.email+' (code : '+iv.code+').';
    if(navigator.share){navigator.share({title:'Carnet de santé familial',text}).catch(()=>{});return}
    try{navigator.clipboard.writeText(text).then(()=>c.toast('Invitation copiée, collez-la dans un message'),()=>c.toast('Copie impossible'))}catch(e){c.toast('Copie impossible')}
  };
  return html`<${Top} back=${true} title="Accès et invitations" sub=${'Espace « '+fam.name+' »'}/>
    <div className="scroll">
      <div className="note">Seuls les membres invités accèdent à cet espace. Chaque famille reste isolée des autres.</div>
      <${Section} title="Membres de l’espace">
        <div className="card">${fam.users.map(u=>html`<div key=${u.email} className="row"><${Ico} e="🙂"/><div className="grow"><b>${u.name}</b><small>${u.email}</small></div>
          ${c.canAdmin&&fam.users.length>1&&!u.owner&&u.email!==c.db.session.email?html`<select aria-label=${'Droits de '+u.name} style=${{width:'auto'}} value=${u.role} onChange=${e=>setRole(u.email,e.target.value)}>${Object.keys(ROLES).map(r=>html`<option key=${r} value=${r}>${ROLES[r][0]}</option>`)}</select>`:html`<${Chip} k="pri">${ROLES[u.role][0]}<//>`}</div>`)}</div>
      <//>
      <${Section} title="Invitations" right=${c.canAdmin?html`<${Btn} sm onClick=${()=>c.openSheet('invite')}><${Pic} e="＋"/> Inviter<//>`:null}>
        ${fam.invites.length?html`<div className="card">${fam.invites.map(iv=>html`<div key=${iv.id} className="row" style=${{flexWrap:'wrap'}}><${Ico} e="✉️" k="i"/><div className="grow"><b>${iv.email}</b><small>${ROLES[iv.role][0]} · en attente depuis le ${fmt(iv.date)}</small><small>${CLOUD?'Code : '+iv.code+' · à utiliser avec cette adresse e-mail':'carnet-famille.exemple/invitation/'+iv.code}</small></div>
          ${c.canAdmin?html`<div className="btns" style=${{width:'100%',paddingLeft:54}}>${CLOUD?html`<${Btn} sm kind="soft" onClick=${()=>shareInvite(iv)}>Partager l’invitation<//>`:html`<${Btn} sm kind="soft" onClick=${()=>{c.mut(d=>{const f=F(d);const x=f.invites.find(y=>y.id===iv.id);f.users.push({email:x.email,name:x.email.split('@')[0],role:x.role});if(!d.accounts.some(a=>a.email===x.email))d.accounts.push({email:x.email,password:'demo',name:x.email.split('@')[0],familyId:f.id});f.invites=f.invites.filter(y=>y.id!==iv.id)});c.toast('Invitation acceptée (simulation)')}}>Simuler l’acceptation<//>`}<${Btn} sm kind="ghost" onClick=${()=>{c.mut(d=>{const f=F(d);f.invites=f.invites.filter(y=>y.id!==iv.id)});c.toast('Invitation annulée')}}>Annuler<//></div>`:null}</div>`)}</div>`
        :html`<div className="card"><${Empty} e="✉️" title="Aucune invitation en attente" text="Invitez votre conjoint(e) ou un proche par e-mail."/></div>`}
      <//>
      <${Section} title="Tester les droits d’accès">
        <div className="seg" role="group" aria-label="Aperçu des droits">${[[null,'Mes droits'],['editor','Modifier'],['viewer','Lecture']].map(x=>html`<button key=${String(x[0])} className=${(sim||null)===x[0]?'on':''} onClick=${()=>c.mut(d=>{d.session.simRole=x[0]})}>${x[1]}</button>`)}</div>
        <span className="muted">Simule l’affichage d’un membre avec des droits limités. Une bannière permet de revenir à vos droits.</span>
      <//>
      ${CLOUD?null:html`<div className="note"><b>À brancher pour la vraie application :</b> authentification sécurisée, envoi réel des e-mails d’invitation et règles d’accès côté serveur pour que chaque famille ne voie que ses propres données.</div>`}
    </div>`;
}

/* ---------- Thèmes ---------- */
function ThemeScreen(){
  const c=useC();const saved=c.fam.theme;
  const [draft,setDraft]=useState(()=>({...saved}));
  const sw=x=>effTheme(x,c.wantDark);
  const th=buildTheme(sw(draft));const r=th.report;
  const dirty=JSON.stringify(draft)!==JSON.stringify(saved);
  const ok=Math.min(r.text,r.btn,r.link);
  const lab=ok>=7?'Excellente':ok>=4.5?'Bonne':'À améliorer pour les boutons';
  const cols=[['primary','Principale'],['secondary','Secondaire'],['bg','Fond'],['card','Cartes'],['nav','Navigation']];
  const apply=()=>{c.mut(d=>{F(d).theme={...draft}});c.toast('Thème appliqué à toute la famille')};
  return html`<${Top} back=${true} title="Thème de la famille" sub="Partagé par tous les membres, indépendant des autres familles"/>
    <div className="scroll">
      ${!c.canAdmin?html`<div className="note">Seul un administrateur peut modifier le thème.</div>`:null}
      <div className="mini" style=${th.vars} aria-label="Aperçu du thème">
        <div className="mt">Aperçu en direct</div>
        <div className="mc"><${Ico} e="🩺"/><div className="grow" style=${{minWidth:0,flex:1}}><b style=${{font:'700 15px var(--font-d)',display:'block'}}>Carnet de Camille</b><span className="muted">Prochain soin le 23 janvier</span></div><span className="chip ok">À jour</span></div>
        <div className="mc"><${Ico} e="🐶" k="s"/><div className="grow" style=${{minWidth:0,flex:1}}><b style=${{font:'700 15px var(--font-d)',display:'block'}}>Vermifuge de Poki</b><span className="muted">À prévoir avant le 10 janvier</span></div><span className="chip warn">À prévoir</span></div>
        <div style=${{display:'flex',gap:8,flexWrap:'wrap'}}><span className="btn sm">Bouton principal</span><span className="btn sm soft">Secondaire</span></div>
        <div className="mn">${[['🏠',1],['👨‍👩‍👧',0],['📅',0]].map(x=>html`<span key=${x[0]} className=${x[1]?'on':''}><${Pic} e=${x[0]}/></span>`)}</div>
      </div>
      <div className="btns"><${Btn} disabled=${!dirty||!c.canAdmin} onClick=${apply}>Appliquer à la famille<//>${dirty?html`<${Btn} kind="ghost" onClick=${()=>setDraft({...saved})}>Annuler<//>`:html`<${Chip} k="ok">Thème en cours<//>`}</div>
      <span className="muted">Touchez une palette pour la voir ci-dessus. Une fois appliqué, le thème est enregistré automatiquement et tous les membres de la famille le voient.</span>
      <${Section} title="Palettes">
        <div className="pgrid">${PALETTES.map(x=>html`<button key=${x.id} disabled=${!c.canAdmin} className=${'pg'+(draft.id===x.id?' on':'')} onClick=${()=>setDraft({...x})}><div className="swatches"><i style=${{background:sw(x).primary}}></i><i style=${{background:sw(x).secondary}}></i><i style=${{background:sw(x).bg}}></i><i style=${{background:sw(x).card}}></i></div><span>${x.em} ${x.name}</span>${saved.id===x.id?html`<small>Appliquée</small>`:null}</button>`)}</div>
      <//>
      <${Section} title="Personnaliser">
        <div className="card pad form"><div className="colors">${cols.map(x=>html`<label key=${x[0]}><input type="color" id=${'col-'+x[0]} disabled=${!c.canAdmin} value=${draft[x[0]]} onChange=${e=>setDraft({...draft,id:'perso',name:'Personnalisé',[x[0]]:e.target.value})}/>${x[1]}</label>`)}</div>
          <div className="chips"><${Chip} k=${r.text>=4.5?'ok':'bad'}>Texte ${r.text.toFixed(1)}:1<//><${Chip} k=${r.btn>=4.5?'ok':'warn'}>Boutons ${r.btn.toFixed(1)}:1<//><${Chip} k=${r.link>=4.5?'ok':'bad'}>Liens ${r.link.toFixed(1)}:1<//></div>
          <span className="muted">Lisibilité : <b>${lab}</b>. Les couleurs de texte s’adaptent automatiquement pour rester lisibles, en mode clair comme en mode sombre.</span></div>
      <//>
    </div>`;
}

/* ---------- Réglages ---------- */
/* ---------- Notifications sur ce téléphone ---------- */
const u8=b=>{const s=atob(b.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,ch=>ch.charCodeAt(0))};
const IOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const STANDALONE=(()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}})();
function NotifCard(){
  const c=useC();
  const ok='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const [on,setOn]=useState(false);const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  useEffect(()=>{if(!CLOUD||!ok)return;navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(sub=>{
    if(sub){setOn(true);Cloud.api('push/subscribe',sub.toJSON()).catch(()=>{})}}).catch(()=>{})},[]);
  const enable=async()=>{
    setBusy(true);setErr('');
    try{
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){setErr('Notifications refusées. Autorisez-les pour le carnet dans les réglages du téléphone, puis réessayez.');setBusy(false);return}
      const {key}=await Cloud.api('push/key');
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(key)});
      await Cloud.api('push/subscribe',sub.toJSON());
      setOn(true);c.toast('Notifications activées sur ce téléphone');
      Cloud.api('push/test',{endpoint:sub.endpoint}).catch(()=>{});
    }catch(e){setErr(e&&typeof e.code==='string'?Cloud.msg(e):'Activation impossible sur cet appareil. Vérifiez la connexion et que le navigateur autorise les notifications.')}
    setBusy(false);
  };
  const disable=async()=>{
    setBusy(true);setErr('');
    try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
      if(sub){await Cloud.api('push/unsubscribe',{endpoint:sub.endpoint}).catch(()=>{});await sub.unsubscribe()}
      setOn(false);c.toast('Notifications désactivées sur ce téléphone')}catch(e){setErr('Désactivation impossible.')}
    setBusy(false);
  };
  const test=async()=>{try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();await Cloud.api('push/test',{endpoint:sub&&sub.endpoint});c.toast('Notification de test envoyée')}catch(e){setErr(Cloud.msg(e))}};
  const head=html`<div><b style=${{font:'700 15px var(--font-d)'}}>Notifications sur ce téléphone</b><div className="muted">Chaque matin : rendez-vous à prendre et rendez-vous à venir (J-7, J-2…), même sans ouvrir le carnet</div></div>`;
  if(!CLOUD)return html`${head}<div className="note">Disponible avec un compte.</div>`;
  if(IOS&&!STANDALONE)return html`${head}<div className="note">Sur iPhone, ajoutez d’abord le carnet à l’écran d’accueil : dans Safari, touchez <b>Partager</b> puis <b>Sur l’écran d’accueil</b>. Ouvrez ensuite le carnet depuis son icône et revenez ici.</div>`;
  if(!ok)return html`${head}<div className="note">Ce navigateur ne reçoit pas les notifications. Ouvrez le carnet dans Chrome (Android) ou Safari (iPhone, depuis l’écran d’accueil).</div>`;
  return html`<div className="swrow">${head}<${Switch} on=${on} set=${x=>busy?null:x?enable():disable()} label="Notifications sur ce téléphone"/></div>
    ${on?html`<button type="button" className="link" style=${{alignSelf:'flex-start'}} onClick=${test}>Envoyer une notification de test</button>`:null}
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}<hr/>`;
}
function SettingsScreen(){
  const c=useC();const {fam}=c;
  const acc=c.db.accounts.find(a=>a.email===c.db.session.email)||{name:''};
  const [ar,setAr]=useState(()=>fam.settings.apptDefaults.map(x=>({...x})));
  const saveAr=n=>{setAr(n);c.mut(d=>{F(d).settings.apptDefaults=n.map(x=>({days:Math.max(1,parseInt(x.days)||1),on:!!x.on}))})};
  const copy=()=>{const txt=JSON.stringify(fam,null,1);try{navigator.clipboard.writeText(txt).then(()=>c.toast('Données copiées'),()=>c.toast('Copie impossible dans ce contexte'))}catch(e){c.toast('Copie impossible dans ce contexte')}};
  return html`<${Top} back=${true} title="Réglages" sub=${fam.name}/>
    <div className="scroll">
      <${Section} title="Espace familial">
        <div className="card">
          <button className="row" onClick=${()=>c.go('theme')}><${Ico} e="🎨" k="s"/><div className="grow"><b>Thème de couleurs</b><small>${fam.theme.name||'Personnalisé'}</small></div><span className="go"><${Pic} e="›"/></span></button>
          <button className="row" onClick=${()=>c.go('access')}><${Ico} e="👪" k="i"/><div className="grow"><b>Membres et invitations</b><small>${fam.users.length} membre${fam.users.length>1?'s':''}${fam.invites.length?' · '+fam.invites.length+' invitation'+(fam.invites.length>1?'s':''):''}</small></div><span className="go"><${Pic} e="›"/></span></button>
          <button className="row" onClick=${()=>c.canAdmin?c.openSheet('famName'):c.toast('Réservé aux administrateurs')}><${Ico} e="🏠"/><div className="grow"><b>Nom de l’espace</b><small>${fam.name}</small></div><span className="go"><${Pic} e="›"/></span></button>
          <button className="row" onClick=${()=>c.go('contacts')}><${Ico} e="🥼" k="i"/><div className="grow"><b>Annuaire</b><small>${(fam.contacts||[]).length?(fam.contacts||[]).length+' fiche'+((fam.contacts||[]).length>1?'s':''):'Aucune fiche'} : médecins, vétérinaires, établissements</small></div><span className="go"><${Pic} e="›"/></span></button>
        </div>
      <//>
      <${Section} title="Affichage">
        <div className="card pad form">
          <div className="seg" role="group" aria-label="Mode d’affichage">${[['auto','Auto'],['light','Clair'],['dark','Sombre']].map(x=>html`<button type="button" key=${x[0]} className=${c.mode===x[0]?'on':''} onClick=${()=>c.setMode(x[0])}>${x[1]}</button>`)}</div>
          <span className="muted">Auto suit le réglage de votre téléphone. Le mode sombre s’applique à votre appareil et garde les couleurs du thème de la famille, adaptées pour rester lisibles.</span>
        </div>
      <//>
      <${Section} title="Notifications et agenda">
        ${CLOUD?html`<div className="card"><button className="row" onClick=${()=>c.openSheet('cal',{})}><${Ico} e="📅" k="i"/><div className="grow"><b>Agenda du téléphone</b><small>Rendez-vous et échéances dans l’agenda de l’iPhone, Google ou Outlook</small></div><span className="go"><${Pic} e="›"/></span></button></div>`:null}
        <div className="card pad form">
          <${NotifCard}/>
          <div className="swrow"><div><b style=${{font:'700 15px var(--font-d)'}}>Rappels sur l’accueil</b><div className="muted">Affiche échéances et rendez-vous proches</div></div><${Switch} on=${fam.settings.showReminders} set=${x=>c.mut(d=>{F(d).settings.showReminders=x})} label="Rappels sur l’accueil"/></div>
          <hr/>
          <div><b style=${{font:'700 15px var(--font-d)'}}>Rappels de rendez-vous par défaut</b><div className="muted">Proposés pour tout nouveau soin, modifiables soin par soin</div></div>
          ${ar.map((r,n)=>html`<div key=${n} className="swrow"><div className="inl"><input id=${'st-ar'+n} className="num" type="number" min="1" inputMode="numeric" value=${r.days} onChange=${e=>saveAr(ar.map((x,j)=>j===n?{...x,days:e.target.value}:x))} aria-label=${'Jours avant, rappel '+(n+1)}/><span>jour(s) avant</span></div><${Switch} on=${r.on} set=${x=>saveAr(ar.map((y,j)=>j===n?{...y,on:x}:y))} label=${'Rappel '+(n+1)}/></div>`)}
          <div className="note">Le délai pour penser à prendre rendez-vous se règle soin par soin, dans le carnet de chaque profil.</div>
        </div>
      <//>
      <${Section} title="Compte">
        <div className="card">
          <button className="row" onClick=${()=>c.openSheet('account')}><${Ico} e="🙂"/><div className="grow"><b>${acc.name||'Mon compte'}</b><small>${c.db.session.email} · modifier le prénom ou le mot de passe</small></div><span className="go"><${Pic} e="›"/></span></button>
          <button className="row" onClick=${()=>c.mut(d=>{d.seen=false})}><${Ico} e="📖" k="i"/><div className="grow"><b>Revoir le guide</b><small>Rappels et rendez-vous en trois écrans</small></div></button>
          <button className="row" onClick=${()=>{if(CLOUD){Cloud.signOut();return}c.mut(d=>{d.session=null});c.tab('auth')}}><${Ico} e="🚪" k="b"/><div className="grow"><b>Se déconnecter</b></div></button>
        </div>
      <//>
      ${CLOUD?html`      <${Section} title="Sauvegarde">
        <div className="card"><button className="row" onClick=${copy}><${Ico} e="📋"/><div className="grow"><b>Copier les données (JSON)</b><small>Copie de secours de cet espace</small></div></button></div>
      <//>
`:html`      <${Section} title="Démonstration">
        <div className="card pad form">
          <${Field} label="Date du jour (simulation)" hint="Avancez la date pour voir apparaître les rappels et les retards."><input id="st-sim" type="date" value=${c.today} onChange=${e=>c.mut(d=>{d.simToday=e.target.value||null})}/><//>
          ${c.db.simToday?html`<${Btn} sm kind="soft" onClick=${()=>c.mut(d=>{d.simToday=null})}>Revenir à aujourd’hui<//>`:null}
        </div>
        <div className="card">
          <button className="row" onClick=${copy}><${Ico} e="📋"/><div className="grow"><b>Copier les données (JSON)</b><small>Sauvegarde manuelle de cet espace</small></div></button>
          <button className="row" onClick=${()=>c.openSheet('confirm',{title:'Réinitialiser la démo ?',text:'Toutes les modifications faites dans ce prototype seront effacées et les données d’exemple rechargées.',label:'Réinitialiser',danger:true,run:()=>{try{localStorage.removeItem(KEY)}catch(e){}c.setDb(seed());c.tab('auth');c.toast('Démo réinitialisée')}})}><${Ico} e="♻️" k="w"/><div className="grow"><b>Réinitialiser la démo</b><small>Recharge les données d’exemple</small></div></button>
        </div>
      <//>
      <${Section} title="À brancher pour la vraie application">
        <div className="card pad"><dl className="kv" style=${{gridTemplateColumns:'1fr'}}>
          <dt>Comptes et partage</dt><dd>Authentification e-mail, base de données partagée avec isolation stricte par famille.</dd>
          <dt>Notifications</dt><dd>Notifications push iPhone et Android pour les deux niveaux de rappels.</dd>
          <dt>Agenda Apple</dt><dd>Ajout réel via l’agenda de l’appareil ou un fichier .ics.</dd>
          <dt>Photos et documents</dt><dd>Stockage sécurisé des pièces jointes et des photos de profil.</dd>
          <dt>Installation</dt><dd>Application web installable ou application mobile sans passer par l’App Store.</dd>
        </dl></div>
      <//>
`}
    </div>`;
}

/* ---------- Formulaire profil ---------- */
const SKINS=[['','Classique','#F7D44C'],['\u{1F3FB}','Très clair','#F7DEC4'],['\u{1F3FC}','Clair','#EDC8A0'],['\u{1F3FD}','Moyen','#CE9B6B'],['\u{1F3FE}','Mat','#A06B43'],['\u{1F3FF}','Foncé','#6B4630']];
const HUMAN_BASES=[['👩','Femme'],['👨','Homme'],['🧑','Neutre'],['👧','Fille'],['👦','Garçon'],['🧒','Enfant'],['👶','Bébé'],['👵','Aînée'],['👴','Aîné']];
const HAIRS=[['','Par défaut'],['blond','Blonds'],['red','Roux'],['curly','Bouclés'],['white','Blancs'],['bald','Aucun']];
const HAIRABLE=['👩','👨','🧑'];
function composeEmoji(a){
  const sk=a.skin||'',b=a.base||'🧑',h=a.hair||'',ZW='‍';
  if(HAIRABLE.includes(b)){
    if(h==='blond')return b==='👩'?'👱'+sk+ZW+'♀️':b==='👨'?'👱'+sk+ZW+'♂️':'👱'+sk;
    const m={red:'🦰',curly:'🦱',white:'🦳',bald:'🦲'}[h];
    if(m)return b+sk+ZW+m;
  }
  return b+sk;
}
function AvatarSheet({p}){
  const c=useC();const t=TYPES[p.type];
  const [a,setA]=useState(()=>{
    const x={...p.av};
    if(t.human&&!x.base){
      const e=x.emoji||'';
      x.base=(HUMAN_BASES.map(y=>y[0]).find(y=>e.startsWith(y)))||'🧑';
      x.skinE=(SKINS.map(y=>y[0]).find(y=>y&&e.includes(y)))||'';
      x.hairE=e.includes('🦰')?'red':e.includes('🦱')?'curly':e.includes('🦳')?'white':e.includes('🦲')?'bald':e.startsWith('👱')?'blond':'';
    }
    if(x.skin!==undefined&&!/^#/.test(x.skin||'')&&x.skinE===undefined){x.skinE=x.skin;delete x.skin}
    if(x.hair!==undefined&&!/^#/.test(x.hair||'')&&x.hairE===undefined){x.hairE=x.hair;delete x.hair}
    if(!x.bg)x.bg=AV_BG[0];
    if(!x.emoji)x.emoji=t.av[0];
    if(x.kind==='drawn')x.kind='emoji';
    return x;
  });
  const [tab,setTab]=useState(a.kind==='photo'?'photo':'emoji');
  const upd=patch=>{const n={...a,...patch,kind:'emoji'};if(t.human)n.emoji=composeEmoji({base:n.base,skin:n.skinE,hair:n.hairE});setA(n)};
  const pickPhoto=e=>{const f=e.target.files&&e.target.files[0];if(f)readPhoto(f,u=>setA({...a,kind:'photo',photo:u}))};
  const goTab=k=>{setTab(k);if(k==='emoji')setA({...a,kind:'emoji'})};
  const fake={type:p.type,avatar:a,name:''};
  const hairOk=HAIRABLE.includes(a.base);
  const L=(txt)=>html`<div className="lbl" style=${{marginBottom:8}}>${txt}</div>`;
  const dot=(col,on,label,fn)=>html`<button type="button" key=${col} aria-label=${label} title=${label} className=${'skin'+(on?' on':'')} style=${{background:col}} onClick=${fn}></button>`;
  const customColor=(val,fn,label)=>html`<input type="color" aria-label=${label} value=${/^#[0-9a-fA-F]{6}$/.test(val||'')?val:'#4A3326'} onChange=${e=>fn(e.target.value)} style=${{width:40,height:40,border:0,padding:0,background:'none'}}/>`;
  const shared=html`
      <div>${L('Couleur de fond')}<div className="bgs">${AV_BG.map(b=>html`<button type="button" key=${b} aria-label=${'Fond '+b} className=${(a.bg||'').toLowerCase()===b.toLowerCase()?'on':''} style=${{background:b}} onClick=${()=>setA({...a,bg:b})}></button>`)}<input type="color" aria-label="Couleur de fond personnalisée" value=${/^#[0-9a-fA-F]{6}$/.test(a.bg||'')?a.bg:'#DCEBE8'} onChange=${e=>setA({...a,bg:e.target.value})}/></div></div>
      <div>${L('Accessoire (facultatif)')}<div className="chips">${AV_ACC.map(x=>html`<button type="button" key=${x||'none'} className=${'emo'+((a.acc||'')===x?' on':'')} style=${{fontSize:22}} onClick=${()=>setA({...a,acc:x})} aria-label=${x?'Accessoire '+x:'Aucun accessoire'}>${x||'∅'}</button>`)}</div></div>`;
  const tabs=[['emoji','Emoji'],['photo','Photo']];
  const dirty=useDirty(a);
  const done=()=>{p.onChange(a);c.closeSheet()};
  return html`<${Sh} title="Avatar ou photo" dirty=${dirty} onSave=${done}>
    <div style=${{display:'flex',justifyContent:'center'}}><${Avatar} p=${fake} size=${96}/></div>
    <div className="seg">${tabs.map(x=>html`<button type="button" key=${x[0]} className=${tab===x[0]?'on':''} onClick=${()=>goTab(x[0])}>${x[1]}</button>`)}</div>
    ${tab==='emoji'?html`<div className="form">
      ${t.human?html`
        <div>${L('Personnage')}<div className="chips">${HUMAN_BASES.map(b=>html`<button type="button" key=${b[0]} aria-label=${b[1]} className=${'emo'+(a.base===b[0]?' on':'')} onClick=${()=>upd({base:b[0]})}>${composeEmoji({base:b[0],skin:a.skinE,hair:HAIRABLE.includes(b[0])?a.hairE:''})}</button>`)}</div></div>
        <div>${L('Teint')}<div className="chips">${SKINS.map(k=>html`<button type="button" key=${k[1]} aria-label=${k[1]} title=${k[1]} className=${'skin'+((a.skinE||'')===k[0]?' on':'')} style=${{background:k[2]}} onClick=${()=>upd({skinE:k[0]})}></button>`)}</div></div>
        <div>${L('Cheveux')}<div className="chips">${HAIRS.map(k=>html`<button type="button" key=${k[1]} disabled=${!hairOk} className=${'tile'+((a.hairE||'')===k[0]&&hairOk?' on':'')} style=${{padding:'8px 12px',flexDirection:'row'}} onClick=${()=>upd({hairE:k[0]})}>${k[1]}</button>`)}</div><div className="muted" style=${{marginTop:6}}>${hairOk?'Les emojis ne proposent pas toutes les couleurs de cheveux : pour un rendu fidèle, importez une photo.':'Les cheveux se choisissent pour Femme, Homme et Neutre.'}</div></div>`
      :html`<div>${L('Apparence')}<div className="chips">${t.av.map(e=>html`<button type="button" key=${e} aria-label=${'Avatar '+e} className=${'emo'+(a.emoji===e?' on':'')} onClick=${()=>upd({emoji:e})}>${e}</button>`)}</div></div>`}
      ${shared}
    </div>`
    :html`<div className="form" style=${{alignItems:'center'}}>
      <label className="btn soft"><${Pic} e="👤"/> Choisir dans la galerie<input type="file" accept="image/*" hidden onChange=${pickPhoto}/></label>
      ${a.kind==='photo'?html`<${Btn} sm kind="ghost" onClick=${()=>{setA({...a,kind:'emoji',photo:''});setTab('emoji')}}>Retirer la photo<//>`:null}
      <span className="muted" style=${{textAlign:'center'}}>Facultatif. La photo est recadrée en carré, remplace l’emoji et s’enregistre avec le profil.</span></div>`}
    <${Btn} block onClick=${done}>Terminer<//>
  <//>`;
}
function ProfileFormScreen({p:q}){
  const c=useC();const ex=q.pid?c.prof(q.pid):null;
  const type=ex?ex.type:q.type;const t=TYPES[type]||TYPES.adult;
  const i0=ex?ex.info:{};
  const [docId,setDocId]=useState(i0.doctorId&&contactOf(c.fam,i0.doctorId)?i0.doctorId:'');
  const [vetId,setVetId]=useState(i0.vetId&&contactOf(c.fam,i0.vetId)?i0.vetId:'');
  const [f,setF]=useState({name:ex?ex.name:'',birth:ex?(ex.birthApprox?'':ex.birth):'',sex:ex?ex.sex:'',species:i0.species!==undefined?i0.species:(t.species||''),breed:i0.breed||'',coat:i0.coat||'',size:i0.size||'',chip:i0.chip||'',vet:i0.vet||'',blood:i0.blood||'',allergies:i0.allergies||'',doctor:i0.doctor||'',neutered:!!i0.neutered,notes:ex?ex.notes:'',w:'',wd:c.today});
  const [unk,setUnk]=useState(ex?!!ex.birthApprox:false);
  const [approx,setApprox]=useState(()=>ex&&ex.birthApprox?String(Math.round(diffDays(c.today,ex.birth)/365.25)):'');
  const [av,setAv]=useState(ex?{...ex.avatar}:{kind:'emoji',emoji:t.av[0],bg:AV_BG[(c.fam.profiles.length)%AV_BG.length],acc:''});
  const [pre,setPre]=useState({});
  const [preLast,setPreLast]=useState({});
  const [err,setErr]=useState('');
  const s=(k,v)=>setF({...f,[k]:v});
  const dirty=useDirty([f,unk,approx,ex?null:av,pre,preLast,docId,vetId]);
  const contacts=(c.fam.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  /* Choix d'une fiche de l'annuaire (ou saisie libre), avec création sur place */
  const proPick=(label,id,setId,txtKey,kind,ids)=>html`<div className="fld"><div className="sech"><span className="lbl">${label}</span><button type="button" className="link" onClick=${()=>c.openSheet('contact',{kind,onSaved:x=>setId(x)})}>＋ Nouvelle fiche</button></div>
    <select id=${ids+'-id'} aria-label=${label+' : fiche de l’annuaire'} value=${id} onChange=${e=>setId(e.target.value)}><option value="">Aucune fiche (saisie libre)</option>${contacts.map(k=>html`<option key=${k.id} value=${k.id}>${k.name}${k.specialty?' · '+k.specialty:''}</option>`)}</select>
    ${!id?html`<input id=${ids} type="text" aria-label=${label} placeholder="Nom (facultatif)" value=${f[txtKey]} onChange=${e=>s(txtKey,e.target.value)}/>`:null}</div>`;
  const presets=PRESETS[t.k]||[];
  const sexOpts=t.human?['Femme','Homme','Autre']:['Femelle','Mâle'];
  const save=()=>{
    if(!f.name.trim()){setErr('Indiquez un nom ou un prénom.');return}
    let birth=f.birth,birthApprox=false;
    if(unk){const n=parseFloat(String(approx).replace(',','.'));if(approx!==''&&n>=0){birth=addUnit(c.today,-Math.round(n*12),'m');birthApprox=true}else birth=''}
    const dk=contactOf(c.fam,docId),vk=contactOf(c.fam,vetId);
    const info=t.human?{blood:f.blood,allergies:f.allergies,doctor:dk?dk.name:f.doctor,doctorId:dk?dk.id:null}:{species:f.species||t.species||t.label,breed:f.breed,coat:f.coat,size:f.size,chip:f.chip,vet:vk?vk.name:f.vet,vetId:vk?vk.id:null,neutered:f.neutered};
    c.mut(d=>{
      const fam=F(d);
      if(ex){Object.assign(P(d,ex.id),{name:f.name.trim(),birth,birthApprox,sex:f.sex,notes:f.notes,info,avatar:av})}
      else{
        const np=mkProfile({type,name:f.name.trim(),birth,birthApprox,sex:f.sex,notes:f.notes,info,avatar:av});
        if(!t.human&&f.w){np.weights.push({id:uid(),date:f.wd||c.today,kg:parseFloat(String(f.w).replace(',','.'))||0,note:''})}
        presets.forEach((x,n)=>{if(pre[n])np.cares.push({id:uid(),name:x[1],category:x[0],pro:'',notes:'',freq:{n:x[2],unit:x[3]},remind:{n:x[4],unit:x[5]},apptReminders:fam.settings.apptDefaults.map(y=>({...y})),realizations:preLast[n]&&preLast[n]<=c.today?[{id:uid(),date:preLast[n],note:'',pro:'',docs:[]}]:[],pending:false,archived:false,freqLog:[]});});
        fam.profiles.push(np);
      }
    });
    c.back();c.toast(ex?'Profil modifié':f.name.trim()+' a rejoint la famille');
  };
  const fakeP={type,avatar:av,name:f.name};
  return html`<${FormTop} title=${ex?'Modifier le profil':'Nouveau · '+t.label} dirty=${dirty} onSave=${save}/>
    <div className="scroll">
      <div className="card pad"><div className="avhead"><${Avatar} p=${fakeP} size=${72}/><div style=${{minWidth:0,flex:1,display:'flex',flexDirection:'column',gap:8,alignItems:'flex-start'}}><b style=${{font:'800 16px var(--font-d)'}}>Photo ou avatar</b><span className="muted">Facultatif : emoji ou photo, couleur de fond.</span><${Btn} sm kind="soft" onClick=${()=>c.openSheet('avatar',{type,av,onChange:v=>{setAv(v);if(ex){c.mut(d=>{P(d,ex.id).avatar=v});c.toast('Avatar enregistré')}}})}>Personnaliser<//></div></div></div>
      <${Section} title="Identité">
        <div className="card pad form">
          <${Field} label=${t.human?'Prénom':'Nom'}><input id="pf-name" type="text" value=${f.name} onChange=${e=>s('name',e.target.value)}/><//>
          <div className="fld"><span>Sexe</span><div className="seg" role="group" aria-label="Sexe">${sexOpts.map(o=>html`<button type="button" key=${o} className=${f.sex===o?'on':''} onClick=${()=>s('sex',f.sex===o?'':o)}>${o}</button>`)}</div></div>
          ${unk?html`<${Field} label="Âge approximatif (en années)" hint="Pour un animal adopté ou si la date exacte est inconnue."><input id="pf-approx" type="number" min="0" step="0.5" inputMode="decimal" value=${approx} onChange=${e=>setApprox(e.target.value)}/><//>`
            :html`<${Field} label="Date de naissance"><input id="pf-birth" type="date" max=${c.today} value=${f.birth} onChange=${e=>s('birth',e.target.value)}/><//>`}
          <div className="swrow"><span className="muted">Date exacte inconnue</span><${Switch} on=${unk} set=${setUnk} label="Date de naissance inconnue"/></div>
          ${t.human?null:html`${type==='other'?html`<${Field} label="Espèce"><input id="pf-sp" type="text" value=${f.species} onChange=${e=>s('species',e.target.value)} placeholder="Lapin, tortue…"/><//>`:null}
            <${Field} label="Race"><input id="pf-breed" type="text" value=${f.breed} onChange=${e=>s('breed',e.target.value)}/><//>
            <${Field} label="Robe"><input id="pf-coat" type="text" value=${f.coat} onChange=${e=>s('coat',e.target.value)}/><//>
            <${Field} label=${type==='horse'?'Taille (au garrot)':'Taille'}><input id="pf-size" type="text" value=${f.size} onChange=${e=>s('size',e.target.value)} placeholder=${type==='horse'?'1,64 m':''}/><//>`}
        </div>
      <//>
      <${Section} title=${t.human?'Santé':'Suivi vétérinaire'}>
        <div className="card pad form">
          ${t.human?html`<${Field} label="Groupe sanguin"><input id="pf-blood" type="text" value=${f.blood} onChange=${e=>s('blood',e.target.value)} placeholder="A+"/><//>
            <${Field} label="Allergies"><input id="pf-all" type="text" value=${f.allergies} onChange=${e=>s('allergies',e.target.value)}/><//>
            ${proPick('Médecin traitant',docId,setDocId,'doctor','doctor','pf-doc')}`
          :html`${proPick('Vétérinaire',vetId,setVetId,'vet','vet','pf-vet')}
            <${Field} label="N° de puce"><input id="pf-chip" type="text" value=${f.chip} onChange=${e=>s('chip',e.target.value)}/><//>
            <div className="swrow"><span>Stérilisé(e) / castré(e)</span><${Switch} on=${f.neutered} set=${v=>s('neutered',v)} label="Stérilisé ou castré"/></div>
            ${!ex?html`<${Field} label="Poids actuel (kg)"><input id="pf-w" type="number" step="0.1" min="0" inputMode="decimal" value=${f.w} onChange=${e=>s('w',e.target.value)}/><//>
              <${Field} label="Pesé le"><input id="pf-wd" type="date" max=${c.today} value=${f.wd} onChange=${e=>s('wd',e.target.value)}/><//>`:null}`}
        </div>
      <//>
      <${Section} title="Notes"><div className="card pad"><textarea id="pf-notes" aria-label="Informations complémentaires" value=${f.notes} onChange=${e=>s('notes',e.target.value)} placeholder="Informations utiles, habitudes, remarques…"></textarea></div><//>
      ${!ex?html`<${Section} title="Soins courants à suivre (facultatif)"><div className="card pad form">${presets.map((x,n)=>html`<div key=${n} className="preset"><div className="swrow"><div><b style=${{font:'700 15px var(--font-d)'}}>${x[1]}</b><div className="muted">${freqLabel({n:x[2],unit:x[3]})}, rappel ${remLabel({n:x[4],unit:x[5]}).toLowerCase()}</div></div><${Switch} on=${!!pre[n]} set=${v=>setPre({...pre,[n]:v})} label=${x[1]}/></div>
          ${pre[n]?html`<${Field} label="Dernière fois fait le" hint=${preLast[n]?'Prochaine échéance le '+fmt(addUnit(preLast[n],x[2],x[3])):'Facultatif : sans date, le soin attend sa première date.'}><input id=${'pf-pre'+n} type="date" max=${c.today} value=${preLast[n]||''} onChange=${e=>setPreLast({...preLast,[n]:e.target.value})}/><//>`:null}</div>`)}</div><//>`:null}
      ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
      <button className="btn block" onClick=${save}>${ex?'Enregistrer':'Ajouter à la famille'}</button>
    </div>`;
}

/* ---------- Feuilles (formulaires courts) ---------- */
/* Détection des modifications : compare l'état du formulaire à son état d'ouverture */
const useDirty=v=>{const init=useRef(null);const j=JSON.stringify(v);if(init.current===null)init.current=j;return j!==init.current};
/* En-tête des fenêtres : titre, « Enregistrer » dès qu'il y a une modification, croix de fermeture.
   Fermer avec des modifications non enregistrées demande confirmation (croix, fond grisé, touche Échap). */
function Sh({title,children,dirty,onSave,saveLabel}){
  const c=useC();
  useEffect(()=>{c.sheetDirty.current=!!dirty},[dirty]);
  useEffect(()=>()=>{c.sheetDirty.current=false},[]);
  return html`<div className="shh">${c.askClose?html`<div className="ask"><span>Abandonner les modifications ?</span><div className="btns"><${Btn} sm kind="soft" onClick=${()=>c.setAskClose(false)}>Continuer<//><${Btn} sm kind="danger" onClick=${()=>c.closeSheet()}>Abandonner<//></div></div>`
    :html`<div className="grab"></div><div className="shbar"><h3 className="sht">${title}</h3>${dirty&&onSave?html`<${Btn} sm onClick=${onSave}>${saveLabel||'Enregistrer'}<//>`:null}<button type="button" className="iconbtn x" aria-label="Fermer" onClick=${c.requestClose}><${Pic} e="✕"/></button></div>`}</div>${children}`;
}
/* Même principe pour les écrans de création et de modification */
function FormTop({title,sub,dirty,onSave,saveLabel}){
  const c=useC();const [ask,setAsk]=useState(false);
  const close=()=>{if(dirty&&!ask){setAsk(true);return}c.back()};
  /* Bouton retour du téléphone : même confirmation que la croix */
  useEffect(()=>{c.screenGuard.current=dirty&&!ask?()=>setAsk(true):null;return()=>{c.screenGuard.current=null}},[dirty,ask]);
  if(ask)return html`<div className="top"><div className="ask"><span>Abandonner les modifications ?</span><div className="btns"><${Btn} sm kind="soft" onClick=${()=>setAsk(false)}>Continuer<//><${Btn} sm kind="danger" onClick=${()=>c.back()}>Abandonner<//></div></div></div>`;
  return html`<div className="top"><button type="button" className="iconbtn" aria-label="Fermer" onClick=${close}><${Pic} e="✕"/></button><div className="tt"><h1>${title}</h1>${sub?html`<p>${sub}</p>`:null}</div><div className="tr">${dirty&&onSave?html`<${Btn} sm onClick=${onSave}>${saveLabel||'Enregistrer'}<//>`:null}</div></div>`;
}
function ConfirmSheet({p}){
  const c=useC();
  return html`<${Sh} title=${p.title}><p className="muted">${p.text}</p>
    <div className="form"><${Btn} kind=${p.danger?'danger':''} block onClick=${()=>{c.closeSheet();p.run()}}>${p.label}<//>
    ${p.alt?html`<${Btn} kind="soft" block onClick=${()=>{c.closeSheet();p.alt()}}>${p.altLabel}<//>`:null}
    <${Btn} kind="ghost" block onClick=${c.closeSheet}>Annuler<//></div><//>`;
}
function AddMemberSheet(){
  const c=useC();
  return html`<${Sh} title="Qui souhaitez-vous ajouter ?"><div className="grid">${Object.keys(TYPES).map(k=>html`<button key=${k} className="tile" onClick=${()=>{c.closeSheet();c.go('profileForm',{type:k})}}><${Ico} e=${TYPES[k].emoji} s=${44}/>${TYPES[k].label}</button>`)}</div>
    <span className="muted">Les enfants peuvent être ajoutés à tout moment, même s’il n’y en a pas encore.</span><//>`;
}
function ProfileMenuSheet({p}){
  const c=useC();const pr=c.prof(p.pid);
  if(!pr)return html`<${GoneSheet} what="Ce profil"/>`;
  return html`<${Sh} title=${pr.name}><div className="card" style=${{background:'var(--bg)'}}>
    <button className="row" onClick=${()=>{c.closeSheet();c.go('profileForm',{pid:pr.id})}}><${Ico} e="✏️"/><div className="grow"><b>Modifier le profil</b></div></button>
    ${c.canAdmin?html`<button className="row" onClick=${()=>{c.mut(d=>{P(d,pr.id).archived=true});c.closeSheet();c.tab('home');c.toast(pr.name+' archivé, données conservées')}}><${Ico} e="🗄️" k="s"/><div className="grow"><b>Archiver</b><small>Masque le profil sans perdre ses données</small></div></button>
    <button className="row" onClick=${()=>{c.closeSheet();setTimeout(()=>c.openSheet('confirm',{title:'Supprimer '+pr.name+' ?',text:'Le profil, son carnet, son historique, ses rendez-vous et ses pesées seront définitivement supprimés. Cette action est irréversible.',label:'Supprimer définitivement',danger:true,
      run:()=>{c.mut(d=>{const f=F(d);f.profiles=f.profiles.filter(x=>x.id!==pr.id)});c.tab('home');c.toast('Profil supprimé')},
      altLabel:'Archiver à la place',alt:()=>{c.mut(d=>{P(d,pr.id).archived=true});c.tab('home');c.toast(pr.name+' archivé')}}),0)}}><${Ico} e="🗑️" k="b"/><div className="grow"><b>Supprimer</b><small>Définitif, avec confirmation</small></div></button>`:null}
  </div><//>`;
}
function RealSheet({p}){
  const c=useC();const pr=c.prof(p.pid);const care=pr&&pr.cares.find(x=>x.id===p.cid);
  if(!care)return html`<${GoneSheet} what="Ce soin"/>`;
  return html`<${RealForm} p=${p} pr=${pr} care=${care}/>`;
}
function RealForm({p,pr,care}){
  const c=useC();
  const ex=p.rid?care.realizations.find(r=>r.id===p.rid):null;
  const [date,setDate]=useState(ex?ex.date:(p.date||c.today));
  const [pro,setPro]=useState(ex?ex.pro:proName(c.fam,care));
  const [note,setNote]=useState(ex?ex.note:'');
  const [docs,setDocs]=useState(ex?ex.docs||[]:[]);
  const [del,setDel]=useState(false);
  const dirty=useDirty([date,pro,note,docs]);
  const save=()=>{
    if(!date)return;
    c.mut(d=>{
      const pp=P(d,p.pid),ca=pp.cares.find(x=>x.id===p.cid);
      if(ex){Object.assign(ca.realizations.find(r=>r.id===p.rid),{date,pro,note,docs})}
      else{ca.realizations.push({id:uid(),date,pro,note,docs});ca.pending=false;
        if(p.aid){const a=pp.appointments.find(x=>x.id===p.aid);if(a)a.status='done'}}
    });
    const latest=[date,...care.realizations.filter(r=>r.id!==p.rid).map(r=>r.date)].sort().pop();
    c.closeSheet();
    c.toast('Fait le '+fmt(date)+(care.freq?' · prochaine échéance le '+fmt(addUnit(latest,care.freq.n,care.freq.unit)):''));
  };
  const remove=()=>{c.mut(d=>{const ca=P(d,p.pid).cares.find(x=>x.id===p.cid);ca.realizations=ca.realizations.filter(r=>r.id!==p.rid)});c.closeSheet();c.toast('Date supprimée de l’historique')};
  return html`<${Sh} title=${ex?'Modifier « fait le »':'Fait le…'} dirty=${dirty} onSave=${save}>
    <span className="muted">${care.name} · ${pr.name}. La date s’ajoute à l’historique, sans effacer les précédentes.</span>
    <div className="form">
      <${Field} label="Fait le"><input id="rs-date" type="date" value=${date} onChange=${e=>setDate(e.target.value)}/><//>
      <${Field} label="Professionnel ou établissement"><input id="rs-pro" type="text" value=${pro} onChange=${e=>setPro(e.target.value)}/><//>
      <${Field} label="Observations"><textarea id="rs-note" value=${note} onChange=${e=>setNote(e.target.value)}></textarea><//>
      <${Field} label="Documents" hint="Les noms de fichiers sont conservés. Le stockage réel viendra avec la version finale."><input id="rs-docs" type="file" multiple onChange=${e=>setDocs([...docs,...Array.from(e.target.files).map(f=>f.name)])}/><//>
      ${docs.length?html`<div className="chips">${docs.map((n,k)=>html`<button type="button" key=${k} className="chip pri" onClick=${()=>setDocs(docs.filter((_,j)=>j!==k))} aria-label=${'Retirer '+n}>📎 ${n} ✕</button>`)}</div>`:null}
      <${Btn} block onClick=${save}>Enregistrer<//>
      ${ex?(del?html`<${Btn} kind="danger" block onClick=${remove}>Confirmer la suppression<//>`:html`<${Btn} kind="ghost" block onClick=${()=>setDel(true)}>Supprimer cette date<//>`):null}
    </div><//>`;
}
function ApptSheet({p}){
  const c=useC();
  const exP=p.aid?c.prof(p.pid):null;const ex=exP?exP.appointments.find(a=>a.id===p.aid):null;
  if(p.aid&&!ex)return html`<${GoneSheet} what="Ce rendez-vous"/>`;
  return html`<${ApptForm} p=${p} ex=${ex}/>`;
}
/* Un rendez-vous peut concerner plusieurs membres (par exemple un vermifuge pour tous les chevaux) :
   un rendez-vous par membre, reliés par un même groupId, modifiés et affichés ensemble. */
function ApptForm({p,ex}){
  const c=useC();
  const act=c.fam.profiles.filter(x=>!x.archived);
  const keyOf=n=>(n||'').trim().toLowerCase();
  const group=ex?(ex.groupId?c.fam.profiles.flatMap(pp=>pp.appointments.filter(a=>a.groupId===ex.groupId&&a.status==='planned').map(a=>({pid:pp.id,a}))):[{pid:p.pid,a:ex}]):[];
  const careOf=(pid,cid)=>{const pp=c.prof(pid);return pp&&cid?pp.cares.find(x=>x.id===cid):null};
  const pre0=(()=>{if(ex||!p.cid)return {};const pp=c.prof(p.pid),cc=careOf(p.pid,p.cid);if(!cc)return {};const i=careInfo(cc,pp.appointments,c.today);return {date:i.due&&i.due>=c.today?i.due:'',place:proName(c.fam,cc)}})();
  const [pids,setPids]=useState(()=>ex?group.map(g=>g.pid):[p.pid||(act[0]&&act[0].id)].filter(Boolean));
  const [ck,setCk]=useState(()=>{const cc=ex?careOf(p.pid,ex.careId):careOf(p.pid,p.cid);return cc?keyOf(cc.name):''});
  const [title,setTitle]=useState(ex?ex.title:'');
  const [date,setDate]=useState(ex?ex.date:(pre0.date||''));
  const [time,setTime]=useState(ex?ex.time:'');
  const [place,setPlace]=useState(ex?ex.place:(pre0.place||''));
  const [note,setNote]=useState(ex?ex.note:'');
  const [rem,setRem]=useState(()=>ex?ex.reminders.map(x=>({...x})):(()=>{const cc=careOf(p.pid,p.cid);return (cc?cc.apptReminders:c.fam.settings.apptDefaults).map(x=>({...x}))})());
  const [err,setErr]=useState('');
  const dirty=useDirty([pids,ck,title,date,time,place,note,rem]);
  const sel=act.filter(x=>pids.includes(x.id));
  /* Soins proposés : ceux des membres choisis, réunis par nom */
  const opts=[],names={};
  sel.forEach(pp=>pp.cares.filter(x=>!x.archived).forEach(x=>{const k=keyOf(x.name);if(!names[k]){names[k]=x.name;opts.push(k)}}));
  const ckLabel=names[ck]||'';
  const careFor=pp=>ck?pp.cares.find(x=>!x.archived&&keyOf(x.name)===ck)||null:null;
  const missing=ck?sel.filter(pp=>!careFor(pp)):[];
  const toggle=id=>{setErr('');setPids(pids.includes(id)?(pids.length>1?pids.filter(x=>x!==id):pids):[...pids,id])};
  const chooseCare=k=>{setCk(k);if(ex||!k)return;const pp=sel.find(x=>x.cares.some(y=>!y.archived&&keyOf(y.name)===k));const cc=pp&&pp.cares.find(y=>!y.archived&&keyOf(y.name)===k);if(!cc)return;
    setRem(cc.apptReminders.map(x=>({...x})));if(proName(c.fam,cc)&&!place)setPlace(proName(c.fam,cc));const i=careInfo(cc,pp.appointments,c.today);if(!date&&i.due&&i.due>=c.today)setDate(i.due)};
  const save=()=>{
    if(!pids.length){setErr('Choisissez au moins un membre.');return}
    if(!date){setErr('Choisissez la date du rendez-vous.');return}
    if(!ck&&!title.trim()){setErr('Choisissez un soin ou donnez un titre.');return}
    const reminders=rem.map(x=>({days:Math.max(1,parseInt(x.days)||1),on:!!x.on}));
    const gid=pids.length>1?((ex&&ex.groupId)||'g-'+uid()):null;
    const label=ckLabel;
    c.mut(d=>{
      const had={};group.forEach(g=>{had[g.pid]=g.a.id});
      /* Membre retiré du rendez-vous commun : son rendez-vous est supprimé */
      group.forEach(g=>{if(!pids.includes(g.pid)){const pp=P(d,g.pid);if(pp)pp.appointments=pp.appointments.filter(a=>a.id!==g.a.id)}});
      pids.forEach(pid=>{
        const pp=P(d,pid);if(!pp)return;
        const cc=ck?pp.cares.find(x=>!x.archived&&keyOf(x.name)===ck):null;
        const body={careId:cc?cc.id:null,title:cc?'':(label||title.trim()),date,time,place,note,reminders,status:'planned',groupId:gid};
        const a=had[pid]&&pp.appointments.find(x=>x.id===had[pid]);
        if(a)Object.assign(a,body);else pp.appointments.push({id:uid(),...body,inCalendar:false});
        if(cc)cc.pending=false;
      });
    });
    c.closeSheet();
    const on=reminders.filter(r=>r.on).map(r=>r.days);
    c.toast('Rendez-vous enregistré'+(pids.length>1?' pour '+andJoin(sel.map(x=>x.name)):'')+(on.length?'. Rappels J-'+on.join(' et J-'):''));
  };
  return html`<${Sh} title=${ex?'Modifier le rendez-vous':'Nouveau rendez-vous'} dirty=${dirty} onSave=${save}><div className="form">
    <div className="fld"><span>Pour</span>
      <div className="mchips" role="group" aria-label="Membres concernés">${act.map(x=>html`<button type="button" key=${x.id} className=${'mchip'+(pids.includes(x.id)?' on':'')} aria-pressed=${pids.includes(x.id)} onClick=${()=>toggle(x.id)}><${Avatar} p=${x} size=${26}/>${x.name}</button>`)}</div>
      <em>${pids.length>1?'Un seul rendez-vous pour '+andJoin(sel.map(x=>x.name))+' : il apparaît sur chaque carnet.':'Touchez plusieurs membres pour un rendez-vous commun (par exemple un vermifuge pour tous les chevaux).'}</em></div>
    <${Field} label="Soin concerné"><select id="ap-c" value=${ck} onChange=${e=>chooseCare(e.target.value)}><option value="">Autre rendez-vous</option>${opts.map(k=>html`<option key=${k} value=${k}>${names[k]}</option>`)}</select><//>
    ${missing.length&&ck?html`<div className="note">${andJoin(missing.map(x=>x.name))} n’${missing.length>1?'ont':'a'} pas de soin « ${ckLabel} » : le rendez-vous sera noté sans mise à jour de l’échéance.</div>`:null}
    ${!ck?html`<${Field} label="Titre"><input id="ap-title" type="text" value=${title} onChange=${e=>setTitle(e.target.value)} placeholder="Consultation, contrôle…"/><//>`:null}
    <div className="two"><${Field} label="Date"><input id="ap-date" type="date" value=${date} onChange=${e=>setDate(e.target.value)}/><//><${Field} label="Heure"><input id="ap-time" type="time" value=${time} onChange=${e=>setTime(e.target.value)}/><//></div>
    <${Field} label="Lieu ou professionnel"><input id="ap-place" type="text" value=${place} onChange=${e=>setPlace(e.target.value)}/><//>
    <${Field} label="Notes"><textarea id="ap-note" value=${note} onChange=${e=>setNote(e.target.value)}></textarea><//>
    <div><div className="lbl" style=${{marginBottom:8}}>Rappels avant le rendez-vous</div>
      ${rem.map((r,n)=>html`<div key=${n} className="swrow" style=${{marginBottom:8}}><div className="inl"><input id=${'ap-r'+n} className="num" type="number" min="1" inputMode="numeric" value=${r.days} onChange=${e=>setRem(rem.map((x,j)=>j===n?{...x,days:e.target.value}:x))} aria-label=${'Jours avant, rappel '+(n+1)}/><span>jour(s) avant</span></div><${Switch} on=${r.on} set=${x=>setRem(rem.map((y,j)=>j===n?{...y,on:x}:y))} label=${'Rappel '+(n+1)}/></div>`)}</div>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>${ex?'Enregistrer':'Enregistrer le rendez-vous'}<//>
  </div><//>`;
}
/* « Fait le… » pour un rendez-vous commun : la même date pour chaque membre */
function GroupDoneSheet({p}){
  const c=useC();
  const items=(p.items||[]).map(x=>{const pr=c.prof(x.pid);const a=pr&&pr.appointments.find(y=>y.id===x.aid);return pr&&a?{pr,a,care:a.careId?pr.cares.find(y=>y.id===a.careId):null}:null}).filter(Boolean);
  const [date,setDate]=useState(items[0]?items[0].a.date:c.today);
  const [note,setNote]=useState('');
  const dirty=useDirty([date,note]);
  if(!items.length)return html`<${GoneSheet} what="Ce rendez-vous"/>`;
  const label=apptTitle(items[0].a,items[0].pr);
  const save=()=>{
    if(!date)return;
    c.mut(d=>{items.forEach(({pr,a,care})=>{const pp=P(d,pr.id);if(!pp)return;const ap=pp.appointments.find(y=>y.id===a.id);if(ap)ap.status='done';
      const ca=care&&pp.cares.find(y=>y.id===care.id);if(ca){ca.realizations.push({id:uid(),date,note,pro:proName(c.fam,ca),docs:[]});ca.pending=false}})});
    c.closeSheet();c.toast(label+' : fait le '+fmt(date)+' pour '+andJoin(items.map(x=>x.pr.name)));
  };
  return html`<${Sh} title="Fait le…" dirty=${dirty} onSave=${save}><div className="form">
    <span className="muted">${label} · ${andJoin(items.map(x=>x.pr.name))}. La date s’ajoute à l’historique de chacun.</span>
    <${Field} label="Fait le"><input id="gd-date" type="date" max=${c.today} value=${date} onChange=${e=>setDate(e.target.value)}/><//>
    <${Field} label="Observations (facultatif)"><textarea id="gd-note" value=${note} onChange=${e=>setNote(e.target.value)}></textarea><//>
    <${Btn} block onClick=${save}>Enregistrer pour ${items.length} membre${items.length>1?'s':''}<//>
  </div><//>`;
}
/* Abonnement à l'agenda du téléphone : l'agenda suit tout seul les rendez-vous et échéances du carnet */
function CalSheet(){
  const c=useC();
  const [tok,setTok]=useState('');const [err,setErr]=useState('');const [renew,setRenew]=useState(false);
  useEffect(()=>{if(CLOUD)Cloud.api('calendar/link',{}).then(r=>setTok(r.token),e=>setErr(Cloud.msg(e)))},[]);
  if(!CLOUD)return html`<${Sh} title="Agenda du téléphone"><div className="note">Disponible avec un compte : l’agenda du téléphone suit alors tout seul les rendez-vous et les échéances du carnet.</div><//>`;
  const https=tok?location.origin+'/cal/'+tok+'.ics':'';
  const webcal=https.replace(/^https?:/,'webcal:');
  const copy=()=>{try{navigator.clipboard.writeText(https).then(()=>c.toast('Lien copié'),()=>c.toast('Copie impossible dans ce contexte'))}catch(e){c.toast('Copie impossible dans ce contexte')}};
  const doRenew=()=>Cloud.api('calendar/link',{renew:true}).then(r=>{setTok(r.token);setRenew(false);c.toast('Nouveau lien créé : abonnez-vous de nouveau')},e=>setErr(Cloud.msg(e)));
  return html`<${Sh} title="Agenda du téléphone">
    <span className="muted">Rendez-vous (avec leurs rappels) et échéances des soins de toute la famille, mis à jour automatiquement dans votre agenda.</span>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    ${tok?html`<div className="form">
      <a className="btn block" href=${webcal}><${Pic} e="📅"/> S’abonner (iPhone, iPad, Mac, Outlook)</a>
      <a className="btn soft block" href=${'https://calendar.google.com/calendar/r?cid='+encodeURIComponent(webcal)} target="_blank" rel="noopener noreferrer">Ajouter à Google Agenda</a>
      <${Btn} kind="ghost" block onClick=${copy}>Copier le lien<//>
      <div className="note">L’agenda se met à jour tout seul, en général en quelques heures (Google Agenda : jusqu’à une journée). Ce lien est personnel : toute personne qui le connaît voit les rendez-vous du carnet.</div>
      ${renew?html`<div className="note">L’ancien lien cessera de fonctionner : il faudra vous abonner de nouveau sur vos appareils.</div><div className="btns"><${Btn} sm kind="danger" onClick=${doRenew}>Changer le lien<//><${Btn} sm kind="ghost" onClick=${()=>setRenew(false)}>Annuler<//></div>`
        :html`<button type="button" className="link" style=${{alignSelf:'flex-start'}} onClick=${()=>setRenew(true)}>Lien partagé par erreur ? Changer le lien</button>`}
    </div>`:err?null:html`<span className="muted">Préparation du lien…</span>`}
  <//>`;
}
function WeightSheet({p}){
  const c=useC();const pr=c.prof(p.pid);const ex=p.wid?pr.weights.find(w=>w.id===p.wid):null;
  const [date,setDate]=useState(ex?ex.date:c.today);
  const [kg,setKg]=useState(ex?String(ex.kg):'');
  const [note,setNote]=useState(ex?ex.note:'');
  const [del,setDel]=useState(false);
  const [err,setErr]=useState('');
  const dirty=useDirty([date,kg,note]);
  const save=()=>{
    const v=parseFloat(String(kg).replace(',','.'));
    if(!date||!(v>0)){setErr('Indiquez une date et un poids supérieur à 0.');return}
    c.mut(d=>{const pp=P(d,p.pid);if(ex)Object.assign(pp.weights.find(w=>w.id===ex.id),{date,kg:v,note});else pp.weights.push({id:uid(),date,kg:v,note})});
    c.closeSheet();c.toast('Pesée enregistrée');
  };
  return html`<${Sh} title=${ex?'Modifier la pesée':'Nouvelle pesée'} dirty=${dirty} onSave=${save}><div className="form">
    <div className="two"><${Field} label="Date"><input id="wt-date" type="date" max=${c.today} value=${date} onChange=${e=>setDate(e.target.value)}/><//><${Field} label="Poids (kg)"><input id="wt-kg" type="number" step="0.1" min="0" inputMode="decimal" value=${kg} onChange=${e=>setKg(e.target.value)}/><//></div>
    <${Field} label="Observation (facultatif)"><input id="wt-note" type="text" value=${note} onChange=${e=>setNote(e.target.value)}/><//>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>Enregistrer<//>
    ${ex?(del?html`<${Btn} kind="danger" block onClick=${()=>{c.mut(d=>{const pp=P(d,p.pid);pp.weights=pp.weights.filter(w=>w.id!==ex.id)});c.closeSheet();c.toast('Pesée supprimée')}}>Confirmer la suppression<//>`:html`<${Btn} kind="ghost" block onClick=${()=>setDel(true)}>Supprimer cette pesée<//>`):null}
  </div><//>`;
}
function TreatSheet({p}){
  const c=useC();const pr=c.prof(p.pid);const ex=p.tid?pr.treatments.find(t=>t.id===p.tid):null;
  const [f,setF]=useState({name:ex?ex.name:'',start:ex?ex.start:c.today,end:ex?ex.end:'',dose:ex?ex.dose:'',freq:ex?ex.freq:'',notes:ex?ex.notes:'',ron:ex?!!(ex.remind&&ex.remind.on):false,rtime:ex&&ex.remind?ex.remind.time:'08:00'});
  const [del,setDel]=useState(false);
  const [err,setErr]=useState('');
  const s=(k,v)=>setF({...f,[k]:v});
  const dirty=useDirty(f);
  const save=()=>{
    if(!f.name.trim()||!f.start){setErr('Indiquez le nom du traitement et sa date de début.');return}
    c.mut(d=>{
      const pp=P(d,p.pid);pp.treatments=pp.treatments||[];
      const body={name:f.name.trim(),start:f.start,end:f.end,dose:f.dose,freq:f.freq,notes:f.notes,remind:{on:f.ron,time:f.rtime||'08:00'}};
      if(ex){const t=pp.treatments.find(x=>x.id===ex.id);Object.assign(t,body);t.events.push({date:c.today,text:'Fiche modifiée'})}
      else pp.treatments.push({id:uid(),...body,status:'active',events:[{date:f.start,text:'Début du traitement'}]});
    });
    c.closeSheet();c.toast('Traitement enregistré');
  };
  return html`<${Sh} title=${ex?'Modifier le traitement':'Nouveau traitement'} dirty=${dirty} onSave=${save}><div className="form">
    <${Field} label="Nom du traitement"><input id="tr-name" type="text" value=${f.name} onChange=${e=>s('name',e.target.value)}/><//>
    <div className="two"><${Field} label="Début"><input id="tr-start" type="date" value=${f.start} onChange=${e=>s('start',e.target.value)}/><//><${Field} label="Fin (si connue)"><input id="tr-end" type="date" value=${f.end} onChange=${e=>s('end',e.target.value)}/><//></div>
    <div className="two"><${Field} label="Posologie"><input id="tr-dose" type="text" value=${f.dose} onChange=${e=>s('dose',e.target.value)} placeholder="1 comprimé"/><//><${Field} label="Fréquence de prise"><input id="tr-freq" type="text" value=${f.freq} onChange=${e=>s('freq',e.target.value)} placeholder="2 fois par jour"/><//></div>
    <${Field} label="Observations"><textarea id="tr-notes" value=${f.notes} onChange=${e=>s('notes',e.target.value)}></textarea><//>
    <div className="swrow"><div><b style=${{font:'700 15px var(--font-d)'}}>Rappel de prise</b><div className="muted">Affiché sur l’accueil</div></div><${Switch} on=${f.ron} set=${v=>s('ron',v)} label="Rappel de prise"/></div>
    ${f.ron?html`<${Field} label="Heure de la prise"><input id="tr-time" type="time" value=${f.rtime} onChange=${e=>s('rtime',e.target.value)}/><//>`:null}
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>Enregistrer<//>
    ${ex?(del?html`<${Btn} kind="danger" block onClick=${()=>{c.mut(d=>{const pp=P(d,p.pid);pp.treatments=pp.treatments.filter(t=>t.id!==ex.id)});c.closeSheet();c.toast('Traitement supprimé')}}>Supprimer avec son historique<//>`:html`<${Btn} kind="ghost" block onClick=${()=>setDel(true)}>Supprimer définitivement<//>`):null}
  </div><//>`;
}
function InviteSheet(){
  const c=useC();
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('editor');
  const [err,setErr]=useState('');
  const dirty=useDirty(email);
  const send=()=>{
    const em=email.trim().toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(em)){setErr('Saisissez une adresse e-mail valide.');return}
    if(c.fam.users.some(u=>u.email===em)||c.fam.invites.some(i=>i.email===em)){setErr('Cette personne a déjà accès ou une invitation est en attente.');return}
    const code=CLOUD?newCode():uid().toUpperCase().slice(0,4)+'-'+uid().toUpperCase().slice(0,4);
    c.mut(d=>{F(d).invites.push({id:code,email:em,role,status:'pending',date:c.today,code})});
    c.closeSheet();c.toast(CLOUD?'Invitation créée : partagez-la depuis la liste':'Invitation créée (envoi simulé)');
  };
  return html`<${Sh} title="Inviter un proche" dirty=${dirty} onSave=${send} saveLabel="Envoyer"><div className="form">
    <${Field} label="Adresse e-mail" hint=${CLOUD?"La personne devra créer son compte avec exactement cette adresse.":null}><input id="iv-mail" type="email" value=${email} onChange=${e=>setEmail(e.target.value)} autoCapitalize="none"/><//>
    <div className="form">${Object.keys(ROLES).filter(r=>r!=='admin'||true).map(r=>html`<button type="button" key=${r} className=${'pal'+(role===r?' on':'')} onClick=${()=>setRole(r)}><div style=${{flex:1}}><b style=${{font:'800 15px var(--font-d)'}}>${ROLES[r][0]}</b><div className="muted">${ROLES[r][1]}</div></div></button>`)}</div>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${send}>Envoyer l’invitation<//>
  </div><//>`;
}
function AccountSheet(){
  const c=useC();const acc=c.db.accounts.find(a=>a.email===c.db.session.email)||{name:''};
  const [name,setName]=useState(acc.name);const [pw,setPw]=useState('');const [err,setErr]=useState('');
  const dirty=useDirty([name,pw]);
  const save=async()=>{
    if(!name.trim()){setErr('Indiquez votre prénom.');return}
    if(pw&&pw.length<6){setErr('Le mot de passe doit contenir au moins 6 caractères.');return}
    if(CLOUD){
      try{await Cloud.updateName(name.trim());if(pw)await Cloud.changePassword(pw)}catch(ex){setErr(Cloud.msg(ex));return}
      c.mut(d=>{const a=d.accounts.find(x=>x.email===d.session.email);if(a)a.name=name.trim()});
    }else c.mut(d=>{const a=d.accounts.find(x=>x.email===d.session.email);a.name=name.trim();if(pw)a.password=pw;const u=F(d).users.find(x=>x.email===d.session.email);if(u)u.name=name.trim()});
    c.closeSheet();c.toast('Compte mis à jour');
  };
  return html`<${Sh} title="Mon compte" dirty=${dirty} onSave=${save}><div className="form">
    <${Field} label="Adresse e-mail"><input id="ac-mail" type="email" value=${c.db.session.email} disabled/><//>
    <${Field} label="Prénom"><input id="ac-name" type="text" value=${name} onChange=${e=>setName(e.target.value)}/><//>
    <${Field} label="Nouveau mot de passe" hint="Laissez vide pour le conserver."><input id="ac-pw" type="password" value=${pw} onChange=${e=>setPw(e.target.value)} autoComplete="new-password"/><//>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>Enregistrer<//></div><//>`;
}
function FamNameSheet(){
  const c=useC();const [name,setName]=useState(c.fam.name);
  const dirty=useDirty(name);
  const save=()=>{if(!name.trim())return;c.mut(d=>{F(d).name=name.trim()});c.closeSheet();c.toast('Nom de l’espace modifié')};
  return html`<${Sh} title="Nom de l’espace familial" dirty=${dirty} onSave=${save}><div className="form">
    <${Field} label="Nom"><input id="fn-name" type="text" value=${name} onChange=${e=>setName(e.target.value)}/><//>
    <${Btn} block onClick=${save}>Enregistrer<//></div><//>`;
}
/* ---------- Types de soin ---------- */
const CAT_FOR=[['h','Personnes'],['a','Animaux'],['e','Chevaux']];
const catUses=fam=>{const u={};fam.profiles.forEach(p=>p.cares.forEach(x=>{u[x.category]=(u[x.category]||0)+1}));return u};
function askDelCat(c,cat){
  const n=catUses(c.fam)[cat.id]||0;const other=catOf(c.fam,'autre').label;
  c.openSheet('confirm',{title:'Supprimer « '+cat.label+' » ?',
    text:n?n+' soin'+(n>1?'s':'')+' de ce type passer'+(n>1?'ont':'a')+' dans « '+other+' ». Leur historique est conservé.':'Aucun soin n’utilise ce type.',
    label:'Supprimer le type',danger:true,
    run:()=>{c.mut(d=>{const f=F(d);
      f.profiles.forEach(p=>p.cares.forEach(x=>{if(x.category===cat.id)x.category='autre'}));
      if(CATS.some(x=>x.id===cat.id)){f.catHidden=[...new Set([...(f.catHidden||[]),cat.id])];if(f.catEdits)delete f.catEdits[cat.id]}
      else f.cats=(f.cats||[]).filter(x=>x.id!==cat.id)});
      c.toast('Type « '+cat.label+' » supprimé')}});
}
function CatsScreen(){
  const c=useC();const f=c.fam;const used=catUses(f);const hid=f.catHidden||[];
  const forLabel=k=>CAT_FOR.filter(x=>k.split(',').includes(x[0])).map(x=>x[1]).join(', ');
  return html`<${Top} back=${true} title="Types de soin" sub="Communs à toute la famille"/>
    <div className="scroll pb">
      <div className="note">Les types regroupent les soins dans les carnets. Supprimer un type déplace ses soins dans « ${catOf(f,'autre').label} », sans rien perdre.</div>
      <div className="card">${allCats(f).map(cat=>html`<div key=${cat.id} className="row">
        <${CatIco} cat=${cat}/><div className="grow"><b>${cat.label}</b><small>${used[cat.id]?used[cat.id]+' soin'+(used[cat.id]>1?'s':''):'Aucun soin'} · ${forLabel(cat.k)}</small></div>
        ${c.canEdit?html`<button type="button" className="iconbtn x" aria-label=${'Modifier '+cat.label} onClick=${()=>c.openSheet('cat',{id:cat.id})}><${Pic} e="✏️"/></button>
          ${cat.id!=='autre'?html`<button type="button" className="iconbtn x" aria-label=${'Supprimer '+cat.label} onClick=${()=>askDelCat(c,cat)}><${Pic} e="🗑️"/></button>`:null}`:null}
      </div>`)}</div>
      ${c.canEdit&&hid.length?html`<${Btn} kind="ghost" onClick=${()=>{c.mut(d=>{F(d).catHidden=[]});c.toast('Types prédéfinis rétablis')}}>Rétablir les types prédéfinis supprimés (${hid.length})<//>`:null}
    </div>
    ${c.canEdit?html`<button className="btn fab" onClick=${()=>c.openSheet('cat',{})}><${Pic} e="＋"/> Nouveau type</button>`:null}`;
}
function CatSheet({p}){
  const c=useC();const ex=p.id?allCats(c.fam).find(x=>x.id===p.id):null;
  const [label,setLabel]=useState(ex?ex.label:'');
  const [emoji,setEmoji]=useState(ex?ex.emoji:CAT_EMOJIS[0]);
  const [k,setK]=useState(ex?ex.k.split(','):(p.k?[p.k]:['h','a','e']));
  const [err,setErr]=useState('');
  const dirty=useDirty([label,emoji,k]);
  /* Une seule fois chaque icône, même si plusieurs emojis y mènent (doublons retirés) */
  const icons=(()=>{const seen=new Set(),out=[];[emoji,...CATS.map(x=>x.emoji),...CAT_EMOJIS,...CAT_ICONS.map(x=>x[0])].forEach(e=>{const n=faName(e);if(n&&!seen.has(n)){seen.add(n);out.push(e)}});return out})();
  const save=()=>{
    if(!label.trim()){setErr('Donnez un nom à ce type de soin.');return}
    if(!k.length){setErr('Choisissez au moins une catégorie de profils.');return}
    const body={label:label.trim(),emoji,k:CAT_FOR.map(x=>x[0]).filter(x=>k.includes(x)).join(',')};
    const id=ex?ex.id:'c-'+uid();
    c.mut(d=>{const f=F(d);
      if(ex&&CATS.some(x=>x.id===ex.id)){f.catEdits={...(f.catEdits||{}),[ex.id]:body}}
      else if(ex){const t=(f.cats||[]).find(x=>x.id===ex.id);if(t)Object.assign(t,body)}
      else{f.cats=[...(f.cats||[]),{id,...body}]}});
    c.closeSheet();c.toast(ex?'Type de soin modifié':'Type « '+body.label+' » créé');
    if(p.onSaved)p.onSaved(id,body.label);
  };
  return html`<${Sh} title=${ex?'Modifier le type de soin':'Nouveau type de soin'} dirty=${dirty} onSave=${save}><div className="form">
    <${Field} label="Nom"><input id="ct-label" type="text" value=${label} onChange=${e=>setLabel(e.target.value)} placeholder="Podologue, kinésithérapeute…"/><//>
    <div><div className="lbl" style=${{marginBottom:8}}>Icône</div><div className="chips">${icons.map(e=>html`<button type="button" key=${e} className=${'tile icotile'+(emoji===e?' on':'')} onClick=${()=>setEmoji(e)} aria-label=${'Icône : '+iconLabel(e)} title=${iconLabel(e)} aria-pressed=${emoji===e}><span style=${{color:tintInk(catTint({id:ex?ex.id:'new'}))}}><${Pic} e=${e}/></span></button>`)}</div></div>
    <div><div className="lbl" style=${{marginBottom:8}}>Proposé pour</div><div className="seg">${CAT_FOR.map(x=>html`<button type="button" key=${x[0]} className=${k.includes(x[0])?'on':''} aria-pressed=${k.includes(x[0])} onClick=${()=>setK(k.includes(x[0])?k.filter(y=>y!==x[0]):[...k,x[0]])}>${x[1]}</button>`)}</div></div>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>${ex?'Enregistrer':'Créer le type'}<//>
    ${ex&&ex.id!=='autre'?html`<${Btn} kind="ghost" block onClick=${()=>{c.closeSheet();setTimeout(()=>askDelCat(c,ex),0)}}>Supprimer ce type<//>`:null}
  </div><//>`;
}

/* ---------- Périodicité d'un soin (depuis sa fiche) ---------- */
function FreqSheet({p}){
  const c=useC();const pr=c.prof(p.pid);const care=pr&&pr.cares.find(x=>x.id===p.cid);
  const [v,setV]=useState(()=>vFrom(care,c.fam.settings.apptDefaults));
  const dirty=useDirty(v);
  if(!care)return html`<${GoneSheet} what="Ce soin"/>`;
  const last=careInfo(care,pr.appointments,c.today).last;
  const save=()=>{
    const freq=toFreq(v);
    c.mut(d=>{const t=P(d,p.pid).cares.find(x=>x.id===p.cid);
      const before=freqLabel(t.freq),after=freqLabel(freq);
      if(before!==after){t.freqLog=t.freqLog||[];t.freqLog.push({date:c.today,from:before,to:after})}
      Object.assign(t,{freq,remind:toRem(v),apptReminders:toAr(v)})});
    c.closeSheet();
    c.toast(freq&&last?'Périodicité enregistrée · prochaine échéance le '+fmt(addUnit(last,freq.n,freq.unit)):'Périodicité enregistrée');
  };
  return html`<${Sh} title="Périodicité et rappels" dirty=${dirty} onSave=${save}>
    <span className="muted">${care.name} · ${pr.name}</span>
    <${RemFields} v=${v} set=${setV} last=${last}/>
    <${Btn} block onClick=${save}>Enregistrer<//>
  <//>`;
}

/* ---------- Annuaire : médecins, vétérinaires, établissements ---------- */
const telHref=t=>'tel:'+String(t).replace(/[^0-9+]/g,'');
const mapHref=a=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(a);
const contactCares=(fam,id)=>{const r=[];fam.profiles.forEach(p=>p.cares.forEach(x=>{if(x.proId===id)r.push({p,care:x})}));return r};
const contactProfiles=(fam,id)=>fam.profiles.filter(p=>!p.archived&&((p.info||{}).doctorId===id||(p.info||{}).vetId===id));
function ContactsScreen(){
  const c=useC();const [kind,setKind]=useState('all');
  const list=(c.fam.contacts||[]).filter(k=>kind==='all'||k.kind===kind).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  return html`<${Top} back=${true} title="Annuaire" sub="Médecins, vétérinaires, établissements"/>
    <div className="scroll pb">
      <div className="seg scrollx" role="group" aria-label="Filtrer l’annuaire">${[['all','Tout'],...Object.keys(KINDS).map(k=>[k,KINDS[k][2]])].map(x=>html`<button key=${x[0]} type="button" className=${kind===x[0]?'on':''} aria-pressed=${kind===x[0]} onClick=${()=>setKind(x[0])}>${x[1]}</button>`)}</div>
      ${list.length?html`<div className="card">${list.map(k=>html`<button key=${k.id} className="row" onClick=${()=>c.go('contact',{id:k.id})}><${Ico} e=${KINDS[k.kind][1]} k=${k.kind==='vet'?'s':k.kind==='place'?'w':'i'}/><div className="grow"><b>${k.name}</b><small>${[k.specialty||KINDS[k.kind][0],k.phone].filter(Boolean).join(' · ')}</small></div><span className="go"><${Pic} e="›"/></span></button>`)}</div>`
        :html`<div className="card"><${Empty} e="🥼" title=${kind==='all'?'L’annuaire est vide':'Aucune fiche dans cette catégorie'} text="Ajoutez le médecin traitant, le vétérinaire, la clinique ou l’écurie : coordonnées et soins suivis au même endroit."/></div>`}
    </div>
    ${c.canEdit?html`<button className="btn fab" onClick=${()=>c.openSheet('contact',{kind:kind==='all'?'doctor':kind})}><${Pic} e="＋"/> Ajouter une fiche</button>`:null}`;
}
function ContactScreen({p:q}){
  const c=useC();const k=contactOf(c.fam,q.id);
  if(!k)return html`<${Gone}/>`;
  const cares=contactCares(c.fam,k.id);
  const ask=()=>c.openSheet('confirm',{title:'Supprimer la fiche « '+k.name+' » ?',text:cares.length?'Les '+cares.length+' soin(s) liés gardent le nom « '+k.name+' » en texte libre.':'Cette fiche n’est liée à aucun soin.',label:'Supprimer la fiche',danger:true,
    run:()=>{c.mut(d=>{const f=F(d);f.profiles.forEach(p=>{p.cares.forEach(x=>{if(x.proId===k.id){x.proId=null;x.pro=k.name}});const i=p.info||{};if(i.doctorId===k.id)i.doctorId=null;if(i.vetId===k.id)i.vetId=null});f.contacts=(f.contacts||[]).filter(x=>x.id!==k.id)});c.back();c.toast('Fiche supprimée')}});
  return html`<${Top} back=${true} lead=${html`<${Ico} e=${KINDS[k.kind][1]} k=${k.kind==='vet'?'s':k.kind==='place'?'w':'i'} s=${44}/>`} title=${k.name} sub=${k.specialty||KINDS[k.kind][0]} right=${c.canEdit?html`<button className="iconbtn" aria-label="Modifier la fiche" onClick=${()=>c.openSheet('contact',{id:k.id})}><${Pic} e="✏️"/></button>`:null}/>
    <div className="scroll">
      ${k.phone||k.email||k.address?html`<div className="btns">
        ${k.phone?html`<a className="btn" href=${telHref(k.phone)}>📞 Appeler</a>`:null}
        ${k.email?html`<a className="btn soft" href=${'mailto:'+k.email}><${Pic} e="✉️"/> E-mail</a>`:null}
        ${k.address?html`<a className="btn soft" href=${mapHref(k.address)} target="_blank" rel="noopener noreferrer"><${Pic} e="📍"/> Itinéraire</a>`:null}
      </div>`:null}
      <div className="card pad"><dl className="kv">
        <dt>Type</dt><dd>${KINDS[k.kind][0]}</dd>
        ${k.specialty?html`<dt>Spécialité</dt><dd>${k.specialty}</dd>`:null}
        ${k.phone?html`<dt>Téléphone</dt><dd>${k.phone}</dd>`:null}
        ${k.email?html`<dt>E-mail</dt><dd>${k.email}</dd>`:null}
        ${k.address?html`<dt>Adresse</dt><dd>${k.address}</dd>`:null}
        ${k.notes?html`<dt>Notes</dt><dd>${k.notes}</dd>`:null}
      </dl></div>
      ${contactProfiles(c.fam,k.id).length?html`<${Section} title="Suit"><div className="card">${contactProfiles(c.fam,k.id).map(p=>html`<button key=${p.id} className="row" onClick=${()=>c.go('book',{pid:p.id})}><${Avatar} p=${p} size=${42}/><div className="grow"><b>${p.name}</b><small>${TYPES[p.type].human?'Médecin traitant':'Vétérinaire'}</small></div><span className="go"><${Pic} e="›"/></span></button>`)}</div><//>`:null}
      <${Section} title=${'Soins suivis ('+cares.length+')'}>
        <div className="card">${cares.length?cares.map(({p,care})=>html`<button key=${care.id} className="row" onClick=${()=>c.go('care',{pid:p.id,cid:care.id})}><${CatIco} cat=${catOf(c.fam,care.category)}/><div className="grow"><b>${care.name}</b><small>${p.name}</small></div><span className="go"><${Pic} e="›"/></span></button>`)
          :html`<${Empty} e="🔗" title="Aucun soin lié" text="Choisissez cette fiche dans « Professionnel ou établissement » en modifiant un soin."/>`}</div>
      <//>
      ${c.canEdit?html`<div className="btns"><${Btn} kind="danger" onClick=${ask}>Supprimer la fiche<//></div>`:null}
    </div>`;
}
function ContactSheet({p}){
  const c=useC();const ex=contactOf(c.fam,p.id);
  /* Ouverte depuis la fenêtre d'un soin : on y revient à la fermeture (avec la fiche créée, le cas échéant) */
  const savedId=useRef(null);
  useEffect(()=>()=>{if(p.back)setTimeout(()=>c.openSheet(p.back.n,savedId.current?{...p.back.p,proId:savedId.current}:p.back.p),0)},[]);
  const [f,setF]=useState({kind:ex?ex.kind:(p.kind||'doctor'),name:ex?ex.name:'',specialty:ex?ex.specialty:'',phone:ex?ex.phone:'',email:ex?ex.email:'',address:ex?ex.address:'',notes:ex?ex.notes:''});
  const [err,setErr]=useState('');
  const dirty=useDirty(f);
  const s=(k,v)=>setF({...f,[k]:v});
  const save=()=>{
    if(!f.name.trim()){setErr('Indiquez un nom.');return}
    if(f.email.trim()&&!/^\S+@\S+\.\S+$/.test(f.email.trim())){setErr('Adresse e-mail invalide.');return}
    const body={kind:f.kind,name:f.name.trim(),specialty:f.specialty.trim(),phone:f.phone.trim(),email:f.email.trim(),address:f.address.trim(),notes:f.notes.trim()};
    const id=ex?ex.id:'k-'+uid();
    c.mut(d=>{const fam=F(d);fam.contacts=fam.contacts||[];
      if(ex){Object.assign(fam.contacts.find(x=>x.id===ex.id),body);fam.profiles.forEach(pp=>{pp.cares.forEach(x=>{if(x.proId===ex.id)x.pro=body.name});const i=pp.info||{};if(i.doctorId===ex.id)i.doctor=body.name;if(i.vetId===ex.id)i.vet=body.name})}
      else fam.contacts.push({id,...body})});
    c.closeSheet();c.toast(ex?'Fiche modifiée':'Fiche ajoutée à l’annuaire');
    if(p.onSaved)p.onSaved(id);
    savedId.current=id;
  };
  const ph={doctor:'Dr Claire Martin',vet:'Clinique vétérinaire des Tilleuls',place:'Hôpital, laboratoire, écurie…',pro:'Ostéopathe, maréchal-ferrant…'}[f.kind];
  return html`<${Sh} title=${ex?'Modifier la fiche':'Nouvelle fiche'} dirty=${dirty} onSave=${save}><div className="form">
    <div className="pgrid">${Object.keys(KINDS).map(k=>html`<button type="button" key=${k} className=${'pg'+(f.kind===k?' on':'')} aria-pressed=${f.kind===k} onClick=${()=>s('kind',k)}><${Ico} e=${KINDS[k][1]} s=${32}/>${KINDS[k][0]}</button>`)}</div>
    <${Field} label="Nom"><input id="kt-name" type="text" value=${f.name} onChange=${e=>s('name',e.target.value)} placeholder=${ph}/><//>
    <${Field} label="Spécialité ou description" hint="Facultatif"><input id="kt-spec" type="text" value=${f.specialty} onChange=${e=>s('specialty',e.target.value)} placeholder=${f.kind==='doctor'?'Médecin généraliste, pédiatre…':f.kind==='vet'?'Chiens, chats, équins…':''}/><//>
    <div className="two"><${Field} label="Téléphone"><input id="kt-tel" type="tel" inputMode="tel" autoComplete="off" value=${f.phone} onChange=${e=>s('phone',e.target.value)}/><//><${Field} label="E-mail"><input id="kt-mail" type="email" autoCapitalize="none" value=${f.email} onChange=${e=>s('email',e.target.value)}/><//></div>
    <${Field} label="Adresse"><textarea id="kt-addr" value=${f.address} onChange=${e=>s('address',e.target.value)} style=${{minHeight:56}}></textarea><//>
    <${Field} label="Notes"><textarea id="kt-notes" value=${f.notes} onChange=${e=>s('notes',e.target.value)} placeholder="Horaires, accès, numéro d’urgence…"></textarea><//>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>${ex?'Enregistrer':'Ajouter à l’annuaire'}<//>
  </div><//>`;
}
/* ---------- Modification rapide d'un soin (depuis le carnet d'un membre) ---------- */
function CareEditSheet({p}){
  const c=useC();const pr=c.prof(p.pid);const care=pr&&pr.cares.find(x=>x.id===p.cid);
  /* draft : saisie en cours, conservée pendant la création d'une fiche d'annuaire */
  const dr=p.draft||{};
  const [name,setName]=useState(dr.name!==undefined?dr.name:care?care.name:'');
  const [cat,setCat]=useState(dr.cat||(care?care.category:'autre'));
  const [proId,setProId]=useState(p.proId||(care&&contactOf(c.fam,care.proId)?care.proId:''));
  const [pro,setPro]=useState(p.proId?'':dr.pro!==undefined?dr.pro:care&&!contactOf(c.fam,care.proId)?care.pro||'':'');
  const [notes,setNotes]=useState(dr.notes!==undefined?dr.notes:care?care.notes||'':'');
  const [v,setV]=useState(()=>dr.v||vFrom(care,c.fam.settings.apptDefaults));
  const last0=care?careInfo(care,pr.appointments,c.today).last||'':'';
  const [last,setLast]=useState(dr.last!==undefined?dr.last:last0);
  const [del,setDel]=useState(false);
  const [err,setErr]=useState('');
  /* Modifié = différent du soin enregistré (et non de l'état d'ouverture, qui peut venir d'un brouillon) */
  const orig=care?[care.name,care.category,contactOf(c.fam,care.proId)?care.proId:'',contactOf(c.fam,care.proId)?'':care.pro||'',care.notes||'',vFrom(care,c.fam.settings.apptDefaults),last0]:[];
  const dirty=!!care&&JSON.stringify([name,cat,proId,pro,notes,v,last])!==JSON.stringify(orig);
  if(!care)return html`<${GoneSheet} what="Ce soin"/>`;
  const i=careInfo(care,pr.appointments,c.today);
  const cats=catsFor(c.fam,pr);
  const contacts=(c.fam.contacts||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const save=()=>{
    if(!name.trim()){setErr('Donnez un nom à ce soin.');return}
    if(last&&last>c.today){setErr('La date « fait le » ne peut pas être dans le futur.');return}
    const freq=toFreq(v);const k=contactOf(c.fam,proId);const proTxt=k?k.name:pro.trim();
    c.mut(d=>{const t=P(d,p.pid).cares.find(x=>x.id===p.cid);
      /* Dernière fois fait le : crée la première date, ou corrige la plus récente */
      if(last&&last!==last0){
        const latest=[...t.realizations].sort((a,b)=>a.date<b.date?1:-1)[0];
        if(latest)latest.date=last;else{t.realizations.push({id:uid(),date:last,note:'',pro:proTxt,docs:[]});t.pending=false}
      }
      const before=freqLabel(t.freq),after=freqLabel(freq);
      if(before!==after){t.freqLog=t.freqLog||[];t.freqLog.push({date:c.today,from:before,to:after})}
      Object.assign(t,{name:name.trim(),category:cat,proId:k?k.id:null,pro:proTxt,notes,freq,remind:toRem(v),apptReminders:toAr(v)})});
    c.closeSheet();
    const lastNow=last||i.last;
    c.toast(freq&&lastNow?'Soin enregistré · prochaine échéance le '+fmt(addUnit(lastNow,freq.n,freq.unit)):'Soin enregistré');
  };
  const remove=()=>{
    c.mut(d=>{const pp=P(d,p.pid);pp.cares=pp.cares.filter(x=>x.id!==p.cid);pp.appointments=pp.appointments.filter(a=>a.careId!==p.cid)});
    c.closeSheet();c.toast('« '+care.name+' » supprimé');
  };
  return html`<${Sh} title="Modifier le soin" dirty=${dirty} onSave=${save}><div className="form">
    <button type="button" className="row act cehist" onClick=${()=>{c.closeSheet();c.go('care',{pid:p.pid,cid:care.id})}}><${CatIco} cat=${catOf(c.fam,care.category)}/><div className="grow"><b>${pr.name}</b><small>${care.realizations.length?'Fait '+care.realizations.length+' fois · dernière fois le '+fmt(i.last):'Jamais fait'}</small><span className="tapedit">Historique et rendez-vous</span></div><span className="go"><${Pic} e="›"/></span></button>
    <${Field} label="Dernière fois fait le" hint=${care.realizations.length>1?'Corrige la date la plus récente. Les dates précédentes restent dans l’historique.':care.realizations.length?null:'Indiquez-la pour que l’échéance suivante se calcule toute seule.'}><input id="ce-last" type="date" max=${c.today} value=${last} onChange=${e=>setLast(e.target.value)}/><//>
    <${Field} label="Nom du soin"><input id="ce-name" type="text" value=${name} onChange=${e=>setName(e.target.value)}/><//>
    <${Field} label="Type de soin"><select id="ce-cat" value=${cat} onChange=${e=>setCat(e.target.value)}>${cats.some(x=>x.id===cat)?null:html`<option value=${cat}>${catOf(c.fam,cat).label}</option>`}${cats.map(x=>html`<option key=${x.id} value=${x.id}>${x.label}</option>`)}</select><//>
    <div className="fld"><div className="sech"><span className="lbl">Professionnel ou établissement</span><button type="button" className="link" onClick=${()=>c.openSheet('contact',{kind:TYPES[pr.type].human?'doctor':'vet',back:{n:'careEdit',p:{pid:p.pid,cid:p.cid,draft:{name,cat,pro,notes,v,last}}}})}>＋ Nouvelle fiche</button></div>
      <select id="ce-proid" aria-label="Fiche de l’annuaire" value=${proId} onChange=${e=>setProId(e.target.value)}><option value="">Aucune fiche (saisie libre)</option>${contacts.map(k=>html`<option key=${k.id} value=${k.id}>${k.name}${k.specialty?' · '+k.specialty:''}</option>`)}</select>
      ${!proId?html`<input id="ce-pro" type="text" aria-label="Nom du professionnel" placeholder="Nom (facultatif)" value=${pro} onChange=${e=>setPro(e.target.value)}/>`:null}</div>
    <div className="lbl">Périodicité et rappels</div>
    <${RemFields} v=${v} set=${setV} last=${last||i.last}/>
    <${Field} label="Observations"><textarea id="ce-notes" value=${notes} onChange=${e=>setNotes(e.target.value)}></textarea><//>
    ${err?html`<div className="chip bad" style=${{whiteSpace:'normal',borderRadius:12}}>${err}</div>`:null}
    <${Btn} block onClick=${save}>Enregistrer<//>
    ${del?html`<div className="note">« ${care.name} » et ${care.realizations.length?'son historique ('+care.realizations.length+' fois)':'ses rendez-vous'} seront définitivement supprimés.</div><${Btn} kind="danger" block onClick=${remove}>Confirmer la suppression<//><${Btn} kind="ghost" block onClick=${()=>setDel(false)}>Annuler<//>`
      :html`<${Btn} kind="danger" block onClick=${()=>setDel(true)}>Supprimer ce soin<//>`}
  </div><//>`;
}
const SHEETS={groupDone:GroupDoneSheet,careEdit:CareEditSheet,cat:CatSheet,freq:FreqSheet,contact:ContactSheet,avatar:AvatarSheet,account:AccountSheet,famName:FamNameSheet,confirm:ConfirmSheet,addMember:AddMemberSheet,profileMenu:ProfileMenuSheet,real:RealSheet,appt:ApptSheet,cal:CalSheet,weight:WeightSheet,treat:TreatSheet,invite:InviteSheet};
const SCREENS={auth:AuthScreen,createFamily:CreateFamilyScreen,home:HomeScreen,book:BookScreen,care:CareScreen,careForm:CareFormScreen,appts:ApptsScreen,treatments:TreatmentsScreen,weight:WeightScreen,access:AccessScreen,theme:ThemeScreen,settings:SettingsScreen,profileForm:ProfileFormScreen,cats:CatsScreen,contacts:ContactsScreen,contact:ContactScreen};
const NAVS=[['home','🏠','Accueil'],['appts','📅','Agenda']];
const NO_NAV=['auth','createFamily','careForm','profileForm'];

function Onboarding(){
  const c=useC();const [i,setI]=useState(0);
  const end=()=>c.mut(d=>{d.seen=true});
  const steps=[
    {t:'Un carnet pour toute la famille',x:'Chaque personne et chaque animal a son carnet de soins : vaccins, rendez-vous, traitements et poids, au même endroit.',
      art:html`<div className="ob-art"><${Ico} e="🧑" s=${64} t="#4E8FB5"/><${Ico} e="🐶" s=${64} t="#D0975A"/><${Ico} e="🐴" s=${64} t="#8C6B4F"/></div>`},
    {t:'Deux rappels, au bon moment',x:'Un premier rappel vous prévient de prendre rendez-vous, avec le délai que vous avez choisi pour chaque soin. Une fois le rendez-vous noté, deux autres rappels évitent de l’oublier.',
      art:html`<div className="ob-art col">
        <div className="ob-step"><${Ico} e="🔔" k="w" s=${44}/><div><b>1. À prévoir</b><span className="muted">Rappel au délai choisi pour chaque soin</span></div></div>
        <div className="ob-step"><${Ico} e="📅" k="i" s=${44}/><div><b>2. Rendez-vous noté</b><span className="muted">Vous saisissez la date et l’heure</span></div></div>
        <div className="ob-step"><${Ico} e="⏰" k="g" s=${44}/><div><b>3. Rappels J-7 et J-2</b><span className="muted">Modifiables ou désactivables</span></div></div></div>`},
    {t:'Tout se fait en un geste',x:'Touchez « Fait » dès qu’un soin est fait : la prochaine échéance se calcule toute seule. Les couleurs et le mode sombre se règlent dans les réglages.',
      art:html`<div className="ob-art col"><div className="card"><div className="row"><${Ico} e="🦷" t="#3FA39C"/><div className="grow"><b>Dentiste</b><small>Prochain : dans 1 an</small></div><span className="donebtn"><${Pic} e="✓"/></span></div></div><div className="chips" style=${{justifyContent:'center'}}><${Chip} k="ok"><${Pic} e="✅"/> Prochaine échéance calculée<//></div></div>`}
  ];
  const st=steps[i],last=i===steps.length-1;
  return html`<div className="ob" role="dialog" aria-modal="true" aria-label="Guide de démarrage">
    <button className="skip" onClick=${end}>Passer</button>
    <div className="ob-body" key=${i}>${st.art}<div style=${{display:'flex',flexDirection:'column',gap:10}}><h2>${st.t}</h2><p>${st.x}</p></div></div>
    <div className="ob-dots" aria-hidden="true">${steps.map((_,n)=>html`<i key=${n} className=${n===i?'on':''}></i>`)}</div>
    <${Btn} block onClick=${()=>last?end():setI(i+1)}>${last?'Commencer':'Suivant'}<//>
  </div>`;
}
/* ---------- Application ---------- */
function App(){
  const [db,setDb]=useState(()=>CLOUD?cloudInit():loadDb());
  const [stack,setStack]=useState(()=>{if(CLOUD)return [{n:'auth',p:{}}];const s=loadDb().session;return [{n:s?(s.familyId?'home':'createFamily'):'auth',p:{}}]});
  const [loading,setLoading]=useState(CLOUD);
  const [syncErr,setSyncErr]=useState('');
  const [online,setOnline]=useState(()=>navigator.onLine!==false);
  const [sheet,setSheet]=useState(null);
  const [msg,setMsg]=useState(null);
  const [flash,setFlash]=useState('');
  const sheetDirty=useRef(false);
  const [askClose,setAskClose]=useState(false);
  const screenGuard=useRef(null);
  const tm=useRef(0);
  useEffect(()=>{try{if(CLOUD)localStorage.setItem(PKEY,JSON.stringify({mode:db.mode,modeSet:db.modeSet,seen:db.seen}));else localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}},[db]);
  useEffect(()=>{const a=()=>setOnline(true),b=()=>setOnline(false);window.addEventListener('online',a);window.addEventListener('offline',b);return()=>{window.removeEventListener('online',a);window.removeEventListener('offline',b)}},[]);
  useEffect(()=>{
    if(!CLOUD)return;
    Cloud.onRemote(f=>setDb(p=>({...p,families:{...p.families,[f.id]:f}})));
    Cloud.onError(e=>setSyncErr(e&&e.code==='permission-denied'?'Accès refusé : vos droits ont peut-être changé. Rechargez l’application.':Cloud.msg(e)+' La dernière version enregistrée a été rechargée.'));
    Cloud.watchAuth(async u=>{
      if(!u){setDb(p=>({...p,session:null,accounts:[],families:{}}));setStack([{n:'auth',p:{}}]);setLoading(false);return}
      setDb(p=>({...p,accounts:[{email:u.email,name:u.name,familyId:u.familyId}],session:{email:u.email,familyId:u.familyId,simRole:null,uid:u.uid}}));
      if(u.familyId){
        try{await Cloud.attach(u.familyId,u.uid);setStack([{n:'home',p:{}}])}
        catch(e){setSyncErr('Impossible de charger votre espace familial ('+((e&&(e.code||e.message))||'erreur')+').');setStack([{n:'createFamily',p:{}}])}
      }else setStack([{n:'createFamily',p:{}}]);
      setLoading(false);
    });
  },[]);
  const fam=db.session&&db.session.familyId?db.families[db.session.familyId]:null;
  const today=db.simToday||realToday();
  const me=fam?fam.users.find(u=>u.email===db.session.email):null;
  const role=(db.session&&db.session.simRole)||(me?me.role:'admin');
  useEffect(()=>{if(CLOUD&&fam&&me)Cloud.push(fam,me.role)},[db]);
  const [sysDark,setSysDark]=useState(()=>{try{return window.matchMedia('(prefers-color-scheme: dark)').matches}catch(e){return false}});
  useEffect(()=>{try{const m=window.matchMedia('(prefers-color-scheme: dark)');const f=e=>setSysDark(e.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f)}catch(e){}},[]);
  const mode=db.mode||'light';
  const wantDark=mode==='dark'||(mode==='auto'&&sysDark);
  const themeKey=JSON.stringify(fam?fam.theme:PALETTES[0])+'|'+wantDark;
  useEffect(()=>{
    const th=buildTheme(effTheme(fam?fam.theme:PALETTES[0],wantDark));
    const st=document.documentElement.style;
    Object.keys(th.vars).forEach(k=>st.setProperty(k,th.vars[k]));
    st.colorScheme=th.dark?'dark':'light';
  },[themeKey]);
  const mut=fn=>setDb(prev=>{const n=structuredClone(prev);fn(n);return n});
  const toast=(m,undo)=>{setMsg({m,undo});clearTimeout(tm.current);tm.current=setTimeout(()=>setMsg(null),undo?6000:3200)};
  const ctx={db,setDb,fam,today,role,flash,quickDone:(pid,cid)=>{
      const snap=db;const pr=fam.profiles.find(x=>x.id===pid);const care=pr.cares.find(x=>x.id===cid);
      const latest=[today,...care.realizations.map(r=>r.date)].sort().pop();
      mut(d=>{const pp=P(d,pid),ca=pp.cares.find(x=>x.id===cid);ca.realizations.push({id:uid(),date:today,note:'',pro:ca.pro||'',docs:[]});ca.pending=false;
        const ap=pp.appointments.filter(a=>a.careId===cid&&a.status==='planned').sort((a,b)=>a.date<b.date?-1:1)[0];if(ap)ap.status='done'});
      setFlash(cid);setTimeout(()=>setFlash(''),1500);
      toast(care.name+' : fait aujourd’hui'+(care.freq?' · prochaine échéance le '+fmt(addUnit(latest,care.freq.n,care.freq.unit)):''),()=>setDb(snap));
    },mode,wantDark,setMode:m=>mut(d=>{d.mode=m;d.modeSet=true}),canEdit:role!=='viewer',canAdmin:role==='admin',mut,toast,
    prof:pid=>fam?fam.profiles.find(x=>x.id===pid):null,
    go:(n,p)=>setStack(s=>[...s,{n,p:p||{}}]),
    back:()=>setStack(s=>s.length>1?s.slice(0,-1):s),
    tab:(n,p)=>setStack([{n,p:p||{}}]),
    openSheet:(n,p)=>{sheetDirty.current=false;setAskClose(false);setSheet({n,p:p||{},k:uid()})},
    closeSheet:()=>{sheetDirty.current=false;setAskClose(false);setSheet(null)},
    requestClose:()=>{if(sheetDirty.current){setAskClose(true);return}sheetDirty.current=false;setAskClose(false);setSheet(null)},
    sheetDirty,askClose,setAskClose,screenGuard,
    setPending:(pid,cid,v)=>{mut(d=>{P(d,pid).cares.find(x=>x.id===cid).pending=v});toast(v?'Noté : rendez-vous à fixer':'Rappel remis à plus tard')}};
  useEffect(()=>{if(!sheet)return;const f=e=>{if(e.key==='Escape')ctx.requestClose()};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[sheet]);
  /* Bouton retour d'Android et du navigateur : une entrée d'historique « piège » tant qu'il y a un écran ou une fenêtre à fermer.
     Retour = fermer la fenêtre (avec confirmation si modifiée), puis l'écran, puis revenir à l'accueil, puis quitter. */
  const rootExtra=fam&&stack.length===1&&!['home','auth','createFamily'].includes(stack[0].n)?1:0;
  const depth=(stack.length-1)+rootExtra+(sheet?1:0);
  const navRef=useRef({armed:false,ignore:0,depth:0});
  navRef.current.depth=depth;
  const backStep=useRef(null);
  backStep.current=()=>{
    if(sheet){ctx.requestClose();return}
    if(screenGuard.current){screenGuard.current();return}
    if(stack.length>1){setStack(s=>s.length>1?s.slice(0,-1):s);return}
    if(rootExtra)ctx.tab('home');
  };
  const syncNav=()=>{const n=navRef.current;
    if(n.depth>0&&!n.armed){try{history.pushState({carnet:1},'');n.armed=true}catch(e){}}
    else if(n.depth===0&&n.armed){n.armed=false;n.ignore++;try{history.back()}catch(e){n.ignore--}}};
  useEffect(()=>{const t=setTimeout(syncNav,60);return()=>clearTimeout(t)},[depth]);
  useEffect(()=>{const onPop=()=>{const n=navRef.current;if(n.ignore>0){n.ignore--;return}n.armed=false;backStep.current();setTimeout(syncNav,80)};
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
  const top=stack[stack.length-1];
  const Scr=SCREENS[top.n];
  const Sh2=sheet?SHEETS[sheet.n]:null;
  const showNav=fam&&!NO_NAV.includes(top.n);
  const sim=db.session&&db.session.simRole;
  return html`<${Ctx.Provider} value=${ctx}><div className="phone">
    ${sim?html`<div className="banner"><span>Aperçu : ${ROLES[sim][0].toLowerCase()}</span><${Btn} sm kind="soft" onClick=${()=>mut(d=>{d.session.simRole=null})}>Quitter l’aperçu<//></div>`:null}
    ${db.simToday?html`<div className="banner"><span>Date simulée : ${fmt(db.simToday)}</span><${Btn} sm kind="soft" onClick=${()=>mut(d=>{d.simToday=null})}>Aujourd’hui<//></div>`:null}
    ${!online&&CLOUD?html`<div className="banner"><span>Hors connexion : vos modifications seront envoyées au retour du réseau.</span></div>`:null}
    ${syncErr?html`<div className="banner"><span>${syncErr}</span><${Btn} sm kind="soft" onClick=${()=>location.reload()}>Recharger<//></div>`:null}
    <div className="screen" key=${loading?'load':stack.length+':'+top.n}>${loading?html`<div className="scroll" style=${{justifyContent:'center',alignItems:'center'}}><${Ico} e="🩺" s=${64}/><p className="muted">Chargement…</p></div>`:(fam||top.n==='auth'||top.n==='createFamily')?html`<${Safe} onHome=${()=>{setSheet(null);ctx.tab(fam?'home':'auth')}}><${Scr} p=${top.p}/><//>`:html`<${AuthScreen}/>`}</div>
    ${showNav?html`<nav className="nav" aria-label="Navigation principale">${NAVS.map(x=>html`<button key=${x[0]} className=${'navb'+(stack[0].n===x[0]?' on':'')} aria-current=${stack[0].n===x[0]?'page':undefined} onClick=${()=>ctx.tab(x[0])}><span><${Pic} e=${x[1]}/></span>${x[2]}</button>`)}</nav>`:null}
    ${sheet?html`<div className="shbg" onClick=${ctx.requestClose}><div className="sheet" role="dialog" aria-modal="true" onClick=${e=>e.stopPropagation()}><${Safe} key=${sheet.k} onClose=${ctx.closeSheet}><${Sh2} p=${sheet.p}/><//></div></div>`:null}
    ${!db.seen?html`<${Onboarding}/>`:null}
    ${msg?html`<div className="toast" role="status"><span className="ti"><${Pic} e="✅"/></span><span className="tx">${msg.m}</span>${msg.undo?html`<button type="button" onClick=${()=>{msg.undo();setMsg(null)}}>Annuler</button>`:null}</div>`:null}
  </div><//>`;
}
/* Si un écran ou une fenêtre plante, on affiche un message et un moyen d'en sortir (jamais de page blanche). */
class Safe extends React.Component{
  constructor(p){super(p);this.state={err:null}}
  static getDerivedStateFromError(err){return {err}}
  componentDidCatch(err){try{console.error('Écran en erreur',err)}catch(e){}}
  render(){
    if(!this.state.err)return this.props.children;
    const {onHome,onClose}=this.props;
    return html`<div className="scroll" style=${{justifyContent:'center'}}><div className="card"><${Empty} e="⚠️" title="Cet écran n’a pas pu s’afficher" text="Vos données ne sont pas perdues. Revenez en arrière et réessayez ; si le problème continue, rechargez l’application.">
      <div className="btns" style=${{justifyContent:'center'}}>${onClose?html`<${Btn} onClick=${onClose}>Fermer<//>`:html`<${Btn} onClick=${onHome}>Revenir à l’accueil<//>`}<${Btn} kind="soft" onClick=${()=>location.reload()}>Recharger<//></div><//></div></div>`;
  }
}
function Broken(){return html`<div className="phone"><div className="scroll" style=${{justifyContent:'center',alignItems:'center',textAlign:'center',gap:14}}><${Ico} e="📡" s=${64}/><h1 style=${{font:'800 22px/1.2 var(--font-d)'}}>Connexion nécessaire</h1><p className="muted" style=${{maxWidth:300}}>Les composants de synchronisation n’ont pas pu être chargés. Vérifiez votre connexion Internet puis rechargez.</p><button className="btn" onClick=${()=>location.reload()}>Recharger</button></div></div>`}
ReactDOM.createRoot(document.getElementById('root')).render(CLOUD_BROKEN?html`<${Broken}/>`:html`<${App}/>`);
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}
