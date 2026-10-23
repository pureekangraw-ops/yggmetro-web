(()=>{
 'use strict';
 if(window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches)return;
 let frame=0,point;
 const targetFrom=e=>e.target.closest('.home-hero,.destination-card,.product-art,.portfolio-card>button');
 document.addEventListener('pointermove',e=>{const target=targetFrom(e);if(!target)return;const r=target.getBoundingClientRect();point={target,x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const p=point;if(!p.target.isConnected)return;p.target.classList.add('pointer-lit');p.target.style.setProperty('--spot-x',`${p.x*100}%`);p.target.style.setProperty('--spot-y',`${p.y*100}%`);if(p.target.classList.contains('destination-card')){p.target.style.setProperty('--tilt-x',`${(0.5-p.y)*5}deg`);p.target.style.setProperty('--tilt-y',`${(p.x-0.5)*6}deg`);}});},{passive:true});
 document.addEventListener('pointerout',e=>{const target=targetFrom(e);if(target&&!target.contains(e.relatedTarget))target.classList.remove('pointer-lit');},{passive:true});
})();
