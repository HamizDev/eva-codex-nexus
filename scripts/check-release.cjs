'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,files,entry,isPrivate}=require('./release-utils.cjs');
const strict=process.argv.includes('--public'),manifest=JSON.parse(fs.readFileSync(path.join(root,'MANIFEST.json'),'utf8'));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
assert.equal(manifest.version,version);
assert.equal(version,JSON.parse(fs.readFileSync(path.join(root,'workbench/package.json'),'utf8')).version);
assert.equal(version,JSON.parse(fs.readFileSync(path.join(root,'workbench/package-lock.json'),'utf8')).version);
const expected=files().map(entry);
assert.equal(new Set(expected.map(x=>x.path)).size,expected.length,'duplicate release files');
assert.deepEqual(manifest.files,expected,'MANIFEST.json is stale; run npm run manifest');
for(const rel of ['LICENSE','LICENSE-STATUS.md','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes','README.md','ASSETS.md','DSH-BOOT.md','CODE-ORIGINS.md','Start-EVA.vbs','Install-EVA-DesktopShortcut.cmd','Import-DSH-Boot.cmd','scripts/Install-EVA-DesktopShortcut.ps1','workbench/start.ps1','codex-skin/Start-EVA.ps1','codex-skin/Import-DSH-Boot.ps1','codex-skin/Restore-EVA.ps1','codex-skin/injector.mjs','codex-skin/assets/eva-skin.css','codex-skin/assets/boot.css','codex-skin/assets/dsh-boot.css']){
 assert(fs.existsSync(path.join(root,rel)),'Missing release requirement: '+rel);
}
const all=[];function crawl(dir,base=''){
 for(const d of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=base?base+'/'+d.name:d.name;
  if(rel==='.git'||rel==='node_modules'||rel.startsWith('workbench/node_modules'))continue;
  if(d.isDirectory())crawl(path.join(dir,d.name),rel);else if(d.isFile())all.push(rel);
 }
}crawl(root);
const privateFiles=all.filter(x=>isPrivate(x));
const nonAudio=privateFiles.filter(x=>x!=='workbench/public/media/audio-unit02-fluid/voice.wav');
if(strict)assert.equal(privateFiles.length,0,'Public release cannot include private/generated files: '+privateFiles.join(', '));
else if(nonAudio.length)console.warn('Local ignored files (not in manifest):',nonAudio.length);
const dshMedia=all.filter(rel=>/(?:^|\/)(?:nerv-boot(?:-original)?\.gif|asuka-avatar-closed-eyes\.png|rei-avatar-closed-eyes\.png|asuka-voice-boot\.mp3|rei-voice-boot\.mp3|nerv-boot-music\.mp3)$/i.test(rel));
assert.equal(dshMedia.length,0,'DSH media must stay in the local boot pack: '+dshMedia.join(', '));
assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/workbench\/data\//);
assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/voice\.wav/);
console.log('Release verification PASS:',expected.length,'manifested files;',strict?'public-safe': 'development source (optional audio allowed)');
