/* EVA theme selection: user preference or system appearance, with explicit allowlist. */
(function(){
 'use strict';
 const KEY='eva-workbench-theme', media=window.matchMedia?.('(prefers-color-scheme: light)');
 const pilots=Object.freeze({
  asuka:Object.freeze({unit:'02',name:'ASUKA',full:'EVANGELION-02',zh:'明日香',mark:'/media/eva/nerv-mark.svg'}),
  rei:Object.freeze({unit:'00',name:'REI',full:'EVANGELION-00',zh:'绫波丽',mark:'/media/eva/unit00-mark.svg'})
 });
 const valid=value=>value==='system'||Object.hasOwn(pilots,value)?value:'asuka';
 const choice=()=>valid(localStorage.getItem(KEY));
 const resolve=selected=>selected==='system'?(media?.matches?'rei':'asuka'):selected;
 const current=()=>resolve(choice());
 const render=()=>{
  const theme=current();document.documentElement.dataset.evaTheme=theme;
  document.documentElement.dataset.evaThemeChoice=choice();
  window.dispatchEvent(new CustomEvent('eva:theme-changed',{detail:{theme,choice:choice()}}));
  return theme;
 };
 const apply=(value)=>{localStorage.setItem(KEY,valid(value));return render()};
 document.documentElement.dataset.evaTheme=current();
 document.documentElement.dataset.evaThemeChoice=choice();
 media?.addEventListener?.('change',()=>{if(choice()==='system')render()});
 window.EvaTheme=Object.freeze({current,choice,apply,pilots});
})();
