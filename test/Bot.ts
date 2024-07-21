import * as dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();
const token = process.env.TOKEN;
// console.log(token)

const bot = new Telegraf(token as string)

bot.start((ctx) => {

    const message = "👋 Welcome to Aptosphere!"
    ctx.reply(message)

});

bot.launch()
console.log('Bot is running...');