# Prueba privada de PLC en AWS Free plan / Free Tier

Estado: **propuesta, no despliegue realizado**. Este documento se revisó el 24 de septiembre de 2026. PLC sigue siendo una demo con una sola cuenta ficticia, sin autenticación. El servidor escucha únicamente en `127.0.0.1` y verifica `Host` y `Origin`; conservar esa configuración es parte del plan. GitHub Pages sirve el frontend estático, pero no ejecuta su API.

## Comprobar la cuenta y el coste antes de crear recursos

1. En **AWS Billing and Cost Management**, comprueba el tipo de plan, la fecha de apertura de la cuenta, la fecha de caducidad y saldo de créditos, la región y las ofertas activas. La elegibilidad depende de la cuenta, no del repositorio. Según [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/) y [Choosing a plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html), una cuenta nueva puede elegir Free o Paid y recibir USD 100 iniciales más hasta USD 100 por actividades. El Free plan termina al cumplir seis meses o agotar los créditos, lo que ocurra primero. Los clientes existentes no reciben nuevamente el Free plan ni esos créditos; las ofertas legadas se deben verificar en su propia consola. No crees otra cuenta para repetir beneficios: consulta los [términos de AWS Free Tier](https://aws.amazon.com/free/terms/).
2. Verifica en la pantalla de lanzamiento qué instancia y AMI figuran como elegibles. La [oferta actual de cómputo](https://aws.amazon.com/free/compute/) enumera tipos elegibles para el Free plan, pero esto no equivale a «EC2 gratis ilimitado»; el uso consume créditos o sigue la oferta concreta de tu cuenta. No reutilices la regla antigua de 750 horas sin confirmar su aplicabilidad. La [guía de EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html) distingue cuentas creadas antes y después de julio de 2025.
3. Estima en la [calculadora de AWS](https://calculator.aws/#/createCalculator/ec2-enhancement) la región, horas previstas, instancia, volumen EBS, dirección IPv4 pública y transferencia de salida. [AWS cobra las IPv4 públicas según su oferta y precio vigente](https://aws.amazon.com/vpc/pricing/); [detener EC2 no elimina el coste de EBS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html). Evita recursos extra como balanceadores, NAT Gateway o IP elástica para esta prueba.
4. Activa los avisos de uso y revisa saldo y consumo cada día de prueba. La [guía de seguimiento de Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html) describe alertas y el presupuesto «zero spend». Un presupuesto avisa; **no detiene automáticamente los recursos ni sustituye la revisión de costes**. En Paid plan, el uso que supere créditos u ofertas elegibles puede facturarse.

## Diseño mínimo recomendado

```text
Navegador del propietario
  → http://127.0.0.1:3000 en su equipo
  → túnel SSH al puerto 22 de una instancia EC2
  → servidor PLC en 127.0.0.1:3000 dentro de EC2
  → backend/storage/demo.json en el volumen EBS de esa instancia
```

Una instancia Linux pequeña compatible con Node.js 22 y el tipo elegible que confirme tu cuenta bastan para una prueba manual. En el grupo de seguridad, permite **solo SSH (TCP 22) desde tu IP pública actual `/32`**; no abras 3000, 80 ni 443. AWS explica el origen de la regla SSH en [Security group rules](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html) y recomienda no permitir SSH desde cualquier origen en [Creating a security group](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-security-group.html). Mantén la clave SSH fuera del repositorio. La dirección pública necesaria para SSH puede tener coste propio; confírmalo en la estimación.

La alternativa de menor consumo de recursos para este código es **JSON en la misma EC2**. No crea una base administrada y conserva el comportamiento local. Sigue siendo una demo: una sola cuenta compartida, sin control de acceso dentro de la aplicación, sin alta disponibilidad ni respaldo automático. Usa solo datos ficticios.

## Secuencia de prueba privada

1. Después de confirmar plan y estimación, lanza una única EC2 elegible en una región elegida. Revisa la AMI, el volumen raíz y la opción de eliminarlo al terminar. Conserva la clave SSH solo en tu equipo y comprueba la huella del host al conectar.
2. En una primera sesión SSH, instala Node.js 22 o superior desde una fuente confiable para la AMI elegida, descarga una versión revisada de `ddepazos/plc` y, en la raíz del repositorio, ejecuta `npm start` **sin `DATABASE_URL`**. Para JSON no se necesita `npm install`. Comprueba desde la propia instancia `http://127.0.0.1:3000/api/health`. Mantén esa sesión abierta durante la prueba.
3. En otra terminal de tu equipo abre el túnel; reemplaza los marcadores por tu clave y el DNS público real, sin guardar estos datos en el repositorio:

   ```sh
   ssh -i <ruta-clave-privada> -N -L 127.0.0.1:3000:127.0.0.1:3000 ec2-user@<dns-publico-ec2>
   ```

   `ec2-user` corresponde a ciertas AMI de Amazon Linux; usa el usuario indicado por la AMI elegida. La [documentación de AWS para túneles SSH](https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-ssh-tunnel-local.html) explica el reenvío local `-L`. Si el puerto 3000 ya está ocupado en tu equipo, usa otro puerto **tanto en `PORT` del servidor como en ambos números del túnel y la URL local**: la validación de `Host` de PLC exige que coincidan.
4. Abre `http://127.0.0.1:3000` en tu equipo. Prueba una lectura y una operación con PLC ficticios. El navegador y la API comparten el mismo origen a través del túnel. No enlaces GitHub Pages a esta instancia: Pages no puede usar tu túnel privado y esta demo no está preparada como API pública.
5. Al acabar, cierra ambas sesiones y decide entre **detener** la instancia para retomarla o **terminarla** para cerrar la prueba. Detenerla conserva y puede seguir cobrando el volumen EBS; al terminar, revisa volúmenes, snapshots e IPv4 elásticas remanentes y la página de costes. Guarda una copia local del JSON ficticio solo si necesitas conservar ese estado de prueba.

No se incluyen comandos que creen recursos AWS automáticamente: región, plan, oferta, coste y permisos deben comprobarse en la cuenta concreta antes de ejecutar la prueba.

## PostgreSQL/RDS: opción posterior

El código admite PostgreSQL mediante `DATABASE_URL`, `npm install` y `npm run db:migrate`, descritos en el [README principal](../README.md). Para esta primera prueba, JSON evita una segunda instancia y simplifica el coste. Si más adelante quieres RDS, verifica **antes de crearlo** que la consola ofrezca el tamaño Free tier aplicable a tu cuenta, región y plan, cuánto crédito queda, el coste de almacenamiento, copias de seguridad y red, y el coste posterior a la oferta. La [guía de creación de RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.PostgreSQL.html) muestra la opción Free tier para Free plan; la [guía de RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/) aclara que el beneficio legado de 750 horas era para ciertas cuentas anteriores a julio de 2025. No presupongas que ese límite cubre tu cuenta actual.

Si se confirma elegibilidad y coste, el diseño sería EC2 con la aplicación ligada a loopback y RDS PostgreSQL **sin acceso público**, accesible solo desde el grupo de seguridad de EC2. Guarda `DATABASE_URL` fuera del repositorio, protege el transporte a la base según la configuración de RDS y elimina los recursos al acabar. Crear RDS, publicar la API o manejar credenciales reales queda fuera de esta guía.
