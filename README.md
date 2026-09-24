# Proletarian Coin — demo local

PLC conserva el frontend HTML/CSS y añade una API de desarrollo para simular saldo, envíos, recepciones, historial, detalle y recargas. **No es una criptomoneda desplegada, una billetera custodial ni un servicio de pagos.** Todos los PLC son ficticios. No ingreses datos personales, contraseñas, datos bancarios reales, direcciones Ethereum reales ni frases semilla.

## Inicio rápido

Requisito: Node.js 22 o superior con npm. No hay dependencias npm externas ni proceso de compilación.

```sh
git clone https://github.com/ddepazos/plc.git
cd plc
npm start
```

Abre `http://127.0.0.1:3000` y selecciona **Entrar a la demo**. También puedes abrir `http://127.0.0.1:3000/pages/dashboard.html`. No hace falta `npm install`: se usan exclusivamente módulos incluidos en Node.js. Las fuentes de Google son opcionales; si no hay conexión, el navegador usa fuentes de respaldo. JavaScript ya no depende del CDN de jQuery.

```sh
npm test
```

Las pruebas crean archivos temporales aislados y no modifican tu demo. Para detener el servidor, presiona Ctrl+C. Ejecuta **un solo proceso por archivo de persistencia**; la cola de escritura es por proceso, no distribuida.

### Configuración

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP; usa otro si está ocupado. |
| `PLC_DATA_FILE` | `backend/storage/demo.json` | Archivo JSON de desarrollo; las rutas relativas se resuelven desde el directorio de ejecución. |

El host está fijado a `127.0.0.1` para que la demo no se publique accidentalmente en la red. No existe modo producción. No se lee `.env` automáticamente; configura variables en el entorno antes de iniciar.

PowerShell:

```powershell
$env:PORT = '3001'
$env:PLC_DATA_FILE = Join-Path (Get-Location) 'backend/storage/otra-demo.json'
npm start
```

macOS/Linux:

```sh
PORT=3001 PLC_DATA_FILE=backend/storage/otra-demo.json npm start
```

Para empezar otra simulación, detén el servidor y cambia `PLC_DATA_FILE` a una ruta nueva. Para reiniciar la habitual, conserva una copia y renombra `backend/storage/demo.json` con el servidor detenido; el siguiente inicio vuelve a usar el seed. Nunca edites el archivo mientras el servidor está activo.

## Arquitectura

```mermaid
flowchart LR
  UI[HTML + CSS + main.js] -->|HTTP mismo origen| API[server.js + routes/api.js]
  API --> VALID[models/transaction.js]
  API --> WALLET[services/wallet.js]
  WALLET --> STORE[services/store.js · cola serial]
  STORE --> DISK[storage/demo.json]
  SEED[data/plc-demo.json] -->|primer inicio| STORE
  SEED -->|API inaccesible al cargar: solo lectura| UI
```

El servidor también entrega los archivos públicos. No necesitas dos servidores ni CORS. El cliente consulta el estado al entrar en cada pantalla y al volver a enfocar la ventana, y lo refresca después de una operación. No hay WebSocket ni sincronización continua entre pestañas.

### Árbol y función de cada archivo

```text
plc/
├── .gitignore                  # excluye persistencia, secretos, logs y node_modules
├── package.json                # Node >=22; comandos start y test; sin dependencias
├── README.md                   # contrato y guía de ejecución del proyecto
├── index.html                  # portada, comunidad y FAQ de la demo
├── assets/
│   ├── css/styles.css          # identidad visual original, responsive, foco y estados
│   └── js/main.js              # API, render seguro, formularios, fallback y navegación
├── data/plc-demo.json           # seed ficticio original; no se modifica al operar
├── pages/
│   ├── login.html              # acceso explícito a demo; no pide credenciales
│   ├── dashboard.html          # saldo actual y tres movimientos recientes
│   ├── wallet.html             # dirección ficticia, copia y recepción simulada
│   ├── enviar.html             # destinatario demo, monto, nota y saldo máximo
│   ├── cargar.html             # recarga genérica bancaria o Ethereum ficticia
│   ├── historial.html          # movimientos y filtro de búsqueda local
│   ├── detalle.html            # detalle por id; estado claro si no existe
│   └── perfil.html             # perfil seed de solo lectura; seguridad no implementada
├── backend/
│   ├── config.js               # rutas absolutas, entorno, host y límite de cuerpo
│   ├── server.js               # HTTP, cabeceras, origen, archivos públicos y errores
│   ├── models/transaction.js   # ApiError, validación, centésimas y creación de transacción
│   ├── routes/api.js           # GET/POST, lectura limitada del cuerpo y rutas de API
│   ├── services/
│   │   ├── store.js            # seed, cola, copia de estado y guardado temporal + rename
│   │   └── wallet.js           # saldo, idempotencia, operaciones y representación pública
│   ├── storage/
│   │   ├── .gitkeep            # conserva la carpeta vacía en Git
│   │   └── demo.json           # generado localmente e ignorado por Git
│   └── test/api.test.js        # pruebas integradas de API, persistencia y enlaces
└── docs/
    ├── plc-arquitectura.drawio # diagrama previo conservado como referencia histórica
    ├── demo-arquitectura.drawio # nuevo diagrama editable de la implementación actual
    ├── arquitectura.md        # decisiones, modelo, consistencia y límites
    ├── interacciones.md       # contrato de cada interacción frontend/backend y Figma
    ├── verificacion.md        # evidencia de pruebas y lista de comprobación visual
    └── cambios.md             # inventario exacto de archivos creados y modificados
```

