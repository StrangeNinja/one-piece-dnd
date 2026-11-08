# Integración con Mesa de Combate

Guía para conectar otra aplicación (por ejemplo, un panel nuevo para el DM) con los datos de **Mesa de Combate** sin leer el código. Todo lo que aparece aquí está tomado del código publicado el 08-11-2026 (`index.html`, `dm.html` y `firestore.rules`). Si el código cambia, esta guía puede quedar desactualizada: ante una duda, manda el código.

---

## 1. Qué es y dónde está

**Mesa de Combate** es una app web para celular que reemplaza las hojas de personaje en combate, para una mesa privada del sistema *Dungeons & Devil Fruits* (homebrew de One Piece sobre D&D 5e). Cada jugador inicia sesión, ve su personaje y resuelve su turno: tiradas, críticos, recursos, reacciones, PV, estados, inventario y subida de nivel. El DM tiene la vista **Mesa** (dentro de la misma app) y un panel de combate aparte (`dm.html`) con iniciativa, turnos y PV de enemigos.

| Qué | Dónde |
|---|---|
| App de los jugadores | https://strangeninja.github.io/one-piece-dnd/ |
| Panel de combate del DM | https://strangeninja.github.io/one-piece-dnd/dm.html |
| Repositorio (público) | https://github.com/StrangeNinja/one-piece-dnd (rama `main`) |

No hay servidor propio, build ni dependencias: son páginas estáticas en GitHub Pages que hablan directo con Firebase (Authentication y Firestore) desde el navegador.

### Archivos

| Archivo | Contenido | ¿Publicado? |
|---|---|---|
| `index.html` | Toda la app de los jugadores (HTML, CSS y JS en un solo archivo). Incluye los datos de los personajes (`const CHARS = {…}`), el motor de niveles (`levelSrc`), la sincronización con Firestore y la vista **Mesa** del DM. | Sí |
| `dm.html` | Panel de combate del DM: iniciativa, turnos, PV, PV temporales, estados y efectos de jugadores, aliados y enemigos. Publica `combat/live` y `combat/dm`. | Sí |
| `conjuros.js` | Objeto global `SPELLS`: conjuros (mecánicas de 5e, resúmenes propios en español e inglés). Campos explicados al inicio del archivo. | Sí |
| `haki.js` | Objeto global `HAKI`: 74 avances de Haki (color, rareza, nivel, requisitos, uso, resumen). Lo usa la tienda de prestigio. | Sí |
| `progresion.js` | `PCLASS`, `PSUB`, `FEATS`, `PROG_NOTES`: progresión de clases y subclases hasta nivel 20, dotes y lo que no se pudo determinar. Lo usa la subida de nivel. | Sí |
| `explicaciones.js` | Objeto global `EXPL`: explicaciones largas de estadísticas, estados y rasgos, en los dos idiomas. | Sí |
| `manifest.json`, `imagenes/icono/` | Ícono e información de la app instalable. | Sí |
| `imagenes/` | Por personaje: `<id>-retrato.jpg` (384 px), `<id>-mini.jpg` (96 px) y `<id>-cartel.jpg` (756×1008). `<id>` es la clave del personaje (`udon`, `codel`, `kalgo`, `sungsopp`, `ryuga`). | Sí |
| `personajes/*.md` | Una ficha por personaje (`<nombre>.md`, `<nombre>-fruta.md`, `<nombre>-rol.md`) con los datos y las decisiones del DM. Es la fuente de verdad desde la que se arma `CHARS`. | **No** (solo en la PC del DM) |
| `firestore.rules` | Copia de las reglas publicadas en la consola de Firebase (ver sección 6). | **No** (copiadas abajo) |
| `INTEGRACION.md` | Este documento. | Sí |

El `.gitignore` es una **lista de permitidos**: todo se ignora salvo lo que aparece ahí. Un archivo nuevo que deba publicarse hay que agregarlo a esa lista. **Nunca publicar `libros/`** (texto de libros con derechos de autor).

Las imágenes se pueden usar desde otra app con su URL completa, por ejemplo `https://strangeninja.github.io/one-piece-dnd/imagenes/kalgo-mini.jpg`. Si falta una, la app muestra la inicial del nombre.

---

## 2. Firebase

- **Proyecto**: `one-piece-dnd`, plan gratuito Spark.
- **Firestore**: base `(default)` en `southamerica-west1` (Santiago), modo producción.
- **SDK que usa la app**: Firebase JS modular **10.12.2**, cargado desde `https://www.gstatic.com/firebasejs/10.12.2/firebase-{app,auth,firestore}.js`, con caché local persistente (`persistentLocalCache` + `persistentMultipleTabManager`) para funcionar sin conexión.

### Configuración

Es pública (está en el código de las dos páginas); lo que protege los datos son las reglas de Firestore y el inicio de sesión.

```js
const firebaseConfig = {
  apiKey: "AIzaSyBjywHbBPsTBVvWtOXbKhjQDf4kmbEc-MU",
  authDomain: "one-piece-dnd.firebaseapp.com",
  projectId: "one-piece-dnd",
  storageBucket: "one-piece-dnd.firebasestorage.app",
  messagingSenderId: "629290049992",
  appId: "1:629290049992:web:6fe9f692bb47c8878460fd"
};
```

### Inicio de sesión

Métodos activados en Authentication:

1. **Google** (ventana emergente).
2. **Correo y contraseña**: crear cuenta (nombre, correo, contraseña de al menos 8 caracteres), iniciar sesión y recuperar contraseña (`sendPasswordResetEmail`).

El inicio de sesión es **obligatorio** en la app de los jugadores. `dm.html` funciona sin sesión (solo en el teléfono), pero para publicar turnos y leer los PV en vivo necesita una sesión de DM.

**Dominios autorizados**: si la nueva app se publica en otro dominio que no sea `strangeninja.github.io`, hay que agregarlo en Firebase → Authentication → Settings → Authorized domains, o el inicio de sesión con Google fallará.

### Cuenta del DM

- No hay un campo "rol" en el usuario. Una cuenta es **DM** si existe el documento `admins/{uid}` (el contenido no importa: las reglas solo miran si existe).
- Ese documento lo crea el DM **a mano** en la consola de Firestore (colección `admins`, id = su `uid` de Authentication). Nadie puede crearlo desde una app.
- Cómo lo detectan las apps: al iniciar sesión hacen `getDoc(doc(db, "admins", uid))`; si `exists()`, es DM. Las reglas solo dejan leer el propio documento, así que un jugador recibe "no existe" o un error de permisos (las dos cosas significan "no es DM").
- Con sesión de DM, `index.html` abre la vista **Mesa** (no una ficha) y `dm.html` sincroniza el combate con la nube.

