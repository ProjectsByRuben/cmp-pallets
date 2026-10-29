# Organización actual de CMP Pallets

Actualizada el 29/10/2026 por encargo de Rubén. Web y addon tienen Git independiente
con main como rama de trabajo. Los repositorios originales se mantienen en su sitio;
no se mueven sus .git ni se crean clones. Los worktrees antiguos de Pallets se retiran.

## Dónde trabajar

- Web: `/home/rubenfernandez/CMP/cmp-pallets`.
- Addon: `/home/rubenfernandez/CMP/doodba-cmp/odoo/custom/src/odoo-cmp-custom/cmp_mrp_packages`.
- Infraestructura Odoo: `/home/rubenfernandez/CMP/doodba-cmp`.
- Planes locales: `/home/rubenfernandez/CMP/datos-locales/cmp-pallets/planificacion/`.

## Qué abrir en el editor

Abrir `CMP-Pallets.code-workspace` en la raíz de la web para trabajar en los dos
componentes y el plan local fuera de Git. `CMP-Pallets-Web.code-workspace` abre sólo React. El workspace del addon
está en `odoo-cmp-custom/CMP-Pallets-Backend.code-workspace` y abre sólo el módulo,
para evitar editar accidentalmente otros módulos con fuentes de integración distintas.
También hay accesos locales en `/home/rubenfernandez/CMP/workspaces/`:
`CMP-Pallets`, `CMP-Pallets-Web` y `CMP-Pallets-Odoo` (todos .code-workspace).
El acceso anterior en la raíz Doodba se actualiza a las mismas carpetas, por compatibilidad.

Abrir un workspace no arranca ni actualiza servicios. En Terminal > Ejecutar tarea
están desarrollo, pruebas, build, comprobación/estado web y pruebas Odoo con rollback.
La tarea de desplegar web se lanza expresamente; no usarla sólo para revisar código.
Cada Git se guarda por separado. No crear ramas de desarrollo para Pallets.

## Operación

Desde la raíz web: `npm test`, `npm run build`, `npm run dev` (127.0.0.1:4184),
`python3 deploy/check_service.py` y `./deploy/up.sh` para desplegar cuando esté autorizado.
El proyecto Docker es cmp-pallets y usa el compose.yaml del repositorio original.
La web compilada corre en cmp-pallets-web-1 y no monta src. El proxy de entrada
sirve https://pallets.cmp3.es con las mismas restricciones de origen y autenticación.

Desde la raíz Doodba: `docker compose exec -T odoo python3
/opt/odoo/auto/addons/cmp_mrp_packages/tests/run_cmpslu.py --browser`.
El hook 58 restablece el enlace a custom/src/odoo-cmp-custom/cmp_mrp_packages.
Los demás módulos mantienen integracion/local y los worktrees de PR.
No actualizar la base ni copiar datos/filestore para reorganizar fuentes.

Los documentos de diseño y versiones conservan las rutas históricas como contexto;
esta guía y AGENTS.md describen las ubicaciones vigentes.
