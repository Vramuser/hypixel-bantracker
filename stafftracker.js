const { WebhookClient } = require('discord.js');

const webhookClient = new WebhookClient({ url: "UR URL });
const API_URL = "https://api.plancke.io/hypixel/v1/punishmentStats";
let lastWatchdogTotal = null;
let lastStaffTotal = null;

async function sendDiscordMessage(message) {
    try {
        await webhookClient.send({ content: message });
        console.log("Message sent successfully!");
    } catch (error) {
        console.error("Failed to send message:", error);
    }
}

async function fetchPunishmentData() {
    try {
        const response = await fetch(API_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" //User Agent = Cloudflare not flagging it 
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Unexpected response format:", text);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch data:", error);
        return null;
    }
}

async function main() {
    const initialData = await fetchPunishmentData();
    if (initialData && initialData.success) {
        const { watchdog_total, staff_total } = initialData.record;
        await sendDiscordMessage(`🐶 WATCHDOG TOTAL BANS: \`${watchdog_total}\``);
        await sendDiscordMessage(`💀 STAFF TOTAL BANS: \`${staff_total}\``);
        lastWatchdogTotal = watchdog_total;
        lastStaffTotal = staff_total;
    }

    setInterval(async () => {
        const data = await fetchPunishmentData();
        if (data && data.success) {
            const { watchdog_total, staff_total } = data.record;
            
            if (lastWatchdogTotal !== null && lastStaffTotal !== null) {
                const watchdogDiff = watchdog_total - lastWatchdogTotal;
                const staffDiff = staff_total - lastStaffTotal;
                
                if (watchdogDiff > 0) {
                    await sendDiscordMessage(`🐶 WATCHDOG BAN \`${watchdogDiff}\``);
                }
                if (staffDiff > 0) {
                    await sendDiscordMessage(`💀 STAFF BAN \`${staffDiff}\``);
                }
            }
            
            lastWatchdogTotal = watchdog_total;
            lastStaffTotal = staff_total;
        }
    }, 15000); // Timer 15000 -> 15 sec
}              // Best time is between 15 to 35 secs

main();
