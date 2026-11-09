'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('follow-system mode selects Rei for light and Asuka for dark; manual choices stay pinned',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../public/theme.js'),'utf8');const saved=new Map(),events=[],media={matches:true,addEventListener(type,callback){this.callback=callback}};
 const win={matchMedia:()=>media,dispatchEvent:event=>events.push(event.detail)};
 const context={window:win,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},document:{documentElement:{dataset:{}}},CustomEvent:class{constructor(name,o){this.detail=o.detail}}};
 vm.runInNewContext(code,context);win.EvaTheme.apply('system');assert.equal(win.EvaTheme.current(),'rei');
 media.matches=false;media.callback();assert.equal(win.EvaTheme.current(),'asuka');
 win.EvaTheme.apply('rei');assert.equal(win.EvaTheme.choice(),'rei');
 media.matches=false;media.callback();assert.equal(win.EvaTheme.current(),'rei');assert.ok(events.length>=3);
});
