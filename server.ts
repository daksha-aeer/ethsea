import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Telegraf } from 'telegraf';
import { AptosAccount, HexString } from "aptos";

dotenv.config();

const app = express();

// MongoDB setup
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    throw new Error('MONGO_URI not set in environment variables');
}

const client = new MongoClient(mongoUri);

let db: any;

client.connect().then(() => {
    console.log('Connected to MongoDB');
    db = client.db('aptos_bot');
}).catch(err => console.error('Failed to connect to MongoDB', err));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web'))); // Serve static files from the web directory

// API endpoint to save wallet address
app.post('/api/save-wallet', async (req: Request, res: Response) => {
    const { chatId } = req.body;

    if (!chatId) {
        return res.status(400).send('Missing chatId');
    }

    try {
        // Generate a new Aptos account
        const account = new AptosAccount();

        // Get the public key, secret key, and account address
        const publicKeyHex = HexString.fromUint8Array(account.signingKey.publicKey).toString();
        const secretKeyHex = HexString.fromUint8Array(account.signingKey.secretKey).toString();

        // Extract the private key (first 64 characters of the secret key)
        const privateKeyHex = secretKeyHex.slice(0, 66);

        // Get the account address
        const address = account.address().toString();

        // Save to MongoDB
        const collection = db.collection(process.env.DB_SERVER);
        await collection.updateOne(
            { chatId },
            { $set: { address, publicKey: publicKeyHex, privateKey: privateKeyHex } },
            { upsert: true }
        );

        // Notify user via Telegram
        const botToken = process.env.TOKEN;
        const chatIdString = chatId.toString();
        if (botToken) {
            const bot = new Telegraf(botToken);
            await bot.telegram.sendMessage(chatIdString, `Wallet connected successfully! Use /swap_tokens to perform swaps`);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error saving wallet:', error);
        res.sendStatus(500);
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
