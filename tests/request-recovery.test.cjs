const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {fixture} = require('./helpers/request-store.cjs');

// Executes the actual rendered UI script against the real request workflow/SQLite.
// This small DOM fixture tests state and side effects, not layout or browser rendering.
async function client(t) {
  const {requestPage} = await import('../src/request-pages.js');
  const {requestWorkflow} = await import('../src/request-workflow.js');
  const {db, env} = fixture();
  t.after(() => db.close());
  class Element {
    constructor(tag = '') { this.tag = tag; this.value = ''; this.textContent = ''; this.children = []; this.style = {}; this.listeners = {}; this.disabled = false; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    append(...nodes) { this.children.push(...nodes); if (this.tag === 'select' && !this.value) this.value = this.children[0]?.value || ''; }
    replaceChildren(...nodes) { this.children = []; if (this.tag === 'select') this.value = ''; this.append(...nodes); }
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id === 'requests' ? 'select' : '')); return elements.get(id); };
  const storage = new Map(), confirmations = [];
  let cookie = '', allowDiscard = false, failCreate = false, failReadId = '';
  const context = vm.createContext({
    document: {getElementById: get, createElement: tag => new Element(tag), hidden: false},
    location: {href: 'https://shop.yggmetro.com/client'}, URL, crypto, console,
    localStorage: {getItem: key => storage.get(key)},
    setInterval() {},
    confirm(text) { confirmations.push(text); return allowDiscard; },
    async fetch(path, init = {}) {
      const method = init.method || 'GET';
      if (method === 'GET' && path === '/api/v1/requests/' + failReadId)
        return Response.json({code: 'REQUEST_STORE_UNAVAILABLE'}, {status: 503});
      if (failCreate && method === 'POST' && /^\/api\/v1\/requests\/BRIEF-[^/]+$/.test(path))
        return Response.json({code: 'REQUEST_STORE_UNAVAILABLE'}, {status: 503});
      const request = new Request('https://shop.yggmetro.com' + path, {...init, headers: {...init.headers, origin: 'https://shop.yggmetro.com', ...(cookie ? {cookie} : {})}});
      const result = await requestWorkflow(request, env, async () => { throw Error('AI is intentionally unavailable in this offline test'); });
      if (result.headers.get('set-cookie')) cookie = result.headers.get('set-cookie').split(';')[0];
      return result;
    },
  });
  vm.runInContext(requestPage().match(/<script>([\s\S]*?)<\/script>/)[1], context);
  for (let i = 0; i < 100 && !get('notice').textContent.includes('เริ่มร่างใหม่แล้ว'); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.match(get('notice').textContent, /เริ่มร่างใหม่แล้ว/, 'fixture bootstraps an owned draft');
  return {
    db, get, storage, confirmations,
    set allowDiscard(value) { allowDiscard = value; },
    set failCreate(value) { failCreate = value; },
    set failReadId(value) { failReadId = value; },
    edit(id, value) { get(id).value = value; get(id).listeners.input(); },
    async click(id) { await get(id).onclick(); },
    async select(id) { get('requests').value = id; await get('requests').listeners.change(); },
    async save() { await get('brief').listeners.submit({preventDefault() {}}); for (let i = 0; i < 100 && get('new').disabled; i++) await new Promise(resolve => setTimeout(resolve, 5)); },
  };
}

test('new-request cancellation retains unsaved brief, selection and database record count', async t => {
  const c = await client(t), id = c.get('requests').value;
  c.edit('goal', 'unsaved customer brief');
  await c.click('new');
  assert.equal(c.get('requests').value, id, 'must not silently navigate to a new draft');
  assert.equal(c.get('goal').value, 'unsaved customer brief');
  assert.equal(c.confirmations.length, 1);
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n, 1);
});

test('failed request selection does not overwrite a different request on the next save', async t => {
  const c = await client(t), first = c.get('requests').value;
  c.edit('goal', 'request A'); await c.save();
  await c.click('new'); const second = c.get('requests').value;
  c.edit('goal', 'request B'); await c.save();
  await c.select(first);
  c.edit('goal', 'updated request A'); c.allowDiscard = true; c.failReadId = second;
  await c.select(second);
  assert.match(c.get('notice').textContent, /บันทึกข้อมูลไม่สำเร็จ/);
  assert.equal(c.get('requests').value, first, 'failed navigation must restore the old selection');
  assert.equal(c.get('goal').value, 'updated request A');
  c.failReadId = ''; await c.save();
  assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(first).brief_json).goal, 'updated request A');
  assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(second).brief_json).goal, 'request B');
});

test('legacy-import cancellation retains the unsaved current request', async t => {
  const c = await client(t), id = c.get('requests').value;
  c.edit('goal', 'current unsaved brief');
  c.storage.set('yggmetro-spectrumsale-v1', JSON.stringify({goal: 'legacy brief'}));
  await c.click('import-draft');
  assert.equal(c.get('requests').value, id);
  assert.equal(c.get('goal').value, 'current unsaved brief');
  assert.equal(c.confirmations.length, 1);
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n, 1);
});

test('failed new-request creation preserves unsaved draft and later saves the original ID', async t => {
  const c = await client(t), id = c.get('requests').value;
  c.edit('goal', 'recover this brief'); c.allowDiscard = true; c.failCreate = true;
  await c.click('new');
  assert.match(c.get('notice').textContent, /บันทึกข้อมูลไม่สำเร็จ/);
  assert.equal(c.get('requests').value, id);
  assert.equal(c.get('goal').value, 'recover this brief');
  c.failCreate = false;
  await c.save();
  assert.match(c.get('notice').textContent, /บันทึกร่างแล้ว/);
  assert.equal(c.get('requests').value, id, 'retry must save the original request, not create another');
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n, 1);
  assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(id).brief_json).goal, 'recover this brief');
});

test('accepting discard creates a new draft and keeps the original saved request intact', async t => {
  const c = await client(t), first = c.get('requests').value;
  c.edit('goal', 'saved original'); await c.save();
  c.edit('goal', 'discarded edit'); c.allowDiscard = true;
  await c.click('new');
  assert.notEqual(c.get('requests').value, first);
  assert.equal(c.get('goal').value, '');
  assert.equal(c.confirmations.length, 1);
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n, 2);
  assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(first).brief_json).goal, 'saved original');
});

test('accepting legacy import persists only supported draft fields in a new owned request', async t => {
  const c = await client(t), first = c.get('requests').value;
  c.edit('goal', 'discarded edit'); c.allowDiscard = true;
  c.storage.set('yggmetro-spectrumsale-v1', JSON.stringify({goal: 'legacy goal', materials: 'legacy materials', sender_type: 'ADMIN'}));
  await c.click('import-draft');
  const imported = c.get('requests').value;
  assert.notEqual(imported, first);
  assert.equal(c.get('goal').value, 'legacy goal');
  assert.match(c.get('notice').textContent, /นำเฉพาะข้อมูลร่างมาแล้ว/);
  const brief = JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(imported).brief_json);
  assert.equal(brief.materials, 'legacy materials');
  assert.equal(brief.sender_type, undefined);
  assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_messages').get().n, 0);
});
