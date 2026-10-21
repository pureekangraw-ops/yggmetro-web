const assert = require('node:assert/strict');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {fixture} = require('./request-store.cjs');
const adminToken = 'synthetic-journey-admin-token-'.repeat(2);

exports.journey = async t => {
  const {requestPage} = await import('../../src/request-pages.js');
  const {requestWorkflow} = await import('../../src/request-workflow.js');
  const f = fixture();
  t.after(() => f.db.close());
  f.env.YGG_ADMIN_CREDENTIALS = JSON.stringify({fixture: createHash('sha256').update(adminToken).digest('hex')});
  const clients = [];
  async function client({admin = false, cookie = '', storage = new Map()} = {}) {
    class Element {
      constructor(tag = '') { Object.assign(this, {tag, value:'', textContent:'', children:[], style:{}, listeners:{}, disabled:false}); }
      addEventListener(name, fn) { this.listeners[name] = fn; }
      append(...nodes) { this.children.push(...nodes); if(this.tag === 'select' && !this.value) this.value = this.children[0]?.value || ''; }
      replaceChildren(...nodes) { this.children = []; if(this.tag === 'select') this.value = ''; this.append(...nodes); }
    }
    const elements = new Map(), events = {}, intervals = [], confirmations = [];
    const get = id => { if(!elements.has(id)) elements.set(id, new Element(id === 'requests' ? 'select' : '')); return elements.get(id); };
    const local = new Map();
    const c = {get, events, intervals, confirmations, storage, allowDiscard:true, intercept:null, get cookie(){return cookie;}};
    async function realFetch(path, init = {}) {
      const response = await requestWorkflow(new Request('https://shop.yggmetro.com' + path, {...init, headers:{...init.headers, origin:'https://shop.yggmetro.com', ...(cookie ? {cookie} : {})}}), f.env, async()=>{throw Error('Offline AI fixture');});
      if(response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return response;
    }
    const storageApi = map => ({getItem:key=>map.get(key)||null, setItem:(key,value)=>map.set(key,String(value)), removeItem:key=>map.delete(key)});
    const context = vm.createContext({document:{getElementById:get, createElement:tag=>new Element(tag), hidden:false}, location:{href:'https://shop.yggmetro.com/client',reload(){}}, URL,crypto,console,
      localStorage:storageApi(local),sessionStorage:storageApi(storage),addEventListener:(name,fn)=>events[name]=fn,
      setInterval:fn=>intervals.push(fn),confirm:text=>{confirmations.push(text);return c.allowDiscard;},
      fetch:(path,init={})=>c.intercept?c.intercept(path,init,()=>realFetch(path,init)):realFetch(path,init)});
    Object.assign(c, {
      async idle(){for(let i=0;i<200 && vm.runInContext('busy',context);i++)await new Promise(r=>setTimeout(r,2));assert.equal(vm.runInContext('busy',context),false);},
      edit(id,value){get(id).value=value;get(id).listeners.input?.();},
      async click(id){await get(id).onclick();await c.idle();},
      async select(id){get('requests').value=id;await get('requests').listeners.change();await c.idle();},
      async save(){await get('brief').listeners.submit({preventDefault(){}});await c.idle();},
      send(){return get('composer').listeners.submit({preventDefault(){}});},
      async login(token=adminToken){get('token').value=token;await get('login').listeners.submit({preventDefault(){}});await c.idle();},
      async poll(){for(const fn of intervals)await fn();await new Promise(r=>setTimeout(r,5));},
      raw:realFetch,
    });
    vm.runInContext(requestPage(admin).match(/<script>([\s\S]*?)<\/script>/)[1],context);
    await c.idle(); clients.push(c);return c;
  }
  return {...f, client, adminToken};
};
