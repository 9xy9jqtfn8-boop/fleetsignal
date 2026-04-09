// VERSION 2 FORCE DEPLOY

// =======================
// SUPABASE SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================
// UI ELEMENTS
// ==========================
const authBox = document.getElementById("authBox");
const dashboardBox = document.getElementById("dashboardBox");
const authMessage = document.getElementById("authMessage");

let isLoadingVehicles = false;

// ==========================
// SMALL HELPERS
// ==========================
function getEl(id) {
  return document.getElementById(id);
}

function setAuthMessage(message = "") {
  if (authMessage) authMessage.innerText = message;
}

function setResultMessage(html = "") {
  const resultBox = getEl("resultBox");
  if (resultBox) {
    resultBox.style.display = "block";
    resultBox.innerHTML = html;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseVehicleType(type) {
  if (!type) return "Car";
  const t = String(type).trim().toLowerCase();
  if (t.includes("van")) return "Van";
  if (t.includes("motor")) return "Motorcycle";
  if (t.includes("bike")) return "Motorcycle";
  return "Car";
}

// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  setupAuthButtons();

  authBox?.classList.remove("hidden");
  dashboardBox?.classList.add("hidden");

  checkSession();
}

// ==========================
// AUTH BUTTONS
// ==========================
function setupAuthButtons() {
  getEl("loginBtn")?.addEventListener("click", login);
  getEl("signupBtn")?.addEventListener("click", signup);
  getEl("logoutBtn")?.addEventListener("click", logout);
  getEl("checkBtn")?.addEventListener("click", checkVehicle);
  getEl("forgotPasswordLink")?.addEventListener("click", forgotPasswordHandler);
}

// ==========================
// AUTH
// ==========================
async function signup() {
  try {
    const email = getEl("email")?.value.trim();
    const password = getEl("password")?.value ?? "";

    if (!email || !password) {
      setAuthMessage("Enter email and password.");
      return;
    }

    const { error } = await client.auth.signUp({ email, password });

    setAuthMessage(
      error ? error.message : "Signup successful. Check your email."
    );
  } catch (err) {
    console.error("Signup failed:", err);
    setAuthMessage("Signup failed. Please try again.");
  }
}

async function login() {
  try {
    const email = getEl("email")?.value.trim();
    const password = getEl("password")?.value ?? "";

    if (!email || !password) {
      setAuthMessage("Enter email and password.");
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    setAuthMessage("");
    showDashboard();
  } catch (err) {
    console.error("Login failed:", err);
    setAuthMessage("Login failed. Please try again.");
  }
}

async function logout() {
  try {
    await client.auth.signOut();
  } catch (err) {
    console.error("Logout failed:", err);
  }

  authBox?.classList.remove("hidden");
  dashboardBox?.classList.add("hidden");
  setAuthMessage("");
}

async function forgotPasswordHandler(event) {
  event.preventDefault();

  try {
    const email = getEl("email")?.value.trim();

    if (!email) {
      alert("Enter your email first");
      return;
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.getfleetsignal.com/reset.html",
    });

    if (error) {
      alert(error.message || "Error sending reset email");
    } else {
      alert("Password reset email sent");
    }
  } catch (err) {
    console.error("Reset email failed:", err);
    alert("Error sending reset email");
  }
}

// ==========================
// SESSION
// ==========================
async function checkSession() {
  try {
    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error("Session check failed:", error);
      return;
    }

    if (data?.session) {
      showDashboard();
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }
}

function showDashboard() {
  authBox?.classList.add("hidden");
  dashboardBox?.classList.remove("hidden");

  loadVehicles();

  setTimeout(() => {
    getEl("regInput")?.focus();
  }, 200);
}

// ==========================
// ICON HELPER
// ==========================
function getVehicleImage(type) {
  if (!type) return "/icons/car.png";

  const t = String(type).toLowerCase();

  if (t.includes("van")) return "/icons/van.png";
  if (t.includes("motorcycle")) return "/icons/bike.png";
  if (t.includes("bike")) return "/icons/bike.png";

  return "/icons/car.png";
}

// ==========================
// EMAIL REMINDER TRIGGER
// ==========================
async function sendReminderIfNeeded({ reg, motDays, alertEmail }) {
  try {
    if (!alertEmail) return;
    if (typeof motDays !== "number") return;
    if (motDays <= 0 || motDays >= 30) return;

    const response = await fetch("/api/sendAlert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: alertEmail,
        reg,
        motDays: motDays,
      }),
    });

    if (!response.ok) {
      console.warn("Reminder API returned non-OK status");
    }
  } catch (err) {
    console.warn("Reminder send failed:", err);
  }
}

