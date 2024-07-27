import * as dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

dotenv.config();
const token = process.env.TOKEN;

const bot = new Telegraf(token as string);

bot.start((ctx) => {
    const message = "👋 Welcome to Aptosphere! Use /connect_wallet to connect your Martian Wallet.";
    ctx.reply(message);
});

bot.command('connect_wallet', (ctx) => {
    const ngrokUrl = 'https://d72d-2405-201-15-71c2-a8a8-bc19-8a6d-b71a.ngrok-free.app'; // ngrok URL
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

bot.launch();
console.log('Bot is running...');
