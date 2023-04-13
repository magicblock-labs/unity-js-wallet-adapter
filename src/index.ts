import {
    WalletNotReadyError,
    WalletReadyState,
} from '@solana/wallet-adapter-base';
import { 
    PublicKey ,
    Transaction
} from '@solana/web3.js';

import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';



let wallets = [
    new PhantomWalletAdapter(),
]

wallets.forEach(wallet => {
    wallet.on('connect', () => {
        console.log('Wallet connected: [' + wallet.name + '], address: [' + wallet.publicKey + ']');
    });

    wallet.on('disconnect', () => {
        console.log('Wallet disconnected: [' + wallet.name + ']');
    });
});


async function connect(adapter): Promise<any> {
    if (adapter.connecting || adapter.connected){
        return;
    }

	const readyState = adapter?.readyState;

    console.log('wallet [' + adapter.name + '] state is [' + readyState + ']');

	if (!(readyState === WalletReadyState.Installed || readyState === WalletReadyState.Loadable)) {

        if (typeof window !== 'undefined') {
            window.open(adapter.url, '_blank');
        }

        throw new WalletNotReadyError();
    }

    try {
        await adapter.connect();
        return adapter;
    } catch (error) {
        console.error('Wallet error: [' + adapter.name + '], error: [' + error + ']');

        console.log('OnWalletErrorEvent', adapter.name);
    }
}

async function signTransaction(adapter, transactionStr): Promise<any> {
    if (!adapter || !adapter.connected){
        console.error('Not connected');
        return;
    }

    try {
        if (adapter && 'signTransaction' in adapter){
            console.log('transactionStr: ' + transactionStr);
            const transactionBuffer = Buffer.from(transactionStr, 'base64');
            console.log('transactionBuffer: ' + transactionBuffer);
            const transaction = Transaction.from(transactionBuffer);
            console.log(transaction.instructions);
            console.log(JSON.stringify(transaction));
            const signedTx = await adapter.signTransaction(transaction);
            console.log(signedTx);
            return signedTx

        } else {
            console.error('Signing not supported with this wallet');
    
            console.log('OnTransactionSignErrorEvent', adapter.name);
        }  
    } catch(error){
        console.log("signTransaction() exception:");
        console.log(error);

        console.log('OnTransactionSignErrorEvent', adapter.name);
    }
}


declare global {
    interface Window {
        walletAdapterLib:any;
        currentAdapter:any;
    }
}

interface WalletAdapterLibrary {
    connectWallet:  (walletName: string) => Promise<any>;
    signTransaction:  (walletName: string, transactionStr: string) => Promise<any>;
    getWallets: () => string;
}

function getWalletAdapterByName(walletName) {
    let walletIndex = wallets.findIndex(x => x.name === walletName);
    if (walletIndex === -1) {
        console.error('Wallet [' + walletName + '] not found');
        return null;
    }
    return wallets[walletIndex];
}

async function connectWallet(walletName) {
    let adapter = getWalletAdapterByName(walletName);
    await connect(adapter);
    console.log('connectWallet: Wallet [' + walletName + '] connected');
    console.log(adapter);
    if (adapter && adapter.publicKey) {
        console.log('connectWallet Bundled: Wallet [' + walletName + '] connected');
        return adapter.publicKey.toString();
    }
    console.error('connectWallet: Wallet [' + walletName + '] not connected');
}

async function signTransactionWallet(walletName, transactionStr) {
    console.log('signTransactionWallet: Wallet [' + walletName + '] signing transaction');
    let adapter = getWalletAdapterByName(walletName);
    const base64str = await signTransaction(adapter, transactionStr);
    console.log('signTransactionWallet: Wallet [' + walletName + '] signed transaction: ' + base64str);
    return base64str;
}

function getWallets() {
    const walletData = wallets.map(wallet => {
        return {
            name: wallet.name,
            installed: wallet.readyState == WalletReadyState.Installed,
            canSign: 'signMessage' in wallet
        }
    }
    );
    console.log('walletData');
    console.log(walletData);
    return JSON.stringify({wallets:walletData});
}

const walletAdapterLib: WalletAdapterLibrary = {
    connectWallet: connectWallet,
    signTransaction: signTransactionWallet,
    getWallets: getWallets
};

window.walletAdapterLib = walletAdapterLib;