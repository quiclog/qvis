FROM node:16-alpine AS build-stage

WORKDIR /app

COPY visualizations/package*.json ./
COPY visualizations/ .

RUN npm ci
RUN npm run build

FROM caddy:alpine AS production-stage

COPY --from=build-stage /app/dist /srv

EXPOSE 8080

CMD ["caddy", "file-server", "--listen", ":8080", "--root", "/srv"]
