// Dev-only helper: seeds a few fake conversations into the inbox tables so
// the "Poruke" UI can be tested without a real Meta App/webhook connected.
// Run with: node scripts/seedMockInbox.js
// Add --live to also drop in one more inbound message after a delay, to
// see the sidebar/chat update on their own the way a real webhook would.
require("dotenv").config();
const crypto = require("crypto");
const store = require("../lib/inboxStore");
const connectionsStore = require("../lib/inboxConnectionsStore");

const LIVE = process.argv.includes("--live");

// Inbound message ids are deduped by the (platform, message_id) unique
// constraint (same as a real Meta webhook retry), but outbound sends
// aren't — a real Send API reply always gets a fresh id from Meta, so
// nothing production-side needs dedup there. Mock outbound ids are
// deterministic per conversation though, so re-running this script would
// collide with the previous run's rows unless each run gets its own
// suffix.
const RUN_ID = Date.now();

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

// Brand → channel mapping, mirroring server/data/connections.json's real
// store list (parkerolovke.rs, papagaj.rs, maped.rs, ...). Each becomes a
// row in inbox-connections.json with a placeholder access token — swap
// "REPLACE_WITH_REAL_TOKEN" for the brand's actual Page/WhatsApp token
// when connecting it for real.
const BRAND_CONNECTIONS = [
  { label: "Parker", platform: "facebook", pageId: "mock-page-parker" },
  { label: "Papagaj", platform: "instagram", pageId: "mock-page-papagaj" },
  { label: "Maped", platform: "whatsapp", phoneNumberId: "mock-wa-maped" },
];

// Avatar photos come from a placeholder-image service (i.pravatar.cc) —
// stands in for the real Graph API profile_pic URL the webhook enrichment
// fetches in production.
const CONVERSATIONS = [
  {
    platform: "facebook",
    senderId: "mock-fb-1",
    senderName: "Ana Jovanović",
    pageId: "mock-page-parker",
    avatarUrl: "https://i.pravatar.cc/150?img=47",
    accountLabel: "Parker",
    messages: [
      { direction: "inbound", text: "Zdravo, da li imate ovu hemijsku olovku na akciji?", minutesAgo: 42 },
      { direction: "outbound", text: "Zdravo Ana! Imamo, mogu odmah da vam rezervišem primerak.", minutesAgo: 40 },
      { direction: "inbound", text: "Super, hvala! Kad stiže dostava?", minutesAgo: 38 },
    ],
  },
  {
    platform: "instagram",
    senderId: "mock-ig-1",
    senderName: "marko.simic__",
    pageId: "mock-page-papagaj",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
    accountLabel: "Papagaj",
    messages: [
      { direction: "inbound", text: "Vidim da je narudžbina #4821 još uvek 'U obradi', kad kreće ka meni?", minutesAgo: 15 },
      { direction: "outbound", text: "Proveravamo odmah i javljamo vam se za par minuta.", minutesAgo: 12 },
    ],
  },
  {
    platform: "whatsapp",
    senderId: "381601234567",
    senderName: "Milica Petrović",
    pageId: "mock-wa-maped",
    avatarUrl: null, // WhatsApp Cloud API doesn't expose a profile photo — UI falls back to initials
    accountLabel: "Maped",
    messages: [
      { direction: "inbound", text: "Poštovani, da li je moguća zamena veličine za porudžbinu od juče?", minutesAgo: 3 },
    ],
  },
];

function seedBrandConnections() {
  const existing = connectionsStore.getConnections();
  for (const def of BRAND_CONNECTIONS) {
    const already = existing.find((c) => c.platform === def.platform && (c.pageId === def.pageId || c.phoneNumberId === def.phoneNumberId));
    if (already) continue;
    connectionsStore.addConnection({
      id: crypto.randomUUID(),
      label: def.label,
      platform: def.platform,
      pageId: def.pageId || null,
      phoneNumberId: def.phoneNumberId || null,
      accessToken: "REPLACE_WITH_REAL_TOKEN",
    });
  }
}

async function seedConversation(def) {
  const conversation = await store.getOrCreateConversation({
    platform: def.platform,
    senderId: def.senderId,
    senderName: def.senderName,
    pageId: def.pageId,
    enrich: async () => ({ senderAvatarUrl: def.avatarUrl, accountLabel: def.accountLabel }),
  });

  for (const m of def.messages) {
    if (m.direction === "inbound") {
      await store.saveInboundMessage({
        conversation,
        message: {
          platform: def.platform,
          messageId: `mock-${def.senderId}-${m.minutesAgo}`,
          senderId: def.senderId,
          senderName: def.senderName,
          text: m.text,
          timestamp: minutesAgo(m.minutesAgo),
        },
      });
      // saveInboundMessage bumps unread_count off the conversation object
      // passed in — keep it in sync locally so a thread with several
      // seeded inbound messages ends up with the right badge count instead
      // of every call computing +1 off the same stale value.
      conversation.unread_count = (conversation.unread_count || 0) + 1;
    } else {
      await store.saveOutboundMessage({
        conversationId: conversation.id,
        platform: def.platform,
        senderId: def.pageId,
        text: m.text,
        messageId: `mock-out-${def.senderId}-${m.minutesAgo}-${RUN_ID}`,
        status: "sent",
      });
    }
  }

  return conversation;
}

async function main() {
  console.log("Registrujem mock brend-naloge (inbox-connections.json)...");
  seedBrandConnections();
  connectionsStore.getConnections().forEach((c) => console.log(`  ✓ ${c.label} (${c.platform})`));

  console.log("\nUbacujem mock konverzacije...");
  const created = [];
  for (const def of CONVERSATIONS) {
    const conversation = await seedConversation(def);
    created.push({ conversation, def });
    console.log(`  ✓ ${def.platform} — ${def.senderName}`);
  }
  console.log("Gotovo. Otvori Porudžbine → Poruke u appu da vidiš rezultat.");

  if (LIVE) {
    const target = created[0];
    console.log('\n--live: čekam 8s pa ubacujem novu poruku u prvu konverzaciju (posmatraj UI, osvežava se samo)...');
    await new Promise((r) => setTimeout(r, 8000));
    await store.saveInboundMessage({
      conversation: target.conversation,
      message: {
        platform: target.def.platform,
        messageId: `mock-live-${Date.now()}`,
        senderId: target.def.senderId,
        senderName: target.def.senderName,
        text: "Da li ste još tu? :)",
        timestamp: new Date().toISOString(),
      },
    });
    console.log("Nova poruka ubačena — trebalo bi da se pojavi u chat-u za par sekundi.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Greška pri ubacivanju mock podataka:", err.message);
    process.exit(1);
  });
