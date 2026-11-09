/* Lightweight local clock. Does not imply remote execution status. */
(function(){
 'use strict';
 const clock=document.getElementById('evaSystemClock');if(!clock)return;
 const formatter=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 function update(){if(document.visibilityState==='hidden')return;clock.textContent=formatter.format(new Date())}
 update();const handle=setInterval(update,1000);
 document.addEventListener('visibilitychange',update);
 window.addEventListener('pagehide',()=>clearInterval(handle),{once:true});
})();
