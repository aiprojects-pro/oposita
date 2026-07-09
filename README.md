# IA-OPOSDEP — Cuestionario del estudio (UPO 26/3-44)

Aplicación web para el estudio "Percepción, uso y actitudes hacia la inteligencia
artificial generativa en la preparación de oposiciones del ámbito de la gestión
deportiva en la administración pública", de María Rosario Teva Villén
(Universidad Pablo de Olavide / Universidad Internacional de La Rioja),
autorizado por el Comité de Ética de la Universidad Pablo de Olavide (código 26/3-44).

## Requisitos
- Node.js 18 o superior.

## Instalación
    npm install

## Arranque
La contraseña del panel de administración se pasa como variable de entorno
(nunca se escribe en el código):

    ADMIN_PASSWORD="tu_clave_segura" npm start

Por defecto escucha en el puerto 3000 (configurable con la variable PORT).

## Despliegue con Docker (servidor)
El proyecto incluye `Dockerfile` y `docker-compose.yml`.

1. Copia la plantilla de variables y define la contraseña de administración:

       cp .env.example .env
       # edita .env y pon un ADMIN_PASSWORD largo y único

2. Construye y arranca el contenedor:

       docker compose up -d --build

3. La aplicación queda escuchando en `127.0.0.1:3000` dentro del servidor. Colócala
   detrás de tu proxy inverso (nginx/Traefik) con HTTPS. El cuestionario está en `/`,
   el panel en `/admin.html` y el borrado de datos en `/borrar.html`.

Comandos útiles:

       docker compose logs -f        # ver logs
       docker compose down           # parar (los datos permanecen en el volumen)
       docker compose up -d --build  # actualizar tras cambios de código

### Datos persistentes y copia de seguridad
Las respuestas viven en el **volumen** `ia-oposdep-data` (montado en `/app/data`),
no dentro del contenedor: sobreviven a reinicios y actualizaciones. Para respaldarlas:

    docker run --rm -v ia-oposdep-data:/data -v "$PWD":/backup alpine \
      tar czf /backup/ia-oposdep-data-$(date +%F).tar.gz -C /data .

Programa esa copia con un cron diario a un almacenamiento externo. **Recuerda borrar
los emails del sorteo (`sorteo.jsonl`) una vez celebrado el sorteo.**

### Anonimato detrás del proxy
No configures el proxy para pasar cabeceras identificativas ni actives logs de IP.
La aplicación no registra IP, cookies ni `X-Forwarded-For`, en cumplimiento del
protocolo ético; mantén ese comportamiento en el proxy (no añadas `X-Real-IP`
a ningún log asociado a las respuestas).

## Dónde quedan los datos (ficheros a respaldar)
Los datos se guardan en **silos separados** dentro de `data/`, diseñados para que los
datos identificativos NUNCA puedan cruzarse con las respuestas:

- `data/respuestas.jsonl` — una línea JSON por respuesta (incluye `borrado_hash`; sin datos personales).
- `data/respuestas.csv`   — cabecera fija + una fila por respuesta (UTF-8 con BOM, abre bien en Excel).
- `data/sorteo.jsonl`     — SOLO los emails del sorteo, sin ninguna conexión con las respuestas.
- `data/tickets.jsonl`    — hashes de los tickets emitidos (para evitar entradas duplicadas); sin datos personales.

**Copia de seguridad:** basta con respaldar periódicamente la carpeta `data/`.
Se recomienda un cron diario que copie `data/` a un almacenamiento externo.

## Código de borrado (derecho de supresión, RGPD art. 17)
Al terminar, cada participante recibe un código personal (p. ej. `OPOSDEP-7F3K-9Q2M`).
La aplicación guarda solo su **hash** junto a la respuesta, de modo que el fichero de
respuestas no contiene datos identificativos. El participante puede borrar sus respuestas
en `/borrar.html` introduciendo su código, o solicitarlo por email a la investigadora.

## Sorteo del cheque de 60 € (anónimo)
Tras enviar el cuestionario, el participante puede dejar (opcionalmente) un email para entrar
en el sorteo de un cheque de Amazon de 60 €. El email se guarda en `data/sorteo.jsonl`, en un
silo separado y sin ningún identificador que lo enlace con las respuestas. Cada envío completado
emite un **ticket** de un solo uso, de forma que un cuestionario = como máximo una participación.
**Elimina `data/sorteo.jsonl` tras celebrar el sorteo.**

## Panel de administración
Disponible en `/admin.html`. Requiere la contraseña definida en `ADMIN_PASSWORD`.
Muestra el total de respuestas, cuántas están marcadas como rápidas
(`flag_rapida`, duración < 300 s), el nº de participantes en el sorteo y la fecha de la última.
Permite exportar el CSV de respuestas y la lista de emails del sorteo (por separado).

## Anonimato (importante)
La aplicación NO registra IP, nombre, email ni cookies identificativas, en
cumplimiento del protocolo ético. No añadir logs de IP ni cabeceras
X-Forwarded-For al desplegar detrás de un proxy.

## Créditos / contacto
Investigadora principal: María Rosario Teva Villén
(Universidad Pablo de Olavide / Universidad Internacional de La Rioja) — rteva@upo.es
Responsable del tratamiento (RGPD): Universidad Pablo de Olavide.
