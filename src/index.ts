import {
  Adapter,
  isWalletAdapterCompatibleStandardWallet,
  WalletNotReadyError,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import {StandardWalletAdapter} from "@solana/wallet-standard-wallet-adapter-base";
import {Cluster, Transaction, VersionedTransaction} from "@solana/web3.js";
import {getWallets} from "@wallet-standard/app";
import type {Wallet} from "@wallet-standard/base";
import {PhantomWalletAdapter, SolflareWalletAdapter,} from "@solana/wallet-adapter-wallets";
import {
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapter,
  SolanaMobileWalletAdapterWalletName,
} from "@solana-mobile/wallet-adapter-mobile";

import {Canvg} from "canvg";
import getIsMobile from "./environtment";

const defaultWalletAdapters: Array<Adapter> = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

function getUriForAppIdentity() {
  const location = globalThis.location;
  if (!location) return;
  return `${location.protocol}//${location.host}`;
}

function getMobileWalletAdapter(adapters: Array<Adapter>): Adapter {
  if (!getIsMobile(adapters)) {
    console.log("MobileWalletAdapter: Not mobile");
    return null;
  }
  if (!window.rpcCluster) {
    console.log("MobileWalletAdapter: rpcCluster not set");
    return null;
  }
  const existingMobileWalletAdapter = adapters.find(
    (adapter) => adapter.name === SolanaMobileWalletAdapterWalletName
  );
  if (existingMobileWalletAdapter) {
    return existingMobileWalletAdapter;
  }
  return new SolanaMobileWalletAdapter({
    addressSelector: createDefaultAddressSelector(),
    appIdentity: {
      uri: getUriForAppIdentity(),
    },
    cluster: window.rpcCluster,
    authorizationResultCache: createDefaultAuthorizationResultCache(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

const { get, on } = getWallets();

function getWalletAdapters(): Array<Adapter> {
  const standardAdapters = wrapWalletsInAdapters(get());
  const adaptersWithStandardAdapters = [
    ...defaultWalletAdapters.filter(
      (adapter) =>
        !standardAdapters.some((wallet) => wallet.name === adapter.name)
    ),
    ...standardAdapters,
  ] as Array<Adapter>;
  const mobileWalletAdapter = getMobileWalletAdapter(
    adaptersWithStandardAdapters
  );
  if (
    mobileWalletAdapter == null ||
    adaptersWithStandardAdapters.indexOf(mobileWalletAdapter) !== -1
  ) {
    return adaptersWithStandardAdapters;
  }
  return [mobileWalletAdapter, ...adaptersWithStandardAdapters];
}

let walletAdapters: Array<Adapter> = getWalletAdapters();

on("register", (...wallets) => {
  walletAdapters = [...walletAdapters, ...wrapWalletsInAdapters(wallets)];
});
on("unregister", (...wallets) => {
  walletAdapters = walletAdapters.filter((adapter) =>
    wallets.some((wallet) => wallet.name === adapter.name)
  );
});

const canvas: HTMLCanvasElement = document.createElement("canvas");
canvas.style.visibility = "hidden";

async function connect(adapter): Promise<any> {
  if (adapter.connecting || adapter.connected) {
    return;
  }

  const readyState = adapter?.readyState;

  if (
    !(
      readyState === WalletReadyState.Installed ||
      readyState === WalletReadyState.Loadable
    )
  ) {
    if (typeof window !== "undefined") {
      window.open(adapter.url, "_blank");
    }

    throw new WalletNotReadyError();
  }

  try {
    await adapter.connect();
    return adapter;
  } catch (error) {
    console.error(
      "Wallet error: [" + adapter.name + "], error: [" + error + "]"
    );
  }
}

async function signTransaction(adapter, transactionStr): Promise<any> {
  if (!adapter || !adapter.connected) {
    console.error("Not connected");
    return;
  }

  try {
    if (adapter && "signTransaction" in adapter) {
      const transactionBuffer = Buffer.from(transactionStr, "base64");
      let transaction: Transaction | VersionedTransaction;
      try {
        transaction = Transaction.from(transactionBuffer);
      } catch (e) {
        transaction = VersionedTransaction.deserialize(transactionBuffer);
      }
      return await adapter.signTransaction(transaction);
    } else {
      console.error("Signing not supported with this wallet");
    }
  } catch (error) {
    console.log(error);
  }
}

async function signMessage(adapter, messageStr): Promise<any> {
  if (!adapter || !adapter.connected) {
    console.error("Not connected");
    return;
  }

  try {
    if (adapter && "signMessage" in adapter) {
      const message = new TextEncoder().encode(messageStr);
      return await adapter.signMessage(message);
    } else {
      console.error("Signing not supported with this wallet");
    }
  } catch (error) {
    console.log(error);
  }
}

async function signAllTransactions(adapter, transactions): Promise<any> {
  if (!adapter || !adapter.connected) {
    console.error("Not connected");
    return;
  }

  try {
    if (adapter && "signAllTransactions" in adapter) {
      const transactionsList = transactions.map((transactionStr) => {
        return getTransactionFromStr(transactionStr);
      });
      return await adapter.signAllTransactions(transactionsList);
    } else {
      console.error("Signing not supported with this wallet");
    }
  } catch (error) {
    console.log(error);
  }
}

function refreshWalletAdapters() {
  walletAdapters = getWalletAdapters();
}

declare global {
  interface Window {
    walletAdapterLib: WalletAdapterLibrary;
    rpcCluster: Cluster;
  }
}

interface WalletAdapterLibrary {
  refreshWalletAdapters: () => void;
  connectWallet: (walletName: string) => Promise<any>;
  signTransaction: (walletName: string, transactionStr: string) => Promise<any>;
  signAllTransactions: (
    walletName: string,
    transactions: Array<string>
  ) => Promise<any>;
  getWallets: () => Promise<any>;
  signMessage: (walletName: string, messageStr: string) => Promise<any>;
  getTransactionFromStr: (
    transactionStr: string
  ) => Transaction | VersionedTransaction;
}

interface WalletData {
  name: string;
  installed: boolean;
  icon: string;
}

function getWalletAdapterByName(walletName) {
  let walletIndex = walletAdapters.findIndex((x) => x.name === walletName);
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
  return await signTransaction(adapter, transactionStr);
}

async function signAllTransactionsWallet(walletName, transactions) {
  let adapter = getWalletAdapterByName(walletName);
  return await signAllTransactions(adapter, transactions);
}

async function signMessageWallet(walletName, messageStr) {
  let adapter = getWalletAdapterByName(walletName);
  return await signMessage(adapter, messageStr);
}

function getTransactionFromStr(
  transactionStr
): Transaction | VersionedTransaction {
  const transactionBuffer = Buffer.from(transactionStr, "base64");
  let transaction: Transaction | VersionedTransaction;
  try {
    transaction = Transaction.from(transactionBuffer);
  } catch (e) {
    transaction = VersionedTransaction.deserialize(transactionBuffer);
  }
  return transaction;
}

function wrapWalletsInAdapters(
  wallets: ReadonlyArray<Wallet>
): Array<StandardWalletAdapter> {
  return wallets
    .filter(isWalletAdapterCompatibleStandardWallet)
    .map((wallet) => new StandardWalletAdapter({ wallet }));
}

async function getWalletIconPng(iconDataUrl) {
  let iconDataUrlPng: string;
  // When the icon format is SVG, we need to convert it to PNG
  if (iconDataUrl.startsWith("data:image/svg+xml")) {
    const context = canvas.getContext("2d");
    const svg = await Canvg.from(context, iconDataUrl);
    await svg.render();
    iconDataUrlPng = canvas.toDataURL();
  } else {
    iconDataUrlPng = iconDataUrl;
  }
  // Remove Encoding prefix
  return iconDataUrlPng.replace(/^data:image\/\w+;base64,/, "");
}

async function getWalletsData() {
  let walletsData: Array<WalletData> = [];

  for (let wallet of walletAdapters) {
    let icon = await getWalletIconPng(wallet.icon);
    walletsData.push({
      name: wallet.name,
      installed: wallet.readyState == WalletReadyState.Installed,
      icon: icon,
    });
  }
  return JSON.stringify({ wallets: walletsData });
}

const walletAdapterLib: WalletAdapterLibrary = {
  refreshWalletAdapters: refreshWalletAdapters,
  connectWallet: connectWallet,
  signTransaction: signTransactionWallet,
  signAllTransactions: signAllTransactionsWallet,
  getWallets: getWalletsData,
  signMessage: signMessageWallet,
  getTransactionFromStr: getTransactionFromStr,
};

window.walletAdapterLib = walletAdapterLib;
