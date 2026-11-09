const test=require('node:test'),assert=require('node:assert/strict');
const {instanceId}=require('../instance-id.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('instance identity is stable for the same path and changes with directory',()=>{
 assert.equal(instanceId('/some/path'),instanceId('/some/path'));
 assert.notEqual(instanceId('/some/path'),instanceId('/other/path'));
 assert.match(instanceId('/some/path'),/^[0-9a-f]{16}$/);
});
test('theme preferences use an explicit allowlist, persist and keep markup independent of assets',()=>{
 const contents=fs.readFileSync(path.join(__dirname,'../public/theme.js'),'utf8'),prefs=new Map();
 const events=[],context={localStorage:{getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v)},document:{documentElement:{dataset:{}}},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}};
 vm.runInNewContext(contents,context);
 assert.equal(context.document.documentElement.dataset.evaTheme,'asuka');
 context.window.EvaTheme.apply('rei');assert.equal(prefs.get('eva-workbench-theme'),'rei');
 assert.equal(context.document.documentElement.dataset.evaTheme,'rei');
 context.window.EvaTheme.apply('<script>');assert.equal(context.window.EvaTheme.current(),'asuka');
 assert.equal(events.length,2);
});
