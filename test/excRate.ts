import { convertValueToDecimal, SDK } from '@pontem/liquidswap-sdk';
import { AptosAccount, HexString } from "aptos";
import { Db } from 'mongodb';
import { Decimal } from 'decimal.js';

const TOKEN_ADDRESSES: { [key: string]: string } = {
    'APT': '0x1::aptos_coin::AptosCoin',
    'USDC': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    'USDT': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
    'WETH': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
    'USDD': '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDD',
};

export async function getSwapRate(db: Db, chatId: number, sendToken: string, receiveToken: string, swapAmt: number) {
    const userCollection = db.collection('key_values');
    const chatIdStr = chatId.toString();
    const user = await userCollection.findOne({ chatId: chatIdStr });

    function convertDecimalToValue(decimalValue: number, decimals: number): number {
        return decimalValue / Math.pow(10, decimals);
    }

    let sendDec: number;
    let recDec: number;

    if (!user || !user.privateKey) {
        console.log('Error: Private key not found.');
        return null;
    }
    if (sendToken == 'APT') {
        sendDec = 8
    }
    else {
        sendDec = 6
    }
    if (receiveToken == 'APT') {
        recDec = 8
    }
    else {
        recDec = 6
    }

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

    const fromTokenAddress = TOKEN_ADDRESSES[sendToken.toUpperCase()] || '';
    const toTokenAddress = TOKEN_ADDRESSES[receiveToken.toUpperCase()] || '';

    if (!fromTokenAddress || !toTokenAddress) {
        console.log('Error: Invalid token.');
        return null;
    }

    try {
        // Get exchange rate
        const output = await sdk.Swap.calculateRates({
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            amount: convertValueToDecimal(swapAmt, sendDec),
            curveType: 'uncorrelated',
            interactiveToken: 'from',
            version: 0
        });

        return convertDecimalToValue(new Decimal(output).toNumber(), recDec);
    } catch (e) {
        console.log('Error during rate calculation:', e);
        return null;
    }
}
