document.getElementById('connectWallet').addEventListener('click', async () => {
    if (!window.martian) {
        alert('Martian Wallet is not installed. Please install it first.');
        window.open('https://www.martianwallet.xyz/', '_blank');
        return;
    }

    try {
        // Request connection
        await window.martian.connect();
        const { address: userAddress } = await window.martian.account();

        // Extract chatId from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chatId');

        // Send the wallet address and chatId to your server
        const response = await fetch('/api/save-wallet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userAddress, chatId })
        });

        if (response.ok) {
            alert('Wallet connected successfully!');
        } else {
            alert('Failed to connect wallet.');
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('An error occurred while connecting your wallet.');
    }
});
