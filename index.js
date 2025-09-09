require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const sharp = require("sharp");
const showdown = require("showdown");
const { PDFDocument } = require("pdf-lib");

const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.end("Bot is running");
}).listen(PORT, () => console.log(`HTTP server listening on ${PORT}`));

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const TEMP_DIR = path.join(os.tmpdir(), "discord-file-converter");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ------------------ Register Slash Command ------------------
const commands = [
  new SlashCommandBuilder()
    .setName("convert")
    .setDescription("Convert a file to another format")
    .addAttachmentOption(opt =>
      opt.setName("file")
        .setDescription("Upload the file to convert")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Slash command registered.");
  } catch (err) {
    console.error(err);
  }
})();

// ------------------ Global Variables ------------------
const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"];
const TEXT_FORMATS = ["txt", "md"];
const DOC_FORMATS = ["docx"];
const PDF_FORMATS = ["pdf"];

// Jobs map
const jobs = new Map();
const JOB_TTL_MS = 15 * 60 * 1000; // 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of jobs.entries()) if (now - v.createdAt > JOB_TTL_MS) jobs.delete(k);
}, 60 * 1000).unref();

// ------------------ Helper Functions ------------------
function getExt(filename = "") {
  const ext = filename.split(".").pop();
  return ext ? ext.toLowerCase() : "";
}

function normalizeExtFromAttachment(att) {
  let ext = getExt(att.name || att.filename || "");
  if (!ext && att.contentType) {
    const ct = String(att.contentType).toLowerCase();
    if (ct.startsWith("image/")) ext = ct.replace("image/", "");
    else if (ct === "application/pdf") ext = "pdf";
    else if (ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ext = "docx";
    else if (ct.startsWith("text/")) ext = "txt";
  }
  return ext;
}

function allowedTargetsFor(ext) {
  if (!ext) return [];
  if (IMAGE_FORMATS.includes(ext)) return [...IMAGE_FORMATS.filter(f => f !== ext), "pdf"];
  if (ext === "pdf") return ["docx"];
  if (ext === "docx") return ["pdf"];
  if (ext === "txt") return ["md"];
  if (ext === "md") return ["txt"];
  return [];
}

function labelForFormat(fmt) {
  const upper = fmt.toUpperCase();
  if (["JPG", "JPEG", "PNG", "WEBP", "PDF"].includes(upper)) return `${upper} (.${fmt})`;
  if (fmt === "md") return "Markdown (.md)";
  if (fmt === "txt") return "Plain Text (.txt)";
  if (fmt === "docx") return "Word (.docx)";
  return fmt;
}

async function downloadTo(fileUrl, destPath) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

// ------------------ Conversion Functions ------------------
async function convertImageToImage(inputPath, outputPath, targetFormat) {
  await sharp(inputPath).toFormat(targetFormat).toFile(outputPath);
}

async function convertImageToPdf(inputPath, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = fs.readFileSync(inputPath);
  const ext = getExt(inputPath);
  const img = ["jpg", "jpeg"].includes(ext)
    ? await pdfDoc.embedJpg(imageBytes)
    : await pdfDoc.embedPng(imageBytes);
  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  fs.writeFileSync(outputPath, await pdfDoc.save());
}

// Python conversions
async function convertPdfToDocx(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    exec(`"${__dirname}/venv/bin/python" converter.py pdf2docx "${inputPath}" "${outputPath}"`, (err, stdout) => {
      if (err) return reject(err);
      if (stdout.includes("ERROR")) return reject(new Error(stdout));
      resolve(stdout.trim());
    });
  });
}

async function convertDocxToPdf(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    exec(`"${__dirname}/venv/bin/python" converter.py docx2pdf "${inputPath}" "${outputPath}"`, (err, stdout) => {
      if (err) return reject(err);
      if (stdout.includes("ERROR")) return reject(new Error(stdout));
      resolve(stdout.trim());
    });
  });
}

