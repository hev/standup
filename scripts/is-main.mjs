import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
/** npm bin links and direct node invocation must select the same entrypoint. */
export function isMain(url){try{return !!process.argv[1]&&url===pathToFileURL(realpathSync(process.argv[1])).href;}catch{return false;}}
