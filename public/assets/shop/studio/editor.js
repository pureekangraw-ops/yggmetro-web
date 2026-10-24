(()=>{
'use strict';
const $=id=>document.getElementById(id), repo='https://github.com/pureekangraw-ops/yggmetro-web';let content,dirty=false,imageURL;
const notice=text=>{$('notice').textContent=text;};
const field=(label,value,change,multi=false)=>{const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(multi?'textarea':'input');input.value=value??'';if(multi)input.rows=3;input.addEventListener('input',()=>{change(input.value);dirty=true;notice('แก้ในหน้านี้แล้ว ยังไม่ได้เผยแพร่');});wrap.append(input);return wrap;};
function render(){
 $('home').replaceChildren(...Object.entries({title:'หัวเรื่อง',accent:'หัวเรื่องบรรทัดที่สอง',description:'คำอธิบาย'}).map(([k,label])=>field(label,content.home[k],v=>content.home[k]=v,k==='description')));
 $('products').replaceChildren();
 for(const product of content.products){const section=document.createElement('details'),title=document.createElement('summary');title.textContent=product.name;section.append(title);
 for(const [k,label] of Object.entries({name:'ชื่อสินค้า',label:'คำอธิบายสั้น',desc:'รายละเอียด',price:'ราคาที่แสดง (ไม่เปลี่ยนราคาเรียกเก็บ)',url:'ลิงก์หน้าสินค้า',image:'ชื่อไฟล์ภาพ',note:'ข้อควรรู้'}))section.append(field(label,product[k],v=>product[k]=v|| (k==='image'?null:''),['desc','note'].includes(k)));
 section.append(field('ประโยชน์สินค้า — บรรทัดละข้อ',product.features.join('\n'),v=>product.features=v.split('\n').filter(Boolean),true));$('products').append(section);}
 $('raw').value=JSON.stringify(content,null,2);preview();
}
function preview(){const box=$('preview');box.replaceChildren();const h=document.createElement('h2');h.textContent=content.home.title+' '+content.home.accent;const p=document.createElement('p');p.textContent=content.home.description;box.append(h,p);for(const item of content.products){const article=document.createElement('article'),title=document.createElement('h3'),detail=document.createElement('p');title.textContent=item.name;detail.textContent=item.label+' · '+item.price;article.append(title,detail);box.append(article);}}
function validate(data){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const text=v=>typeof v==='string'&&v.trim().length>0;
 const fields=(v,keys)=>object(v)&&keys.every(k=>text(v[k]));
 const id=v=>typeof v==='string'&&/^[a-z0-9-]+$/.test(v);
 const image=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(v);
 const strings=v=>Array.isArray(v)&&v.length>0&&v.every(text);
 const fail=()=>{throw Error('ข้อมูลหน้าร้านไม่ครบหรือการจับคู่สินค้าไม่ถูกต้อง ฉบับร่างเดิมยังอยู่');};
 if(!object(data)||data.schemaVersion!==1||!fields(data.home,['title','accent','description'])||!Array.isArray(data.products)||data.products.length!==6)fail();
 for(const key of ['categories','galleryCategories'])if(!object(data[key])||!Object.entries(data[key]).every(([k,v])=>id(k)&&text(v)&&!/[<>]/.test(v)))fail();
 const ids=data.products.map(p=>p?.id);
 if(ids.some(v=>!id(v))||new Set(ids).size!==6||!object(data.guides)||Object.keys(data.guides).sort().join()!==[...ids].sort().join())fail();
 // IDs are routing/mapping keys, not editable product copy.
 if(content&&[...ids].sort().join()!==content.products.map(p=>p.id).sort().join())fail();
 for(const p of data.products){
  if(!fields(p,['name','label','desc','price','note','type','category','url'])||!Object.hasOwn(data.categories,p.category)||!strings(p.features)||(p.image!==null&&!image(p.image)))fail();
  let url;try{url=new URL(p.url);}catch{fail();}
  if(url.protocol!=='https:'||url.username||url.password)fail();
  const g=data.guides[p.id];
  if(!fields(g,['tone','job','format','audience','headline','intro','limit','delivery'])||!/^[a-z]+$/.test(g.tone)||!Array.isArray(g.steps)||g.steps.length!==3||!g.steps.every(step=>Array.isArray(step)&&step.length===5&&step.every(text)))fail();
  if(!strings(g.aliases))fail();
 }
 if(!Array.isArray(data.galleryItems)||!data.galleryItems.length||new Set(data.galleryItems.map(p=>p?.id)).size!==data.galleryItems.length)fail();
 for(const p of data.galleryItems)if(!fields(p,['id','name','category','label'])||!id(p.id)||!Object.hasOwn(data.galleryCategories,p.category)||!image(p.image))fail();
 if(!Array.isArray(data.services)||!data.services.length)fail();
 for(const service of data.services)if(!fields(service,['id','title','icon','intro','result'])||!id(service.id)||!strings(service.scope))fail();
 for(const key of ['galleryItems','services']){
  const keys=data[key].map(item=>item.id).sort();
  if(new Set(keys).size!==keys.length||(content&&keys.join()!==content[key].map(item=>item.id).sort().join()))fail();
 }
 return data;
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('preview-button').onclick=()=>{preview();$('raw').value=JSON.stringify(content,null,2);notice('อัปเดตตัวอย่างข้อความในหน้านี้แล้ว เว็บจริงยังไม่เปลี่ยน');};
$('download').onclick=()=>{try{validate(content);download(new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json'}),'content.json');dirty=false;notice('เตรียม content.json แล้ว นำไปใส่ใน branch แยกและเปิด Pull Request ตามขั้นที่ 2 ขณะนี้ระงับการเผยแพร่ การดาวน์โหลดหรือ Commit ยังไม่เปลี่ยนเว็บจริง');}catch(e){notice(e.message);}};
$('apply-raw').onclick=()=>{try{content=validate(JSON.parse($('raw').value));dirty=true;render();notice('อ่านข้อมูลขั้นสูงแล้ว ยังไม่เผยแพร่');}catch(e){notice('ใช้ข้อมูลไม่ได้: '+e.message);}};
$('import').onchange=async e=>{try{content=validate(JSON.parse(await e.target.files[0].text()));dirty=true;render();notice('นำเข้าฉบับร่างแล้ว ยังไม่เผยแพร่');}catch(e){notice('อ่านไฟล์ไม่ได้: '+e.message);}};
$('image').onchange=e=>{const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){notice('เลือกรูป PNG, JPEG หรือ WebP');return;}if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(file);$('image-preview').src=imageURL;$('image-preview').hidden=false;$('image-name').value=file.name.replace(/[^a-zA-Z0-9_.-]/g,'-');$('image-download').hidden=false;};
$('image-download').onclick=()=>{const name=$('image-name').value;if(!/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/.test(name)){notice('ตั้งชื่อไฟล์เป็นภาษาอังกฤษ ไม่มีช่องว่าง และใช้นามสกุลภาพเดิม');return;}const file=$('image').files[0];if(!file)return;const expected={'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp']}[file.type];if(!expected?.includes(name.split('.').pop())){notice('นามสกุลต้องตรงชนิดภาพ ไม่ได้แปลงไฟล์ด้วยการเปลี่ยนชื่อ');return;}download(file,name);notice('นำรูปชื่อนี้ไปใส่ใน branch แยกเดียวกับ content.json และส่งตรวจใน Pull Request ใส่ชื่อเดียวกันในช่องชื่อไฟล์ภาพของสินค้า ยังไม่เปลี่ยนเว็บจริง');};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
fetch('/admin/storefront/content',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{content=validate(data);render();notice('อ่านข้อมูลหน้าร้านรุ่นปัจจุบันแล้ว');}).catch(()=>notice('โหลดข้อมูลไม่ได้ กรุณารีเฟรชก่อนแก้ไข'));
})();
