# Use official Node.js image (LTS)
FROM node:20-bullseye

# Install Python 3, venv, and pip
RUN apt-get update && \
    apt-get install -y python3 python3-venv python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Create Python virtual environment
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy Node.js files first for caching
COPY package*.json ./
RUN npm install --production

# Copy the rest of the project
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir pdf2docx docx2pdf

# Expose a port (optional, useful if using webhooks or testing)
EXPOSE 3000

# Run the bot
CMD ["node", "index.js"]
