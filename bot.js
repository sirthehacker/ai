// Make sure to install qrcode-terminal: npm install qrcode-terminal

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage, Browsers } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const axios = require('axios');

// Configs
const GEMINI_API_KEY = 'AIzaSyDwsSu3DsBS-UVjGL9q8pXEj6-RAoAnIjc'; // Replace with your key
const IMGBB_API_KEY = 'c3df4b0447a2f2aa50f7185e702dab30';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Favorite stickers
let favoriteStickers = [
    'https://i.ibb.co/JwwHSD8r/all.webp',
    'https://i.ibb.co/sJvjRfvK/bola.webp',
    'https://i.ibb.co/pv8ZWk6G/laugh.webp',
    'https://i.ibb.co/Jj2bPyYb/solo.webp'
];

// Group Gemini state
let geminiOnInGroups = new Map();

// Query Gemini with Swahili slang vibe
async function queryGemini(prompt, isReply = false) {
    try {
        const instruction = isReply
            ? `Sema kama mtaa homie, use Swahili slang like *poa*, *mambo*, *vipi*, *sare*, *fiti*. Keep it short, chill, no long stories. Reply to: "${prompt}"`
            : `Talk like a Dar es Salaam bro, throw in Swahili slang—*mambo*, *poa*, *sema*, *haraka*. Keep it tight and vibey. Answer: "${prompt}"`;

        const chat = model.startChat();
        const result = await chat.sendMessage(instruction);
        return result.response.text().trim();
    } catch (error) {
        return 'Aisee, nimehang—sema tena!';
    }
}

// Download sticker
async function downloadStickerBuffer(message) {
    const stream = await downloadContentFromMessage(message.stickerMessage, 'sticker');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// Upload to ImgBB
async function uploadStickerToImgBB(stickerBuffer) {
    try {
        const formData = new URLSearchParams();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', stickerBuffer.toString('base64'));
        const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return response.data.success ? response.data.data.url : null;
    } catch (error) {
        return null;
    }
}

// Random sticker
function getRandomSticker() {
    return favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
}

// Terminal input
const question = (text) => {
    process.stdout.write(text);
    return new Promise((resolve) => process.stdin.once('data', (data) => resolve(data.toString().trim())));
};

// Main bot
async function connectToWhatsApp() {
    const authDir = 'auth_info';
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    console.log('Auth state loaded:', state.creds ? 'yes' : 'no');

    const sock = makeWASocket({
        browser: Browsers.ubuntu('SIRTECH0'),
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('Nimeconnect poa sana!');
        } else if (connection === 'close') {
            console.log('Nimekatika, na-reconnect...');
            connectToWhatsApp();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroupChat = remoteJid.endsWith('@g.us');
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();

        // Typing vibe
        await sock.sendPresenceUpdate('composing', remoteJid);

        // Save sticker
        if (text.toLowerCase() === '.save' && quotedMessage?.stickerMessage) {
            const stickerBuffer = await downloadStickerBuffer(quotedMessage);
            const uploadedUrl = await uploadStickerToImgBB(stickerBuffer);
            if (uploadedUrl) {
                favoriteStickers.push(uploadedUrl);
                await sock.sendMessage(remoteJid, { text: 'Sticker imestick! Nimeisave—tayari kwa next round.' });
            } else {
                await sock.sendMessage(remoteJid, { text: 'Aisee, sticker haikusave—kuna
