'use strict';
const crypto=require('node:crypto');
const path=require('node:path');
// Hash the canonical *installation path*, not an account token or machine identifier.
// The Windows launcher computes the same value before attaching to a running service.
function instanceId(directory,platform=process.platform){
  const full=path.resolve(directory);
  const key=platform==='win32'?full.toLowerCase():full;
  return crypto.createHash('sha256').update(key,'utf8').digest('hex').slice(0,16);
}
module.exports={instanceId};