---

## 3. Modelo de datos de Firestore

Colecciones que existen: `admins`, `players`, `state`, `progress` y `combat`. **No hay otras**: las solicitudes de compra, entregas del DM, avisos de caídos, efectos y avances de tiempo viven como campos dentro de esos documentos. Cualquier colección nueva está **bloqueada** por las reglas actuales (no tiene `match`) hasta que se agregue una regla.

**Ids de personaje** (se usan en `state/{id}`, `progress/{id}`, `players.char`, imágenes y `combat/live`): `udon`, `codel`, `kalgo`, `sungsopp`, `ryuga`.

**Fechas**: salvo donde se indica, son números en milisegundos desde 1970 (`Date.now()`), no `Timestamp` de Firestore.

**Textos bilingües**: algunos campos pueden ser un texto simple o un objeto `{es, en}`. Hay que aceptar las dos formas.

### 3.1 `admins/{uid}`

| Campo | Tipo | Significado |
|---|---|---|
| (ninguno obligatorio) | — | Basta con que el documento exista. |

- **Escribe**: nadie desde la app; el DM en la consola.
- **Lee**: solo el propio usuario (`get`).

### 3.2 `players/{uid}`

Una cuenta por jugador. El id es el `uid` de Authentication.

| Campo | Tipo | Significado |
|---|---|---|
| `name` | string | Nombre de la cuenta (`displayName` de Google o el nombre escrito al crear la cuenta de correo). |
| `email` | string | Correo de la cuenta. |
| `char` | string o `null` | Personaje asignado (`udon`, `codel`…). `null` = "Sin asignar". Solo el DM lo cambia. |
| `look` | objeto (opcional) | Apariencia y preferencias: `{pal, mode, dice, lang, quick}`. Ver abajo. |

`look`:

| Campo | Valores | Significado |
|---|---|---|
| `pal` | `"grand"`, `"bandera"`, `"paja"` | Paleta: Grand Line, Bandera pirata, Sombrero de paja. |
| `mode` | `"auto"`, `"day"`, `"night"` | Modo claro u oscuro. |
| `dice` | `"fis"`, `"dig"` | Dados físicos (la app muestra la receta) o digitales (la app tira). Predeterminado `"fis"`. |
| `lang` | `"es"`, `"en"` | Idioma. Predeterminado `"es"`. |
| `quick` | boolean | Uso rápido de ataques sin límite. Predeterminado `false`. |

Ejemplo:

```json
{
  "name": "Jugador de Kalgo",
  "email": "jugador@example.com",
  "char": "kalgo",
  "look": { "pal": "grand", "mode": "auto", "dice": "fis", "lang": "es", "quick": false }
}
```

- **Escribe**:
  - La app del jugador lo **crea** la primera vez que inicia sesión (si no existe y la lectura no viene de caché): `{name, email, char: null}`.
  - El jugador (o el DM en su propio documento) actualiza **solo** `look` cada vez que cambia la apariencia (`setDoc` con `merge`).
  - El DM cambia `char` desde Mesa (`updateDoc(players/{uid}, {char})`).
- **Lee**: el propio jugador (escucha su documento: cuando cambia `char`, abre esa ficha) y el DM (escucha toda la colección para la lista de cuentas).

### 3.3 `state/{personaje}`

El **estado completo** del personaje en juego. Lo escribe el teléfono de su jugador cada vez que algo cambia. **No** incluye el prestigio ni el nivel (están en `progress`).

Campos principales (la app ignora o corrige cualquier campo desconocido o de tipo incorrecto al leer):

| Campo | Tipo | Significado |
|---|---|---|
| `hp` | número | PV actuales. |
| `temp` | número | PV temporales (no se acumulan: queda el más alto). |
| `maxHp` | número | PV máximos **calculados** por la app al nivel actual. Úsalo en lugar de los PV de la hoja. |
| `conds` | string[] | Estados activos, con su nombre en **español** (ver lista abajo). |
| `exh` | número 0–6 | Nivel de agotamiento. |
| `ds` | `{ok, ko}` | Salvaciones de muerte: éxitos y fallos (0–3). |
| `dead` | boolean | Falló "No abandonaré mis sueños" o quedó sin vida. |
| `dream` | número | Puntos de sueño que le quedan. |
| `lvl` | número | Nivel que el teléfono ya aplicó (evita aplicar dos veces una subida). |
| `res` | `{idRecurso: número}` | Usos que quedan de cada recurso (ids en `CHARS[...].resources`). |
| `sr` | `{idEspecial: número}` | Usos de reacciones especiales (`contra`, `bloqueo`, `proyectil`, `paso`). |
| `used` | `{clave: boolean}` | Rasgos de "una vez por descanso" ya usados. |
| `turn` | objeto | Economía del turno: `a` (acción), `b` (acción adicional), `r` (reacción) como 1/0, `sr` (reacciones especiales que quedan en la ronda), `atk` (golpes que quedan) y banderas del turno (`attacked`, `hurt`, `exec`, `sneak`…). |
| `turnEnded` | boolean | Ya terminó su turno (el DM lo pasó a otro). |
| `fx` | objeto[] | Efectos con duración del jugador (ver 4.4). |
| `conc` | `{id, lvl}` | Concentración activa: id del conjuro o `"f:<técnica>"` de fruta; `""` si no hay. |
| `slots` | número[] | Espacios de conjuro que quedan por nivel (solo lanzadores). |
| `spells` | `{c: string[], p: string[]}` | Trucos y conjuros preparados (ids de `SPELLS`). |
| `fore` | `{v, u}[]` | Presagios de Vistazo al futuro (Codel): valor y si se usó. |
| `sea` | boolean | Kairoseki activo (anula la fruta). |
| `frenzy`, `trans`, `muscle`, `form`, `formOpts`, `humanHp`, `float`, `stageAC`, `advNext`, `hard`, `mw` | varios | Estados propios de rasgos: frenesí, Sulong, Músculos de Haki (`"def"`/`"atk"`/`""`), forma Zoan, Paso de nube, Endurecimiento, arma de mochi, etc. |
| `fury` | string[] | Técnicas de furia conocidas (Bruiser). `furyDone`: último desbloqueo del DM ya usado. |
| `comp` | `{hp, temp, heads, tf, turnDmg}` | Mascota (Fluffy, en `state/sungsopp`). Vacío `{}` si no hay mascota. |
| `inv` | `{money, items[]}` | Inventario. `money` en berries (entero ≥ 0). Cada objeto: `{id, n, q, note, eq, w?, k?}` (nombre texto o `{es,en}`, cantidad, nota, equipado, arma enlazada, clave de consumible). |
| `ilog` | objeto[] | Historial del inventario (últimos 60): `{at, by, t, note}`. `by` es el nombre del personaje o `"DM"`. |
| `gotG` | string[] | Ids de las entregas del DM (`progress.grants`) ya aplicadas en este personaje. |
| `hid` | string[] | Tarjetas que el jugador ocultó. |
| `aided` | string[] | A quién curó con Primeros auxilios desde el último descanso. |
| `log` | string[] | Historial de la ficha (texto con `<b>` permitido; lo demás se borra). |
| `hurt` | boolean | Recibió daño desde que empezó su último turno. |
| `by` | string | `uid` de quien escribió (el jugador o el DM). |
| `at` | **Timestamp de Firestore** | `serverTimestamp()` de la última escritura. |

