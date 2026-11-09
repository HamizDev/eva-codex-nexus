/* Lightweight, dependency-free Markdown subset for Codex responses.
 * All content is rendered with DOM text nodes: no untrusted innerHTML or HTML execution.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.EvaMarkdown=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const fence=/^\s{0,3}```\s*([^`]*)$/;
 const heading=/^\s{0,3}(#{1,4})\s+(.+)$/;
 const bullets=/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/;
 const separator=/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/;
 const splitRow=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
 function tokenize(input){
  const lines=String(input??'').replace(/\r\n?/g,'\n').split('\n'),blocks=[];
  for(let i=0;i<lines.length;){
   const line=lines[i],code=line.match(fence),h=line.match(heading);
   if(!line.trim()){i++;continue}
   if(code){const language=code[1].trim().slice(0,30),body=[];i++;while(i<lines.length&&!fence.test(lines[i]))body.push(lines[i++]);if(i<lines.length)i++;blocks.push({type:'code',language,text:body.join('\n')});continue}
   if(h){blocks.push({type:'heading',level:h[1].length,text:h[2]});i++;continue}
   if(line.includes('|')&&i+1<lines.length&&separator.test(lines[i+1])){
    const headers=splitRow(line),rows=[];i+=2;
    while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()&&rows.length<100){rows.push(splitRow(lines[i++]));}
    blocks.push({type:'table',headers,rows});continue;
   }
   if(bullets.test(line)){
    const ordered=/^\s{0,3}\d+[.)]\s+/.test(line),items=[];
    while(i<lines.length&&bullets.test(lines[i])&&(/^\s{0,3}\d+[.)]\s+/.test(lines[i])===ordered)){
     items.push(lines[i++].replace(bullets,''));
    }
    blocks.push({type:'list',ordered,items});continue;
   }
   if(/^\s{0,3}>\s?/.test(line)){
    const quote=[];while(i<lines.length&&/^\s{0,3}>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^\s{0,3}>\s?/,''));
    blocks.push({type:'quote',text:quote.join('\n')});continue;
   }
   const paragraph=[line];i++;
   while(i<lines.length&&lines[i].trim()&&!fence.test(lines[i])&&!heading.test(lines[i])&&!bullets.test(lines[i])&&!/^\s{0,3}>\s?/.test(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&separator.test(lines[i+1])))paragraph.push(lines[i++]);
   blocks.push({type:'paragraph',text:paragraph.join('\n')});
  }
  return blocks;
 }
 function safeHref(raw){
  const url=String(raw||'').trim();
  if(/^https?:\/\//i.test(url)||/^mailto:[^\s@]+@[^\s@]+$/i.test(url))return url;
  if(url.startsWith('#')||url.startsWith('./')||url.startsWith('../')||(url.startsWith('/')&&!url.startsWith('//')))return url;
  return null;
 }
 function inline(target,text){
  const source=String(text),pattern=/`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;
  let match,last=0;
  while((match=pattern.exec(source))){
   if(match.index>last)target.append(document.createTextNode(source.slice(last,match.index)));
   if(match[1]!==undefined){const node=document.createElement('code');node.className='eva-md-inline-code';node.textContent=match[1];target.append(node)}
   else if(match[2]!==undefined){const node=document.createElement('strong');node.textContent=match[2];target.append(node)}
   else if(match[3]!==undefined){const node=document.createElement('em');node.textContent=match[3];target.append(node)}
   else{const href=safeHref(match[5]);if(!href)target.append(document.createTextNode(match[0]));else{const a=document.createElement('a');a.href=href;a.className='eva-md-link';a.target='_blank';a.rel='noopener noreferrer';a.textContent=match[4];target.append(a)}}
   last=pattern.lastIndex;
  }
  if(last<source.length)target.append(document.createTextNode(source.slice(last)));
 }
 function render(container,content,copyFn){
  const fragment=document.createDocumentFragment();
  for(const block of tokenize(content)){
   let node;
   if(block.type==='code'){
    const label=document.createElement('div');label.className='code-label';label.textContent=block.language||'CODE';
    const copy=document.createElement('button');copy.type='button';copy.textContent='复制';
    copy.addEventListener('click',async()=>{try{await copyFn(block.text);copy.textContent='已复制'}catch{copy.textContent='复制失败'}});
    label.append(copy);fragment.append(label);node=document.createElement('pre');node.textContent=block.text;
   }else if(block.type==='heading'){
    node=document.createElement('h'+Math.min(4,block.level+1));node.className='eva-md-heading';inline(node,block.text);
   }else if(block.type==='list'){
    node=document.createElement(block.ordered?'ol':'ul');node.className='eva-md-list';for(const item of block.items){const li=document.createElement('li');inline(li,item);node.append(li)}
   }else if(block.type==='quote'){
    node=document.createElement('blockquote');node.className='eva-md-quote';inline(node,block.text);
   }else if(block.type==='table'){
    const wrap=document.createElement('div');wrap.className='eva-md-table-wrap';const table=document.createElement('table');table.className='eva-md-table';
    const tr=document.createElement('tr');for(const title of block.headers){const th=document.createElement('th');inline(th,title);tr.append(th)}table.append(tr);
    for(const cells of block.rows){const row=document.createElement('tr');for(let j=0;j<block.headers.length;j++){const td=document.createElement('td');inline(td,cells[j]||'');row.append(td)}table.append(row)}wrap.append(table);node=wrap;
   }else{node=document.createElement('div');node.className='eva-md-paragraph';inline(node,block.text)}
   fragment.append(node);
  }
  container.append(fragment);
 }
 return {tokenize,safeHref,render};
});