// ==========================
// VEHICLE CHECK (FIXED + SAFE)
// ==========================
async function checkVehicle() {
  const regInput = getEl("regInput");
  const resultBox = getEl("resultBox");
  const vehicleNameInput = getEl("vehicleNameInput");
  const vehicleTypeInput = getEl("vehicleTypeInput");
  const vehicleColourInput = getEl("vehicleColourInput");
  const alertEmailInput = getEl("alertEmailInput");

  if (!regInput || !resultBox) return;

  const reg = regInput.value.trim().toUpperCase();
  const manualName = vehicleNameInput?.value.trim() || "";
  const manualType = vehicleTypeInput?.value.trim() || "";
  const manualColour = vehicleColourInput?.value.trim() || "";
  const alertEmail = alertEmailInput?.value.trim() || "";

  resultBox.style.display = "block";
  resultBox.innerHTML = "⏳ Checking vehicle...";

  if (!reg) {
    resultBox.innerHTML = "⚠️ Enter a registration";
    return;
  }

  let motStatus = "🟢 Valid";
  let taxStatus = "🟢 Taxed";
  let motDays = null;

  let vehicleMake = "";
  let vehicleColor = "";
  let vehicleType = "Car";

  try {
    const response = await fetch(
      `${window.location.origin}/api/mot?reg=${encodeURIComponent(reg)}`
    );

    if (!response.ok) {
      throw new Error("Vehicle check request failed");
    }

    const data = await response.json();

    vehicleMake = data.make || data.vehicleMake || data.manufacturer || "";
    vehicleColor =
      data.colour || data.color || data.vehicleColour || data.vehicleColor || "";

    const makeLower = vehicleMake.toLowerCase();

    if (
      makeLower.includes("transit") ||
      makeLower.includes("sprinter") ||
      makeLower.includes("crafter")
    ) {
      vehicleType = "Van";
    } else if (
      makeLower.includes("yamaha") ||
      makeLower.includes("honda") ||
      makeLower.includes("kawasaki") ||
      makeLower.includes("ducati") ||
      makeLower.includes("bsa")
    ) {
      vehicleType = "Motorcycle";
    }

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();

      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) motStatus = "🔴 Expired";
      else if (motDays < 7) motStatus = "🔴 Expiring";
      else if (motDays < 30) motStatus = "🟡 Due soon";
      else motStatus = "🟢 Valid";
    } else {
      motStatus = "⚪ Unknown";
      motDays = null;
    }

    taxStatus =
      data.taxStatus === "Taxed"
        ? "🟢 Taxed"
        : data.taxStatus === "SORN"
        ? "⚪ SORN"
        : "🔴 Untaxed";

  } catch (err) {
    console.error("Vehicle check failed:", err);
    motStatus = "⚠️ Error";
    taxStatus = "⚠️ Failed";
    motDays = null;
  }

  // FINAL VALUES (consistent everywhere)
  const finalName = manualName || vehicleMake || "Vehicle";
  const finalColour = manualColour || vehicleColor || "";
  const finalType = normaliseVehicleType(manualType || vehicleType);

  // UI RESULT
  resultBox.innerHTML = `
    <div class="result-card">
      <div class="reg">${escapeHtml(reg)}</div>
      <div class="meta">${escapeHtml(vehicleMake || "")} ${escapeHtml(finalColour)}</div>
      <div class="badges">
        <span class="badge">${escapeHtml(motStatus)} (${motDays ?? "-" } days)</span>
        <span class="badge">${escapeHtml(taxStatus)}</span>
      </div>
    </div>
  `;

  try {
    const { data: authData } = await client.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { data: existing } = await client
      .from("vehicles")
      .select("id, last_alert_sent")
      .eq("user_id", user.id)
      .eq("reg", reg)
      .limit(1);

    const payload = {
      user_id: user.id,
      reg,
      mot_status: motStatus,
      mot_days: motDays,
      tax_status: taxStatus,
      make: vehicleMake || null,
      colour: finalColour || null,
      vehicle_type: finalType,
      alert_email: alertEmail || null,
    };

    let vehicleId = null;
    let lastAlertSent = null;

    if (existing && existing.length > 0) {
      vehicleId = existing[0].id;
      lastAlertSent = existing[0].last_alert_sent;

      await client
        .from("vehicles")
        .update(payload)
        .eq("id", vehicleId);
    } else {
      const { data: inserted } = await client
        .from("vehicles")
        .insert([payload])
        .select();

      vehicleId = inserted?.[0]?.id;
    }

    // ALERT LOGIC (safe)
    let shouldSendAlert = false;

    if (alertEmail && typeof motDays === "number" && motDays < 30) {
      const lastSent = lastAlertSent ? new Date(lastAlertSent) : null;
      const now = new Date();

      const daysSince =
        lastSent ? (now - lastSent) / (1000 * 60 * 60 * 24) : null;

      if (!lastSent || daysSince >= 7) {
        shouldSendAlert = true;
      }
    }

    if (shouldSendAlert && vehicleId) {
      await sendReminderIfNeeded({
        reg,
        motDays,
        alertEmail,
      });

      await client
        .from("vehicles")
        .update({ last_alert_sent: new Date().toISOString() })
        .eq("id", vehicleId);
    }

    // 🔥 THIS FIXES YOUR MISSING LIST
    await loadVehicles();

  } catch (err) {
    console.error("Vehicle save flow failed:", err);
  }
}

    // ==========================
    // ALERT LOGIC
    // ==========================
    let shouldSendAlert = false;

    if (alertEmail && typeof motDays === "number" && motDays < 30) {
      const lastSent = existing?.[0]?.last_alert_sent
        ? new Date(existing[0].last_alert_sent)
        : null;

      const now = new Date();

      const daysSinceLastAlert = lastSent
        ? (now - lastSent) / (1000 * 60 * 60 * 24)
        : null;

      if (!lastSent || daysSinceLastAlert >= 7) {
        shouldSendAlert = true;
      }
    }

    if (shouldSendAlert && vehicleId) {
      await sendReminderIfNeeded({
        reg,
        motDays,
        alertEmail,
      });

      await client
        .from("vehicles")
        .update({ last_alert_sent: new Date().toISOString() })
        .eq("id", vehicleId);
    }

    await loadVehicles();

  } catch (err) {
    console.error("Vehicle save flow failed:", err);
  }
}

