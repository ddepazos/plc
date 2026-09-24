# Verificación — 24 septiembre 2026

## Automatizada, ejecutada

`node --test backend/test/api.test.js`: 6 pruebas aprobadas, 0 fallos.

1. Saldo inicial, envío decimal, recepción, ambas recargas, detalle por id, reintento idempotente, conflicto de clave y reapertura de persistencia.
2. Montos cero/negativos/imprecisos/no numéricos, sobregiro, destino real o propio, método inválido, campos no admitidos y falta de clave: rechazados sin modificar saldo.
3. Tres envíos simultáneos contra saldo limitado: solo dos se confirman; tres recepciones con igual clave generan un único crédito de 0,01.
4. Archivos privados inaccesibles, origen externo bloqueado, content-type incorrecto, JSON malformado, cuerpo excesivo y cabeceras de seguridad.
5. Archivo persistido dañado: el inicio falla sin reemplazarlo por datos iniciales.
6. Enlaces y recursos relativos de todas las páginas resuelven a archivos existentes; anclas locales existen; no queda dependencia de jQuery.

## Revisión estática realizada

Se conservaron estructura, colores, tipografía y reglas responsive originales. Se añadieron límites de ancho mínimo, ajuste de referencias largas, select oscuro, foco visible y botones deshabilitados. Se revisaron los puntos de corte 850/560 px y las rutas HTML → CSS/JS → JSON/API. Se corrigieron actividad reciente fija, enlace FAQ sin destino, detalle que elegía otra transacción y formularios que aparentaban autenticación/guardado real.

## Pendiente de verificación visual interactiva

El navegador integrado falló al crear una pestaña por un error de sesión. No se afirma haber realizado pruebas visuales de navegador ni capturas responsive. Comprobar manualmente a 390, 768 y 1440 px:

- Portada, navegación móvil desplazable, tarjetas sin desbordamiento horizontal.
- Acceso demo sin campos de contraseña; perfil explícitamente de solo lectura.
- Enviar 25,10 PLC a PLC-DEMO-DESTINO, comprobar detalle y saldo.
- Recibir 10,20 y recargar por banco y Ethereum; comprobar métodos en detalle.
- Rechazar sobregiro y tres decimales; filtrar historial y abrir id inexistente.
- Reiniciar servidor y verificar persistencia. Usar un archivo distinto para pruebas manuales.
- Servir solo frontend: banda seed y escrituras deshabilitadas. No abrir por file://.
- Teclado, foco, mensajes anunciados, copiar dirección y referencias/notas largas.

## Figma

Archivo creado e inspeccionado vacío. La transferencia de pantallas está pendiente por límite de llamadas del plan Starter; documentación lista en interacciones.md. No se presentan pantallas ficticias como publicadas.
