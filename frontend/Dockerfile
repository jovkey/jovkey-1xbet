FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# NEXT_PUBLIC_* sont figées dans le bundle JS au moment du `next build` (ce ne sont PAS
# des variables d'environnement lues au runtime par le navigateur). Elles doivent donc
# être passées en --build-arg (voir docker-compose.yml > frontend > build > args),
# jamais seulement en `environment:` runtime — sinon le frontend garde ses valeurs par
# défaut (ex. http://localhost:4000) une fois déployé, et rien ne fonctionne pour un
# vrai visiteur (inscription, connexion, etc.).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PROMO_CODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PROMO_CODE=$NEXT_PUBLIC_PROMO_CODE

RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