## Endpoints

Todas las respuestas de API son JSON. Las operaciones exitosas responden HTTP 200. Los errores tienen forma `{"error":"mensaje"}`. La API usa una única cuenta ficticia compartida por los navegadores que acceden a ese proceso.

| Método | Ruta | Entrada / respuesta |
| --- | --- | --- |
| GET | `/api/health` | `{status:"ok",mode:"demo"}` |
| GET | `/api/state` | `{meta, users:[user], transactions:[transaction]}`; snapshot para la UI |
| GET | `/api/wallet` | Usuario ficticio y saldo PLC |
| GET | `/api/transactions` | Lista completa, movimiento nuevo primero |
| GET | `/api/transactions/:id` | Una transacción; 404 si no existe |
| POST | `/api/send` | `{amount, recipient, note?}`; debita saldo |
| POST | `/api/receive` | `{amount}`; simula crédito recibido |
| POST | `/api/topups` | `{amount, method}`; `bank` o `ethereum`; acredita PLC ficticios |

Cada POST requiere `Content-Type: application/json` e `Idempotency-Key` de 16–100 caracteres alfanuméricos o guiones. El frontend genera una UUID. Una clave repetida con la misma operación devuelve la misma transacción con `replayed:true`; si cambia la operación, responde 409. Las claves confirmadas se conservan en el archivo sin expiración; esto debe rediseñarse antes de escalar.

Ejemplo con el servidor iniciado (PowerShell):

```powershell
$headers = @{ 'Idempotency-Key' = [guid]::NewGuid().ToString() }
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/send' -Method Post `
  -ContentType 'application/json' -Headers $headers `
  -Body '{"amount":"25.10","recipient":"PLC-DEMO-DESTINO","note":"Ensayo"}'
```

Respuesta: `{transaction:{id,userId,type,amount,date,status,reference,recipient?,method?,note?,demo},replayed:false}`. La nota tiene máximo 140 caracteres. Solo se aceptan destinatarios ficticios `PLC-DEMO-` seguidos de 3–60 letras mayúsculas, dígitos o guiones; no se permite enviar a la misma dirección demo. El destinatario no representa otra cuenta mantenida por este servidor: el envío solo debita al usuario de demostración.

Montos positivos de 0,01 a 1.000.000 PLC, máximo dos decimales, sin notación científica. Saldo máximo: 10.000.000 PLC. Validación autoritativa en el backend, adicional a los límites del formulario. Cuerpo máximo: 8 KiB. Se rechazan campos desconocidos.

Errores: 400 validación/JSON/clave; 403 host u origen externo; 404 ruta/transacción/archivo; 405 método; 409 saldo, límite o clave reutilizada; 413 cuerpo excesivo; 415 tipo de contenido; 500 fallo interno o de guardado. Los fallos internos no revelan rutas ni trazas al navegador.

## Modelo de datos

- `user`: id, nombre/email ficticios, dirección `PLC-DEMO-*`, moneda, datos de seguridad ilustrativos y `balanceCents` interno. No hay contraseñas ni claves criptográficas.
- `transaction`: UUID (los seed conservan sus ids), userId, tipo `sent|received|topup`, `amountCents` entero, fecha ISO, estado `completed`, referencia demo y campos opcionales `recipient`, `method`, `note`; `demo:true`.
- Estado persistido: `{version:1,user,transactions,requests}`. `requests` relaciona clave de idempotencia con firma de operación e id de transacción.
- API/seed: usa `balance` y `amount` en PLC para compatibilidad con el frontend. El servicio convierte centésimas a PLC al responder.
- El saldo seed de **2.450 PLC** es un saldo inicial independiente: sus cuatro movimientos son ejemplos históricos, no un libro mayor completo que reconstruya ese saldo.

