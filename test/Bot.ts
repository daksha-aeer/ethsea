import { AptosClient, AptosAccount, HexString, CoinClient } from "aptos";
import * as dotenv from 'dotenv';
import { Telegraf, Context } from 'telegraf';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import { getSwapRate } from './excRate';
import { performSwap } from './swapHandler';
import { Decimal } from 'decimal.js';

dotenv.config();
const token = process.env.TOKEN;
const mongoUri = process.env.MONGO_URI;

const bot = new Telegraf(token as string);

// MongoDB setup
const client = new MongoClient(mongoUri as string);
let db: any;
const aptClient = new AptosClient("https://fullnode.mainnet.aptoslabs.com/v1");
const coinClient = new CoinClient(aptClient);

client.connect().then(async () => {
    console.log('Connected to MongoDB');
    db = client.db('aptos_bot');
    const collection = db.collection(process.env.DB_BOT as string);
    await collection.createIndex(
        { chatId: 1, sendToken: 1, receiveToken: 1 },
        { unique: true }
    );
}).catch(err => console.error('Failed to connect to MongoDB', err));

// List of coin types
const coins = [
    "0x1::aptos_coin::AptosCoin",
    "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
    "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
    "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
    "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDD"
];

async function fetchAptosCoinData() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ids: 'aptos',
                vs_currencies: 'usd',
                include_market_cap: 'true',
                include_24hr_change: 'true'
            }
        });

        const data = response.data.aptos;
        return {
            currentPrice: data.usd,
            priceChangePercentage: data.usd_24h_change
        };
    } catch (error) {
        console.error('Error fetching Aptos Coin data:', error);
        return null;
    }
}

function convertBigIntToValue(balance: bigint, decimals: number): Decimal {
    return new Decimal(balance.toString()).div(new Decimal(10).pow(decimals));
}

function getTokenDetails(typeArguments: string[]): { token: string, decimals: number } {
    if (!typeArguments || typeArguments.length === 0) {
        console.error('Error: typeArguments is undefined or empty');
        return { token: 'Unknown', decimals: 6 }; // Default values
    }

    const tokenType = typeArguments[0];
    
    if (tokenType.includes('AptosCoin')) {
        return { token: 'APT', decimals: 8 };
    } else if (tokenType.includes('USDC')) {
        return { token: 'USDC', decimals: 6 };
    } else if (tokenType.includes('USDT')) {
        return { token: 'USDT', decimals: 6 };
    } else if (tokenType.includes('WETH')) {
        return { token: 'WETH', decimals: 18 };
    } else if (tokenType.includes('USDD')) {
        return { token: 'USDD', decimals: 6 };
    } else {
        console.error(`Error: Unrecognized token type - ${tokenType}`);
        return { token: 'Unknown', decimals: 6 }; // Default to 6 decimals if token type is unknown
    }
}

bot.start((ctx) => {
    const message = "👋 Welcome to Aptosphere! Use /connect_wallet to connect your Martian Wallet.";
    ctx.reply(message);
});

