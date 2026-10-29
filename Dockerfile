FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY index.html tsconfig.json vite.config.mts ./
COPY src ./src
COPY dist/brand ./dist/brand
COPY dist/hid.mjs dist/camera.mjs ./dist/
COPY dist/vendor/jsqr.js dist/vendor/jsqr-LICENSE.txt ./dist/vendor/
ARG CMP_ODOO_DB=cmpslu
RUN CMP_ODOO_DB="$CMP_ODOO_DB" npm run build && printf '%s' "$CMP_ODOO_DB" > /app/build-db

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY --from=build /app/build/ /usr/share/nginx/html/
COPY --from=build /app/build-db /opt/cmp/build-db
COPY deploy/nginx.conf.template /opt/cmp/nginx.conf.template
COPY deploy/security-headers.conf /opt/cmp/security-headers.conf
COPY --chmod=755 deploy/entrypoint.sh /opt/cmp/entrypoint.sh
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/opt/cmp/entrypoint.sh"]
