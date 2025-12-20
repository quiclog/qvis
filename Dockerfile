FROM node:16-alpine AS build-stage

WORKDIR /app

COPY visualizations/package*.json ./
COPY visualizations/ .

RUN npm ci
RUN npm run build

FROM nginx:alpine AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
