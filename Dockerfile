FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec npm start"]
