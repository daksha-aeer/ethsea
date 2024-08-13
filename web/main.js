// document.getElementById('connectWallet').addEventListener('click', async () => {
//     if (!window.martian) {
//         alert('Martian Wallet is not installed. Please install it first.');
//         window.open('https://www.martianwallet.xyz/', '_blank');
//         return;
//     }

//     try {
//         // Request connection
//         await window.martian.connect();
//         const { address: userAddress } = await window.martian.account();

//         // Extract chatId from URL query parameters
//         const urlParams = new URLSearchParams(window.location.search);
//         const chatId = urlParams.get('chatId');

//         // Send the wallet address and chatId to your server
//         const response = await fetch('/api/save-wallet', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ userAddress, chatId })
//         });

//         if (response.ok) {
//             alert('Wallet connected successfully!');
//         } else {
//             alert('Failed to connect wallet.');
//         }
//     } catch (error) {
//         console.error('Error connecting wallet:', error);
//         alert('An error occurred while connecting your wallet.');
//     }
// });

document.addEventListener('DOMContentLoaded', function() {
    const popup = document.getElementById('popup');
    const closePopupButton = document.getElementById('closePopup');
    const connectWalletButton = document.getElementById('connectWalletModalButton');

    // Show the popup immediately when the page is loaded
    popup.style.display = 'flex';

    // Hide the popup when the close button is clicked
    closePopupButton.addEventListener('click', function() {
        popup.style.display = 'none';
    });

    // Handle wallet connection when the "Connect Wallet" button in the popup is clicked
    connectWalletButton.addEventListener('click', async () => {
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
            const chatId = new URLSearchParams(window.location.search).get('chatId');

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
                popup.style.display = 'none'; // Hide the popup after successful connection
            } else {
                alert('Failed to connect wallet.');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert('An error occurred while connecting your wallet.');
        }
    });
});
