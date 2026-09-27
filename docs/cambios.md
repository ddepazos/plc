# Inventario exacto de cambios

Base: `939c831` (rama `main`). Incluye la corrección posterior de responsive móvil, acentos y ayuda de recargas, junto con evidencia de pruebas de navegador.

## Modificados (12)

- `README.md`
- `assets/css/styles.css`
- `assets/js/main.js`
- `index.html`
- `pages/cargar.html`
- `pages/dashboard.html`
- `pages/detalle.html`
- `pages/enviar.html`
- `pages/historial.html`
- `pages/login.html`
- `pages/perfil.html`
- `pages/wallet.html`

## Creados (15)

- `.gitignore`
- `backend/config.js`
- `backend/models/transaction.js`
- `backend/routes/api.js`
- `backend/server.js`
- `backend/services/store.js`
- `backend/services/wallet.js`
- `backend/storage/.gitkeep`
- `backend/test/api.test.js`
- `docs/arquitectura.md`
- `docs/cambios.md`
- `docs/demo-arquitectura.drawio` (creado en la primera entrega y retirado después)
- `docs/interacciones.md`
- `docs/verificacion.md`
- `package.json`

## Evolución posterior

- `data/plc-demo.json`: seed/fallback original.
- `docs/plc-arquitectura.drawio`: el diagrama previo se reemplazó por uno que refleja la API y la persistencia actuales.

El diagrama alternativo `docs/demo-arquitectura.drawio` se retiró para evitar dos versiones contradictorias de la misma arquitectura. El estado runtime no se incluye en Git. Figma: se creó el archivo, pero la transferencia de pantallas quedó pendiente por límite Starter; ver `interacciones.md`.
