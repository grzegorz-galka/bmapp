# Development image: sources are bind-mounted and Vite's dev server watches
# them, so this installs dependencies only and never copies application code.
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
