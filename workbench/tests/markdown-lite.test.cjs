'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/markdown-lite.js'),'utf8'),sandbox);
const {tokenize,safeHref}=sandbox.module.exports;
test('Markdown identifies headings, tables, fenced code, lists and quotes',()=>{
 const blocks=tokenize('# Title\n\n| Name | Value |\n| --- | --- |\n| a | b |\n\n- item1\n- item2\n\n> quote\n\n```js\nconsole.log(1)\n```');
 assert.deepEqual(Array.from(blocks,x=>x.type),['heading','table','list','quote','code']);
 assert.equal(blocks[1].rows[0][1],'b');assert.equal(blocks[4].language,'js');assert.equal(blocks[4].text,'console.log(1)');
});
test('Markdown keeps raw HTML as text; link validation blocks dangerous schemes',()=>{
 assert.equal(tokenize('<img src=x onerror=alert(1)>')[0].text,'<img src=x onerror=alert(1)>');
 for(const value of ['javascript:alert(1)','data:text/html,hi','file:///etc/passwd','//attacker.example'])assert.equal(safeHref(value),null);
 assert.equal(safeHref('https://github.com'),'https://github.com');
});
