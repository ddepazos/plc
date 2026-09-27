# PLC en Render + Neon: demo protegida

Esta guía prepara **una sola instancia web gratuita de Render** para servir el frontend y la API del repositorio, con una base PostgreSQL de **Neon**. El archivo raíz [`render.yaml`](../render.yaml) describe el servicio, pero no crea la base de Neon ni contiene credenciales. **Estado comprobado: el proyecto gratuito `plc-demo` de Neon existe, su rama `production` contiene la base `neondb` y las seis tablas de PLC; el servicio de Render aún no existe.** Todos los PLC y las recargas siguen siendo ficticios.

## Antes de crear el servicio

1. Usa el proyecto gratuito `plc-demo` ya creado en Neon, rama `production`, base `neondb`. El esquema de `plc_bd/schema.sql` ya se aplicó; el adaptador de PLC insertará el seed ficticio solo si la base permanece sin usuarios. No migra datos del JSON local a PostgreSQL. No conectes una base que tenga datos reales o ajenos a esta demo. En el panel de Neon, copia la cadena **directa** de conexión de esa rama para `DATABASE_URL`; conserva las opciones TLS que entregue Neon, incluido `sslmode=require`. La misma variable se usa para la migración y para la aplicación. Una conexión directa es suficiente para esta instancia pequeña; si más adelante se separan migraciones y tráfico, se podrán usar roles y URLs distintas.
2. Prepara una contraseña nueva de **al menos 16 caracteres**, larga y exclusiva para `PLC_DEMO_PASSWORD`. El acceso público usa HTTP Basic con usuario fijo `demo`; comparte la contraseña solo con quienes deban probar la demo. No reutilices contraseñas personales.
3. Verifica en los paneles de ambos proveedores que el proyecto y el servicio estén en sus planes gratuitos y revisa los límites y ajustes de facturación de tus cuentas. `plan: free` en el Blueprint evita elegir un plan de cómputo pagado para este servicio, pero no garantiza que otros recursos o excesos de uso de la cuenta nunca generen cargos.

**No pegues** `DATABASE_URL` ni la contraseña en GitHub, incidencias, capturas o este documento. Render solicitará ambas variables durante la creación inicial del Blueprint porque figuran como `sync: false`. Si el servicio ya existe, añádelas o actualízalas manualmente en **Environment**: Render no vuelve a pedir valores `sync: false` en sincronizaciones posteriores.

## Crear la demo en Render

1. Publica en GitHub la versión revisada del repositorio con `render.yaml` y el backend configurado para `HOST=0.0.0.0` y origen público.
2. Crea una cuenta de Render o inicia sesión, conecta GitHub y crea un **Blueprint** desde `ddepazos/plc`. Revisa el servicio `plc-demo`: tipo **Web Service**, entorno Node y plan **Free**. El Blueprint no declara una base Render Postgres: usa la base de Neon creada en el paso anterior.
3. Al crear el Blueprint, pega `DATABASE_URL` y `PLC_DEMO_PASSWORD` **solo en los campos secretos de Render**. No configures `PLC_DATA_FILE`; la persistencia de archivos del servicio es efímera.
4. Inicia el despliegue y examina el registro. Render instalará `pg`, ejecutará `npm run db:migrate` y luego `npm start`. `schema.sql` usa `CREATE ... IF NOT EXISTS`, de modo que el esquema puede aplicarse otra vez tras un reinicio. Una falla de conexión o migración detiene el arranque, en vez de iniciar accidentalmente en modo JSON.
5. Abre la URL `https://<servicio>.onrender.com` que Render asigne. El navegador pedirá el usuario `demo` y la contraseña configurada. El frontend y la API comparten origen. Prueba saldo, recepción, envío, recarga ficticia, historial y detalle. Las acciones cambian **una sola billetera ficticia compartida**; los participantes verán las operaciones de los demás.

Render proporciona `PORT` y `RENDER_EXTERNAL_URL` automáticamente. `HOST=0.0.0.0` permite que su proxy alcance el proceso. El backend usa `RENDER_EXTERNAL_URL` para validar el Host y el Origin públicos cuando no se define `PUBLIC_ORIGIN`. Si más adelante conectas un dominio personalizado, configura `PUBLIC_ORIGIN=https://tu-dominio` en el entorno de Render y comprueba de nuevo el chequeo de salud. Render envía el Host del dominio personalizado verificado en sus chequeos HTTP.

## Comprobación y solución de problemas

- `GET /api/health` debe devolver HTTP 200 sin credenciales; Render usa esa ruta para decidir si el servicio está listo. No expone la billetera.
- La portada y las rutas `/api/state`, `/api/wallet` y de operaciones requieren Basic Auth. Un HTTP 401 aquí indica credenciales ausentes o erróneas.
- Si el despliegue falla durante `db:migrate`, revisa la URL de Neon, permisos de creación de tablas, disponibilidad de la rama y el parámetro TLS. Usa el panel de Render para actualizar el secreto; no lo imprimas en registros.
- Si Render informa que no detecta un puerto abierto, confirma `HOST=0.0.0.0` y que la aplicación lee el `PORT` suministrado por Render.
- Si `/api/health` responde 403, comprueba `PUBLIC_ORIGIN`, el dominio verificado y el Host que aparece en la petición. El chequeo de Render usa el subdominio `onrender.com`, salvo que el servicio tenga un dominio personalizado verificado.
- Tras guardar secretos o cambiar de dominio, vuelve a desplegar y comprueba por separado el chequeo de salud y una petición del navegador. `PUBLIC_ORIGIN` debe ser una URL `https://` sin ruta ni barra final.

En el plan Free, Render puede suspender el proceso después de un periodo sin tráfico; la primera visita posterior puede tardar. Su sistema de archivos se pierde al reiniciar o volver a desplegar: **PostgreSQL es imprescindible para conservar el estado compartido**. Neon también tiene límites de uso propios; revísalos en su panel. Esta configuración es para aprendizaje y revisión privada, no para dinero real ni cuentas personales. Basic Auth controla quién entra a una demo compartida, pero no crea usuarios individuales ni sustituye la autenticación, autorización, auditoría y controles financieros que exigiría un producto real.

## Referencias oficiales

- [Render: Blueprint YAML, secretos `sync: false` y `plan: free`](https://render.com/docs/blueprint-spec)
- [Render: web services, Host `0.0.0.0` y `PORT`](https://render.com/docs/web-services)
- [Render: variables `RENDER_EXTERNAL_URL` y `RENDER_EXTERNAL_HOSTNAME`](https://render.com/docs/environment-variables)
- [Render: chequeos de salud y Host enviado](https://render.com/docs/health-checks)
- [Render: límites del servicio gratuito y sistema de archivos efímero](https://render.com/docs/free)
- [Render: migración previa solo en web services pagados](https://render.com/docs/deploys)
- [Neon: ramas y cadenas de conexión aisladas](https://neon.com/docs/get-started-with-neon/workflow-primer)
- [Neon: conexión TLS y formato de URL](https://neon.com/blog/oops-proof-your-vibe-code-with-neon)
- [Neon: plan gratuito vigente y recursos incluidos](https://neon.com/blog/neon-backend-is-ga)
