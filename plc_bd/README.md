# PLC_BD

Esquema relacional de desarrollo y modo PostgreSQL opcional de Proletarian Coin. La demo usa JSON cuando `DATABASE_URL` no está definida. Con `DATABASE_URL`, `npm run db:migrate` aplica `schema.sql` y el servidor carga `backend/services/postgres-store.js`; el seed ficticio se inserta al iniciar con una base vacía. Instala las dependencias con `npm install` antes de usar este modo. Usa una base dedicada a la demo: si hay otras cuentas y no existe la cuenta ficticia del seed, el servidor se detiene sin modificar otra billetera. No existe conversión automática entre el JSON local y la base SQL.

## Entidades
- **users**: identidad y estado de la cuenta.
- **wallets**: una billetera PLC por usuario.
- **transactions**: movimientos enviados, recibidos y recargas.
- **idempotency_requests**: evita duplicar operaciones POST.
- **user_sessions**: tabla preparada para futuras sesiones; la demo aún no autentica usuarios.
- **security_settings**: tabla preparada para futuras opciones de seguridad; la demo no implementa 2FA.

## Relaciones
- users 1:1 wallets
- users 1:N user_sessions
- users 1:1 security_settings
- wallets 1:N transactions
- transactions 0..1:N idempotency_requests (cada request referencia como máximo una transacción)

El saldo se representa en centésimas enteras para evitar errores de punto flotante. El adaptador PostgreSQL usa transacciones y bloqueo de la billetera para actualizar saldo, movimientos y claves de idempotencia, manteniendo el mismo contrato de API de la demo JSON. Los ID descriptivos de transacciones seed se convierten a UUID nuevos al sembrar PostgreSQL. Las pruebas automatizadas usan un Pool simulado; antes de desplegar esta opción hay que probarla con una instancia real de PostgreSQL. Este esquema sigue siendo una base de desarrollo; antes de dinero real requiere ledger de doble entrada, migraciones versionadas, auditoría, autorización, cifrado y revisión de seguridad.

Archivos:
- `schema.sql`: DDL PostgreSQL.
- `migrate.js`: aplica el esquema con `DATABASE_URL`.
- `diagrama-er.md`: diagrama entidad-relación editable en Mermaid.
