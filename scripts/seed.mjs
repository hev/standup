import {LayerStore} from '../src/layer.js';import {seed} from '../fixtures/seed.js';import {validateNamespaces} from '../src/config.js';
validateNamespaces({demo:process.env.DEMO_NAMESPACE,privateNotes:process.env.PRIVATE_NAMESPACE,sandbox:process.env.SANDBOX_NAMESPACE});
const namespace=process.env.SEED_NAMESPACE??process.env.DEMO_NAMESPACE;
if(!/^standup-(demo|uat|sandbox)[\w-]*$/.test(namespace))throw Error('Seeding is restricted to explicitly synthetic standup-demo/uat/sandbox namespaces');
const store=new LayerStore(process.env,namespace);const result=await store.seed(seed);console.log(JSON.stringify({namespace,inserted:result.rows_upserted,fictional:true}));