// ==========================
// LOAD VEHICLES
// ==========================
async function loadVehicles() {
  if (isLoadingVehicles) return;
  isLoadingVehicles = true;

  const list = getEl("vehicleList");
  if (!list) {
    isLoadingVehicles = false;
    return;
  }

  list.innerHTML = "";

  try {
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
      console.error("Get user failed:", authError);
      list.innerHTML = "<p>Could not load vehicles.</p>";
      isLoadingVehicles = false;
      return;
    }

    const user = authData?.user;
    if (!user) {
      list.innerHTML = "<p>No vehicles yet</p>";
      isLoadingVehicles = false;
      return;
    }

    let vehicles = null;
    let error = null;

    // try with created_at ordering first
    const firstAttempt = await client
      .from("vehicles")
      .select(
       "id, reg, make, colour, vehicle_type, mot_status, mot_days, tax_status, alert_email"
      )
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    vehicles = firstAttempt.data;
    error = firstAttempt.error;

    // fallback if created_at column/order causes issues
    if (error) {
      console.warn("Primary load failed, retrying without created_at:", error);

      const fallbackAttempt = await client
        .from("vehicles")
        .select(
          "id, reg, make, colour, vehicle_type, mot_status, mot_days, tax_status, alert_email"
        )
        .eq("user_id", user.id);

      vehicles = fallbackAttempt.data;
      error = fallbackAttempt.error;
    }

    if (error) {
      console.error("Load vehicles failed:", error);
      list.innerHTML = "<p>Could not load vehicles.</p>";
      isLoadingVehicles = false;
      return;
    }

    if (!vehicles || vehicles.length === 0) {
      list.innerHTML = "<p>No vehicles yet</p>";
      isLoadingVehicles = false;
      return;
    }

    for (const v of vehicles) {
      let colorClass = "grey";
      if (v.mot_status?.includes("Expired") || v.mot_status?.includes("Expiring")) {
        colorClass = "red";
      } else if (v.mot_status?.includes("Due soon")) {
        colorClass = "yellow";
      } else if (v.mot_status?.includes("Valid")) {
        colorClass = "green";
      }

      const safeReg = escapeHtml(v.reg || "");
      const safeMake = escapeHtml(v.make || "Vehicle");
      const safeType = escapeHtml(v.vehicle_type || "Car");
      const safeColour = escapeHtml(v.colour || "Unknown");
      const safeAlertEmail = escapeHtml(v.alert_email || "");
      const safeMotStatus = escapeHtml(v.mot_status || "Unknown");
      const safeTaxStatus = escapeHtml(v.tax_status || "Unknown");
      const safeMotDays =
        v.mot_days === null || v.mot_days === undefined ? "-" : escapeHtml(v.mot_days);

      const row = document.createElement("div");
      row.className = "vehicle-card";

      row.innerHTML = `
        <div class="vehicle-header">
          <img src="${getVehicleImage(v.vehicle_type)}" class="vehicle-icon" alt="Vehicle icon"/>

          <div>
            <div class="vehicle-title">${safeReg}</div>
            <div class="vehicle-meta">
              ${safeMake} • ${safeType} • ${safeColour}
            </div>
            ${safeAlertEmail ? `<div class="vehicle-meta">${safeAlertEmail}</div>` : ""}
          </div>

          <button class="delete-btn" type="button" aria-label="Delete vehicle">✕</button>
        </div>

        <div class="vehicle-stats">
          <span class="badge ${colorClass}">
            ● MOT: ${safeMotStatus} (${safeMotDays} days)
          </span>

          <span class="badge grey">
            ● TAX: ${safeTaxStatus}
          </span>
        </div>
      `;

      const deleteBtn = row.querySelector(".delete-btn");
      deleteBtn?.addEventListener("click", async () => {
        const confirmed = window.confirm(`Delete ${v.reg}?`);
        if (!confirmed) return;

        try {
          const { error: deleteError } = await client
            .from("vehicles")
            .delete()
            .eq("id", v.id);

          if (deleteError) {
            console.error("Delete failed:", deleteError);
            alert("Could not delete vehicle.");
            return;
          }

          await loadVehicles();
        } catch (err) {
          console.error("Delete failed:", err);
          alert("Could not delete vehicle.");
        }
      });

      list.appendChild(row);
    }
  } catch (err) {
    console.error("Unexpected loadVehicles error:", err);
    list.innerHTML = "<p>Could not load vehicles.</p>";
  } finally {
    isLoadingVehicles = false;
  }
}