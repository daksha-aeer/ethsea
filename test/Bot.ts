import * as dotenv from 'dotenv';
import { Telegraf, Context } from 'telegraf';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { MongoClient } from 'mongodb';
import { getSwapRate } from './excRate'; // Import the updated function

dotenv.config();
const token = process.env.TOKEN;
const mongoUri = process.env.MONGO_URI;

const bot = new Telegraf(token as string);

// MongoDB setup
const client = new MongoClient(mongoUri as string);
let db: any;

client.connect().then(() => {
    console.log('Connected to MongoDB');
    db = client.db('aptos_bot');
}).catch(err => console.error('Failed to connect to MongoDB', err));

bot.start((ctx) => {
    const message = "👋 Welcome to Aptosphere! Use /connect_wallet to connect your Martian Wallet.";
    ctx.reply(message);
});

bot.command('connect_wallet', (ctx) => {
    const ngrokUrl = process.env.NGROK; // Replace with your ngrok URL
    const chatId = ctx.chat?.id; // Get chat ID

    // Construct the inline keyboard
    const inlineKeyboard: InlineKeyboardMarkup = {
        inline_keyboard: [
            [
                { text: 'Connect Wallet', url: `${ngrokUrl}?chatId=${chatId}` } as InlineKeyboardButton
            ]
        ]
    };

    ctx.reply('Please connect your Martian Wallet:', { reply_markup: inlineKeyboard });
});

bot.command('swap_tokens', async (ctx: Context) => {
    const swapInfo = "Please enter the tokens you want to swap in the format 'SEND_TOKEN RECEIVE_TOKEN AMOUNT' (e.g., 'APT USDC 0.1'):\nAvailable tokens: APT/USDC/USDT/WETH/USDD";
    await ctx.reply(swapInfo);
});

bot.on('text', async (ctx: Context) => {
    const message = ctx.message as any;

    if (message && message.text) {
        const input = message.text.trim();
        const tokens = input.split(' ');

        if (tokens.length === 3) {
            const [sendToken, receiveToken, quantityStr] = tokens;
            const chatId = ctx.chat?.id;

            if (!chatId) {
                await ctx.reply("Error: Chat ID not found.");
                return;
            }

            const quantity = parseFloat(quantityStr);

            if (isNaN(quantity) || quantity <= 0) {
                await ctx.reply("Invalid quantity. Please enter a valid number greater than 0.");
                return;
            }

            // Get the collection reference
            const collection = db.collection(process.env.DB_BOT);

            // Save the tokens to MongoDB
            if (db) {
                try {
                    await collection.updateOne(
                        { chatId, sendToken: sendToken.toUpperCase(), receiveToken: receiveToken.toUpperCase() },
                        {
                            $set: {
                                quantity,
                                timestamp: new Date()
                            }
                        },
                        { upsert: true }
                    );

                    // Get the exchange rate
                    const rate = await getSwapRate(db, chatId, sendToken.toUpperCase(), receiveToken.toUpperCase(), quantity);

                    if (rate === null) {
                        await ctx.reply("Error calculating exchange rate.");
                        return;
                    }

                    // Display exchange rate and ask for confirmation
                    const confirmationMarkup: InlineKeyboardMarkup = {
                        inline_keyboard: [
                            [
                                { text: 'Yes', callback_data: 'confirm_swap' },
                                { text: 'No', callback_data: 'cancel_swap' }
                            ]
                        ]
                    };

                    await ctx.reply(`Tokens to swap:\nSEND_TOKEN: ${sendToken.toUpperCase()}\nRECEIVE_TOKEN: ${receiveToken.toUpperCase()}\nQUANTITY: ${quantity}\n\nEstimated return: ${rate}\n\nDo you want to proceed with the swap?`, { reply_markup: confirmationMarkup });

                } catch (err) {
                    console.error('Error updating MongoDB:', err);
                    await ctx.reply("Error updating swap details.");
                }
            } else {
                await ctx.reply("Error: Database is not initialized.");
            }
        } else {
            await ctx.reply("Invalid format. Please enter the tokens in the format 'SEND_TOKEN RECEIVE_TOKEN QUANTITY' (e.g., 'APT USDC 0.1').");
        }
    } else {
        await ctx.reply("Error: No text message detected.");
    }
});

bot.action('confirm_swap', async (ctx: Context) => {
    // Retrieve the swap details from MongoDB and perform the swap
    const chatId = ctx.chat?.id;
    const collection = db.collection('token_swaps');
    const swapDetails = await collection.findOne({ chatId });

    if (!swapDetails) {
        await ctx.reply("Error: Swap details not found.");
        return;
    }

    // Call your swap function here
    // ...

    await ctx.reply("Swap transaction is being processed...");
});

bot.action('cancel_swap', (ctx: Context) => {
    ctx.reply("Swap canceled.");
});

bot.launch();
console.log('Bot is running...');
