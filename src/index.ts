import {
    Adapter,
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
import { PhantomWalletAdapter, SolflareWalletAdapter  } from '@solana/wallet-adapter-wallets';


import { Canvg } from "canvg";

const defaultWalletAdapters: Array<Adapter> = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
];

const { get, on } = getWallets();
let walletAdapters : Array<Adapter> = getWalletAdapters();

function getWalletAdapters () : Array<Adapter> {
    let standardAdapters = wrapWalletsInAdapters(get());
    let adapters =  defaultWalletAdapters.filter((adapter) => !standardAdapters.some((wallet) => wallet.name === adapter.name));
    return [...adapters, ...standardAdapters] as Array<Adapter>;
}

on('register', (...wallets) => {
    walletAdapters = [ ...walletAdapters, ...wrapWalletsInAdapters(wallets) ];
});
on('unregister', (...wallets) => {
    walletAdapters = walletAdapters.filter((adapter) => wallets.some((wallet) => wallet.name === adapter.name));
});



const canvas: HTMLCanvasElement = document.createElement('canvas');
canvas.style.visibility = 'hidden';


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
    getWallets: () => Promise<any>;
    signMessage: (walletName: string, messageStr: string) => Promise<any>;
}

interface WalletData {
    name: string;
    installed: boolean;
    icon: string;
}

function getWalletAdapterByName(walletName) {
    let walletIndex = walletAdapters.findIndex(x => x.name === walletName);
    if (walletIndex === -1) {
        return null;
    }
    return walletAdapters[walletIndex];
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
    wallets: ReadonlyArray<Wallet>,
  ): Array<StandardWalletAdapter> {
    return wallets
        .filter(isWalletAdapterCompatibleStandardWallet)
        .map((wallet) => new StandardWalletAdapter({wallet}));
}
    

async function getWalletIconPng(iconDataUrl) {
    let iconDataUrlPng: string;
    // When the icon format is SVG, we need to convert it to PNG
    if (iconDataUrl.startsWith('data:image/svg+xml')) {
        const context = canvas.getContext('2d');
        const svg = await Canvg.from(
            context,
            iconDataUrl
          );
        await svg.render();
        iconDataUrlPng = canvas.toDataURL();
    }
    else {
        iconDataUrlPng = iconDataUrl;
    }
    // Remove Encoding prefix
    return iconDataUrlPng.replace(/^data:image\/\w+;base64,/, '');
}





async function getWalletsData() {
    let walletsData: Array<WalletData> = [];
    
    for (let wallet of walletAdapters) {
        let icon = await getWalletIconPng(wallet.icon);
        walletsData.push({
            name: wallet.name,
            installed: wallet.readyState == WalletReadyState.Installed,
            icon: icon
        });
    }
    return JSON.stringify({wallets:walletsData});
}

const walletAdapterLib: WalletAdapterLibrary = {
    connectWallet: connectWallet,
    signTransaction: signTransactionWallet,
    getWallets: getWalletsData,
    signMessage: signMessageWallet,
    
};

window.walletAdapterLib = walletAdapterLib;