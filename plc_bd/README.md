# PLC_BD

Modelo relacional propuesto para evolucionar Proletarian Coin desde la persistencia JSON de la demo hacia PostgreSQL.

## Entidades
- **users**: identidad y estado de la cuenta.
- **wallets**: una billetera PLC por usuario.
- **transactions**: movimientos enviados, recibidos y recargas.
- **idempotency_requests**: evita duplicar operaciones POST.
- **user_sessions**: sesiones de autenticación almacenando solo hash del token.
- **security_settings**: configuración de seguridad de la cuenta.

## Relaciones
- users 1:1 wallets
- users 1:N user_sessions
- users 1:1 security_settings
- wallets 1:N transactions
- transactions 0..1:N idempotency_requests (cada request referencia como máximo una transacción)

El saldo se representa en centésimas enteras para evitar errores de punto flotante. Este esquema es una base de desarrollo; antes de dinero real requiere ledger de doble entrada, migraciones, auditoría, autorización, cifrado y revisión de seguridad.

Archivos:
- `schema.sql`: DDL PostgreSQL.
- `diagrama-er.md`: diagrama entidad-relación editable en Mermaid.
