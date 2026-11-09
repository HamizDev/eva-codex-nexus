'use strict';
const fs=require('node:fs'),path=require('node:path');
const {root,files,entry}=require('./release-utils.cjs');
const manifest={schema:1,project:'eva-codex-nexus',version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,files:files().map(entry)};
fs.writeFileSync(path.join(root,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log('Manifest generated:',manifest.files.length,'public-source files');
