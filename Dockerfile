FROM node:20-alpine

WORKDIR /app

# Copy root and server configuration
COPY package.json ./
COPY server/package*.json ./server/

# Install server dependencies
RUN cd server && npm install --production

# Copy remaining code
COPY . .

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server/server.js"]
