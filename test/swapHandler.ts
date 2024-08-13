import { convertValueToDecimal, SDK } from '@pontem/liquidswap-sdk';
import { AptosAccount, HexString, CoinClient, AptosClient } from "aptos";
import { Decimal } from 'decimal.js';
import { Db } from 'mongodb';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

const TOKEN_ADDRESSES: { [key: string]: string } = {
    'APT': '0x1::aptos_coin::AptosCoin',
    'USDC': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    'USDT': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
    'WETH': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
    'USDD': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDD',
};

class AptosTokenTransfer {
    private client: AptosClient;

    constructor(nodeUrl: string) {
        this.client = new AptosClient(nodeUrl);
    }

    private async generateTransaction(senderAddress: HexString, payload: any) {
        const txnRequest = await this.client.generateTransaction(senderAddress, payload);
        return txnRequest;
    }

    private async signTransaction(sender: AptosAccount, rawTxn: any) {
        const signedTxn = await this.client.signTransaction(sender, rawTxn);
        return signedTxn;
    }

    private async submitTransaction(bcsTxn: any) {
        const pendingTxn = await this.client.submitTransaction(bcsTxn);
        await this.client.waitForTransaction(pendingTxn.hash);
        return pendingTxn;
    }

    async transferCoin(sender: AptosAccount, receiverAddress: HexString, amount: number | bigint, coinType: string): Promise<string> {
        const rawTxn = await this.generateTransaction(sender.address(), {
            function: "0x1::aptos_account::transfer_coins",
            type_arguments: [coinType],
            arguments: [receiverAddress.hex(), amount],
        });

        const bcsTxn = await this.signTransaction(sender, rawTxn);
        const pendingTxn = await this.submitTransaction(bcsTxn);

        return pendingTxn.hash;
    }
}

