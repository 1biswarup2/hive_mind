# ---- Build stage: compile the React app into static files ----
FROM node:20-alpine AS build

WORKDIR /app

# REACT_APP_BACKEND_URL is baked into the bundle at build time.
# Pass it with: docker build --build-arg REACT_APP_BACKEND_URL=https://your-backend-url
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

COPY package.json yarn.lock* ./
RUN yarn install --network-timeout 600000

COPY . .
RUN yarn build

# ---- Serve stage: static files via nginx ----
FROM nginx:1.27-alpine

# Template is rendered by the nginx image entrypoint (envsubst) so it can
# listen on Cloud Run's $PORT.
ENV PORT=8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
