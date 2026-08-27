const { Router } = require("express");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const router = Router();
const ALLOWED_ROLES = new Set(["E-commerce Manager", "E-commerce Operations Manager", "CEO"]);
const UNASSIGNABLE_ROLES = new Set(["Owner"]);

function extToContentType(ext) {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

async function uploadWorkerPhoto(supabaseAdmin, userId, photo) {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(photo || "");
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("Avatars")
    .upload(path, buffer, { upsert: true, contentType: extToContentType(ext) });
  if (uploadError) return null;
  const { data: publicUrlData } = supabaseAdmin.storage.from("Avatars").getPublicUrl(path);
  return `${publicUrlData.publicUrl}?t=${Date.now()}`;
}

async function assertAssignableRole(supabaseAdmin, roleId) {
  const { data: role, error } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .single();
  if (error || !role) return "Nevažeća rola.";
  if (UNASSIGNABLE_ROLES.has(role.name)) return `Rola '${role.name}' se ne može dodeliti radniku.`;
  return null;
}

async function requireManager(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
    return null;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Niste prijavljeni." });
    return null;
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    res.status(401).json({ error: "Niste prijavljeni." });
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("company, pib, roles(name)")
    .eq("id", callerData.user.id)
    .single();

  if (profileError || !profile) {
    res.status(403).json({ error: "Nalog nije pronađen." });
    return null;
  }

  if (!ALLOWED_ROLES.has(profile.roles?.name)) {
    res.status(403).json({ error: "Nemate dozvolu za upravljanje radnicima." });
    return null;
  }

  return { ...profile, id: callerData.user.id };
}

router.get("/workers", async (req, res) => {
  const callerProfile = await requireManager(req, res);
  if (!callerProfile) return;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, phone, photo, roles(name)")
    .eq("company", callerProfile.company)
    .neq("id", callerProfile.id)
    .order("full_name");

  if (error) {
    return res.status(400).json({ error: "Nije moguće učitati radnike." });
  }

  res.json({
    workers: data.map((w) => ({
      id: w.id,
      fullName: w.full_name,
      phone: w.phone,
      photo: w.photo,
      role: w.roles?.name || "",
    })),
  });
});

router.post("/workers", async (req, res) => {
  const callerProfile = await requireManager(req, res);
  if (!callerProfile) return;
  const supabaseAdmin = getSupabaseAdmin();

  const { fullName, phone, email, password, roleId, photo } = req.body || {};

  if (!fullName?.trim() || !email?.trim() || !roleId) {
    return res.status(400).json({ error: "Ime, email i rola su obavezni." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Lozinka mora imati najmanje 8 karaktera." });
  }

  const roleError = await assertAssignableRole(supabaseAdmin, roleId);
  if (roleError) return res.status(400).json({ error: roleError });

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName.trim(),
      phone: phone?.trim() || "",
      pib: callerProfile.pib,
    },
  });

  if (createError) {
    const message =
      createError.message === "A user with this email address has already been registered"
        ? "Nalog sa ovim mejlom već postoji."
        : createError.message;
    return res.status(400).json({ error: message });
  }

  const newUserId = created.user.id;
  const photoUrl = await uploadWorkerPhoto(supabaseAdmin, newUserId, photo);

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ role_id: roleId, company: callerProfile.company, photo: photoUrl })
    .eq("id", newUserId);

  if (updateError) {
    return res.status(400).json({ error: "Radnik je napravljen, ali podešavanje profila nije uspelo." });
  }

  res.status(201).json({
    worker: {
      id: newUserId,
      fullName: fullName.trim(),
      phone: phone?.trim() || "",
      email: email.trim(),
      company: callerProfile.company,
      photo: photoUrl,
    },
  });
});

router.put("/workers/:id", async (req, res) => {
  const callerProfile = await requireManager(req, res);
  if (!callerProfile) return;
  const supabaseAdmin = getSupabaseAdmin();

  const { id } = req.params;
  const { fullName, phone, roleId, photo } = req.body || {};

  if (!fullName?.trim() || !roleId) {
    return res.status(400).json({ error: "Ime i rola su obavezni." });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from("users")
    .select("id, company")
    .eq("id", id)
    .single();

  if (targetError || !target || target.company !== callerProfile.company) {
    return res.status(404).json({ error: "Radnik nije pronađen." });
  }

  const roleError = await assertAssignableRole(supabaseAdmin, roleId);
  if (roleError) return res.status(400).json({ error: roleError });

  const patch = {
    full_name: fullName.trim(),
    phone: phone?.trim() || "",
    role_id: roleId,
  };

  const photoUrl = await uploadWorkerPhoto(supabaseAdmin, id, photo);
  if (photoUrl) patch.photo = photoUrl;

  const { error: updateError } = await supabaseAdmin.from("users").update(patch).eq("id", id);
  if (updateError) {
    return res.status(400).json({ error: "Nije moguće sačuvati izmene." });
  }

  res.json({
    worker: {
      id,
      fullName: patch.full_name,
      phone: patch.phone,
      photo: photoUrl || null,
    },
  });
});

module.exports = router;
