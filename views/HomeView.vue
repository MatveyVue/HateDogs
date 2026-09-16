<template>
<div class="home">

    <div class="modal-overlay" v-if="modalState !== 'hidden'">
        <div class="modal-card">
            <img class="modal-logo" :src="'/HateDogs.PNG'" width="70">

            <template v-if="modalState === 'checking'">
                <h2 class="modal-title">Checking NFTs</h2>
                <p class="modal-desc">Looking for a HateDogs NFT on your wallet</p>
                <div class="spinner"></div>
            </template>

            <template v-else-if="modalState === 'rewarded'">
                <h2 class="modal-title">Woof!</h2>
                <p v-if="tokensAwarded > 0" class="modal-reward">+{{ tokensAwarded.toLocaleString('en-US') }} HDOGS</p>
                <p v-else class="modal-reward">Your HDOGS are ready</p>
                <p class="modal-desc">Reward sent to your account</p>
            </template>

            <template v-else-if="modalState === 'no-nft'">
                <h2 class="modal-title">No NFT Found</h2>
                <p class="modal-desc">Buy a HateDogs NFT to earn tokens</p>
                <a style="text-decoration: none;" href="https://getgems.io/hatedogs" target="_blank" rel="noopener">
                    <button class="modal-btn">Buy NFT</button>
                </a>
            </template>
        </div>
    </div>

    <div class="banner">
        <img style="margin-top: 5%;" :src="'/HateDogs.PNG'" width="100px">
        <p class="banner-text"><b>Buy NFT<br>Hate Dogs</b></p>
        <a style="color: black; text-decoration: none;" href="https://getgems.io/hatedogs">
            <button class="banner-btn">Buy</button>
        </a>
    </div>

    <div class="wallet-wrap">
        <button
            v-if="!connectedAddress"
            class="wallet-btn"
            :disabled="connectingWallet"
            @click="connectWallet"
        >{{ connectingWallet ? 'Connecting…' : 'Connect Wallet' }}</button>
        <div v-else class="wallet-connected">
            <span class="wallet-addr">{{ shortAddr(connectedAddress) }}</span>
            <button class="wallet-x" title="Disconnect" @click="disconnectWallet">✕</button>
        </div>
    </div>

    <div class="curve"></div>

    <div class="balance">
        <h1 style="color: white; margin: 15%; font-weight: 800; font-size: 36px;">{{ userTokens.toLocaleString('en-US') }}</h1>
        <img style="margin-top: -50px;" :src="'/HateDogs.PNG'" width="250vw">
    </div>

    <button class="claim-btn">Claim</button>

    <div class="bar">
        <RouterLink to="/leaderboard">
            <button class="bar-btn">Leaders</button>
        </RouterLink>
        <RouterLink to="/">
            <button class="bar-btn-active">Home</button>
        </RouterLink>
        <RouterLink to="/tasks">
            <button class="bar-btn">Tasks</button>
        </RouterLink>
    </div>
</div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, increment, onSnapshot } from 'firebase/firestore';
import { getOwnedCollectionNfts } from '../services/nft';
import { NFT_REWARD_PER_ITEM } from '../config';
import { tonConnectUI, walletAddress } from '../walletStore';

const modalState = ref('hidden');
const tokensAwarded = ref(0);
const userTokens = ref(0);
const tgUser = ref(readTgUser());
const connectedAddress = walletAddress;
const connectingWallet = ref(false);

let unsubUser = null;
let hideTimer = null;
let processingAddress = null;

const tc = () => tonConnectUI.value;

function readTgUser() {
    try {
        return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    } catch (e) {
        return null;
    }
}

async function waitForTgUser(timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const u = readTgUser();
        if (u) return u;
        await new Promise((r) => setTimeout(r, 150));
    }
    return readTgUser();
}

function profileFromTg(tg, address) {
    const p = { address };
    if (tg?.username) p.username = tg.username;
    if (tg?.first_name) p.firstName = tg.first_name;
    if (tg?.photo_url) p.photoUrl = tg.photo_url;
    return p;
}

function subscribeUser(address) {
    if (unsubUser) {
        unsubUser();
        unsubUser = null;
    }
    unsubUser = onSnapshot(
        doc(db, 'users', address),
        (snap) => {
            userTokens.value = snap.exists() ? snap.data().tokens || 0 : 0;
        },
        (err) => console.error(err)
    );
}

function scheduleHide(ms = 2500) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        modalState.value = 'hidden';
    }, ms);
}

watch(walletAddress, async (addr) => {
    if (addr) {
        modalState.value = 'hidden';
        await handleConnected(addr);
    } else {
        userTokens.value = 0;
        modalState.value = 'hidden';
        if (unsubUser) {
            unsubUser();
            unsubUser = null;
        }
    }
}, { immediate: true });

watch(tgUser, (tg) => {
    if (tg && connectedAddress.value) {
        setDoc(
            doc(db, 'users', connectedAddress.value),
            profileFromTg(tg, connectedAddress.value),
            { merge: true }
        ).catch((err) => console.error(err));
    }
});

onUnmounted(() => {
    if (hideTimer) clearTimeout(hideTimer);
    if (unsubUser) unsubUser();
});

async function connectWallet() {
    const wc = tc();
    if (!wc || connectingWallet.value) return;
    connectingWallet.value = true;
    modalState.value = 'hidden';
    try {
        await wc.connectWallet();
    } catch (e) {
        console.error(e);
    } finally {
        connectingWallet.value = false;
    }
}

