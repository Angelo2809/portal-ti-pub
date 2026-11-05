FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY sql ./sql
COPY Assets ./Assets
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]