Estados (`conds`), en español → inglés: Agarrado (Grappled), Apresado (Restrained), Asustado (Frightened), Aturdido (Stunned), Cegado (Blinded), Derribado (Prone), Ensordecido (Deafened), Envenenado (Poisoned), Hechizado (Charmed), Incapacitado (Incapacitated), Invisible (Invisible), Paralizado (Paralyzed). Cualquier otro texto se descarta.

Ejemplo (recortado):

```json
{
  "hp": 52, "temp": 7, "maxHp": 75, "lvl": 7,
  "conds": ["Derribado"], "exh": 0,
  "ds": { "ok": 0, "ko": 0 }, "dead": false, "dream": 7,
  "res": { "emocion": 2, "furia": 3, "sulong": 1, "meteoro": 1, "cargas": 10 },
  "sr": { "contra": 3, "bloqueo": 3, "proyectil": 3, "paso": 3 },
  "turn": { "a": 0, "b": 1, "r": 1, "sr": 2, "atk": 0, "attacked": true, "hurt": false },
  "frenzy": true, "muscle": "def", "sea": false,
  "fx": [ { "id": "k1", "t": "r", "left": 8, "k": "frenzy" } ],
  "conc": { "id": "", "lvl": 0 },
  "comp": {},
  "inv": { "money": 5000, "items": [ { "id": "s0", "w": "main", "n": "Puños del Cosmos", "q": 1, "note": "", "eq": true } ] },
  "ilog": [], "gotG": [], "log": ["<b>Ataque</b>: 17 para impactar"],
  "by": "uid-del-jugador", "at": "<Timestamp>"
}
```

- **Escribe**:
  - El teléfono del jugador, **unos 0,7 s después de cada cambio** (tiradas que gastan algo, daño, curación, estados, descansos, inventario…). Escribe el **documento completo** con `setDoc` **sin `merge`**: lo que no esté en su estado desaparece.
  - Si el documento no existe al abrir la ficha, lo crea.
  - El DM, cuando abre una ficha desde Mesa con **Editar ficha real** (mismo formato; `by` = uid del DM).
  - `dm.html` **no** escribe `state`.
- **Lee**: el jugador de ese personaje (escucha su documento y reemplaza su estado local si cambió) y el DM (escucha toda la colección: Mesa y `dm.html`).

### 3.4 `progress/{personaje}`

Nivel, prestigio, Haki comprado, entregas del DM y el flujo de subida de nivel. **Lo controla el DM**; el jugador solo puede escribir dos campos (`pending` y `buy`).

| Campo | Tipo | Quién | Significado |
|---|---|---|---|
| `level` | número 7–20 | DM | Nivel aprobado. Sin documento o sin campo: nivel de la hoja (7). |
| `hpDice` | número | DM | Suma de los dados de PV de todas las subidas aprobadas. |
| `asi` | `{FUE: n, DES: n, …}` | DM | Mejoras de característica acumuladas. |
| `feats` | `{id, ab?, save?}[]` | DM | Dotes elegidas (ids de `FEATS` en `progresion.js`). |
| `picks` | `{cantrips: [], fury: []}` | DM | Trucos y técnicas elegidos al subir. |
| `ok` | string[] | DM | Rasgos marcados "Revisar" que el DM aprobó. |
| `hist` | objeto[] | DM | Historial de subidas: `{from, to, at, die, hp, asi, feat, picks, fury, ok}`. |
| `maxHp` | número | DM | PV máximos calculados al aprobar (los lee `dm.html`). |
| `event` | `{id, from, to, rej?}` o `null` | DM | Subida en curso. `rej: true` = el DM rechazó la propuesta y el jugador debe rehacerla. |
| `pending` | objeto o `null` | **Jugador** (solo para el `event` en curso) | Propuesta del jugador (ver 4.5). |
| `prestige` | número ≥ 0 | DM | Puntos de prestigio. |
| `plog` | objeto[] | DM | Historial de prestigio, el más nuevo primero, hasta 30: `{at, n, r, note}`. `n` = cambio (+1, −1, −costo). `r` = rareza si fue compra: 1 Poco común, 2 Raro, 3 Muy raro, 4 Legendario, 5 Común; 0 = sin rareza. |
| `haki` | string[] | DM | Avances de Haki comprados (ids de `HAKI`). |
| `hakiN` | `{idHaki: número}` | DM | Número fijo que reemplaza a la Voluntad en avances que la usaban. |
| `king` | boolean | DM | "Cualidades de un rey": habilita comprar Haki del Rey Supremo. |
| `buy` | `{id, st, at, note?}` o `null` | **Jugador** (crea y cancela) y DM (responde) | Solicitud de compra en la tienda. `st`: `"pend"`, `"ok"` o `"no"`. |
| `grants` | objeto[] | DM | Entregas de dinero u objetos, la más nueva primero, hasta 30: `{id, at, m, n, q, note}` (ver 4.8). |
| `furyOpen` | número (fecha) | DM | El DM permitió cambiar las técnicas de furia. |

Ejemplo:

```json
{
  "level": 8, "hpDice": 9, "asi": { "FUE": 2 }, "feats": [], "picks": { "cantrips": [], "fury": [] }, "ok": [],
  "hist": [ { "from": 7, "to": 8, "at": 1761700000000, "die": 9, "hp": 13, "asi": { "FUE": 2 }, "feat": null, "picks": { "cantrips": [], "fury": [] }, "fury": [], "ok": [] } ],
  "maxHp": 88, "event": null, "pending": null,
  "prestige": 3,
  "plog": [ { "at": 1761800000000, "n": 1, "r": 0, "note": "" } ],
  "haki": [], "hakiN": {}, "king": false,
  "buy": { "id": "auraDetection", "st": "pend", "at": 1761900000000 },
  "grants": [ { "id": "mf3k2a9x", "at": 1761950000000, "m": 50000, "n": "Pop Green Meteor Plant", "q": 2, "note": "Botín" } ],
  "furyOpen": 0
}
```

