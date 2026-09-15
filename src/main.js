import './assets/main.css'

import { createApp } from 'vue'
import App from '../components/App.vue'
import router from './router'
import { initTonConnect, TonConnectUIContext, TonConnectUIOptionsContext, tonConnectUI } from './walletStore';

const { setOptions } = initTonConnect();

const app = createApp(App)
app.provide(TonConnectUIContext, tonConnectUI);
app.provide(TonConnectUIOptionsContext, setOptions);
app.use(router)
app.mount('#app')