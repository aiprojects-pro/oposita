# Oposita con IA - OKD

Despliegue adaptado para OpenShift/OKD con build Docker desde GitHub.

## Recursos

- Namespace: `oposita`
- Secret: `oposita-config`
- PVCs: `oposita-data`, `oposita-backups`
- BuildConfig/ImageStream: `oposita`
- Deployment/Service/Route: `oposita`
- CronJob: `oposita-backup`

## Aplicacion

- Cuestionario: `/`
- Panel de administracion: `/admin.html`
- Borrado RGPD: `/borrar.html`
- Probe: `/api/schema`

Los datos se guardan en `/app/data` dentro del PVC `oposita-data`.
