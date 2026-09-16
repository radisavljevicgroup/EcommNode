const { Router } = require("express");
const crypto = require("crypto");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");
const { isPersonalizationEnabled, getPersonalizationProductIds } = require("../lib/settingsStore");
const {
  isOrderCompleted,
  markOrderCompleted,
  unmarkOrderCompleted,
  getCompletedOrderKeys,
} = require("../lib/personalizationStore");

const router = Router();

const BUCKET = "personalizacija";
const MAX_FILES_PER_UPLOAD = 10;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — comfortably under the
// app-wide express.json 25mb limit (server/index.js) even for a full batch
// of MAX_FILES_PER_UPLOAD, accounting for base64's ~33% size overhead.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const DATA_URL_RE = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/;

function sanitizeFileName(name) {
  return String(name || "fajl")
    .replace(/[/\\]/g, "_")
    .slice(-150);
}

async function withSignedUrl(supabaseAdmin, row) {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return {
    id: row.id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    productId: row.product_id,
    createdAt: row.created_at,
    url: data?.signedUrl || null,
  };
}

// All completed (connectionId, orderId) pairs for the company — used by
// Orders.jsx to color the personalization icon green on the order list
// without a per-order round trip. Segment count ("/completed" — one
// segment) never collides with the "/:connectionId/:orderId" route below
// (two segments), so registration order here doesn't matter, but it's kept
// first for readability.
router.get("/personalization/completed", async (req, res) => {
  if (!isPersonalizationEnabled(req.company)) {
    return res.json({ completed: [] });
  }
  const keys = await getCompletedOrderKeys(req.company);
  const completed = [...keys].map((key) => {
    const [connectionId, orderId] = key.split(":");
    return { connectionId, orderId };
  });
  res.json({ completed });
});

router.get("/personalization/:connectionId/:orderId", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
  }
  const { connectionId, orderId } = req.params;

  const { data: rows, error } = await supabaseAdmin
    .from("order_personalization_files")
    .select("*")
    .eq("firma_id", req.company)
    .eq("connection_id", connectionId)
    .eq("order_id", String(orderId))
    .order("created_at", { ascending: true });

  if (error) {
    return res.status(400).json({ error: "Ne mogu da učitam fajlove za personalizaciju." });
  }

  const [files, completed] = await Promise.all([
    Promise.all(rows.map((row) => withSignedUrl(supabaseAdmin, row))),
    isOrderCompleted(req.company, connectionId, orderId),
  ]);
  res.json({ files, completed });
});

// Marks the order's personalization job done — removes it from the "za
// graviranje" banner/count on Porudžbine for everyone at the company (see
// server/lib/personalizationStore.js).
router.post("/personalization/:connectionId/:orderId/complete", async (req, res) => {
  const { connectionId, orderId } = req.params;
  try {
    await markOrderCompleted(req.company, connectionId, orderId, req.userId);
    res.json({ completed: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reopens it — back into "za graviranje" if it still has files attached.
router.delete("/personalization/:connectionId/:orderId/complete", async (req, res) => {
  const { connectionId, orderId } = req.params;
  try {
    await unmarkOrderCompleted(req.company, connectionId, orderId);
    res.json({ completed: false });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/personalization/:connectionId/:orderId", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
  }
  const { connectionId, orderId } = req.params;
  const { productId, files } = req.body || {};

  if (!isPersonalizationEnabled(req.company)) {
    return res.status(403).json({ error: "Alatka za personalizaciju nije uključena." });
  }
  // productId here may be either a WooCommerce product_id or a SKU — see
  // personalizableProductId in Orders.jsx — so this just confirms the value
  // the client claims matched is actually on the merchant's own allowlist,
  // case-insensitively (matches the client-side comparison).
  const allowedIds = getPersonalizationProductIds(req.company).map((id) => id.toLowerCase());
  if (!productId || !allowedIds.includes(String(productId).toLowerCase())) {
    return res.status(403).json({ error: "Ovaj proizvod nije označen za personalizaciju." });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Nijedan fajl nije priložen." });
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return res.status(400).json({ error: `Najviše ${MAX_FILES_PER_UPLOAD} fajlova odjednom.` });
  }

  const decoded = [];
  for (const file of files) {
    const match = DATA_URL_RE.exec(file?.dataUrl || "");
    if (!match) {
      return res.status(400).json({ error: `Fajl "${file?.fileName || ""}" nije ispravan.` });
    }
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return res
        .status(400)
        .json({ error: `Fajl "${file.fileName}" prelazi dozvoljenih ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` });
    }
    decoded.push({ fileName: sanitizeFileName(file.fileName), contentType: match[1], buffer });
  }

  const inserted = [];
  for (const file of decoded) {
    const storagePath = `${req.company}/${connectionId}/${orderId}/${crypto.randomUUID()}-${file.fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.contentType });
    if (uploadError) {
      console.error("[personalization] storage upload failed:", uploadError);
      return res.status(400).json({ error: `Neuspešno čuvanje fajla "${file.fileName}".` });
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from("order_personalization_files")
      .insert({
        firma_id: req.company,
        connection_id: connectionId,
        order_id: String(orderId),
        product_id: String(productId),
        file_name: file.fileName,
        storage_path: storagePath,
        content_type: file.contentType,
        size_bytes: file.buffer.length,
        uploaded_by: req.userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[personalization] db insert failed:", insertError);
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return res.status(400).json({ error: `Neuspešno čuvanje fajla "${file.fileName}".` });
    }
    inserted.push(row);
  }

  const result = await Promise.all(inserted.map((row) => withSignedUrl(supabaseAdmin, row)));
  res.json({ files: result });
});

router.delete("/personalization/:connectionId/:orderId/:fileId", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
  }
  const { fileId } = req.params;

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("order_personalization_files")
    .select("id, firma_id, storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError || !row || row.firma_id !== req.company) {
    return res.status(404).json({ error: "Fajl nije pronađen." });
  }

  await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
  const { error: deleteError } = await supabaseAdmin
    .from("order_personalization_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    return res.status(400).json({ error: "Neuspešno brisanje fajla." });
  }
  res.json({ ok: true });
});

module.exports = router;
