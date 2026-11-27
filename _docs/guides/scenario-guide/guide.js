(function(){
'use strict';
var STEPS=__STEPS__,GROUPS=__GROUPS__,KEY='kx-scenario-guide-v1',done={};
function load(){try{var r=localStorage.getItem(KEY);if(r)done=JSON.parse(r)||{};}catch(e){done={};}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(done));}catch(e){}}
function $(s,r){return (r||document).querySelector(s);}function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
var total=0;Object.keys(STEPS).forEach(function(k){total+=STEPS[k];});
function count(id){var c=0;for(var i=1;i<=STEPS[id];i++){if(done[id+'-'+i])c++;}return c;}
function refresh(){
 var all=0;
 Object.keys(STEPS).forEach(function(id){var c=count(id);all+=c;var el=$('[data-prog="'+id+'"]');if(el){el.textContent=c+'/'+STEPS[id];el.classList.toggle('done',c===STEPS[id]);}});
 Object.keys(GROUPS).forEach(function(g){var t=0,c=0;GROUPS[g].forEach(function(id){t+=STEPS[id];c+=count(id);});var el=$('[data-gprog="'+g+'"]');if(el)el.textContent=c+'/'+t;});
 $('#barAll').style.width=(total?all/total*100:0)+'%';$('#txtAll').textContent=all+' of '+total+' steps';
 applyFilters();
}
function init(){
 load();
 $$('input[data-step]').forEach(function(cb){cb.checked=!!done[cb.getAttribute('data-step')];cb.addEventListener('change',function(){var k=cb.getAttribute('data-step');if(cb.checked)done[k]=1;else delete done[k];save();refresh();});});
 var state={q:'',grp:{},app:'',ver:'',open:false};
 var qEl=$('#q');qEl.addEventListener('input',function(){state.q=qEl.value.trim().toLowerCase();applyFilters();});
 $$('[data-filter-group]').forEach(function(b){b.addEventListener('click',function(){var g=b.getAttribute('data-filter-group');state.grp[g]=!state.grp[g];b.setAttribute('aria-pressed',state.grp[g]?'true':'false');applyFilters();});});
 $('#fApp').addEventListener('change',function(e){state.app=e.target.value;applyFilters();});
 $('#fVer').addEventListener('change',function(e){state.ver=e.target.value;applyFilters();});
 $('#fOpen').addEventListener('change',function(e){state.open=e.target.checked;applyFilters();});
 $('#clearF').addEventListener('click',function(){state={q:'',grp:{},app:'',ver:'',open:false};qEl.value='';$('#fApp').value='';$('#fVer').value='';$('#fOpen').checked=false;$$('[data-filter-group]').forEach(function(b){b.setAttribute('aria-pressed','false');});applyFilters();});
 window.applyFilters=function(){
  var anyG=Object.keys(state.grp).some(function(g){return state.grp[g];});var shown=0,n=0;
  $$('.scn').forEach(function(a){n++;var id=a.id,ok=true;
   if(state.q&&a.getAttribute('data-text').indexOf(state.q)<0)ok=false;
   if(anyG&&!state.grp[a.getAttribute('data-group')])ok=false;
   if(state.app&&(' '+a.getAttribute('data-apps')+' ').indexOf(' '+state.app+' ')<0)ok=false;
   if(state.ver&&a.getAttribute('data-ver')!==state.ver)ok=false;
   if(state.open&&count(id)===STEPS[id])ok=false;
   a.hidden=!ok;if(ok)shown++;});
  $$('.grp').forEach(function(g){g.hidden=!$$('.scn',g).some(function(a){return !a.hidden;});});
  $('#count').textContent=shown+' of '+n+' scenarios shown';$('#noRes').hidden=shown>0;
 };
 $('#expand').addEventListener('click',function(){$$('.scn:not([hidden]) details').forEach(function(d){d.open=true;});});
 $('#collapse').addEventListener('click',function(){$$('.scn details').forEach(function(d){d.open=false;});});
 $('#reset').addEventListener('click',function(){if(window.confirm('Clear all progress ticks stored in this browser?')){done={};save();$$('input[data-step]').forEach(function(c){c.checked=false;});refresh();}});
 $('#printBtn').addEventListener('click',function(){window.print();});
 window.addEventListener('beforeprint',function(){$$('.scn details').forEach(function(d){d.setAttribute('data-was',d.open?'1':'0');d.open=true;});});
 window.addEventListener('afterprint',function(){$$('.scn details').forEach(function(d){d.open=d.getAttribute('data-was')==='1';});});
 var mb=$('#menuBtn'),side=$('#side');mb.addEventListener('click',function(){var o=side.classList.toggle('open');mb.setAttribute('aria-expanded',o?'true':'false');});
 side.addEventListener('click',function(e){if(e.target.closest('a')){side.classList.remove('open');mb.setAttribute('aria-expanded','false');}});
 function openHash(){var h=location.hash.slice(1);if(!h)return;var el=document.getElementById(h);if(el&&el.classList.contains('scn')){el.hidden=false;var d=$('details',el);if(d)d.open=true;}}
 document.addEventListener('click',function(e){var a=e.target.closest('a.xref');if(a){var t=document.getElementById(a.getAttribute('data-ref'));if(t){t.hidden=false;var d=$('details',t);if(d)d.open=true;}}});
 window.addEventListener('hashchange',openHash);openHash();
 // sidebar highlight
 if('IntersectionObserver' in window){var links={};$$('[data-nav]').forEach(function(a){links[a.getAttribute('data-nav')]=a;});
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){$$('[data-nav].on').forEach(function(a){a.classList.remove('on');});var id=en.target.id.replace(/^g-/,'');if(links[id])links[id].classList.add('on');}});},{rootMargin:'-30% 0px -60% 0px'});
  $$('section.front, section.grp').forEach(function(s){io.observe(s);});}
 function same(){$$('img[data-same]').forEach(function(im){var o=document.querySelector('img[data-k="'+im.getAttribute('data-same')+'"]');if(o)im.src=o.src;});}
 same();window.addEventListener('beforeprint',same);
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
