<template>
<div class="leaderpage">
    <div class="banner">
        <img style="margin-top: 5%;" :src="'/HateDogs.PNG'" width="100px">
        <p class="banner-text"><b>Buy NFT<br>Hate Dogs</b></p>
        <a style="color: black; text-decoration: none;" href="https://getgems.io/hatedogs">
            <button class="banner-btn">Buy</button>
        </a>
    </div>

    <div class="curve"></div>

    <div class="lb-body">
        <h1 class="title">Leaderboard</h1>

        <div class="list">
            <div
                v-for="(p, i) in players"
                :key="p.id"
                class="row"
                :class="{ me: p.id === me, gold: i === 0, silver: i === 1, bronze: i === 2 }"
                :style="{ animationDelay: (i * 0.05) + 's' }"
            >
                <span class="rank">
                    <template v-if="i === 0">🥇</template>
                    <template v-else-if="i === 1">🥈</template>
                    <template v-else-if="i === 2">🥉</template>
                    <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="avatar" :style="{ background: avatarBg(p.id) }">
                    <img v-if="p.photoUrl || p.avatarUrl" :src="p.photoUrl || p.avatarUrl" alt="" class="avatar-img">
                    <template v-else>🐶</template>
                </span>
                <div class="info">
                    <div class="name">
                        {{ displayName(p) }}
                        <span v-if="p.id === me" class="you-tag">You</span>
                    </div>
                </div>
                <span class="score">{{ (p.tokens || 0).toLocaleString('en-US') }}</span>
            </div>

            <div v-if="empty" class="empty">No players yet</div>
        </div>
    </div>

    <div class="bar">
        <RouterLink to="/leaderboard">
            <button class="bar-btn-active">Leaders</button>
        </RouterLink>
        <RouterLink to="/">
            <button class="bar-btn">Home</button>
        </RouterLink>
        <RouterLink to="/tasks">
            <button class="bar-btn">Tasks</button>
        </RouterLink>
    </div>
</div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { TonConnectUIContext } from 'ton-ui-vue';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

const tonConnectUI = inject(TonConnectUIContext);

const players = ref([]);
const me = ref('');
const empty = computed(() => players.value.length === 0);

let unsub = null;
let unsubStatus = null;
let setupDone = false;

const tc = () => tonConnectUI?.value;

function setupWallet() {
    const wc = tc();
    if (!wc || setupDone) return;
    setupDone = true;

    me.value = wc.wallet?.account?.address || '';
    unsubStatus = wc.onStatusChange((wallet) => {
        me.value = wallet?.account?.address || '';
    });
}

onMounted(() => {
    const q = query(
        collection(db, 'users'),
        where('tokens', '>=', 1),
        orderBy('tokens', 'desc')
    );

    unsub = onSnapshot(
        q,
        (snap) => {
            players.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        },
        (err) => console.error(err)
    );

    setupWallet();
    watch(tonConnectUI, () => setupWallet());
});

onUnmounted(() => {
    if (unsub) unsub();
    if (unsubStatus) unsubStatus();
});

const shortAddress = (address) => {
    if (!address) return '';
    return address.slice(0, 6) + '...' + address.slice(-4);
};

const displayName = (p) => {
    if (p.username) return '@' + p.username;
    if (p.firstName) return p.firstName;
    return shortAddress(p.id);
};

const colors = ['#0780d7', '#7d5ba6', '#2e9e6b', '#e67e22', '#e74c3c', '#f1c40f', '#3498db', '#8e44ad'];

const avatarBg = (id) => {
    if (!id) return '#0780d733';
    let h = 0;
    for (const c of id) h = (h + c.charCodeAt(0)) % colors.length;
    return colors[h] + '33';
};
</script>

<style scoped>
.leaderpage {
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.curve {
    background-color: black;
    width: 100%;
    height: 80px;
    margin-top: -50px;
    border-top-left-radius: 30px;
    border-top-right-radius: 30px;
}

.lb-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 16px;
}

.title {
    color: white;
    font-weight: 800;
    font-size: 22px;
    margin: -62px 0 14px 0;
}

.list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 2px 2px 8px;
    scrollbar-width: none;
}

.list::-webkit-scrollbar {
    display: none;
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(14px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #141414;
    border: 1px solid #1e1e1e;
    border-radius: 14px;
    padding: 10px 12px;
    margin-bottom: 8px;
    animation: slideUp 0.45s ease-out backwards;
}

.row.gold {
    border-color: rgba(247, 201, 72, 0.6);
    background: linear-gradient(90deg, rgba(247, 201, 72, 0.12), #141414 60%);
}

.row.silver {
    border-color: rgba(192, 199, 207, 0.5);
    background: linear-gradient(90deg, rgba(192, 199, 207, 0.1), #141414 60%);
}

.row.bronze {
    border-color: rgba(205, 127, 50, 0.5);
    background: linear-gradient(90deg, rgba(205, 127, 50, 0.1), #141414 60%);
}

.row.me {
    border-color: #0780d7;
    box-shadow: 0 0 16px rgba(7, 128, 215, 0.35);
}

.rank {
    width: 26px;
    color: #6a6a6a;
    font-weight: 800;
    font-size: 15px;
    text-align: center;
    flex-shrink: 0;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 1px solid #2a2a2a;
    overflow: hidden;
    flex-shrink: 0;
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.info {
    flex: 1;
    min-width: 0;
}

.name {
    color: white;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.you-tag {
    background: #0780d7;
    color: white;
    font-size: 10px;
    font-weight: 800;
    padding: 1px 7px;
    border-radius: 9px;
    flex-shrink: 0;
}

.score {
    color: white;
    font-weight: 800;
    font-size: 14px;
    flex-shrink: 0;
}

.empty {
    color: #6a6a6a;
    font-weight: 700;
    text-align: center;
    padding: 40px 0;
}
</style>