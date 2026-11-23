/* Service worker de Mesa de Combate (index.html, dm.html y mesa.html).
   HTML y JS: primero la red (así llegan las versiones nuevas) y, sin conexión, la copia guardada. Imágenes, íconos y la librería de Firebase (con versión en la URL): primero la copia.
   La caché lleva la versión: al activarse una versión nueva se borran las viejas. La página pide "skip" solo cuando el jugador toca Actualizar (nunca recarga sola).
   No toca Firestore ni el inicio de sesión (otras direcciones): esos los maneja la caché propia de Firestore. */
/* Versión publicada: la escribe sola el hook pre-commit de git, como en las páginas */
const APP_VERSION="2026-11-22 21:31";
const CACHE="mesa-"+APP_VERSION;
const CORE=["./","index.html","dm.html","mesa.html","conjuros.js","progresion.js","explicaciones.js","haki.js","entregas.js","manifest.json","imagenes/icono/icono-192.png","imagenes/icono/icono-180.png","imagenes/icono/icono-32.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{})));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(K=>Promise.all(K.filter(k=>k.startsWith("mesa-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",e=>{if(e.data==="skip")self.skipWaiting()});
const keep=(req,res)=>{if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(req,c))}return res};
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);
  const same=u.origin===self.location.origin,sdk=u.hostname==="www.gstatic.com"&&u.pathname.startsWith("/firebasejs/");if(!same&&!sdk)return;
  if(sdk||/\.(png|jpe?g|webp|svg|ico)$/i.test(u.pathname)){e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>keep(r,res))));return}
  e.respondWith(fetch(r).then(res=>keep(r,res)).catch(()=>caches.match(r,{ignoreSearch:true}).then(h=>h||(r.mode==="navigate"?caches.match("index.html"):undefined)).then(h=>h||Response.error())))});
