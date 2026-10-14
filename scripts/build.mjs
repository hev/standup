import {mkdir,copyFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {build} from 'esbuild';
const version=process.env.APP_VERSION??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir('dist',{recursive:true});await build({entryPoints:['src/worker.js'],outfile:'dist/worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});await writeFile('dist/version.json',JSON.stringify({version}));
const config=JSON.parse(await (await import('node:fs/promises')).readFile('wrangler.json','utf8'));config.main='worker.js';config.assets.directory='../public';config.vars.APP_VERSION=version;await writeFile('dist/wrangler.json',JSON.stringify(config,null,2));console.log(JSON.stringify({built:true,version}));
