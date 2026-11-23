/* Entregas y prestigio que el DM escribe en progress/{personaje} con setDoc + merge.
   Los usan index.html (vista Mesa: Dar / Quitar, +1 / −1 y comprar avance) y dm.html (Recompensas al terminar el combate), para que las dos escriban igual.
   P: el progreso actual de ese personaje (lo que se leyó de la nube). Devuelven el cambio que hay que escribir. */
/* Entrega (grants, las últimas 30): berries (m) y un objeto (n, cantidad q); el teléfono del jugador la aplica una sola vez (S.gotG) */
function grantPatch(P,m,n,q,note){const g={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),at:Date.now(),m:m||0,n:n||"",q:n?q:0,note:String(note||"").slice(0,80)};
  return{g,patch:{grants:[g,...((P&&P.grants)||[])].slice(0,30)}}}
/* Prestigio: total y una línea del historial (plog, las últimas 30; r = código de rareza si fue una compra). null si quedaría negativo */
function prestPatch(P,n,r,note){const p=(P&&P.prestige)||0;if(p+n<0)return null;
  return{prestige:p+n,plog:[{at:Date.now(),n,r:r||0,note:String(note||"").slice(0,80)},...((P&&P.plog)||[])].slice(0,30)}}
console.assert((()=>{const a=grantPatch({grants:[{id:"x"}]},500,"Kit",2,"botín"),b=prestPatch({prestige:1,plog:[]},2,0,"épico");
  return a.patch.grants.length===2&&a.g.m===500&&a.g.q===2&&grantPatch(null,5,"",3).g.q===0&&b.prestige===3&&b.plog[0].n===2&&prestPatch({prestige:0},-1)===null})(),"entregas");
