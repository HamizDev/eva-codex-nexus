'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const blockedNames=new Set(['.git','.idea','.vscode','node_modules','data','sandbox','.verification','.cache']);
const blockedExts=new Set(['.zip','.7z','.mp4','.mov','.p12','.pfx','.pem','.key','.log','.ttf','.otf','.woff','.woff2']);
function isPrivate(rel){
 const norm=rel.replaceAll('\\','/'),parts=norm.split('/'),name=parts.at(-1);
 return parts.some(part=>blockedNames.has(part))||blockedExts.has(path.extname(name).toLowerCase())||
 /^\.env(?:\.|$)/i.test(name)||/^(?:auth|credentials|secrets)\.json$/i.test(name)||
 norm==='workbench/public/media/audio-unit02-fluid/voice.wav'||name==='Thumbs.db'||name==='.DS_Store';
}
function files(dir=root,base=''){
 const result=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const rel=base?base+'/'+entry.name:entry.name;
  if(isPrivate(rel)||rel==='MANIFEST.json')continue;
  if(entry.isSymbolicLink())throw Error('Symbolic links are not supported in release: '+rel);
  if(entry.isDirectory())result.push(...files(path.join(dir,entry.name),rel));
  else if(entry.isFile())result.push(rel);
 }
 return result.sort();
}
function entry(rel){const data=fs.readFileSync(path.join(root,rel));return {path:rel,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}
module.exports={root,isPrivate,files,entry};