export async function performSwap(db: Db, chatId: number, sendToken: string, receiveToken: string) {

    try {
        const privateKeyHex = process.env.PRIVATE_KEY;
        if (!privateKeyHex) {
            throw new Error("PRIVATE_KEY is not defined in the environment variables.");
        }
        const privateKeyBytes = HexString.ensure(privateKeyHex).toUint8Array();
        const account = new AptosAccount(privateKeyBytes);

        const sdk = new SDK({
            nodeUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
            networkOptions: {
                nativeToken: '0x1::aptos_coin::AptosCoin',
                modules: {
                    Scripts: '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::scripts_v2',
                    CoinInfo: '0x1::coin::CoinInfo',
                    CoinStore: '0x1::coin::CoinStore'
                },
                resourceAccount: '0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948',
                moduleAccount: '0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12',
                moduleAccountV05: '0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e',
                resourceAccountV05: '0x61d2c22a6cb7831bee0f48363b0eec92369357aece0d1142062f7d5d85c7bef8'
            }
        });

        const aptClient = new AptosClient("https://fullnode.mainnet.aptoslabs.com/v1");
        const coinClient = new CoinClient(aptClient);

        const fromTokenAddress = TOKEN_ADDRESSES[sendToken.toUpperCase()] || '';
        const toTokenAddress = TOKEN_ADDRESSES[receiveToken.toUpperCase()] || '';

        if (!fromTokenAddress || !toTokenAddress) {
            console.log('Error: Invalid token.');
            return null;
        }

        const sendDec = sendToken.toUpperCase() === 'APT' ? 8 : 6;
        const recDec = receiveToken.toUpperCase() === 'APT' ? 8 : 6;

        let firstGas: number = sendDec === 8 ? 900000 : 50;
        let secondGas: number = recDec === 8 ? 900000 : 50;

        const getBalance = async () => {
            return await coinClient.checkBalance(account.address(), {
                coinType: fromTokenAddress,
            });
        };
        console.log("Balance:", getBalance)

        const notifyUser = async () => {
            const botToken = process.env.TOKEN;
            if (botToken) {
                const bot = new Telegraf(botToken);
                const chatIdString = chatId.toString();
                await bot.telegram.sendMessage(chatIdString, `Please send the amount to the address: 0x87385b46d8e40c648f29dca2565e014592d921ab6e48d5cbeae3b37dc89c89f7`);
            }
        };

        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            await notifyUser();

            const checkInterval = 15 * 1000; // 15 seconds
            const timeout = 10 * 60 * 1000; // 10 minutes

            const startTime = Date.now();
            let initialBalance = await getBalance();
            console.log(`Initial balance: ${initialBalance}`);

            const userCollection = db.collection("token_swaps");
            // const chatIdStr = chatId.toString();

            console.log(`Querying for user with chatId: ${chatId}`);
            const user = await userCollection.findOne({ chatId: chatId });

            if (!user) {
                console.error(`User with chatId ${chatId} not found.`);
            } else {
                console.log(`User found: ${JSON.stringify(user)}`);
            }

            while (Date.now() - startTime < timeout) {
                const newBalance = await getBalance();
                console.log(`New balance: ${newBalance}`);

                if (!user) {
                    console.error(`User with chatId ${chatId} not found.`);
                    return null;
                }

                let convUser = convertValueToDecimal(user.quantity, sendDec).minus(firstGas);

                if (BigInt(newBalance) >= BigInt(convUser.toFixed(0))) {
                    console.log("Received the transferred tokens, proceeding with the swap.");
                    initialBalance = BigInt(convUser.toFixed(0));
                    break;
                } else {
                    console.log("Waiting for the transaction to settle...");
                    await wait(checkInterval);
                }
            }

            if (BigInt(initialBalance) === BigInt(0)) {
                console.log("Timeout: Tokens were not received in the account after 10 minutes. Canceling the transaction.");
                return null;
            }

            const convAmt = Number(initialBalance);

            const output = await sdk.Swap.calculateRates({
                fromToken: fromTokenAddress,
                toToken: toTokenAddress,
                amount: convAmt,
                curveType: 'uncorrelated',
                interactiveToken: 'from',
                version: 0
            });

            const toAmt = new Decimal(output);

            const txPayload = sdk.Swap.createSwapTransactionPayload({
                fromToken: fromTokenAddress,
                toToken: toTokenAddress,
                fromAmount: convAmt,
                toAmount: toAmt.toNumber(), // The calculated amount after swap
                interactiveToken: 'from',
                slippage: 0.005, // 0.5% slippage
                stableSwapType: 'high',
                curveType: 'uncorrelated',
                version: 0
            });

            const rawTxn = await aptClient.generateTransaction(account.address(), txPayload);
            const bcsTxn = await aptClient.signTransaction(account, rawTxn);
            const { hash } = await aptClient.submitTransaction(bcsTxn);
            await aptClient.waitForTransaction(hash);
            console.log(`Swap transaction ${hash} is submitted.`);

            // Retrieve the new account address
            const oguserCollection = db.collection("key_values");
            const chatIdStr = chatId.toString();
            const ogUser = await oguserCollection.findOne({ chatId: chatIdStr });

            if (!ogUser || !ogUser.user_address) {
                console.log('User or new account address not found.');
                return;
            }

            // Instantiate AptosTokenTransfer
            const transfer = new AptosTokenTransfer("https://fullnode.mainnet.aptoslabs.com/v1");

            try {
                const receiverAddress = new HexString(ogUser.user_address);
                const txnHash = await transfer.transferCoin(account, receiverAddress, toAmt.toNumber(), toTokenAddress);
                console.log(`Transferred tokens back to user with transaction hash: ${txnHash}`);
                return txnHash
            } catch (e) {
                console.error('Error during token transfer:', e);
                return null;
            }

        } catch (e) {
            console.error('Error during rate calculation or swap execution:', e);
            return null;
        }
    } catch (e) {
        console.error('Error retrieving user data from MongoDB:', e);
        return null;
    }
}
