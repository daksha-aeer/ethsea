import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Telegraf, Markup } from 'telegraf';


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
    const { address, chatId } = req.body;

    if (!chatId || !address) {
        return res.status(400).send('Missing chatId or address');
    }

    try {
        const collection = db.collection('user_wallets');
        await collection.updateOne({ chatId }, { $set: { address } }, { upsert: true });

        // Notify user via Telegram
        const botToken = process.env.TOKEN;
        const chatIdString = chatId.toString();
        if (botToken) {
            const bot = new Telegraf(botToken);
            await bot.telegram.sendMessage(chatIdString, 'Wallet connected successfully!');
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
