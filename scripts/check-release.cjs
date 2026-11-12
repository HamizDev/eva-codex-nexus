'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root,files,entry,isPrivate}=require('./release-utils.cjs');
const strict=process.argv.includes('--public'),manifest=JSON.parse(fs.readFileSync(path.join(root,'MANIFEST.json'),'utf8'));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
assert.equal(manifest.version,version);
const expected=files().map(entry);
assert.equal(new Set(expected.map(x=>x.path)).size,expected.length,'duplicate release files');
assert.deepEqual(manifest.files,expected,'MANIFEST.json is stale; run npm run manifest');
for(const rel of ['LICENSE','LICENSE-STATUS.md','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes','README.md','ASSETS.md','EVA-THEME.md','PROVENANCE.md','PUBLIC-RELEASE-CHECKLIST.md','Start-EVA.vbs','Install-EVA-DesktopShortcut.cmd','Import-EVA-Theme.cmd','scripts/Install-EVA-DesktopShortcut.ps1','codex-skin/Start-EVA.ps1','codex-skin/Import-EVA-Theme.ps1','codex-skin/Restore-EVA.ps1','codex-skin/injector.mjs','codex-skin/assets/eva-skin.css','codex-skin/assets/boot.css','codex-skin/assets/eva-boot.css','codex-skin/assets/skin-ui.js']){
 assert(fs.existsSync(path.join(root,rel)),'Missing release requirement: '+rel);
}
for(const rel of ['Start-EVA-Workbench.cmd','workbench/start.ps1','workbench/package.json','CODE-ORIGINS.md','UPSTREAM.md','DEVELOPMENT-HANDOFF.md','licenses/DragonCodexBoot-MIT.txt']){
 assert(!fs.existsSync(path.join(root,rel)),'Removed legacy path is back: '+rel);
}
const all=[];function crawl(dir,base=''){
 for(const d of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=base?base+'/'+d.name:d.name;
  if(rel.split('/').some(part=>part==='.git'||part==='node_modules'))continue;
  if(d.isDirectory())crawl(path.join(dir,d.name),rel);else if(d.isFile())all.push(rel);
 }
}crawl(root);
const privateFiles=all.filter(x=>isPrivate(x));
if(strict)assert.equal(privateFiles.length,0,'Public release cannot include private/generated files: '+privateFiles.join(', '));
else if(privateFiles.length)console.warn('Local ignored files (not in manifest):',privateFiles.length);
const packRoot='eva-theme/';
const packAssets=all.filter(rel=>rel.startsWith(packRoot+'assets/'));
const characterMedia=all.filter(rel=>/(?:^|\/)(?:nerv-boot(?:-original)?\.gif|asuka-avatar-closed-eyes\.png|rei-avatar-closed-eyes\.png|asuka-voice-boot\.mp3|rei-voice-boot\.mp3|nerv-boot-music\.mp3)$/i.test(rel));
const strayCharacterMedia=characterMedia.filter(rel=>!rel.startsWith(packRoot+'assets/'));
assert.equal(strayCharacterMedia.length,0,'Character media outside eva-theme/assets: '+strayCharacterMedia.join(', '));
if(packAssets.length){
 const licensePath='eva-theme/MEDIA-LICENSE.md',noticePath='eva-theme/NOTICE.md',packManifestPath='eva-theme/assets/manifest.json';
 const mediaLicense=fs.readFileSync(path.join(root,licensePath),'utf8');
 const mediaNotice=fs.readFileSync(path.join(root,noticePath),'utf8');
 assert.match(mediaLicense,/All rights reserved/i,'Media pack must retain its restrictive license');
 assert.match(mediaNotice,/MEDIA-LICENSE\.md/,'Media pack notice must point to the media license');
 const packManifest=JSON.parse(fs.readFileSync(path.join(root,packManifestPath),'utf8'));
 const packEntries=Object.values(packManifest.assets||{});
 assert(packEntries.length>0,'EVA theme pack has no assets');
 const expectedPack=new Set(packEntries.map(asset=>packRoot+'assets/'+asset.file));
 const actualPack=new Set(packAssets.filter(rel=>rel!==packManifestPath));
 assert.deepEqual(actualPack,expectedPack,'EVA theme pack has missing or unlisted assets');
 for(const asset of packEntries){
  const data=fs.readFileSync(path.join(root,packRoot,'assets',asset.file));
  assert.equal(data.length,asset.bytes,'EVA theme asset byte count mismatch: '+asset.file);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),asset.sha256,'EVA theme asset SHA-256 mismatch: '+asset.file);
 }
}
const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
assert.ok(!/workbench[\\/]/i.test(ignore),'.gitignore still references the removed workbench');
assert.ok(!/voice\.wav/i.test(ignore),'.gitignore still references the removed workbench audio');
console.log('Release verification PASS:',expected.length,'manifested files;',strict?'public-safe':'development source');
