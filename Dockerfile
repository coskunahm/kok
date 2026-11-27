FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js db.js ./
COPY public ./public
# DATABASE_URL çalıştırırken verilir. DATA_DIR yalnızca eski sürümden geçiş içindir: veritabanı boşsa
# /data/state.json bir kez içeri aktarılır (eski kok-veri birimi /data'ya bağlıysa).
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data TRUST_PROXY=1
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/api/saat >/dev/null || exit 1
CMD ["node", "server.js"]
