const { WebhookClient } = require('discord.js');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Multiple webhooks are supported 
const WEBHOOKS = [
  "UR WEBHOOK1",
  "UR WEBHOOK2",
// "Your webhook URL here",
//"Your webhook URL here 2"
];

let webhookClients = [];

if (typeof WEBHOOKS === "string") {
  webhookClients = [new WebhookClient({ url: WEBHOOKS })];
} else if (Array.isArray(WEBHOOKS)) {
  webhookClients = WEBHOOKS.map(url => new WebhookClient({ url }));
} else {
  throw new Error("WEBHOOKS must be a string or an array of strings!");
}

const PLANCKE_API = "https://api.plancke.io/hypixel/v1/punishmentStats";
const NIKO_API = "https://bantracker.niko233.me/";
const ALT_API = "https://bantracker.23312355.xyz/";

const lastTotals = {
  plancke: { watchdog: null, staff: null },
  niko: { watchdog: null, staff: null },
  alt: { watchdog: null, staff: null }
};

// Helpers
async function sendDiscordMessage(message) {
  try {
    await Promise.all(webhookClients.map(client => client.send({ content: message })));
    console.log("✅ Sent:", message);
  } catch (error) {
    console.error("❌ Failed to send message:", error);
  }
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const type = res.headers.get("content-type");
    if (!type?.includes("application/json")) {
      console.error("⚠️ Unexpected response format from", url);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("❌ Fetch error from", url, err);
    return null;
  }
}

async function sendStartupPlanckeSummary() {
  const data = await fetchJSON(PLANCKE_API);
  if (data?.success) {
    const { watchdog_total, staff_total } = data.record;
    lastTotals.plancke = { watchdog: watchdog_total, staff: staff_total };

    await sendDiscordMessage(
      `📨 Bot Started\n🐶 Watchdog Bans: \`${watchdog_total}\`\n💀 Staff Bans: \`${staff_total}\``
    );
  } else {
    console.warn("⚠️ Could not fetch Plancke data at startup.");
  }
}

function updateLastTotals(apiKey, data) {
  if (data) {
    lastTotals[apiKey] = {
      watchdog: data.watchdog.total,
      staff: data.staff.total
    };
  }
}

// Handler 
async function checkAPIs() {
  const [planckeData, nikoData, altData] = await Promise.all([
    fetchJSON(PLANCKE_API),
    fetchJSON(NIKO_API),
    fetchJSON(ALT_API)
  ]);

  if (!planckeData?.success) {
    console.error("❌ Failed to fetch Plancke data");
    return;
  }

  const { watchdog_total: planckeWD, staff_total: planckeStaff } = planckeData.record;

  if (lastTotals.plancke.watchdog === null) {
    lastTotals.plancke = { watchdog: planckeWD, staff: planckeStaff };
    updateLastTotals("niko", nikoData);
    updateLastTotals("alt", altData);

    await sendDiscordMessage(
      `Bot Started\n🐶 Watchdog Bans: \`${planckeWD}\`\n💀 Staff Bans: \`${planckeStaff}\``
    );
    return;
  }

  const diffWD = planckeWD - lastTotals.plancke.watchdog;
  const diffStaff = planckeStaff - lastTotals.plancke.staff;

  if (diffWD <= 0 && diffStaff <= 0) {
    updateLastTotals("niko", nikoData);
    updateLastTotals("alt", altData);
    return;
  }

  const messages = [];

  if (diffWD > 0) {
    const sources = [];
    if (nikoData?.watchdog.total > lastTotals.niko.watchdog) sources.push("🟢 Niko");
    if (altData?.watchdog.total > lastTotals.alt.watchdog) sources.push("🔵 FishAPI");
    sources.push("🥞 Plancke");

    messages.push(`🐶 WATCHDOG BAN \`${diffWD}\` detected by: ${sources.join(", ")}`);
  }

  if (diffStaff > 0) {
    const sources = [];
    if (nikoData?.staff.total > lastTotals.niko.staff) sources.push("🟢 Niko");
    if (altData?.staff.total > lastTotals.alt.staff) sources.push("🔵 FishAPI");
    sources.push("🥞 Plancke");

    messages.push(`💀 STAFF BAN \`${diffStaff}\` detected by: ${sources.join(", ")}`);
  }

  for (const msg of messages) {
    await sendDiscordMessage(`${msg}`);
  }

  lastTotals.plancke = { watchdog: planckeWD, staff: planckeStaff };
  updateLastTotals("niko", nikoData);
  updateLastTotals("alt", altData);
}

(async () => {
  await sendStartupPlanckeSummary();
  setInterval(checkAPIs, 5000);
})();
