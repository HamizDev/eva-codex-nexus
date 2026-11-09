/* Non-copyrighted two-note local UI cues, no remote audio service or bundled recordings. */
(function(root,factory){
 const exports=factory();if(typeof module==='object'&&module.exports)module.exports=exports;
 if(root){root.EvaPilotAlerts=exports.PilotAlerts;root.EvaTonePlayer=exports.makeTonePlayer;}
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 class PilotAlerts{
  constructor({getTheme=()=> 'asuka',play=()=>{}}={}){
   this.getTheme=getTheme;this.play=play;this.previous=null;this.enabled=false;
  }
  setEnabled(enabled){this.enabled=!!enabled}
  observe(snapshot,activeThreadId){
   const previous=this.previous;this.previous={
    approvals:new Set((snapshot.approvals||[]).map(a=>String(a.id))),
    threads:new Map((snapshot.threads||[]).map(t=>[t.id,t.status]))
   };
   if(!previous||!this.enabled)return;
   const approvals=snapshot.approvals||[];
   if(approvals.some(a=>!previous.approvals.has(String(a.id)))){this.play('approval',this.getTheme());return}
   const thread=(snapshot.threads||[]).find(t=>t.id===activeThreadId);
   if(thread&&thread.status==='completed'&&previous.threads.get(thread.id)==='inProgress')this.play('complete',this.getTheme());
  }
 }
 function makeTonePlayer(windowObject){
  let context;
  return (kind,theme)=>{
   try{
    const Ctx=windowObject.AudioContext||windowObject.webkitAudioContext;if(!Ctx)return;
    context??=new Ctx();if(context.state==='suspended')context.resume().catch(()=>{});
    // Distinct original notification tones; intentionally not EVA soundtrack or dialogue.
    const notes=kind==='approval'?[740,560]:theme==='rei'?[580,780]:[660,880];
    const when=context.currentTime;
    notes.forEach((frequency,index)=>{
     const osc=context.createOscillator(),gain=context.createGain(),at=when+index*.13;
     osc.type='sine';osc.frequency.value=frequency;
     gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.028,at+.02);
     gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
     osc.connect(gain);gain.connect(context.destination);osc.start(at);osc.stop(at+.13);
    });
   }catch{/* Unavailable sound output must never interrupt Codex. */}
  }
 }
 return {PilotAlerts,makeTonePlayer};
});
