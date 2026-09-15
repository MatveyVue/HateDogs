import { ref, watch } from 'vue';
import { createTonConnectUIProvider, TonConnectUIContext, TonConnectUIOptionsContext } from 'ton-ui-vue';

const manifestUrl = 'https://raw.githubusercontent.com/MatveyVue/manifest/refs/heads/main/HateDogsManifest.json';

let provider = null;
let unsub = null;

const wallet = ref(null);
const walletAddress = ref('');

function onStatus(w) {
    wallet.value = w || null;
    walletAddress.value = w?.account?.address || '';
}

function startTracking() {
    const wc = tonConnectUI.value;
    if (!wc || unsub) return;
    unsub = wc.onStatusChange(onStatus);
    onStatus(wc.wallet || null);
}

let tonConnectUI = null;

export function initTonConnect() {
    if (!provider) {
        provider = createTonConnectUIProvider({ manifestUrl });
        const uiRef = provider.tonConnectUI;
        tonConnectUI = uiRef;
        watch(uiRef, startTracking, { immediate: true });
    }
    return provider;
}

export { TonConnectUIContext, TonConnectUIOptionsContext, tonConnectUI, wallet, walletAddress };