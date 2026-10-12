FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]
