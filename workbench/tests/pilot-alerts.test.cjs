'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/pilot-alerts.js'),'utf8'),sandbox);
const {PilotAlerts}=sandbox.module.exports;
test('notifications never replay old approvals or completed tasks on first snapshot',()=>{
 const events=[],alerts=new PilotAlerts({getTheme:()=> 'rei',play:(...args)=>events.push(args)});
 alerts.setEnabled(true);
 alerts.observe({approvals:[{id:11}],threads:[{id:'1',status:'completed'}]},'1');
 assert.deepEqual(events,[]);
 alerts.observe({approvals:[{id:11}],threads:[{id:'1',status:'completed'}]},'1');
 assert.deepEqual(events,[]);
});
test('only new approvals and current thread in-progress to completed trigger sound',()=>{
 const events=[],alerts=new PilotAlerts({getTheme:()=> 'rei',play:(...args)=>events.push(args)});alerts.setEnabled(true);
 alerts.observe({approvals:[],threads:[{id:'1',status:'inProgress'},{id:'2',status:'inProgress'}]},'1');
 alerts.observe({approvals:[],threads:[{id:'1',status:'completed'},{id:'2',status:'completed'}]},'1');
 alerts.observe({approvals:[],threads:[{id:'1',status:'completed'},{id:'2',status:'completed'}]},'1');
 alerts.observe({approvals:[{id:'abc'}],threads:[{id:'1',status:'completed'}]},'1');
 assert.deepEqual(events,[['complete','rei'],['approval','rei']]);
 alerts.setEnabled(false);alerts.observe({approvals:[{id:'def'}],threads:[{id:'1',status:'completed'}]},'1');
 assert.equal(events.length,2);
});
