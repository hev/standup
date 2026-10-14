#!/usr/bin/env node
// Link the maintained checkout so the skill, CLI and documentation stay together.
import {symlink,mkdir,readlink,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
export async function install(target=resolve(homedir(),'.codex/skills/granola-standup')) {
  const source=fileURLToPath(new URL('../skills/granola-standup',import.meta.url));
  await mkdir(dirname(target),{recursive:true});
  try {await symlink(source,target,'dir');} catch(e) {
    if(e.code!=='EEXIST')throw e;
    let existing;try{existing=await readlink(target);}catch{throw Error('Existing skill is not a symlink; preserve it and choose another target');}
    if(resolve(dirname(target),existing)!==source)throw Error('Existing skill points elsewhere; preserve it and choose another target');
  }
  await realpath(resolve(target,'references/cli.md'));
  return {target,source,checkout:fileURLToPath(new URL('..',import.meta.url))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  install(process.argv[2]).then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
