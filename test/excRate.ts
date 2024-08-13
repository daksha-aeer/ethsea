import { convertValueToDecimal, SDK } from '@pontem/liquidswap-sdk';
import { AptosAccount, HexString } from "aptos";
import { Db } from 'mongodb';
import { Decimal } from 'decimal.js';
import * as dotenv from 'dotenv';

dotenv.config();

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

    function convertDecimalToValue(decimalValue: Decimal, decimals: number): number {
        return decimalValue.div(Math.pow(10, decimals)).toNumber();
    }

    if (!user || !user.privateKey) {
        console.log('Error: Private key not found.');
        return null;
    }
    const sendDec = sendToken.toUpperCase() === 'APT' ? 8 : 6;
    const recDec = receiveToken.toUpperCase() === 'APT' ? 8 : 6;

    //0.000009 APT
    //0.00005 usd
    let firstGas: number
    let secondGas: number

    // firstGas = sendDec === 8? convertValueToDecimal(0.000009, 8) : convertValueToDecimal(0.00005, 6);
    // secondGas = recDec === 8? convertValueToDecimal(0.000009, 8) : convertValueToDecimal(0.00005, 6);

    if (sendDec == 8){
        firstGas = 900000
    }
    else{
        firstGas = 50
    }
    if (recDec == 8){
        secondGas = 900000
    }
    else{
        secondGas = 50
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

    const client = sdk.client;

    const fromTokenAddress = TOKEN_ADDRESSES[sendToken.toUpperCase()] || '';
    const toTokenAddress = TOKEN_ADDRESSES[receiveToken.toUpperCase()] || '';

    if (!fromTokenAddress || !toTokenAddress) {
        console.log('Error: Invalid token.');
        return null;
    }

    const privateKeyHex = process.env.PRIVATE_KEY;
    if (!privateKeyHex) {
        throw new Error("PRIVATE_KEY is not defined in the environment variables.");
    }
    const privateKeyBytes = HexString.ensure(privateKeyHex).toUint8Array();
    const account = new AptosAccount(privateKeyBytes);

    try {

        const registerPayload = {
            type: 'entry_function_payload',
            function: '0x1::managed_coin::register',
            type_arguments: [toTokenAddress],
            arguments: []
        };

        const registerTxn = await client.generateTransaction(account.address(), registerPayload);
        const signedRegisterTxn = await client.signTransaction(account, registerTxn);
        const registerTxnResult = await client.submitTransaction(signedRegisterTxn);
        await client.waitForTransaction(registerTxnResult.hash);
        console.log(`CoinStore registered successfully: ${registerTxnResult.hash}`);

        const valToDec = convertValueToDecimal(swapAmt, sendDec)
        let calcSend = valToDec.minus(firstGas);
        console.log("first gas: ", calcSend)

        // Get exchange rate
        const output = await sdk.Swap.calculateRates({
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            amount: calcSend,
            curveType: 'uncorrelated',
            interactiveToken: 'from',
            version: 0
        });

        // const gasOutput = new Decimal(output).minus(new Decimal(secondGas));
        const gasOutput = new Decimal(output)
        console.log("second gas: ", gasOutput.toString()); // Use toString for proper logging

        // Convert gasOutput back to a number if needed
        let aprRate = convertDecimalToValue(gasOutput, recDec);
        console.log("Rate: ", aprRate);
        return aprRate;

        // const firstOutput = convertDecimalToValue(new Decimal(output), recDec);

        // // Convert `secondGas` to number for arithmetic operation
        // const secondGasNumber = convertDecimalToValue(secondGas, recDec);

        // // Perform the subtraction
        // const calcOutput = firstOutput - secondGasNumber;

        // return calcOutput
    } catch (e) {
        console.log('Error during rate calculation:', e);
        return null;
    }
}