// TXT ↔ MD
async function convertMarkdownToText(inputPath, outputPath) {
  const md = fs.readFileSync(inputPath, "utf8");
  const converter = new showdown.Converter();
  const html = converter.makeHtml(md);
  const plain = html.replace(/<[^>]+>/g, "");
  fs.writeFileSync(outputPath, plain, "utf8");
}

async function copyText(inputPath, outputPath) {
  const data = fs.readFileSync(inputPath, "utf8");
  fs.writeFileSync(outputPath, data, "utf8");
}

// Router
async function runConversion({ sourcePath, sourceExt, targetExt, outputPath }) {
  if (IMAGE_FORMATS.includes(sourceExt) && IMAGE_FORMATS.includes(targetExt)) return convertImageToImage(sourcePath, outputPath, targetExt);
  if (IMAGE_FORMATS.includes(sourceExt) && targetExt === "pdf") return convertImageToPdf(sourcePath, outputPath);
  if (sourceExt === "docx" && targetExt === "pdf") return convertDocxToPdf(sourcePath, outputPath);
  if (sourceExt === "pdf" && targetExt === "docx") return convertPdfToDocx(sourcePath, outputPath);
  if (sourceExt === "md" && targetExt === "txt") return convertMarkdownToText(sourcePath, outputPath);
  if (sourceExt === "txt" && targetExt === "md") return copyText(sourcePath, outputPath);
  throw new Error("Unsupported conversion pair.");
}

// ------------------ Bot Interaction ------------------
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "convert") {
      const file = interaction.options.getAttachment("file");
      if (!file) return interaction.reply({ content: "Please attach a file.", ephemeral: true });

      const ext = normalizeExtFromAttachment(file);
      const targets = allowedTargetsFor(ext);
      if (!ext || targets.length === 0) {
        return interaction.reply({
          content: `Cannot convert **.${ext || "unknown"}** files.\nSupported: images, PDF ↔ DOCX, TXT ↔ MD`,
          ephemeral: true
        });
      }

      const jobId = crypto.randomUUID();
      jobs.set(jobId, { attachment: file, sourceExt: ext, createdAt: Date.now() });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`convert_select:${jobId}`)
        .setPlaceholder("Select output format")
        .addOptions(targets.map(t => ({ label: labelForFormat(t), value: t })));

      await interaction.reply({
        content: `Detected **.${ext}**. Choose format:`,
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("convert_select:")) {
      const [, jobId] = interaction.customId.split(":");
      const job = jobs.get(jobId);
      if (!job) return interaction.reply({ content: "Conversion session expired. Use /convert again.", ephemeral: true });

      const targetExt = interaction.values[0];
      const { attachment: file, sourceExt } = job;

      await interaction.update({ content: `⏳ Converting **.${sourceExt} → .${targetExt}** ...`, components: [] });

      // Keep original filename
      const originalName = (file.name || "file").replace(/[^a-zA-Z0-9_.-]/g, "_");
      const sourcePath = path.join(TEMP_DIR, originalName);
      const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
      const outputPath = path.join(TEMP_DIR, `${nameWithoutExt}.${targetExt}`);

      const cleanup = () => {
        try { if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath); } catch {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
        jobs.delete(jobId);
      };

      try {
        if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10 MB).");
        await downloadTo(file.url, sourcePath);
        await runConversion({ sourcePath, sourceExt, targetExt, outputPath });
        await interaction.followUp({ content: "✅ Conversion complete!", files: [outputPath], flags: 64 }); // ephemeral
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: `❌ Conversion failed: ${err.message || err}`, flags: 64 });
      } finally { cleanup(); }
    }
  } catch (outerErr) {
    console.error("Interaction error:", outerErr);
    if (interaction.isRepliable()) interaction.reply({ content: "Unexpected error.", ephemeral: true });
  }
});

client.once("clientReady", () => console.log(`Logged in as ${client.user.tag}`));
client.login(TOKEN);