- **Escribe**:
  - El DM desde Mesa (`index.html`): casi siempre con `setDoc` + `merge` (solo los campos que cambia). **Al aprobar una subida** escribe el **documento completo sin `merge`**: cualquier campo que la app no conozca se pierde en ese momento.
  - El jugador: `pending` al enviar su subida y `buy` al pedir o cancelar una compra.
- **Lee**: el jugador de ese personaje (escucha su documento) y el DM (escucha toda la colección, en Mesa y en `dm.html`). La app guarda una copia en el teléfono (`mc:prog`) y valida cada campo al leer (tipos, rangos, ids que existan en `HAKI`, `FEATS`, `SPELLS`).

### 3.5 `combat/live`

Lo que **todos los jugadores con cuenta** ven del combate. Lo publica `dm.html` (con sesión de DM) en cada cambio, con unos 250 ms de espera. **No lleva nombres, PV ni CA de enemigos.**

| Campo | Tipo | Significado |
|---|---|---|
| `active` | boolean | Hay combate en curso. `false` = la barra de combate desaparece en todos los teléfonos. |
| `round` | número ≥ 1 | Ronda. |
| `turnId` | número | **Sube en 1 en cada cambio de turno**. Cada teléfono avisa una sola vez por valor (ver 4.2). |
| `cur` | `{kind, char, name}` o `null` | De quién es el turno. |
| `next` | `{kind, char, name}` o `null` | Quién sigue (salta enemigos y aliados a 0 PV; los jugadores a 0 PV no se saltan). |
| `fallen` | `{char, kind, name, st}[]` | Jugadores y mascotas caídos ahora. `st`: `"down"`, `"stable"` o `"dead"`. |
| `alerts` | `{id, char, kind, name, ev, at}[]` | Últimos 5 avisos de caídos. `ev`: `"down"`, `"stable"`, `"up"`, `"dead"`. `id` y `at` = fecha. |
| `adv` | `{id, min}` o `null` | Último "Avanzar tiempo" del DM: `id` = fecha, `min` = minutos (1, 10 o 60). |
| `at` | número | Fecha de la publicación. |

`kind`: `"pc"` (jugador), `"pet"` (mascota de un jugador; `char` = el dueño), `"ally"` (aliado sin dueño; `char` = `null`) o `"foe"` (enemigo; `char` = `null` y `name` = `""`).

Ejemplo:

```json
{
  "active": true, "round": 3, "turnId": 42,
  "cur": { "kind": "pc", "char": "kalgo", "name": "Kalgo" },
  "next": { "kind": "foe", "char": null, "name": "" },
  "fallen": [ { "char": "sungsopp", "kind": "pet", "name": "Fluffy", "st": "down" } ],
  "alerts": [ { "id": 1762000000000, "char": "sungsopp", "kind": "pet", "name": "Fluffy", "ev": "down", "at": 1762000000000 } ],
  "adv": { "id": 1761990000000, "min": 10 },
  "at": 1762000000500
}
```

- **Escribe**: solo el DM (`dm.html`).
- **Lee**: cualquier usuario con sesión **y** con documento en `players` (todos los jugadores), y el DM.

### 3.6 `combat/dm`

El combate **completo** del DM (con enemigos, PV y CA). Sirve para que varios dispositivos del DM compartan el mismo combate: gana el que tenga `at` más nuevo.

```json
{ "S": { …estado del panel… }, "at": 1762000000500 }
```

`S`:

| Campo | Tipo | Significado |
|---|---|---|
| `list` | criatura[] | Todas las criaturas del combate. |
| `cur` | string o `null` | `id` de la criatura con el turno. |
| `round` | número | Ronda. |
| `active` | boolean | Combate en curso. |
| `turnId` | número | Contador de turnos (el mismo que se publica en `combat/live`). |
| `v` | número | Versión de las migraciones (hoy 7). No bajarla: volverían a correr. |
| `at` | número | Última modificación. |
| `fall` | `{clave: "down" \| "stable" \| "dead"}` | Caídos. Clave: `"kalgo"` o `"pet:sungsopp"`. |
| `alerts` | objeto[] | Los mismos avisos que se publican. |
| `adv` | `{id, min}` | Último Avanzar tiempo. |

Criatura de `list`:

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | Id propio (`"c" + base36`). |
| `name` | string | Nombre. |
| `type` | `"pc"`, `"foe"`, `"ally"` | Jugador, enemigo o aliado. |
| `char` | string (solo `pc`) | Id del personaje enlazado. |
| `owner` | string (aliados) | Nombre del dueño (Fluffy: `"Sungsopp"`): lo enlaza como mascota. |
| `init` | número o `null` | Iniciativa (orden de mayor a menor; empate: orden de la lista). |
| `ac` | número | CA. |
| `max` | número o `null` | PV máximos (`null` = hoja pendiente). |
| `hp`, `temp` | número | PV y PV temporales. Para jugadores con datos en vivo, `dm.html` muestra los de `state` en lugar de estos. |
| `conds` | string[] | Estados (los mismos nombres en español, más `"Concentrado"`). |
| `fx` | objeto[] | Efectos del DM sobre esa criatura (ver 4.4). |

- **Escribe** y **lee**: solo el DM. **Nunca** debe llegar a los jugadores (tiene PV, CA y nombres de enemigos).

---

## 4. Flujos en tiempo real

Todas las apps usan escuchas en vivo (`onSnapshot`). Resumen de quién escucha qué:

| App | Escucha |
|---|---|
| Jugador (`index.html`) | `players/{su uid}`, `state/{su personaje}`, `progress/{su personaje}`, `combat/live` |
| DM en Mesa (`index.html`) | `players` (colección), `state` (colección), `progress` (colección), `combat/live` |
| `dm.html` con sesión de DM | `combat/dm`, `state` (colección), `progress` (colección) |

### 4.1 Asignar un personaje

