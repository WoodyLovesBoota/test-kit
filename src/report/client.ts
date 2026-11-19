// Plain ES2017 for the report page. Two screens share one page scroll:
//   #/            the test list (scores, filters, tests grouped by tool and file)
//   #/t/<id>      one test's detail (error, screenshots, trace) with back / prev / next
// The list's scroll position is kept when you come back from a detail.
export const CLIENT_SCRIPT = `(function(){
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

var images={};try{images=JSON.parse(($('#testkit-images')||{}).textContent||'{}')}catch(e){}
function srcOf(el){var id=el.getAttribute('data-img');return id?images[id]:el.getAttribute('data-url')}

$$('[data-time]').forEach(function(el){var d=new Date(el.getAttribute('data-time'));if(!isNaN(d))el.textContent=d.toLocaleString();});

// ---- filters ----
var state={status:'all',tool:'all',q:''};
var items=$$('.item');
function visibleItems(){return items.filter(function(a){return !a.closest('[hidden]')})}
function applyFilters(){
  var shown=0;
  items.forEach(function(a){
    var ok=(state.status==='all'||a.getAttribute('data-status')===state.status)&&(state.tool==='all'||a.getAttribute('data-tool')===state.tool)&&(!state.q||a.getAttribute('data-text').indexOf(state.q)!==-1);
    a.parentNode.hidden=!ok;if(ok)shown++;
  });
  $$('.file,.tool').forEach(function(g){g.hidden=!$$('li',g).some(function(li){return !li.hidden})});
  var none=$('.none');if(none)none.hidden=shown!==0;
}
function wireSeg(sel,key){$$(sel+' button').forEach(function(b,_,all){b.addEventListener('click',function(){
  state[key]=b.getAttribute('data-value');all.forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});applyFilters();});});}
wireSeg('.by-status','status');wireSeg('.by-tool','tool');
var search=$('.search');if(search)search.addEventListener('input',function(){state.q=search.value.trim().toLowerCase();applyFilters();});

// ---- step viewer ----
function setupViewer(v){
  if(v._ready)return;v._ready=true;
  var steps=$$('.step',v);var img=$('.stage img',v);var pos=$('.pos',v);var cap=$('.cap',v);var prev=$('.prev',v);var next=$('.next',v);
  steps.forEach(function(s){var t=$('img',s);if(t&&!t.getAttribute('src'))t.src=srcOf(s)||''});
  function go(i){i=Math.max(0,Math.min(steps.length-1,i));v._at=i;var s=steps[i];
    img.src=srcOf(s)||'';img.alt=s.getAttribute('data-name')||'';
    pos.textContent='Step '+(i+1)+' of '+steps.length;cap.textContent=s.getAttribute('data-name')||'';
    steps.forEach(function(x,j){x.setAttribute('aria-current',j===i?'step':'false')});
    prev.disabled=i===0;next.disabled=i===steps.length-1;}
  v._go=go;
  if(steps.length<2){$('.steps',v).hidden=true;$('.nav',v).hidden=true;}
  steps.forEach(function(s,i){s.addEventListener('click',function(){go(i)})});
  prev.addEventListener('click',function(){go(v._at-1)});next.addEventListener('click',function(){go(v._at+1)});
  $('.stage-btn',v).addEventListener('click',function(){openFull(img.src,(pos.textContent||'')+' · '+(cap.textContent||''))});
  go(Number(v.getAttribute('data-start'))||0);
}

// ---- screens ----
if('scrollRestoration' in history)history.scrollRestoration='manual';
var listView=$('.listview');var detailView=$('#detail');var current=null;var listScroll=0;var lastId=null;
function showList(){
  if(current){current.hidden=true;current=null;}
  if(detailView)detailView.hidden=true;if(listView)listView.hidden=false;
  var y=listScroll;window.scrollTo(0,y);requestAnimationFrame(function(){window.scrollTo(0,y)});
  var back=lastId&&$('.item[data-id="'+lastId+'"]');if(back)back.focus({preventScroll:true});
}
function showDetail(id){
  var d=document.getElementById('d-'+id);if(!d){showList();return;}
  if(listView&&!listView.hidden)listScroll=window.scrollY;
  if(current)current.hidden=true;
  listView.hidden=true;detailView.hidden=false;d.hidden=false;current=d;lastId=id;
  $$('.viewer',d).forEach(setupViewer);
  // Prev / next follow the list as it is filtered right now.
  var vis=visibleItems();var i=vis.findIndex(function(a){return a.getAttribute('data-id')===id});
  if(i<0){vis=items;i=items.findIndex(function(a){return a.getAttribute('data-id')===id});}
  var prev=$('.dprev'),next=$('.dnext'),pos=$('.dpos');
  function link(a,item){if(item){a.href='#/t/'+item.getAttribute('data-id');a.removeAttribute('aria-disabled')}else{a.href='#/';a.setAttribute('aria-disabled','true')}}
  link(prev,vis[i-1]);link(next,vis[i+1]);
  if(pos)pos.textContent=(i+1)+' / '+vis.length;
  document.title=(d.querySelector('h2')||{}).textContent+' — '+baseTitle;
  window.scrollTo(0,0);requestAnimationFrame(function(){window.scrollTo(0,0)});detailView.focus({preventScroll:true});
}
var baseTitle=document.title;
function route(){var m=/^#\\/t\\/(.+)$/.exec(location.hash);if(m)showDetail(decodeURIComponent(m[1]));else{document.title=baseTitle;showList();}}
window.addEventListener('hashchange',route);
route();

// ---- keyboard ----
document.addEventListener('keydown',function(e){
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')||e.metaKey||e.ctrlKey||e.altKey)return;
  if($('dialog.lb[open]'))return;
  if(!current)return;
  if(e.key==='Escape'){location.hash='#/';}
  else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var v=$('.viewer',current);if(v&&v._go){e.preventDefault();v._go(v._at+(e.key==='ArrowRight'?1:-1));}}
  else if(e.key==='j'||e.key==='k'){var a=$(e.key==='j'?'.dnext':'.dprev');if(a&&a.getAttribute('aria-disabled')!=='true')location.hash=a.getAttribute('href');}
});

// ---- full-size view ----
var lb=$('dialog.lb');
function openFull(src,caption){if(!lb||!src)return;$('img',lb).src=src;$('.lb-cap',lb).textContent=caption;if(lb.showModal)lb.showModal();else lb.setAttribute('open','');}
if(lb){$('.lb-close',lb).addEventListener('click',function(){lb.close()});lb.addEventListener('click',function(e){if(e.target===lb||e.target.classList.contains('lb-body'))lb.close()});}

// ---- copy ----
$$('[data-copy]').forEach(function(b){b.addEventListener('click',function(){
  var text=b.getAttribute('data-copy');var done=function(){var o=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=o},1500)};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(done,fallback);else fallback();
  function fallback(){var t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();
    try{document.execCommand('copy');done()}catch(e){}t.parentNode.removeChild(t);}
});});
})();`;
