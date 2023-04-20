import {
    WalletNotReadyError,
    WalletReadyState,
    isWalletAdapterCompatibleStandardWallet,
} from '@solana/wallet-adapter-base';
import {
    StandardWalletAdapter,
  } from "@solana/wallet-standard-wallet-adapter-base";
import { 
    Transaction
} from '@solana/web3.js';
import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";



let wallets : Array<StandardWalletAdapter> = [];

initWallets();


async function connect(adapter): Promise<any> {
    if (adapter.connecting || adapter.connected){
        return;
    }

	const readyState = adapter?.readyState;

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
    }
}

async function signTransaction(adapter, transactionStr): Promise<any> {
    if (!adapter || !adapter.connected){
        console.error('Not connected');
        return;
    }

    try {
        if (adapter && 'signTransaction' in adapter){
            const transactionBuffer = Buffer.from(transactionStr, 'base64');
            const transaction = Transaction.from(transactionBuffer);
            const signedTx = await adapter.signTransaction(transaction);
            return signedTx

        } else {
            console.error('Signing not supported with this wallet');
        }  
    } catch(error){
        console.log(error);
    }
}

async function signMessage(adapter, messageStr): Promise<Uint8Array> {
    if (!adapter || !adapter.connected){
        console.error('Not connected');
        return;
    }

    try {
        if (adapter && 'signMessage' in adapter){
            const message = new TextEncoder().encode(messageStr);
            const signature: Uint8Array = await adapter.signMessage(message);
            return signature

        } else {
            console.error('Signing not supported with this wallet');
        }  
    } catch(error){
        console.log(error);
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
    signMessage: (walletName: string, messageStr: string) => Promise<any>;
}

function getWalletAdapterByName(walletName) {
    let walletIndex = wallets.findIndex(x => x.name === walletName);
    if (walletIndex === -1) {
        return null;
    }
    return wallets[walletIndex];
}

async function connectWallet(walletName) {
    let adapter = getWalletAdapterByName(walletName);
    await connect(adapter);
    if (adapter && adapter.publicKey) {
        return adapter.publicKey.toString();
    }
}

async function signTransactionWallet(walletName, transactionStr) {
    let adapter = getWalletAdapterByName(walletName);
    const base64str = await signTransaction(adapter, transactionStr);
    return base64str;
}

async function signMessageWallet(walletName, messageStr) {
    let adapter = getWalletAdapterByName(walletName);
    const base64str = await signMessage(adapter, messageStr);
    return base64str;
}


function wrapWalletsInAdapters(
    wallets: ReadonlyArray<Wallet>
  ): Array<StandardWalletAdapter> {
    return wallets
      .filter(isWalletAdapterCompatibleStandardWallet )
      .map((wallet) => new StandardWalletAdapter({ wallet }));
  }

  function initWallets() {
    const { get, on } = getWallets();
    const walletsStandard = get();
    wallets = wrapWalletsInAdapters(walletsStandard);
    console.log(wallets);
  }

function getWalletsData() {
    if (wallets.length === 0) {
        initWallets();
    }
    const walletData = wallets.map(wallet => {
        return {
            name: wallet.name,
            installed: wallet.readyState == WalletReadyState.Installed,
        }
    }
    );
    return JSON.stringify({wallets:walletData});
}

const walletAdapterLib: WalletAdapterLibrary = {
    connectWallet: connectWallet,
    signTransaction: signTransactionWallet,
    getWallets: getWalletsData,
    signMessage: signMessageWallet,
    
};

window.walletAdapterLib = walletAdapterLib;