1. El jugador inicia sesión por primera vez; su app crea `players/{uid}` con `char: null` y le muestra "esperando al DM".
2. El DM escribe `players/{uid}.char = "<personaje>"` (solo ese campo).
3. La app del jugador, que escucha su documento, abre esa ficha al instante y empieza a escuchar `state` y `progress` de ese personaje.
4. Para quitar el personaje: `char = null`. Cada cuenta tiene **un solo** personaje.

### 4.2 Turnos y "¡Es tu turno!"

El DM controla el orden; los teléfonos reaccionan a `combat/live`.

- **Cambiar de turno**: actualizar `cur`, `next`, `round` y **sumar 1 a `turnId`**, con `active: true`.
- En cada teléfono, cuando llega un `turnId` distinto al último que avisó (`mc:turnseen`, comparación por **igualdad**):
  - si `cur` es su personaje (`kind: "pc"`): aviso grande "¡Es tu turno, X!", la app reinicia acción, acción adicional, reacción, reacciones especiales y efectos por turno (lo mismo que tocar "Nuevo turno"), vibra y baja a la sección Acción;
  - si `cur` es su mascota (`kind: "pet"`, `char` = su personaje): "Turno de Fluffy", sin reiniciar al dueño;
  - si `next` es su personaje o mascota: "Prepárate, vas después de X".
- **Fin del turno**: cuando el turno estaba en su personaje y llega otro `turnId` con otro `cur`, el teléfono cierra su turno (efectos "hasta el final de tu turno", pregunta de la Emoción del combate, agotamiento de Sulong).
- **Terminar el combate**: `active: false` (la barra desaparece en todos).
- **Importante**: nunca reiniciar `turnId` a 0 ni repetir un valor ya usado. Si se repite el valor guardado en un teléfono, ese teléfono no avisa. Al empezar a publicar desde una app nueva, leer el `turnId` actual y seguir desde ahí.

### 4.3 Daño, curación y PV temporales

- **Los PV de cada jugador los maneja su teléfono**: el jugador toca Daño, Curar o Temp., y la app aplica resistencias, inmunidades, reducciones, PV temporales, formas, frenesí y concentración, y escribe `state.hp` y `state.temp`.
- `dm.html` **no cambia** los PV de un jugador con datos en vivo: muestra `state.hp`, `state.temp`, `state.conds` y `state.maxHp`, y oculta sus controles. Los PV de Fluffy salen de `state/sungsopp.comp`.
- Enemigos, aliados sin dueño y jugadores sin datos en vivo: los maneja el DM en `combat/dm`. El daño va primero a los PV temporales; los temporales no se acumulan (queda el mayor); la curación no pasa del máximo.
- **Si una app nueva necesita cambiar los PV de un jugador**: escribir solo los campos que cambian (`updateDoc(state/x, {hp, temp})` o `setDoc` con `merge`) y con el **tipo correcto** (números enteros). Tener en cuenta que el teléfono del jugador sobrescribe el documento completo en su siguiente guardado: si guarda dentro del mismo segundo, el cambio del DM se pierde (gana el último en guardar). No hay resistencias calculadas del lado del DM.
- **PV máximos**: tomar `state.maxHp` (lo calcula la app en cada guardado) o `progress.maxHp` (al aprobar una subida). `dm.html` actualiza su `max` con esos valores.

### 4.4 Estados y efectos con duración

- **Estados del jugador**: `state.conds` (nombres en español) y `state.exh` (0–6). Los cambia el jugador desde el botón Estados de su ficha.
- **Efectos del jugador** (`state.fx`), cada uno `{id, t, k?, src?, cid?, n?, left?, ends?, min?}`:
  - `t: "r"`: rondas (`left`), bajan al inicio de su turno; 1 minuto = 10 rondas.
  - `t: "start"`: hasta el inicio de su próximo turno.
  - `t: "end"`: hasta el final de su próximo turno (`ends`: cuántos finales de turno faltan).
  - `t: "conc"`: mientras se concentre (`cid` = id de la concentración).
  - `t: "long"`: horas o minutos (`min`), terminan a mano, con descanso o con Avanzar tiempo.
  - `t: "until"`: mientras dure otro rasgo (`k`, por ejemplo `"until:frenzy"`).
  - `k` indica el estado propio que apaga al vencer (`hard`, `frenzy`, `trans`, `float`, `stage`, `muscle`, `rampage`, `form`, `conc`); `src: "a:<xid>"` indica la acción que lo creó; `n` es el nombre si no sale de otro lado.
  - Los maneja **solo** el teléfono del jugador. El DM los ve en vivo.
- **Efectos del DM** (`combat/dm`, `list[i].fx`), cada uno `{id, n, t, left?, ends?, own, cond?}`: `t` puede ser `"r"`, `"start"`, `"end"` o `"txt"` (sin límite); `own` = id de la criatura en cuyo turno cuenta; `cond` = estado que se quita al terminar.
- **Avanzar tiempo**: el DM publica `combat/live.adv = {id: Date.now(), min}` (1, 10 o 60). Cada teléfono lo aplica **una vez** (`mc:advseen`) y solo si tiene menos de 1 hora: descuenta sus efectos y avisa qué se terminó. Funciona también sin combate activo.

### 4.5 Subida de nivel (`event` → `pending` → aprobar o rechazar)

1. **DM**: escribe `progress/{p}.event = {id, from, to}` (`id` = texto único corto, por ejemplo base36 de la fecha más algo aleatorio, máx. 20 caracteres; `to = from + 1`). No se abre si ya hay `event` o `pending`, o si está en nivel 20.
2. **Jugador**: su teléfono ve el `event`, muestra la celebración una vez (`mc:lvseen`) y abre el asistente. Al enviar, escribe solo `pending`:

   ```json
   {
     "eventId": "mf3k2a9xq1", "from": 7, "to": 8,
     "die": 9, "mode": "roll",
     "asi": { "FUE": 2 }, "feat": null,
     "picks": { "cantrips": [], "fury": [] }, "fury": ["bruteForce", "focused", "keepGoing"],
     "at": 1762000000000
   }
   ```

   `die`: resultado del dado de PV (1–12; en promedio, el promedio del libro), `mode`: `"roll"` o `"avg"`, `asi` (+2 a una o +1 a dos) **o** `feat` (`{id, ab?, save?}`), `picks.cantrips` (trucos nuevos de Priest), `fury` (técnicas de furia de un Bruiser tras la subida). Las reglas solo lo aceptan si `pending.eventId == event.id`.
