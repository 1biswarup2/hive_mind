FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json ./
RUN npm install --legacy-peer-deps && npm install ajv@^8 --legacy-peer-deps

COPY frontend/ .

ARG REACT_APP_BACKEND_URL=
ARG REACT_APP_SHOW_DEMO_HINTS=false
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_SHOW_DEMO_HINTS=$REACT_APP_SHOW_DEMO_HINTS
ENV NODE_ENV=production
ENV CI=false
ENV DISABLE_ESLINT_PLUGIN=true

RUN npm run build

FROM nginx:alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
