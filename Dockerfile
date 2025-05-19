# Gunakan Node.js LTS berbasis Debian slim (lebih mudah instal deps Chromium)
FROM node:18-slim

# Install library yang dibutuhkan Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
    libdrm2 libexpat1 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 lsb-release xdg-utils wget ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package.json dan install dependencies
COPY package*.json ./
RUN npm install --production

# Copy semua source code
COPY . .

# Expose port sesuai .env (2208)
EXPOSE 2208

# Jalankan aplikasi
CMD ["npm", "start"]
