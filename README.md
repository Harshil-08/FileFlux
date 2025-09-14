[![Top.gg Verified](https://img.shields.io/badge/Top.gg-Verified-brightgreen)](https://top.gg/bot/1414901319998767144)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)


# Discord File Converter Bot

A Discord bot that allows users to **convert files between different formats** directly within Discord using slash commands. Supports image, PDF, DOCX, and text/Markdown conversions.

## Features

- ✅ Convert **images** (`jpg`, `jpeg`, `png`, `webp`) to other image formats or PDF  
- ✅ Convert **PDF ↔ DOCX** using Python-based conversion  
- ✅ Convert **TXT ↔ Markdown (MD)**  
- ✅ Slash commands: `/convert` to convert files, `/ping` to check bot status  
- ✅ Supports file uploads up to 10 MB  

## Slash Commands

### `/ping`
Check if the bot is online.  
**Response:** `🏓 Pong! Bot is online.`

### `/convert`
Upload a file to convert it into a different format.

**Options:**

- `file` (Attachment) – File to convert (required)

**Flow:**

1. Upload a file using `/convert`.
2. Select the desired output format from the menu.
3. Bot responds with the converted file.

## Supported Conversions

| Source | Target Formats |
|--------|----------------|
| Image (`jpg`, `jpeg`, `png`, `webp`) | Other images, PDF |
| PDF | DOCX |
| DOCX | PDF |
| TXT | MD |
| MD | TXT |
