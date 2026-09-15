<template>
<div class="taskpage">
    <div class="banner">
        <img style="margin-top: 5%;" :src="'/HateDogs.PNG'" width="100px">
        <p class="banner-text"><b>Buy NFT<br>Hate Dogs</b></p>
        <a style="color: black; text-decoration: none;" href="https://getgems.io/hatedogs">
            <button class="banner-btn">Buy</button>
        </a>
    </div>

    <div class="curve"></div>

    <div class="tasks-body">
        <div class="header">
            <h1 class="title">Tasks</h1>
            <button v-if="isAdmin" class="admin-btn" @click="adminMode = !adminMode">⚙ Admin</button>
        </div>

        <div v-if="adminMode && isAdmin" class="admin-panel">
            <input v-model="form.title" class="inp" placeholder="Task name (Subscribe To Channel)">
            <input v-model="form.link" class="inp" placeholder="Link (t.me/channel)">
            <input v-model.number="form.reward" class="inp" type="number" placeholder="Reward (HDOGS)">
            <input v-model="form.chatId" class="inp" placeholder="Telegram chat id for bot check">
            <select v-model="form.type" class="inp">
                <option value="channel">📢 Channel</option>
                <option value="chat">💬 Chat</option>
                <option value="other">➕ Other</option>
            </select>
            <button class="modal-btn" @click="addTask">Add task</button>
        </div>

        <div class="msg" v-if="msg">{{ msg }}</div>

        <div class="scroll">
            <div v-if="tasks.length === 0" class="empty">No tasks yet. Add via Admin.</div>

            <div v-for="task in tasks" :key="task.id" class="task" :class="{ done: completed[task.id] }">
                <div class="task-icon">{{ iconFor(task.type) }}</div>
                <div class="task-info">
                    <div class="name-task">{{ task.title }}</div>
                    <div class="summa-task">+{{ (task.reward || 0).toLocaleString('en-US') }} HDOGS</div>
                </div>

                <div class="task-actions">
                    <template v-if="completed[task.id]">
                        <button class="done-btn">✓</button>
                    </template>
                    <template v-else>
                        <button
                            v-if="task.link"
                            class="start-btn"
                            @click="openLink(task.link)"
                        >Start</button>
                        <button
                            class="claim-btn-sm"
                            :disabled="claiming === task.id"
                            @click="claim(task)"
                        >{{ claiming === task.id ? '⏳' : 'Check' }}</button>
                    </template>
                    <button v-if="adminMode && isAdmin" class="del-btn" @click="removeTask(task.id)">✕</button>
                </div>
            </div>
        </div>
    </div>

    <div class="bar">
        <RouterLink to="/leaderboard">
            <button class="bar-btn">Leaders</button>
        </RouterLink>
        <RouterLink to="/">
            <button class="bar-btn">Home</button>
        </RouterLink>
        <RouterLink to="/tasks">
            <button class="bar-btn-active">Tasks</button>
        </RouterLink>
    </div>
</div>
</template>

<script setup>
import { ref, reactive, inject, computed, watch, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { TonConnectUIContext } from 'ton-ui-vue';
import { db } from '../firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    setDoc,
    serverTimestamp,
    increment
} from 'firebase/firestore';
import { verifyTask } from '../services/taskVerify';
import { ADMIN_USERNAME } from '../config';

const tonConnectUI = inject(TonConnectUIContext);

const tc = () => tonConnectUI?.value;

function telegramUser() {
    try {
        return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    } catch (e) {
        return null;
    }
}

const tasks = ref([]);
const completed = ref({});
const claiming = ref('');
const msg = ref('');
const adminMode = ref(false);
const meAddress = ref('');

const isAdmin = computed(() => {
    const username = telegramUser()?.username;
    return username === ADMIN_USERNAME;
});

const form = reactive({
    title: '',
    link: '',
    reward: 1000,
    chatId: '',
    type: 'channel'
});

let unsubTasks = null;
let unsubCompleted = null;
let unsubStatus = null;

function setupWallet() {
    const wc = tc();
    if (!wc || wc.__hatedogsListening) return;
    wc.__hatedogsListening = true;

    meAddress.value = wc.wallet?.account?.address || '';
    if (meAddress.value) subscribeCompleted(meAddress.value);

    unsubStatus = wc.onStatusChange((wallet) => {
        meAddress.value = wallet?.account?.address || '';
        if (unsubCompleted) {
            unsubCompleted();
            unsubCompleted = null;
        }
        if (meAddress.value) subscribeCompleted(meAddress.value);
    });
}

function subscribeCompleted(address) {
    unsubCompleted = onSnapshot(
        query(collection(db, 'users', address, 'completedTasks')),
        (snap) => {
            const map = {};
            snap.docs.forEach((d) => (map[d.id] = d.data()));
            completed.value = map;
        },
        (err) => console.error(err)
    );
}

