# Arquitectura de la demo PLC

## Capas y dependencias

`server.js` conoce configuración, almacenamiento y rutas. `api.js` conoce HTTP, el modelo de error y el servicio de billetera. `wallet.js` conoce reglas de negocio y el contrato del store. `transaction.js` no conoce HTTP ni el disco. `store.js` administra el archivo JSON; `postgres-store.js` implementa el mismo contrato sobre PostgreSQL cuando se define `DATABASE_URL`. El frontend depende del contrato público JSON, no del formato interno de centésimas.

## Persistencia y consistencia

El primer inicio lee el seed original, transforma montos a enteros y crea el archivo de desarrollo. Cada actualización trabaja con una copia del estado. La cola encadena promesas y continúa después de errores. La escritura temporal y el cambio de nombre se completan antes de reemplazar la referencia en memoria. Las lecturas concurrentes ven el snapshot anterior o el nuevo, nunca una mutación parcial en memoria.

Una solicitud repetida con igual clave y firma devuelve la transacción existente. Una distinta con igual clave se rechaza. Las comprobaciones de saldo ocurren dentro de la cola, por lo que dos envíos simultáneos no pueden gastar el mismo saldo. El método no es un bloqueo entre procesos ni una transacción de base de datos distribuida. No se ejecutan dos procesos sobre un mismo archivo. El archivo completo crece y se vuelve a escribir: adecuado solo para ensayos pequeños.

Con PostgreSQL, el adaptador exige el esquema de `plc_bd/schema.sql` y selecciona únicamente la cuenta ficticia por correo y dirección del seed. Se niega a usar una billetera distinta. Cada POST inicia una transacción, bloquea esa billetera, lee el saldo y las claves de idempotencia confirmadas, aplica la regla de negocio y confirma saldo, movimiento y clave juntos. Las lecturas GET actualizan el estado desde la base. Así dos procesos no pueden gastar el mismo saldo inicial. El seed descriptivo de JSON recibe UUID nuevos al entrar a PostgreSQL porque la columna `transactions.id` es UUID. Este adaptador no convierte el archivo JSON ya usado ni autoriza dinero real. Sus pruebas automatizadas usan una base simulada; falta una prueba con PostgreSQL real.

## Formato interno

```json
{
  "version": 1,
  "user": {"id":"demo-user-001","balanceCents":245000},
  "transactions": [{"id":"tx-demo-001","type":"received","amountCents":12000,"demo":true}],
  "requests": {"clave-ejemplo-0001":{"signature":"operación normalizada","id":"tx-demo-001"}}
}
```

Ejemplo abreviado: los campos completos están en README y en los modelos. Los datos del seed se preservan. No se reconstruye el saldo inicial con sus movimientos ilustrativos.

## Decisiones

| Decisión | Motivo | Límite |
| --- | --- | --- |
| Node con `pg` opcional | El modo JSON arranca sin instalar dependencias; PostgreSQL usa `pg` tras instalar paquetes | Probar PostgreSQL real antes de desplegar este modo |
| Mismo origen para HTML y API | Rutas relativas estables y sin CORS | Uso local únicamente |
| Centésimas enteras | Evitar deriva en sumas/restas | Máximo dos decimales |
| JSON de desarrollo | Estado inspeccionable y seed reutilizable | Sin escalabilidad o auditoría fuerte |
| Fallback de lectura | Portada y ejemplos disponibles sin backend | No permite operaciones ni reconcilia estados |
| JavaScript nativo | Elimina dependencia de jQuery remoto | Navegador moderno con fetch, módulos, UUID y AbortSignal.timeout |
| Dirección PLC-DEMO | Hace explícito que no es una red de pagos | No transfiere a otro usuario real |

## Fronteras futuras

Una versión real necesitaría identidad, autorización por recurso, ledger transaccional, conciliación, idempotencia durable con políticas de retención, proveedores de pago, protección de secretos, copias de seguridad, supervisión y revisión de seguridad. Ethereum requeriría decidir red, contrato, custodia y confirmaciones: nada de eso se representa como ya implementado.

## Diagrama

`demo-arquitectura.drawio` representa las capas actuales y el fallback. `plc-arquitectura.drawio` es el documento original, conservado sin cambios; no es la fuente contractual de esta API.
