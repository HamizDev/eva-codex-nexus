const test=require('node:test'),assert=require('node:assert/strict');
const {reduceEvent}=require('../state.cjs');const {CodexBridge}=require('../bridge.cjs');
const fixture=()=>({messages:[],tools:[],status:'idle'});
test('interleaved streams are joined by item id; final item replaces deltas',()=>{const t=fixture();reduceEvent(t,'item/agentMessage/delta',{itemId:'a',delta:'Hel'});reduceEvent(t,'item/agentMessage/delta',{itemId:'b',delta:'Other'});reduceEvent(t,'item/agentMessage/delta',{itemId:'a',delta:'lo'});reduceEvent(t,'item/completed',{item:{id:'a',type:'agentMessage',text:'Hello!'}});assert.deepEqual(t.messages.map(x=>x.text),['Hello!','Other'])});
test('failed and interrupted turns never become completed',()=>{for(const status of ['failed','interrupted']){const t=fixture();reduceEvent(t,'turn/started',{turn:{id:'turn'}});reduceEvent(t,'turn/completed',{turn:{id:'turn',status,error:{message:'failure'}}});assert.equal(t.status,status);assert.equal(t.activeTurn,null);assert.equal(t.error,'failure')}});
test('command output and diff are preserved',()=>{const t=fixture();reduceEvent(t,'item/started',{item:{id:'cmd',type:'commandExecution',command:'node --test',status:'inProgress'}});reduceEvent(t,'item/commandExecution/outputDelta',{itemId:'cmd',delta:'passed'});reduceEvent(t,'turn/diff/updated',{diff:'+added'});assert.equal(t.tools[0].aggregatedOutput,'passed');assert.equal(t.diff,'+added')});
test('bridge routes approvals separately and does not auto approve',()=>{const b=new CodexBridge();let request;let writes=0;b.send=()=>writes++;b.on('approval',r=>request=r);b.receive({id:7,method:'item/fileChange/requestApproval',params:{threadId:'test'}});assert.equal(request.id,7);assert.equal(writes,0)});
test('protocol errors reject matching request',async()=>{const b=new CodexBridge();b.send=()=>{};const pending=b.request('test',{},100);b.receive({id:1,error:{message:'rejected'}});await assert.rejects(pending,/rejected/);assert.equal(b.pending.size,0)});

test('large streamed command output stays bounded and signals truncation',()=>{
 const t=fixture();
 for(let i=0;i<12;i++)reduceEvent(t,'item/commandExecution/outputDelta',{itemId:'long',delta:'x'.repeat(8192)});
 assert.equal(t.tools[0].aggregatedOutput.length,65536);
 assert.equal(t.tools[0].outputTruncated,true);
 reduceEvent(t,'item/completed',{item:{id:'long',type:'commandExecution',aggregatedOutput:'y'.repeat(90000)}});
 assert.equal(t.tools[0].aggregatedOutput.length,65536);
 assert.equal(t.tools[0].outputTruncated,true);
});
test('oversize cumulative diff is truncated with a visible flag',()=>{
 const t=fixture();reduceEvent(t,'turn/diff/updated',{diff:'z'.repeat(300000)});
 assert.equal(t.diff.length,262144);assert.equal(t.diffTruncated,true);
});
