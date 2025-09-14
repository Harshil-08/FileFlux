FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip libreoffice && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN pip install --no-cache-dir pdf2docx

EXPOSE 3000

CMD ["node", "index.js"]