3. **DM** revisa y:
   - **Aprueba**: escribe el documento completo con `level = to`, `hpDice += die`, `asi` acumulado, `feats`, `picks`, `ok`, una entrada nueva en `hist`, `maxHp` recalculado, `event: null` y `pending: null`. El DM puede quitar la mejora, la dote o las elecciones y cambiar el dado antes de aprobar.
   - **Rechaza**: `pending: null` y `event.rej = true` (el jugador rehace la propuesta).
   - **Anula** una subida sin propuesta: `event: null`.
4. Al ver el nivel nuevo, el teléfono del jugador sube los PV actuales y los recursos en lo que creció su máximo, renueva los puntos de sueño y agrega los trucos (aunque estuviera cerrado: lo hace al abrir la ficha). Las técnicas de furia aprobadas pasan a `state.fury`.

Calcular la ficha del nivel nuevo (PV, salvaciones, bonos) requiere el motor de `index.html` (`levelSrc`) con las tablas de `progresion.js`. Una app nueva que no lo reproduzca debe limitarse a mostrar y aprobar, y tomar `maxHp` de lo que escriba la app (ver sección 5).

### 4.6 Prestigio (solo el DM)

- Vive en `progress/{p}.prestige` y `progress/{p}.plog`. El jugador **no** puede escribirlo (ni en `progress` ni en `state`).
- Dar o quitar: `prestige = actual + n` (nunca negativo) y agregar `{at, n, r: 0, note}` al inicio de `plog` (máximo 30).
- Comprar un avance a mano: `n = −costo` y `r` = código de rareza. Costos de la casa: **Común 1 · Poco común 1 · Raro 2 · Muy raro 3 · Legendario 5**.
- El teléfono del jugador muestra el aviso ("El DM te dio 1 de prestigio · Ahora tienes 3") comparando con su copia `mc:prog`, también si estaba cerrado.

### 4.7 Solicitudes de la tienda de prestigio (Haki)

1. **Jugador** pide un avance: `progress/{p}.buy = {id: "<id de HAKI>", st: "pend", at}`. Puede cancelar con `buy: null`. La app solo deja pedir si alcanzan los puntos y se cumplen los requisitos.
2. **DM**:
   - **Aprueba**: en una sola escritura, `prestige -= costo`, nueva entrada en `plog` (`n: −costo`, `r`: rareza, `note`: nombre del avance), agrega el id a `haki`, opcionalmente fija `hakiN[id]` (avances que usaban Voluntad) y pone `buy = {id, st: "ok", at: ahora, note}`.
   - **Rechaza**: `buy = {id, st: "no", at: ahora, note}` (sin tocar puntos).
3. El jugador ve el aviso de respuesta una vez (`mc:buyseen`, clave `at + st`). El avance aprobado aparece solo en su ficha.

### 4.8 Inventario y dinero

- **No hay fondo común**: cada personaje tiene su `state.inv` (`money` y `items`) y su historial `state.ilog`.
- El jugador lo cambia en su teléfono (Ganar, Gastar, agregar, editar; los consumibles bajan solos al usarse).
- **El DM da o quita** sin tocar `state`: agrega una entrega al **inicio** de `progress/{p}.grants` (máximo 30):

  ```json
  { "id": "mf3k2a9x", "at": 1762000000000, "m": -2000, "n": "Balas de pistola", "q": 10, "note": "Compra" }
  ```

  `id`: único (texto, máx. 20), `m`: berries (positivo da, negativo quita), `n`: nombre del objeto (opcional, se busca por nombre en español o inglés), `q`: cantidad (positiva da, negativa quita; `0` si no hay objeto), `note`: nota opcional.
- El teléfono del jugador aplica cada entrega **una sola vez** (guarda su `id` en `state.gotG`), también si estaba cerrado, la anota en `ilog` como `"DM"` y avisa en segunda persona. Si el objeto no existe y `q > 0`, lo agrega; si se quita todo, desaparece (salvo los consumibles, que quedan en 0). El dinero nunca baja de 0.

### 4.9 Aviso de caídos (0 PV)

- **Quién lo detecta**: solo `dm.html` con sesión de DM. En cada lectura compara los PV de cada jugador y de Fluffy con la lectura anterior:
  - pasa de > 0 a ≤ 0 → `fall[clave] = "down"` y aviso `"down"`;
  - vuelve a > 0 → borra la clave y aviso `"up"`;
  - sigue a 0 y `state.ds.ok >= 3` → `"stable"`;
  - el DM toca **Confirmar muerte** dos veces → `"dead"`.
  - La primera lectura y el cambio entre datos locales y en vivo **no** avisan. Los cambios que hace el DM con su cuenta (`state.by` = uid del DM) tampoco.
- **Publica** en `combat/live`: `fallen` (estado actual) y `alerts` (los últimos 5, el más nuevo primero, `id` = `at` = `Date.now()`).
- **Cada teléfono** muestra cada aviso una sola vez (`mc:alertseen` guarda el `id` mayor visto) y solo si tiene **menos de 3 minutos**. El jugador caído lo ve en segunda persona.
- Solo se publican nombre, tipo y estado: nunca PV ni otros datos del `state`.

---

## 5. Definición de los personajes

### Dónde está

- **`CHARS`**: objeto dentro de `index.html` (`const CHARS = {` … `};`), con una entrada por personaje (`udon`, `codel`, `kalgo`, `sungsopp`, `ryuga`). No está en un archivo aparte. Es solo datos (sin funciones), así que se puede extraer descargando `index.html` y evaluando ese bloque. Ojo: si el formato del archivo cambia, la extracción puede romperse.
- **`personajes/*.md`**: las fichas en Markdown con las decisiones del DM. **No están en el repositorio**: hay que pedírselas al DM.
- La ficha de `CHARS` es la **base al nivel 7**. Lo que cambia con el nivel está escrito como plantilla:
  - `"=expr"` en números (por ejemplo `max: "=prof"`);
  - `"{expr}"` dentro de textos (por ejemplo `heal: "1d10+{lvl}"`).
  - Variables: `lvl`, `prof`, `FUE`, `DES`, `CON`, `INT`, `SAB`, `CAR` (modificadores), `apa` (ataques por acción) y columnas de la clase (`exec`, `scrap`, `sneak`, `fury`, `cd`, `cr`, `cantrips`) más `will`, `fdc`, `fatk` de la fruta.
- Textos bilingües como `{es, en}`. Tipos de daño, salvaciones y unidades simples (`"30 pies"`) se escriben solo en español.

### Valores base (nivel 7, competencia +3)

