'use strict';
// Keep streaming command logs and huge diff summaries from growing unbounded.
const MAX_TOOL_OUTPUT=64*1024,MAX_DIFF=256*1024;
function lastChars(value,max){return typeof value==='string'&&value.length>max?value.slice(-max):value;}
function reduceEvent(thread,method,p){
  if(method==='thread/name/updated'&&p.threadName)thread.title=p.threadName;
  if(method==='turn/started'){thread.activeTurn=p.turn.id;thread.status='inProgress';thread.error=null;}
  if(method==='turn/completed'){thread.status=p.turn.status;thread.error=p.turn.error?.message||null;thread.activeTurn=null;}
  if(method==='error')thread.error=p.error?.message||p.message||'Codex error';
  if(method==='turn/diff/updated'){thread.diff=lastChars(p.diff,MAX_DIFF);thread.diffTruncated=typeof p.diff==='string'&&p.diff.length>MAX_DIFF;}
  if(method==='turn/plan/updated')thread.plan=p.plan;
  if(method==='item/agentMessage/delta'){
    let msg=thread.messages.find(x=>x.id===p.itemId);
    if(!msg){msg={id:p.itemId,role:'assistant',text:''};thread.messages.push(msg)}
    msg.text+=p.delta;
  }
  if(method==='item/started'||method==='item/completed'){
    const item=p.item;
    if(!item||typeof item!=='object')return thread;
    if(item.type==='agentMessage'){
      let msg=thread.messages.find(x=>x.id===item.id);
      if(!msg){msg={id:item.id,role:'assistant',text:''};thread.messages.push(msg)}
      if(item.text)msg.text=item.text;
    }else if(item.type!=='userMessage'){
      const index=thread.tools.findIndex(x=>x.id===item.id);
      const bounded={...item};
      if(typeof bounded.aggregatedOutput==='string'){bounded.outputTruncated=bounded.aggregatedOutput.length>MAX_TOOL_OUTPUT;bounded.aggregatedOutput=lastChars(bounded.aggregatedOutput,MAX_TOOL_OUTPUT)}
      if(index<0)thread.tools.push(bounded);else thread.tools[index]={...thread.tools[index],...bounded};
    }
  }
  if(method==='item/commandExecution/outputDelta'){
    let item=thread.tools.find(x=>x.id===p.itemId);
    if(!item){item={id:p.itemId,type:'commandExecution',status:'inProgress',aggregatedOutput:''};thread.tools.push(item)}
    const merged=(item.aggregatedOutput||'')+(typeof p.delta==='string'?p.delta:'');
    item.outputTruncated=!!item.outputTruncated||merged.length>MAX_TOOL_OUTPUT;
    item.aggregatedOutput=lastChars(merged,MAX_TOOL_OUTPUT);
  }
  if(method==='thread/tokenUsage/updated')thread.usage=p.tokenUsage;
  return thread;
}
module.exports={reduceEvent};