async function disconnectWallet() {
    const wc = tc();
    if (!wc || connectingWallet.value) return;
    connectingWallet.value = true;
    try {
        await wc.disconnect();
    } catch (e) {
        console.error(e);
    } finally {
        connectingWallet.value = false;
    }
}

const shortAddr = (address) => {
    if (!address) return '';
    return address.slice(0, 6) + '...' + address.slice(-4);
};

async function handleConnected(address) {
    if (processingAddress === address) return;
    processingAddress = address;

    const userRef = doc(db, 'users', address);

    try {
        connectedAddress.value = address;
        subscribeUser(address);

        const tgd = await waitForTgUser(1500);
        if (tgd) tgUser.value = tgd;

        const snap = await getDoc(userRef);
        const firstEnter = !snap.exists();
        const tg = tgUser.value;

        if (firstEnter) {
            await setDoc(userRef, {
                address,
                username: tg?.username || null,
                firstName: tg?.first_name || null,
                photoUrl: tg?.photo_url || null,
                tokens: 0,
                nftOwner: false,
                nftCount: 0,
                avatarUrl: null,
                joinedAt: serverTimestamp(),
                lastVisit: serverTimestamp()
            });
            await checkAndReward(userRef, address, 0, false);
        } else {
            const profile = tg ? profileFromTg(tg, address) : { address };
            await setDoc(userRef, {
                ...profile,
                lastVisit: serverTimestamp()
            }, { merge: true });
            await checkAndReward(userRef, address, snap.data().nftCount, true);
        }
    } catch (e) {
        console.error(e);
        modalState.value = 'error';
    } finally {
        processingAddress = null;
    }
}

async function checkAndReward(userRef, address, knownCount, silent = false) {
    if (!silent) modalState.value = 'checking';
    tokensAwarded.value = 0;
    try {
        const nfts = await getOwnedCollectionNfts(address);
        const newCount = nfts.length;
        const known = Number.isFinite(knownCount) ? knownCount : null;
        const oldCount = known == null ? newCount : known;
        const delta = Math.max(0, newCount - oldCount);
        const award = delta * NFT_REWARD_PER_ITEM;

        const update = {
            nftCount: newCount,
            nftOwner: newCount > 0,
            lastVisit: serverTimestamp()
        };
        if (newCount > 0) update.avatarUrl = nfts[0]?.image || null;
        if (delta > 0) update.tokens = increment(award);

        await setDoc(userRef, update, { merge: true });

        if (delta > 0) {
            tokensAwarded.value = award;
            modalState.value = 'rewarded';
            scheduleHide(2500);
        } else if (!silent) {
            if (newCount === 0) {
                modalState.value = 'no-nft';
            } else {
                modalState.value = 'hidden';
            }
            scheduleHide(2500);
        }
    } catch (e) {
        console.error(e);
        modalState.value = 'hidden';
    }
}
</script>

<style scoped>
.home {
    height: 100vh;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
}

.tg-hint {
    color: #e74c3c;
    font-size: 12px;
    font-weight: 700;
    margin: 10px 0 0;
    padding: 0 30px;
}

.wallet-wrap {
    display: flex;
    justify-content: center;
    margin: 8px 0;
    z-index: 10;
}

.wallet-btn {
    background: #0780d7;
    color: white;
    border: none;
    border-radius: 10px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 800;
    font-family: 'Nunito', sans-serif;
    cursor: pointer;
}

.wallet-btn:disabled {
    opacity: 0.6;
}

.wallet-connected {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #141414;
    border: 1px solid #262626;
    border-radius: 12px;
    padding: 5px 8px 5px 14px;
}

.wallet-addr {
    color: white;
    font-weight: 800;
    font-size: 13px;
    font-family: monospace;
}

.wallet-x {
    background: #1e1e1e;
    border: 1px solid #3a1e1e;
    color: #e74c3c;
    border-radius: 9px;
    width: 26px;
    height: 26px;
    font-size: 12px;
    font-weight: 800;
    font-family: 'Nunito', sans-serif;
    cursor: pointer;
}

.curve {
    background-color: black;
    width: 100%;
    height: 70px;
    margin-top: -98px;
    border-top-left-radius: 30px;
    border-top-right-radius: 30px;
}

.balance {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0 20px 150px;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    backdrop-filter: blur(4px);
}

.modal-card {
    width: 82%;
    max-width: 320px;
    background: #141414;
    border: 1px solid #262626;
    border-radius: 22px;
    padding: 28px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    animation: pop 0.3s ease-out;
}

@keyframes pop {
    from {
        opacity: 0;
        transform: scale(0.9);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.modal-logo {
    border-radius: 16px;
    margin-bottom: 14px;
}

.modal-title {
    color: white;
    font-weight: 800;
    font-size: 21px;
    margin: 4px 0 6px;
}

.modal-desc {
    color: #8a8a8a;
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 18px;
    line-height: 1.4;
}

.modal-reward {
    color: #2ecc71;
    font-weight: 800;
    font-size: 26px;
    margin: 6px 0;
}

.modal-btn {
    width: 100%;
    background: #0780d7;
    color: white;
    border: none;
    border-radius: 14px;
    padding: 13px 0;
    font-size: 15px;
    font-weight: 800;
    font-family: 'Nunito', sans-serif;
    cursor: pointer;
}

.spinner {
    width: 34px;
    height: 34px;
    margin: 10px auto 4px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: #0780d7;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
