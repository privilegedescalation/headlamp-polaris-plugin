FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY src/ src/
RUN npx @kinvolk/headlamp-plugin build

FROM alpine:3.20
COPY --from=build /app/dist/ /plugins/polaris-headlamp-plugin/
COPY --from=build /app/package.json /plugins/polaris-headlamp-plugin/
