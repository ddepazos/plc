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

## Verificación interactiva ejecutada

Se recuperó el navegador integrado y se probó la demo usando un archivo de persistencia de preview aislado del repositorio.

- Envío de 25,10 PLC a PLC-DEMO-DESTINO: detalle con nota, referencia e importe; saldo 2.424,90.
- Recepción de 10,20: saldo 2.435,10; recarga bancaria de 100: 2.535,10; recarga Ethereum de 20: saldo final 2.555,10.
- Revisión visual de dashboard a 390/768/1440 px y recarga en móvil/escritorio. Se corrigió un desbordamiento de la navegación móvil con minmax(0,1fr) y min-width:0.
- Medición de las ocho pantallas de pages/ a 390 px: ningún ancho de documento supera el viewport.
- Acceso demo revisado: texto en español correcto y sin contraseña. Se corrigió una recodificación accidental de acentos.
- Corrección de ayuda de método tras resetear el formulario: vuelve a coincidir con la opción bancaria predeterminada.
- Servidor estático sin API: wallet muestra saldo seed 2.450, banda de solo lectura y recepción deshabilitada. No se usa fallback para confirmar escrituras.

Alcance: estas comprobaciones no equivalen a una auditoría integral de accesibilidad ni a cobertura automática de todos los navegadores. Las pruebas de API cubren sobregiro, persistencia, concurrencia y validaciones; la revisión de interfaz cubrió el flujo principal.

## Figma

Archivo creado e inspeccionado vacío. La transferencia de pantallas está pendiente por límite de llamadas del plan Starter; documentación lista en interacciones.md. No se presentan pantallas ficticias como publicadas.
