# Stage 1: Build React static assets
FROM node:20-alpine AS build

WORKDIR /app

# Copy package lock and configurations
COPY frontend/package*.json ./
RUN npm install

# Copy source code and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:stable-alpine

# Copy custom nginx config for SPA routing
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to nginx public folder
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
