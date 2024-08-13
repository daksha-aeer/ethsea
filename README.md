# Aptosphere

Aptosphere enhances the Aptos blockchain experience with a user-friendly interface for wallet connections and token swaps. Users connect their Martian Wallet and perform Aptos token swaps directly through Telegram, streamlining the trading process.

## File Overview

- **index.html**: Provides the HTML structure for the wallet connection popup.
- **styles.css**: Contains styles for the wallet connection modal.
- **main.js**: Handles wallet connection logic and sends wallet data to the backend.
- **server.ts**: Sets up an Express server that handles wallet data, generates new Aptos accounts, and sends notifications via Telegram.
- **Bot.ts**: Manages the Telegram bot, including commands and interactions with users.
- **excRate.ts**: Retrieves and processes exchange rates for token swaps.
- **swapHandler.ts**: Handles the logic for swapping tokens and interacting with the Aptos blockchain.

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/daksha-aeer/ethsea.git
    cd ethsea
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Set up the environment variables** by creating a `.env` file in the root directory:
    ```plaintext
    TOKEN=your_telegram_bot_token
    MONGO_URI=your_mongodb_connection_string
    ADDRESS=your_wallet_address
    PRIVATE_KEY=your_private_key
    DB_BOT=token_swaps
    DB_SERVER=key_values
    NGROK=your_ngrok_url
    ```

4. **Run the server**:
    ```bash
    npm start
    ```
