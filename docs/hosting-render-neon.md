# PLC en Render + Neon: demo protegida

Esta guía describe **una sola instancia web gratuita de Render** que sirve el frontend y la API del repositorio, con una base PostgreSQL de **Neon**. El archivo raíz [`render.yaml`](../render.yaml) describe el servicio, pero no contiene credenciales. **Estado comprobado:** el proyecto gratuito `plc-demo` de Neon existe, su rama `production` contiene la base `neondb` y las seis tablas de PLC. El servicio Web Free `plc-demo` de Render existe en [https://plc-demo.onrender.com](https://plc-demo.onrender.com); el despliegue `b520071` registró la migración PostgreSQL y «Your service is live». Eso acredita el arranque, pero todavía falta comprobar desde el navegador cada operación de la demo. Todos los PLC y las recargas siguen siendo ficticios.

## Configuración existente y secretos

### Acceso desde GitHub Pages

La aplicación dinámica se abre en `https://plc-demo.onrender.com/pages/dashboard.html`. En `ddepazos.github.io/plc/`, `assets/js/main.js` identifica el alojamiento estático, muestra una banda con acceso a la demo conectada y dirige los enlaces de la billetera a Render. Pages carga únicamente el JSON de ejemplo y mantiene las operaciones desactivadas; no intenta llamar a una API inexistente en `github.io`. Frontend y API de la demo conectada comparten el origen de Render, con Basic Auth y sin CORS adicional. Una indisponibilidad de Render no debe presentarse como una operación guardada.

1. Usa el proyecto gratuito `plc-demo` ya creado en Neon, rama `production`, base `neondb`. El esquema de `plc_bd/schema.sql` ya se aplicó; el adaptador de PLC insertará el seed ficticio solo si la base permanece sin usuarios. No migra datos del JSON local a PostgreSQL. No conectes una base que tenga datos reales o ajenos a esta demo. En el panel de Neon, copia la cadena **directa** de conexión de esa rama para `DATABASE_URL`; conserva las opciones TLS que entregue Neon, incluido `sslmode=require`. La misma variable se usa para la migración y para la aplicación. Una conexión directa es suficiente para esta instancia pequeña; si más adelante se separan migraciones y tráfico, se podrán usar roles y URLs distintas.
2. Mantén una contraseña de **al menos 16 caracteres**, larga y exclusiva para `PLC_DEMO_PASSWORD`. El acceso público usa HTTP Basic con usuario fijo `demo`; comparte la contraseña solo con quienes deban probar la demo. No reutilices contraseñas personales.
3. Verifica en los paneles de ambos proveedores que el proyecto y el servicio estén en sus planes gratuitos y revisa los límites y ajustes de facturación de tus cuentas. `plan: free` en el Blueprint evita elegir un plan de cómputo pagado para este servicio, pero no garantiza que otros recursos o excesos de uso de la cuenta nunca generen cargos.

**No pegues** `DATABASE_URL` ni la contraseña en GitHub, incidencias, capturas o este documento. En un Blueprint nuevo, Render solicita ambas variables durante la creación inicial porque figuran como `sync: false`. En el servicio existente, añádelas o actualízalas manualmente en **Environment**: Render no vuelve a pedir valores `sync: false` en sincronizaciones posteriores. El servidor exige `DATABASE_URL` cuando `HOST=0.0.0.0`; si falta, no inicia con JSON efímero.

## Despliegue y comprobación en Render

1. En Render, revisa el servicio existente `plc-demo`: tipo **Web Service**, entorno Node, plan **Free** y URL [https://plc-demo.onrender.com](https://plc-demo.onrender.com). El Blueprint no declara una base Render Postgres: usa el proyecto de Neon descrito arriba.
2. En **Deploys**, identifica el despliegue `b520071`. Su registro ya mostró la migración PostgreSQL y «Your service is live». `render.yaml` instala `pg`, ejecuta `npm run db:migrate` y luego `npm start`. `schema.sql` usa `CREATE ... IF NOT EXISTS`, de modo que el esquema puede aplicarse otra vez tras un reinicio. Una falla de conexión o migración detiene el arranque.
3. Abre la URL pública en el navegador con el usuario `demo` y la contraseña configurada. El frontend y la API comparten origen. Comprueba saldo, recepción, envío, recarga ficticia, historial y detalle, y confirma que los cambios persisten en Neon. **Esta comprobación funcional aún está pendiente.** Las acciones cambian una sola billetera ficticia compartida; los participantes verán las operaciones de los demás.
4. Conserva `DATABASE_URL` y `PLC_DEMO_PASSWORD` únicamente en **Environment** de Render. No configures `PLC_DATA_FILE`: la persistencia de archivos del servicio es efímera.

### Despliegue automático pendiente

El servicio se creó desde la URL pública del repositorio. **No se ha verificado ni configurado el despliegue automático desde GitHub.** Según Render, un servicio que usa solo una URL pública de Git requiere despliegues manuales. Para habilitar auto-deploy, conecta GitHub como **Git provider** en la cuenta Render, concede acceso a `ddepazos/plc`, cambia la fuente del servicio a ese repositorio conectado y revisa que la rama sea `main`. Después selecciona **Settings → Auto-Deploy → On Commit** y verifica un despliegue nuevo contra el commit esperado. Si se usa **After CI Checks Pass**, debe existir al menos un check: con cero checks Render no inicia el despliegue.

**Blueprint Auto Sync** es independiente: controla cuándo Render aplica los cambios de `render.yaml`, mientras que **Auto-Deploy** controla los cambios de código del servicio. Comprueba ambos ajustes por separado. El manifiesto actual no fija `autoDeployTrigger`: Render usa `commit` para un servicio nuevo, pero conserva el valor existente de uno ya creado. La sincronización de un Blueprint puede sobrescribir cambios manuales que entren en conflicto con su configuración; revisa la fuente tras sincronizar.

Render proporciona `PORT` y `RENDER_EXTERNAL_URL` automáticamente. `HOST=0.0.0.0` permite que su proxy alcance el proceso. El backend usa `RENDER_EXTERNAL_URL` para validar el Host y el Origin públicos cuando no se define `PUBLIC_ORIGIN`. Si más adelante conectas un dominio personalizado, configura `PUBLIC_ORIGIN=https://tu-dominio` en el entorno de Render y comprueba de nuevo el chequeo de salud. Render envía el Host del dominio personalizado verificado en sus chequeos HTTP.

## Comprobación y solución de problemas

- `GET /api/health` debe devolver HTTP 200 sin credenciales; Render usa esa ruta para decidir si el servicio está listo. No expone la billetera.
- La portada y las rutas `/api/state`, `/api/wallet` y de operaciones requieren Basic Auth. Un HTTP 401 aquí indica credenciales ausentes o erróneas.
- Si el despliegue falla durante `db:migrate`, revisa la URL de Neon, permisos de creación de tablas, disponibilidad de la rama y el parámetro TLS. Usa el panel de Render para actualizar el secreto; no lo imprimas en registros.
- Si Render informa que no detecta un puerto abierto, confirma `HOST=0.0.0.0` y que la aplicación lee el `PORT` suministrado por Render.
- Si `/api/health` responde 403, comprueba `PUBLIC_ORIGIN`, el dominio verificado y el Host que aparece en la petición. El chequeo de Render usa el subdominio `onrender.com`, salvo que el servicio tenga un dominio personalizado verificado.
- Tras guardar secretos o cambiar de dominio, vuelve a desplegar y comprueba por separado el chequeo de salud y una petición del navegador. `PUBLIC_ORIGIN` debe ser una URL `https://` sin ruta, parámetros ni fragmento; el backend normaliza una barra final.

En el plan Free, Render puede suspender el proceso después de un periodo sin tráfico; la primera visita posterior puede tardar. Su sistema de archivos se pierde al reiniciar o volver a desplegar: **PostgreSQL es imprescindible para conservar el estado compartido**. Neon también tiene límites de uso propios; revísalos en su panel. Esta configuración es para aprendizaje y revisión privada, no para dinero real ni cuentas personales. Basic Auth controla quién entra a una demo compartida, pero no crea usuarios individuales ni sustituye la autenticación, autorización, auditoría y controles financieros que exigiría un producto real.

## Referencias oficiales

- [Render: Blueprint YAML, secretos `sync: false` y `plan: free`](https://render.com/docs/blueprint-spec)
- [Render: web services, Host `0.0.0.0` y `PORT`](https://render.com/docs/web-services)
- [Render: variables `RENDER_EXTERNAL_URL` y `RENDER_EXTERNAL_HOSTNAME`](https://render.com/docs/environment-variables)
- [Render: chequeos de salud y Host enviado](https://render.com/docs/health-checks)
- [Render: límites del servicio gratuito y sistema de archivos efímero](https://render.com/docs/free)
- [Render: migración previa solo en web services pagados](https://render.com/docs/deploys)
- [Render: Git provider y despliegue automático](https://render.com/docs/git-provider)
- [Render: Blueprint Auto Sync](https://render.com/docs/infrastructure-as-code)
- [Render: cambiar la fuente de un servicio existente](https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard)
- [Neon: ramas y cadenas de conexión aisladas](https://neon.com/docs/get-started-with-neon/workflow-primer)
- [Neon: conexión TLS y formato de URL](https://neon.com/blog/oops-proof-your-vibe-code-with-neon)
- [Neon: plan gratuito vigente y recursos incluidos](https://neon.com/blog/neon-backend-is-ga)
