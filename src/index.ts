import {
    WalletNotReadyError,
    WalletReadyState,
} from '@solana/wallet-adapter-base';


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

        sendUnityEvent('OnWalletErrorEvent', adapter.name);
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
}


async function connectWallet(walletName) {
    let walletIndex = wallets.findIndex(x => x.name === walletName);
    console.log('connectWallet: Wallet with name [' + walletName + ']');
    console.log(wallets);
    if (walletIndex < 0){
        console.error('connectWallet Bundle: Wallet with name [' + walletName + '] not found');
        return;
    }
    const adapter = wallets[walletIndex] 
    await connect(adapter);
    console.log('connectWallet: Wallet [' + walletName + '] connected');
    console.log(adapter);
    if (adapter && adapter.publicKey) {
        console.log('connectWallet Bundled: Wallet [' + walletName + '] connected');
        return adapter.publicKey.toString();
    }
    console.error('connectWallet: Wallet [' + walletName + '] not connected');
}


const walletAdapterLib: WalletAdapterLibrary = {
    connectWallet: connectWallet,
};

window.walletAdapterLib = walletAdapterLib