bot.command('connect_wallet', (ctx) => {
    const ngrokUrl = process.env.NGROK;
    const chatId = ctx.chat?.id;

    if (!chatId) {
        ctx.reply("Error: Chat ID not found.");
        return;
    }

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

// Function to convert BigInt to a human-readable number with the correct number of decimals
// function convertBigIntToValue(balance: bigint, decimals: number): number {
//     return Number(balance) / Math.pow(10, decimals);
// }

// Updated function to handle transactions and display the correct amount based on token type
bot.command('transaction_history', async (ctx: Context) => {
    const chatId = ctx.chat?.id;

    if (!chatId) {
        await ctx.reply("Error: Chat ID not found.");
        return;
    }

    const collection = db.collection(process.env.DB_SERVER as string);
    const chatIdString = chatId.toString();

    const user = await collection.findOne({ chatId: chatIdString });

    if (!user || !user.user_address) {
        await ctx.reply("Wallet not connected. Please connect your wallet using /connect_wallet.");
        return;
    } else {
        await ctx.reply("Wallet connected, checking transactions...");
    }

    const walletAddress = user.user_address;

    // Fetch transaction history from the Aptos API
    const options = { method: 'GET', headers: { accept: 'application/json' } };
    const apiUrl = `https://aptos-mainnet.nodereal.io/v1/551babb6f63340e882a1ac621dc3d8d1/v1/accounts/${walletAddress}/transactions?limit=5`;

    try {
        const response = await fetch(apiUrl, options);
        const transactions = await response.json();

        if (!transactions || transactions.length === 0) {
            await ctx.reply("No recent transactions found.");
            return;
        }

        let transactionMessage = "Recent Transactions:\n";

        for (const tx of transactions) {
            const txHash = tx.hash;
            const sender = tx.sender;
            let receiver = 'Unknown';
            let amount = '0';
            let token = 'USDC'; // Default token type

            // Determine token type and decimals based on the transaction payload
            const payloadType = tx.payload?.type_arguments?.[0];
            const decimals = payloadType?.includes('aptos_coin') ? 8 : 6;

            // Extract amount and receiver from events
            for (const event of tx.events) {
                if (event.type.includes('WithdrawEvent')) {
                    amount = event.data?.amount || '0';
                    amount = convertBigIntToValue(BigInt(amount), decimals).toFixed(2);
                } else if (event.type.includes('DepositEvent')) {
                    receiver = event.guid.account_address || 'Unknown';
                }
            }

            // Update token type based on payload
            if (payloadType?.includes('USDC')) {
                token = 'USDC';
            } else if (payloadType?.includes('aptos_coin')) {
                token = 'APT';
            }

            // Construct message for each transaction
            transactionMessage += `Tx Hash: ${txHash}\nSender: ${sender}\nReceiver: ${receiver}\nAmount: ${amount} ${token}\n\n`;
        }

        await ctx.reply(transactionMessage);

    } catch (error) {
        console.error('Error fetching transaction history:', error);
        await ctx.reply("Error fetching transaction history.");
    }
});


bot.command('balance', async (ctx: Context) => {
    const chatId = ctx.chat?.id;

    if (!chatId) {
        await ctx.reply("Error: Chat ID not found.");
        return;
    }

    const collection = db.collection(process.env.DB_BOT as string);
    const chatIdString = chatId.toString();

    const user = await collection.findOne({ chatId: chatIdString });

    if (!user || !user.user_address) {
        await ctx.reply("Wallet not connected. Please connect your wallet using /connect_wallet.");
        return;
    } else {
        await ctx.reply("Wallet connected, checking balance...");
    }

    const walletAddress = user.user_address;

    let balanceMessage = "";
    let foundNonZeroBalance = false;

    for (const coinType of coins) {
        try {
            const balance = await coinClient.checkBalance(walletAddress, { coinType });

            if (balance > 0n) {
                let tokenName = coinType.split("::").pop();
                let decimals = 6;

                if (tokenName === "AptosCoin") {
                    tokenName = "APT";
                    decimals = 8;
                }

                const formattedBalance = convertBigIntToValue(balance, decimals);
                balanceMessage += `${tokenName}: ${formattedBalance.toFixed(8)}\n`; // Ensure a fixed number of decimal places
                foundNonZeroBalance = true;
            }
        } catch (error: any) {
            if (error.errorCode === 'resource_not_found') {
                console.log(`Resource not found for coin type: ${coinType}`);
            } else {
                console.error(`Error checking balance for ${coinType}:`, error);
            }
        }
    }

    if (!foundNonZeroBalance) {
        balanceMessage = "You have a zero balance for all supported tokens.";
    }

    // Fetch and display Aptos Coin details
    const aptosCoinData = await fetchAptosCoinData();

    if (aptosCoinData) {
        const aptBalanceStr = balanceMessage.split('\n').find(line => line.startsWith('APT:'));
        const formattedBalanceStr = aptBalanceStr ? aptBalanceStr.split(': ')[1] : '0.00';
        const formattedBalance = parseFloat(formattedBalanceStr);

        const formattedPrice = aptosCoinData.currentPrice.toFixed(2);
        const priceChangePercentage = aptosCoinData.priceChangePercentage.toFixed(2);

        // Convert balance to dollars
        const dollarValue = (formattedBalance * aptosCoinData.currentPrice).toFixed(2);

        // Adjust spacing and format the details
        const aptosDetails = `Aptos Coin: ${formattedBalance.toFixed(8)} APT\n` +
            `$${formattedPrice} (${priceChangePercentage}%): ~$${dollarValue}`;

        // Combine Aptos Coin details with other token balances
        const combinedMessage = `Your account balances:\n${aptosDetails}\n\n${balanceMessage}`;

        await ctx.reply(combinedMessage);
    } else {
        await ctx.reply("Unable to fetch Aptos Coin data.");
    }
});

// Bot.ts
bot.on('text', async (ctx: Context) => {
    const message = ctx.message;

    // Ensure ctx.message is defined and has a text property
    if (message && 'text' in message) {
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

            const collection = db.collection(process.env.DB_BOT as string);

            await collection.deleteMany({ chatId });

            try {
                await collection.insertOne({
                    chatId,
                    sendToken: sendToken.toUpperCase(),
                    receiveToken: receiveToken.toUpperCase(),
                    quantity,
                    timestamp: new Date()
                });

                const rate = await getSwapRate(db, chatId, sendToken.toUpperCase(), receiveToken.toUpperCase(), quantity);

                if (rate === null) {
                    await ctx.reply("Error calculating exchange rate.");
                    return;
                }

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
            await ctx.reply("Invalid format. Please enter the tokens in the format 'SEND_TOKEN RECEIVE_TOKEN QUANTITY' (e.g., 'APT USDC 0.1').");
        }
    } else {
        await ctx.reply("Error: No text message detected.");
    }
});



bot.action('confirm_swap', async (ctx: Context) => {
    const chatId = ctx.chat?.id;

    if (!chatId) {
        await ctx.reply("Error: Chat ID not found.");
        return;
    }

    const collection = db.collection(process.env.DB_BOT as string);
    const swapDetails = await collection.findOne({ chatId: chatId });

    if (!swapDetails) {
        await ctx.reply("Error: Swap details not found.");
        return;
    }

    const { sendToken, receiveToken, quantity } = swapDetails;

    if (!sendToken || !receiveToken || quantity == null) {
        await ctx.reply("Error: Missing token details.");
        return;
    }

    await ctx.reply("Swap transaction is being processed...");
    const transHash = await performSwap(db, chatId, sendToken, receiveToken);

    const explorerUrl = `https://tracemove.io/transaction/${transHash}`;

    await ctx.reply(`Transferred tokens with transaction hash: ${transHash}\nYou can view the transaction here: ${explorerUrl}`);    
});

bot.action('cancel_swap', (ctx: Context) => {
    ctx.reply("Swap canceled.");
});


bot.launch();
console.log('Bot is running...');
