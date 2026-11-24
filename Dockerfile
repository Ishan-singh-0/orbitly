FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data TRUST_PROXY=1
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.js"]