| Personaje | Clase · subclase | CA | PV máx. | Iniciativa | Notas |
|---|---|---|---|---|---|
| Udon | Warrior · Black Weapon | 15 | 66 | +1 | |
| Codel | Priest · Sky Domain | 18 | 62 | +2 | Fruta Mochi Mochi; con kairoseki (`state.sea`), CA 16 |
| Kalgo | Bruiser · Black Fist | 17 | 75 | +3 | Fruta Zushi Zushi |
| Sungsopp | Rogue · Dancing Duelist | 15 | 42 | +4 | Fruta Zoan; mascota Fluffy (CA 15, 68 PV) |
| Ryuga | Bruiser · Eastern Dragon | 19 | 89 | +4 | |

### Cómo leer cada número

| Dato | Campo en `CHARS` | Cómo obtener el valor actual |
|---|---|---|
| PV máximos | `maxHp` | **Usar `state.maxHp`** (o `progress.maxHp`). Fórmula del motor: base + `hpDice` + (nivel − 7) × mod. CON + (subida de mod. CON) × 7 + (dote Tough: 2 × nivel). |
| CA | `ac` | Fija con el nivel. Excepciones: kairoseki (`fruit.seaAC` si `state.sea`), forma Zoan activa (`forms[state.form].ac`), Escenario de batalla (`state.stageAC`). No se guarda en `state`. |
| Iniciativa | `init` | Base + subida del mod. DES + 5 con la dote Alert. |
| Salvaciones | `saves: {FUE: [bono, competente], …}` | Bono + subida del mod. + subida de competencia si es competente (o competencia nueva si una dote o rasgo la da). |
| Características | `scores` (puntuaciones) y `abil` (modificadores) | `scores` + `progress.asi` + dotes con `ab` (máx. 20); mod. = ⌊(puntuación − 10) / 2⌋. |
| Habilidades | `skills: {id: 1 \| 2}` | 1 competente, 2 pericia. Bono = mod. + competencia (× 2 con pericia). |
| Ataques | `weapons: {id: {name, hit, dice, mod, type, abil, …}}` y `actions` con `kind: "attack"` y `w: "<id del arma>"` | `hit` y `mod` **sin Haki** (el Endurecimiento suma solo mientras está activo). Al subir: + subida del mod. de `abil` y + subida de competencia. |
| Recursos | `resources: [{id, name, max, rest}]` | `max` puede ser plantilla. `rest`: `"short"`, `"long"` o `"none"`. Usos actuales en `state.res[id]`. |
| Acciones | `actions: [{cost, kind, name, note, res?, …}]` | `cost`: `"accion"`, `"adicional"`, `"reaccion"`, `"gratis"`, `"fuera"`. |
| Fruta | `fruit` | Voluntad = nivel + 2 × Fortalecerse; CD = 10 + ⌈Voluntad / 2⌉; ataque = 2 + ⌈Voluntad / 2⌉; cargas = nivel + competencia (`state.res.cargas`). |
| Defensas | `def: [{k, on, not, nm, fruit, only, muscle, n, src}]` | `k`: `res`, `imm`, `vul` o `red`. |
| Mascota | `companion` | PV, CA, ataques; estado en `state.comp`. |
| Inventario inicial | `inv` | El actual está en `state.inv`. |

Lo más seguro para una app nueva: mostrar los números que ya escribe la app de los jugadores (`state.maxHp`, `state.hp`, `state.res`, `progress.level`) y usar `CHARS` solo para lo que no está en Firestore (CA, nombres, ataques).

---

## 6. Reglas de Firestore

