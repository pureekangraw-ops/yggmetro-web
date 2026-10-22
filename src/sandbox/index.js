import {WorkerEntrypoint} from 'cloudflare:workers';
import shop from '../index.js';
import {sandboxCommerceRead} from './commerce-read.js';
export default shop;
// Named entrypoint: reachable only through an explicitly configured service binding.
// It is absent from the production Worker entry module. No caller-name header is trusted.
export class ShopCommerceRead extends WorkerEntrypoint {
 async fetch(){return new Response('Not found',{status:404});}
 async shopOrdersRead(input){return sandboxCommerceRead(this.env,input);}
}
