FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 4000
# Synchronise le schéma Prisma avec la vraie base à chaque démarrage (Render ne lance pas
# docker-compose, donc rien d'autre n'appliquerait les migrations de schéma en prod) puis
# (re)crée le superadmin — seed:prod est idempotent, sûr à chaque redémarrage.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run seed:prod && node dist/main.js"]