## Flujo frontend/backend

1. `main.js` consulta `/api/state`; muestra una banda permanente de demo.
2. Si falla la carga inicial de API, obtiene `data/plc-demo.json`, muestra **solo lectura** y deshabilita operaciones. No mezcla ni sincroniza saldos de localStorage; la antigua clave `plc-demo-state-v1` deja de usarse.
3. Enviar, recibir o recargar valida el formulario, bloquea doble clic y hace POST. No se acredita ni debita de manera optimista en el navegador.
4. El servidor valida, serializa cambios en una cola, comprueba idempotencia/saldo y guarda un snapshot temporal; solo publica el nuevo estado después del `rename` exitoso.
5. Envío abre el detalle por id; recepción/recarga vuelve a consultar el estado y ofrece enlace al detalle. No se hace fallback de una escritura a datos locales.
6. Un fallo de red al escribir conserva la clave en memoria para reintentar **en el mismo formulario, sin recargar y sin cambiar datos**. Si recargas o cambias de pestaña antes de resolver una respuesta incierta, revisa el historial antes de repetir: la clave pendiente no sobrevive a la recarga.
7. Historial filtra los movimientos ya descargados. Detalle usa su endpoint específico; nunca sustituye un id inexistente por otra transacción.

## Seguridad y alcance demo

- Servidor limitado a loopback, validación de Host/Origin y bloqueo de `Sec-Fetch-Site: cross-site`; sin CORS abierto.
- POST exige JSON y clave; límites de tamaño, montos y texto. Dinero ficticio calculado con enteros.
- Lista permitida de archivos estáticos: el servidor no publica `.git`, backend, persistencia o configuración.
- CSP, `nosniff`, `no-referrer`, `no-store` y protección contra marcos. Render de contenido dinámico con `textContent`, no HTML interpolado.
- Persistencia ignorada por Git; archivo temporal y cambio de nombre, sin garantizar durabilidad de base de datos ante cortes de energía. Un archivo ilegible bloquea el inicio: no se sustituye silenciosamente por seed.
- Sin autenticación, autorización multiusuario, cifrado de base de datos, rate limiting, auditoría inmutable ni defensa completa contra actores locales. **No publicar este servidor en Internet.**
- Banco: solo etiqueta genérica y referencia `DEMO-BANCO-001`, sin proveedor ni cuenta utilizable.
- Ethereum: solo opción de simulación; no RPC, MetaMask, contrato, red, firma, hash real, conversión ETH/PLC ni gas.
- Perfil y seguridad son información de demo, no funciones reales de cuenta. QR ficticio anterior retirado para no aparentar una dirección operativa.

## Documentación y Figma

Consulta [arquitectura](docs/arquitectura.md), [interacciones](docs/interacciones.md), [verificación](docs/verificacion.md) e [inventario de cambios](docs/cambios.md). Abre `docs/demo-arquitectura.drawio` en diagrams.net para editarlo; el archivo previo se conserva.

[Figma: Proletarian Coin — Demo e interacciones backend](https://www.figma.com/design/oO77Doeh7yNvOOfZCaPusV). Se creó el archivo en el equipo personal, pero **la carga de pantallas y anotaciones quedó bloqueada por el límite de llamadas de Figma Starter**. El archivo aún está vacío; la carpeta solicitada tampoco pudo crearse: la interfaz de Figma indica que crear más carpetas requiere el plan Profesional. `docs/interacciones.md` contiene el material preparado para completar esa entrega sin reinterpretar el backend.

## Próximos pasos

1. Completar pantallas y anotaciones en Figma cuando vuelva a estar disponible el conector.
2. Persistir claves pendientes en el cliente para recuperación entre recargas, y añadir paginación, límites de historial y control de tasa.
3. Migrar a SQLite/PostgreSQL con transacciones, migraciones y libro mayor de doble entrada antes de soportar cuentas múltiples.
4. Diseñar autenticación real, autorización por cuenta, gestión segura de sesiones y pruebas de seguridad.
5. Separar una eventual integración bancaria/blockchain en adaptadores auditados con entornos sandbox. Definir cumplimiento aplicable y operación antes de considerar dinero real.
6. Añadir CI, pruebas de navegador, monitoreo, respaldo y proceso de despliegue revisado. Esta demo no constituye esa plataforma de producción.