Copia exacta de lo publicado (Firebase → Firestore Database → Reglas):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isDM() { return signedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }
    function myChar() { return get(/databases/$(database)/documents/players/$(request.auth.uid)).data.char; }

    match /admins/{uid} {
      allow get: if signedIn() && request.auth.uid == uid;
    }

    match /players/{uid} {
      allow get: if isDM() || (signedIn() && request.auth.uid == uid);
      allow list: if isDM();
      allow update: if isDM()
        || (signedIn() && request.auth.uid == uid
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["look"]));
      allow create: if signedIn() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(["name", "email", "char", "look"])
        && request.resource.data.get("char", null) == null;
    }

    match /progress/{charId} {
      function mine() { return signedIn() && exists(/databases/$(database)/documents/players/$(request.auth.uid)) && myChar() == charId; }
      allow read: if isDM() || mine();
      allow delete: if isDM();
      allow create: if isDM()
        || (mine() && request.resource.data.keys().hasOnly(["buy"]) && request.resource.data.buy.st == "pend");
      allow update: if isDM()
        || (mine()
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["pending"])
            && resource.data.get("event", null) != null
            && request.resource.data.pending.eventId == resource.data.event.id)
        || (mine()
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(["buy"])
            && (request.resource.data.get("buy", null) == null || request.resource.data.buy.st == "pend"));
    }

    match /combat/{docId} {
      allow read: if isDM()
        || (docId == "live" && signedIn() && exists(/databases/$(database)/documents/players/$(request.auth.uid)));
      allow write: if isDM();
    }

    match /state/{charId} {
      function mine() { return signedIn() && exists(/databases/$(database)/documents/players/$(request.auth.uid)) && myChar() == charId; }
      allow read, delete: if isDM() || mine();
      allow create, update: if isDM()
        || (mine() && !request.resource.data.keys().hasAny(["prestige", "plog"]));
    }
  }
}
```

### Explicación, regla por regla

- **Funciones**:
  - `signedIn()`: hay sesión.
  - `isDM()`: hay sesión y existe `admins/{uid}`.
  - `myChar()`: el `char` del documento `players/{uid}` del usuario.
- **`admins/{uid}`**: cada uno puede leer **solo su propio** documento (para saber si es DM). Nadie puede listar, crear, cambiar ni borrar desde una app (no hay `allow write`): solo la consola.
- **`players/{uid}`**:
  - Leer uno: el DM o el dueño. Listar la colección: solo el DM.
  - Crear: solo el dueño, solo con los campos `name`, `email`, `char` y `look`, y con `char` vacío. Así un jugador no puede asignarse un personaje.
  - Actualizar: el DM cualquier campo; el dueño **solo `look`**.
  - Borrar: nadie desde la app.
- **`progress/{charId}`**:
  - `mine()`: el usuario tiene documento en `players` y su `char` es este personaje.
  - Leer: el DM o el jugador de ese personaje.
  - Borrar: solo el DM.
  - Crear: el DM; o el jugador, solo si el documento lleva únicamente `buy` en estado `"pend"` (primera solicitud de compra cuando todavía no hay progreso).
  - Actualizar: el DM cualquier campo; o el jugador, **solo `pending`** cuando hay un `event` y el `eventId` coincide con su id; o **solo `buy`**, para pedir (`"pend"`) o cancelar (`null`). El jugador no puede tocar `prestige`, `plog`, `level`, `haki`, `grants`, etc.
- **`combat/{docId}`**:
  - Leer `combat/live`: cualquier usuario con sesión que tenga documento en `players`. Leer cualquier otro documento de `combat` (incluido `combat/dm`): solo el DM.
  - Escribir: solo el DM.
- **`state/{charId}`**:
  - Leer y borrar: el DM o el jugador de ese personaje. Un jugador **no puede leer el estado de otro**.
  - Crear y actualizar: el DM; o el jugador de ese personaje, siempre que el documento no tenga los campos `prestige` ni `plog`.
- **Todo lo demás está prohibido**: cualquier colección o documento sin `match` no se puede leer ni escribir.

### Lo que una app nueva NO debe hacer

- **No exponer `combat/dm` a los jugadores**, ni copiar nombres, PV o CA de enemigos a `combat/live` o a otro documento que lean los jugadores. Los enemigos van en `combat/live` como `{kind: "foe", char: null, name: ""}`.
- **No mostrar ni copiar el `state` de un personaje a otro jugador** (ni en `combat/live`, ni en avisos). Solo nombre, tipo y estado de caído.
- **No aflojar las reglas** para que los jugadores escriban `prestige`, `plog`, `level`, `haki`, `grants`, `char` o `admins`, ni para que lean `players` de otros (tiene correos).
- **No crear `admins/{uid}` desde código** ni basar el permiso de DM en otra cosa que ese documento.
- **No escribir campos propios** en `state` ni en `progress`: el teléfono del jugador reescribe `state` completo y la aprobación de nivel reescribe `progress` completo, así que se perderían. Si hace falta guardar algo nuevo, usar otra colección y **agregarle su regla** en la consola (y en `firestore.rules`).
- **No escribir tipos distintos** a los de esta guía: al leer, la app reemplaza por el valor predeterminado cualquier campo con tipo incorrecto (por ejemplo, `hp: "40"` como texto haría que el jugador vuelva a tener los PV llenos).
- **No reiniciar `turnId`** ni bajar `S.v` en `combat/dm`.
- **No meter HTML** en textos que lean los jugadores (`name`, `note`): la app escapa la mayoría, pero `state.log` admite `<b>`.
- **No publicar** `libros/`, `personajes/` ni datos personales en el repositorio público.

---

## 7. Compatibilidad

### Nombres y formatos que no deben cambiar

- Colecciones y documentos: `admins`, `players`, `state`, `progress`, `combat/live`, `combat/dm`.
- Ids de personaje: `udon`, `codel`, `kalgo`, `sungsopp`, `ryuga` (en minúsculas).
- Estados en español (`Agarrado`, `Derribado`…), no en inglés.
- Fechas en milisegundos (`Date.now()`), salvo `state.at` (`serverTimestamp`).
- `kind` de `combat/live`: `pc`, `pet`, `ally`, `foe`. Estados de caído: `down`, `stable`, `up` (solo en avisos), `dead`.
- `buy.st`: `pend`, `ok`, `no`. `pending.mode`: `roll`, `avg`. Códigos de rareza en `plog.r`: 1 Poco común, 2 Raro, 3 Muy raro, 4 Legendario, 5 Común.
- Listas con orden "el más nuevo primero" y su límite: `plog` 30, `grants` 30, `alerts` 5, `ilog` 60, `hist` (el más viejo primero) 20.
- Validaciones de la app al leer (si se excede, se descarta o se recorta): `progress.level` 7–20, `prestige` 0–9999, textos de notas hasta 80 caracteres (`buy.note` hasta 120), nombres hasta 40–60, `adv.min` 1–1440, avisos con `at` de menos de 3 minutos.

### Claves de `localStorage`

`localStorage` es **por origen**. Todas las páginas de `https://strangeninja.github.io` (incluidas las de **otros repositorios** de la misma cuenta) comparten el mismo almacenamiento. Si la app nueva se publica ahí, **debe usar un prefijo propio** y no tocar estas claves:

| Clave | Página | Contenido |
|---|---|---|
| `mc:look` | `index.html` y `dm.html` (compartida) | Apariencia `{pal, mode, dice, lang, quick}`. |
| `dm:combat2` | `dm.html` | Combate completo (igual que `combat/dm.S`). |
| `mc2:<personaje>` | `index.html` | Estado del personaje en este teléfono (igual que `state/<personaje>`). |
| `mc:cur` | `index.html` | Último personaje abierto. |
| `mc:acct` | `index.html` | Personaje del último jugador que entró (para abrir sin conexión). Se borra al cerrar sesión. |
| `mc:dirty` | `index.html` | Personaje con cambios hechos sin conexión, pendientes de subir. |
| `mc:prog` | `index.html` | Copia local de `progress` de cada personaje. |
| `mc:lvseen` | `index.html` | Ids de subidas ya celebradas. |
| `mc:turnseen` | `index.html` | Último `turnId` avisado. |
| `mc:alertseen` | `index.html` | `id` del último aviso de caídos visto. |
| `mc:advseen` | `index.html` | `id` del último Avanzar tiempo aplicado. |
| `mc:buyseen` | `index.html` | Última respuesta de compra avisada. |

Además, IndexedDB guarda la caché de Firestore (la crea el SDK).

### Despliegue

- GitHub Pages publica la rama `main`, carpeta raíz, en https://strangeninja.github.io/one-piece-dnd/. Se actualiza sola uno o dos minutos después de cada `git push`.
- Para publicar: `git add -A`, `git commit` y `git push`. Solo se suben los archivos permitidos en `.gitignore`.
- Versión visible: al final de Ajustes aparece "Versión AAAA-MM-DD HH:MM" (`APP_VERSION` en las dos páginas). La escribe el hook local `.git/hooks/pre-commit` con la fecha y hora del commit. El hook no viaja con el repositorio: si se publica desde otra PC sin copiarlo, la versión no cambia.
- Los commits usan el correo `StrangeNinja@users.noreply.github.com` para no mostrar el correo personal.
- Las reglas de Firestore **no se despliegan con git**: se pegan a mano en la consola de Firebase. Mantener `firestore.rules` (en la PC del DM) igual a lo publicado.
- Si la app nueva vive en otro repositorio o dominio: agregar el dominio a los autorizados de Authentication, usar la misma `firebaseConfig` y, si hace falta, las mismas versiones del SDK (10.12.2) para no mezclar formatos de caché en el mismo origen.
