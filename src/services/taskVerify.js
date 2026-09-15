import { BOT_API_URL } from '../config';

const BOT_VERIFY_PATH = '/api/verify';

export async function verifyTask(task, walletAddress) {
    const botUrl = BOT_API_URL || BOT_VERIFY_PATH;
    const simulated = !BOT_API_URL && import.meta.env.DEV;

    if (simulated) {
        await new Promise((r) => setTimeout(r, 1200));
        return { success: true, message: 'verified' };
    }

    const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;

    if (!telegramUserId) {
        return { success: false, message: 'Telegram user not detected — open the app from the bot inside Telegram' };
    }

    if (!task.chatId) {
        return { success: false, message: 'Task has no chatId — set it in Admin' };
    }

    try {
        const res = await fetch(botUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId: task.id,
                chatId: task.chatId,
                walletAddress,
                telegramUserId
            })
        });

        let data = null;
        try {
            data = await res.json();
        } catch (e) { /* ignore */ }

        if (!res.ok) {
            return { success: false, message: data?.message || 'Bot check failed (' + res.status + ')' };
        }

        return typeof data?.success !== 'undefined' ? data : { success: false, message: 'Bad response from bot' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}