onMounted(() => {
    unsubTasks = onSnapshot(
        query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
        (snap) => {
            tasks.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        },
        (err) => console.error(err)
    );

    setupWallet();
    watch(tonConnectUI, () => setupWallet());
});

onUnmounted(() => {
    if (unsubTasks) unsubTasks();
    if (unsubCompleted) unsubCompleted();
    if (unsubStatus) unsubStatus();
});

async function addTask() {
    if (!isAdmin.value) return;
    if (!form.title) {
        msg.value = 'Enter a task name';
        return;
    }
    msg.value = '';
    await addDoc(collection(db, 'tasks'), {
        title: form.title,
        link: form.link,
        reward: Number(form.reward) || 0,
        chatId: form.chatId,
        type: form.type,
        createdAt: serverTimestamp()
    });
    form.title = '';
    form.link = '';
    form.chatId = '';
    form.reward = 1000;
}

async function removeTask(id) {
    if (!isAdmin.value) return;
    await deleteDoc(doc(db, 'tasks', id));
}

function openLink(link) {
    window.open(link, '_blank');
}

async function claim(task) {
    if (!meAddress.value) {
        msg.value = 'Connect your wallet first';
        return;
    }
    if (completed.value[task.id] || claiming.value) return;

    claiming.value = task.id;
    msg.value = '';
    try {
        const result = await verifyTask(task, meAddress.value);
        if (result.success) {
            await setDoc(doc(db, 'users', meAddress.value, 'completedTasks', task.id), {
                taskId: task.id,
                completedAt: serverTimestamp(),
                reward: task.reward
            });
            await setDoc(
                doc(db, 'users', meAddress.value),
                { tokens: increment(task.reward) },
                { merge: true }
            );
            msg.value = `+${task.reward.toLocaleString('en-US')} HDOGS!`;
        } else {
            msg.value = result.message || 'Not verified. Make sure you completed the task.';
        }
    } catch (e) {
        console.error(e);
        msg.value = 'Error, try again';
    } finally {
        claiming.value = '';
    }
}

const iconFor = (type) =>
    type === 'channel' ? '📢' : type === 'chat' ? '💬' : '🎯';
</script>

<style scoped>
.taskpage {
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

.tasks-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 16px;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: -62px;
}

.title {
    color: white;
    font-weight: 800;
    font-size: 22px;
    margin: 0 0 12px 0;
}

.admin-btn {
    background: #141414;
    border: 1px solid #262626;
    color: #8a8a8a;
    border-radius: 12px;
    padding: 6px 12px;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 13px;
}

.admin-panel {
    background: #141414;
    border: 1px solid #262626;
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
}

.inp {
    background: #1e1e1e;
    border: 1px solid #2c2c2c;
    border-radius: 12px;
    padding: 10px 12px;
    color: white;
    font-family: 'Nunito', sans-serif;
    font-size: 16px;
    font-weight: 600;
    outline: none;
    max-height: 46px;
}

.modal-btn {
    background: #0780d7;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 11px 0;
    font-size: 14px;
    font-weight: 800;
    font-family: 'Nunito', sans-serif;
}

.msg {
    color: #2ecc71;
    font-weight: 700;
    font-size: 13px;
    margin: 2px 0 8px;
    text-align: center;
}

.scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 2px 2px 10px;
    scrollbar-width: none;
}

.scroll::-webkit-scrollbar {
    display: none;
}

.empty {
    color: #6a6a6a;
    font-weight: 700;
    text-align: center;
    padding: 40px 0;
}

.task {
    background: #141414;
    border: 1px solid #1e1e1e;
    border-radius: 16px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.task.done {
    opacity: 0.55;
}

.task-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(7, 128, 215, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    flex-shrink: 0;
}

.task-info {
    flex: 1;
    min-width: 0;
}

.name-task {
    color: white;
    font-weight: 800;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.summa-task {
    color: #8a8a8a;
    font-weight: 600;
    font-size: 12px;
}

.task-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.start-btn {
    background: #1e1e1e;
    border: 1px solid #2c2c2c;
    color: white;
    border-radius: 12px;
    padding: 8px 12px;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 12px;
}

.claim-btn-sm {
    background: #0780d7;
    border: none;
    color: white;
    border-radius: 12px;
    padding: 8px 12px;
    font-family: 'Nunito', sans-serif;
    font-weight: 800;
    font-size: 12px;
}

.claim-btn-sm:disabled {
    opacity: 0.6;
}

.done-btn {
    background: #2ecc71;
    border: none;
    color: white;
    border-radius: 12px;
    padding: 8px 12px;
    font-weight: 800;
    font-size: 12px;
}

.del-btn {
    background: transparent;
    border: 1px solid #3a1e1e;
    color: #e74c3c;
    border-radius: 10px;
    padding: 6px 9px;
    font-size: 11px;
    font-weight: 800;
    font-family: 'Nunito', sans-serif;
}
</style>