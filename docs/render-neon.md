# Despliegue gratuito de PLC: Render + Neon

Esta rama prepara la demo para el flujo **GitHub Pages → Render (Node.js) → Neon (PostgreSQL)**.

## 1. Neon

1. Crea un proyecto PostgreSQL para PLC.
2. Copia la cadena de conexión segura suministrada por Neon.
3. Configúrala temporalmente como `DATABASE_URL` y ejecuta `npm run db:migrate` para aplicar `plc_bd/schema.sql`.
4. No guardes la URL real en GitHub.

## 2. Render

Crea un Web Service desde este repositorio y usa la rama `postgres-integration`.

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`

Variables:

```text
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=<cadena entregada por Neon>
ALLOWED_ORIGINS=https://ddepazos.github.io
```

Render proporciona `PORT`; el backend ya lo lee automáticamente.

## 3. Frontend

Mientras el frontend y la API estén servidos por el mismo proceso, las rutas `/api/*` funcionan sin cambios. Si el frontend queda en GitHub Pages y la API en Render, `assets/js/main.js` debe apuntar a la URL pública de Render. Esa URL solo se puede fijar después de crear el Web Service.

## 4. Verificación

Comprueba, en este orden:

1. `GET /health` devuelve `ok: true` y almacenamiento PostgreSQL.
2. La pantalla obtiene saldo e historial.
3. Ejecuta una operación ficticia pequeña.
4. Recarga la página y confirma que la operación persiste.
5. Repite la misma petición con la misma Idempotency-Key y confirma que no duplica el movimiento.
6. Comprueba que un origen no autorizado recibe 403.

## Límite actual

PLC sigue siendo una demo sin autenticación multiusuario. El despliegue no debe usarse con dinero, contraseñas, claves privadas ni datos personales reales.
