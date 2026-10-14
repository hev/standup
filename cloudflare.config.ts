import {execFileSync} from 'node:child_process';
import {bindings,defineConfig} from 'cf/config';
const version=process.env.APP_VERSION??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
export default defineConfig({worker:{name:'standup',compatibilityDate:'2026-10-14',entrypoint:'src/worker.js',observability:{enabled:true},assets:{runWorkerFirst:['/api/*']},domains:['standup.hevlayer.com'],env:{APP_VERSION:bindings.text(version),APP_MODE:bindings.text('demo'),LAYER_GATEWAY_URL:bindings.text('https://aws-us-east-1.hevlayer.com'),DEMO_NAMESPACE:bindings.text('standup-demo-v2'),PRIVATE_NAMESPACE:bindings.text('standup-private-configure-me'),SANDBOX_NAMESPACE:bindings.text('standup-sandbox-configure-me'),ASSETS:bindings.assets(),LAYER_API_KEY:bindings.secret()}}});
