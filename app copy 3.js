// =======================
// STEP 1: SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authBox = document.getElementById("authBox");
const dashboardBox = document.getElementById("dashboardBox");
const authMessage = document.getElementById("authMessage");

let currentSession = null;
let premiumCache = null; // This stops the flickering

// ==========================
// HELPERS
// ==========================
function getEl(id) {
  return document.getElementById(id);
}

function setAuthMessage(message = "") {
  if (authMessage) authMessage.innerText = message;
}

function setResultMessage(html = "") {
  const resultBox = getEl("resultBox");
  if (!resultBox) return;

  resultBox.style.display = html ? "block" : "none";
  resultBox.innerHTML = html;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearDashboardInputs() {
  const ids = [
    "regInput",
    "alertEmailInput",
    "vehicleNameInput",
    "vehicleTypeInput",
    "vehicleColourInput",
    "insuranceInput",
  ];

  ids.forEach((id) => {
    const el = getEl(id);
    if (el) el.value = "";
  });
}

function clearLoginInputs() {
  const email = getEl("email");
  const password = getEl("password");

  if (email) email.value = "";
  if (password) password.value = "";
}

function normaliseVehicleType(type) {
  if (!type) return "Car";

  const t = String(type).trim().toLowerCase();

  if (t.includes("van")) return "Van";
  if (t.includes("motor")) return "Motorcycle";
  if (t.includes("bike")) return "Motorcycle";
  if (t.includes("truck")) return "Truck";
  if (t.includes("lorry")) return "Lorry";

  return "Car";
}

function getVehicleIcon(type, make) {
  const t = String(type || "").toLowerCase();
  const m = String(make || "").toLowerCase();

  if (t.includes("motorcycle") || t.includes("bike")) return "🏍️";
  if (
    t.includes("van") ||
    m.includes("transit") ||
    m.includes("sprinter") ||
    m.includes("vivaro") ||
    m.includes("trafic") ||
    m.includes("berlingo") ||
    m.includes("partner") ||
    m.includes("caddy")
  ) {
    return "🚐";
  }
  if (t.includes("truck") || t.includes("lorry")) return "🚛";
  return "🚗";
}

// ==========================
// PREMIUM STATUS
// ==========================
async function getPremiumStatus(sessionOverride = null) {
  if (premiumCache !== null) return premiumCache;
  const session = sessionOverride ?? currentSession;

  if (!session?.user) {
    premiumCache = false;
    return false;
  }

  try {
    const { data, error } = await client
      .from("profiles")
      .select("is_premium")
      .eq("id", session.user.id)
      .maybeSingle();

    premiumCache = Boolean(data?.is_premium);
  } catch (err) {
    console.error("Premium check error:", err);
    premiumCache = false;
  }
  return premiumCache;
}

// ==========================
// UPDATE USER UI
// ==========================
async function updateUserStatusUI(sessionOverride = null) {
  const session = sessionOverride ?? currentSession;

  const headerEmail = getEl("headerUserEmail");
  const headerBadge = getEl("headerPlanBadge");
  const dashboardEmail = getEl("dashboardUserEmail");
  const dashboardBadge = getEl("dashboardPlanBadge");
  const logoutBtn = getEl("logoutBtn");

  if (!session?.user) {
    if (headerEmail) headerEmail.innerText = "";
    if (dashboardEmail) dashboardEmail.innerText = "";

    if (headerBadge) {
      headerBadge.innerText = "";
      headerBadge.className = "badge free";
    }

    if (dashboardBadge) {
      dashboardBadge.innerText = "";
      dashboardBadge.className = "badge free";
    }

    if (logoutBtn) logoutBtn.style.display = "none";
    return;
  }

  try {
    const isPremium = await getPremiumStatus(session);
    const planText = isPremium ? "Premium" : "Free";
    const badgeClass = isPremium ? "badge premium" : "badge free";

    if (headerEmail) headerEmail.innerText = session.user.email || "";
    if (dashboardEmail) dashboardEmail.innerText = session.user.email || "";

    if (headerBadge) {
      headerBadge.innerText = planText;
      headerBadge.className = badgeClass;
    }

    if (dashboardBadge) {
      dashboardBadge.innerText = planText;
      dashboardBadge.className = badgeClass;
    }

    if (logoutBtn) logoutBtn.style.display = "inline-flex";
  } catch (err) {
    console.error("User UI update failed:", err);
  }
}

// ==========================
// PREMIUM UI CONTROL (FIXED)
// ==========================
async function checkPremiumUI(sessionOverride = null) {
  const upgradeBox = document.querySelector(".upgrade-box");

  const toggle = getEl("alertsToggle");
  const label = getEl("alertsLabel");
  const alertEmailInput = getEl("alertEmailInput");

  if (!upgradeBox) return;

  const session = sessionOverride ?? currentSession;

  // Not logged in
  if (!session?.user) {
    upgradeBox.style.display = "block";

    if (toggle) toggle.disabled = true;
    if (label) label.textContent = "Premium only";
    if (alertEmailInput) {
      alertEmailInput.disabled = true;
      alertEmailInput.style.opacity = "0.55";
    }

    return;
  }

  try {
    const isPremium = await getPremiumStatus(session);

    // SHOW / HIDE upgrade box
    upgradeBox.style.display = isPremium ? "none" : "block";

    console.log("💎 Premium UI:", isPremium ? "hidden" : "visible");

    // HANDLE ALERT CONTROLS
    if (!isPremium) {
      if (toggle) {
        toggle.checked = false;
        toggle.disabled = true;
      }

      if (label) label.textContent = "Premium only";

      if (alertEmailInput) {
        alertEmailInput.disabled = true;
        alertEmailInput.style.opacity = "0.55";
      }
    } else {
      if (toggle) toggle.disabled = false;
    }
  } catch (err) {
    console.error("Premium UI failed:", err);
  }
}

// ==========================
// STRIPE SUCCESS
// ==========================
async function handleStripeSuccess() {
  const params = new URLSearchParams(window.location.search);
  const success = params.get("success");

  if (success !== "true") return;

  localStorage.setItem("stripe_pending", "true");

  // CLEAN URL (prevents loop)
  window.history.replaceState({}, document.title, "/app.html");
}

// ==========================
// APPLY PREMIUM (SAFE)
// ==========================
async function applyPendingPremium(sessionOverride = null) {
  const pending = localStorage.getItem("stripe_pending");
  if (pending !== "true") return;

  const session = sessionOverride ?? currentSession;
  const user = session?.user;

  if (!user) return;

  try {
    const { data: existingProfile } = await client
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile?.is_premium === true) {
      premiumCache = true;
      localStorage.removeItem("stripe_pending");
      return;
    }

    const { error } = await client
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", user.id);

    if (error) {
      console.error("Premium update failed:", error);
      localStorage.removeItem("stripe_pending");
      return;
    }

    premiumCache = true;
    localStorage.removeItem("stripe_pending");

    alert("🎉 Payment successful! Premium activated.");
  } catch (err) {
    console.error("Pending premium failed:", err);
    localStorage.removeItem("stripe_pending");
  }
}

// ==========================
// ALERT CONTROLS (SAFE)
// ==========================
function initAlertControls() {
  const toggle = getEl("alertsToggle");
  const label = getEl("alertsLabel");
  const emailInput = getEl("alertEmailInput");

  if (!toggle || !label || !emailInput) return;

  const savedToggle = localStorage.getItem("fleet_alert_toggle");
  const savedEmail = localStorage.getItem("fleet_alert_email");

  if (savedToggle === "true") toggle.checked = true;
  if (savedEmail) emailInput.value = savedEmail;

  function updateAlertUI() {
    if (toggle.disabled) {
      label.textContent = "Premium only";
      emailInput.disabled = true;
      emailInput.style.opacity = "0.55";
      return;
    }

    if (toggle.checked) {
      label.textContent = "Alerts ON";
      emailInput.disabled = false;
      emailInput.style.opacity = "1";
    } else {
      label.textContent = "Alerts OFF";
      emailInput.disabled = true;
      emailInput.style.opacity = "0.55";
    }
  }

  toggle.onchange = () => {
    localStorage.setItem("fleet_alert_toggle", String(toggle.checked));
    updateAlertUI();
  };

  emailInput.oninput = () => {
    localStorage.setItem("fleet_alert_email", emailInput.value);
  };

  updateAlertUI();
}

// ==========================
// UI VIEW CONTROL
// ==========================
function showLogin() {
  console.log("🔐 Showing login");

  if (authBox) authBox.style.display = "block";
  if (dashboardBox) dashboardBox.style.display = "none";

  setAuthMessage("");
  setResultMessage("");

  const list = getEl("vehicleList");
  if (list) list.innerHTML = "";

  clearDashboardInputs();
}

async function showDashboard(sessionOverride = null) {
  const session = sessionOverride ?? currentSession;
  if (!session?.user) {
    showLogin();
    return;
  }

  if (authBox) {
    authBox.classList.add("hidden");
    authBox.style.display = "none";
  }

  async function showDashboard(sessionOverride = null) {
  const session = sessionOverride ?? currentSession;

  if (!session?.user) {
    showLogin();
    return;
  }

  console.log("📊 Rendering dashboard");

  // Show dashboard ONLY using display (remove class conflicts)
  if (authBox) authBox.style.display = "none";
  if (dashboardBox) dashboardBox.style.display = "block";

  clearLoginInputs();
  setResultMessage("");

  await updateUserStatusUI(session);
  await checkPremiumUI(session);
  await loadVehicles();

  setTimeout(() => {
    getEl("regInput")?.focus();
  }, 150);
}

async function renderAppForSession(sessionOverride = null) {
  const session = sessionOverride ?? currentSession;

  if (session?.user) {
    console.log("✅ Rendering dashboard");

    // 🔥 FORCE CLEAN STATE (this fixes your issue)
    if (authBox) {
      authBox.classList.add("hidden");
      authBox.style.display = "none";
    }

    if (dashboardBox) {
      dashboardBox.classList.remove("hidden");
      dashboardBox.style.display = "block";
    }

    await applyPendingPremium(session);
    await updateUserStatusUI(session);
    await checkPremiumUI(session);
    await loadVehicles();

  } else {
    console.log("🔐 Rendering login");

    if (authBox) {
      authBox.classList.remove("hidden");
      authBox.style.display = "block";
    }

    if (dashboardBox) {
      dashboardBox.classList.add("hidden");
      dashboardBox.style.display = "none";
    }
  }
}

// ==========================
// AUTH BUTTONS
// ==========================
function setupAuthButtons() {
  const loginBtn = getEl("loginBtn");
  const signupBtn = getEl("signupBtn");
  const checkBtn = getEl("checkBtn");
  const forgotBtn = getEl("forgotPasswordLink");
  const logoutBtn = getEl("logoutBtn");

  if (loginBtn) loginBtn.onclick = login;
  if (signupBtn) signupBtn.onclick = signup;
  if (checkBtn) checkBtn.onclick = checkVehicle;
  if (forgotBtn) forgotBtn.onclick = forgotPasswordHandler;
  if (logoutBtn) logoutBtn.onclick = logout;
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

   setAuthMessage("Logging in...");

   const { error } = await client.auth.signInWithPassword({
     email,
     password,
   });

   if (error) {
     console.error("Login error:", error);
     setAuthMessage(error.message);
     return;
   }

   // Let Supabase auth listener handle session + UI switch
   setAuthMessage("");

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

  currentSession = null;
  premiumCache = null;
  showLogin();
  await updateUserStatusUI(null);
  await checkPremiumUI(null);
}

async function forgotPasswordHandler(event) {
  event.preventDefault();

  const email = getEl("email")?.value.trim();

  if (!email) {
    alert("Enter your email first");
    return;
  }

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: "https://www.getfleetsignal.com/reset-password.html",
  });

  if (error) {
    alert(error.message);
  } else {
    alert("Password reset email sent");
  }
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
        motDays,
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
// VEHICLE CHECK
// ==========================
async function checkVehicle() {
  const regInput = getEl("regInput");
  const resultBox = getEl("resultBox");
  const vehicleNameInput = getEl("vehicleNameInput");
  const vehicleTypeInput = getEl("vehicleTypeInput");
  const vehicleColourInput = getEl("vehicleColourInput");
  const insuranceInput = getEl("insuranceInput");
  const alertEmailInput = getEl("alertEmailInput");
  const alertsToggle = getEl("alertsToggle");

  if (!regInput || !resultBox) return;
  if (!currentSession?.user) {
    showLogin();
    return;
  }

  const isPremium = await getPremiumStatus(currentSession);

  const reg = regInput.value.trim().toUpperCase();
  const manualName = vehicleNameInput?.value.trim() || "";
  const manualType = vehicleTypeInput?.value.trim() || "";
  const manualColour = vehicleColourInput?.value.trim() || "";
  const insuranceExpiry = insuranceInput?.value.trim() || null;

  const alertsEnabled = isPremium ? Boolean(alertsToggle?.checked) : false;
  const alertEmail = alertsEnabled
    ? (alertEmailInput?.value.trim() || "")
    : "";

  if (!reg) {
    setResultMessage("⚠️ Enter a registration");
    return;
  }

  setResultMessage("⏳ Checking vehicle...");

  let motStatus = "Valid";
  let taxStatus = "Unknown";
  let motDays = null;
  let vehicleMake = "";
  let vehicleColor = "";
  let taxClass = "";

  try {
    const response = await fetch(
      `${window.location.origin}/api/mot?reg=${encodeURIComponent(reg)}`
    );

    if (!response.ok) {
      throw new Error("Vehicle check request failed");
    }

    const data = await response.json();

    vehicleMake = data.make || "";
    vehicleColor = data.colour || "";
    taxClass = data.taxClass || "";

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();
      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) motStatus = "Expired";
      else if (motDays < 7) motStatus = "Expiring";
      else if (motDays < 30) motStatus = "Due soon";
      else motStatus = "Valid";
    } else {
      motStatus = "Unknown";
      motDays = null;
    }

    taxStatus =
      data.taxStatus === "Taxed"
        ? "Taxed"
        : data.taxStatus === "SORN"
        ? "SORN"
        : "Untaxed";
  } catch (err) {
    console.error("Vehicle check failed:", err);
    motStatus = "Error";
    taxStatus = "Failed";
    motDays = null;
  }

  const finalName = manualName || vehicleMake || "Vehicle";
  const finalColour = manualColour || vehicleColor || "";

  let finalType = "Car";
  const taxClassLower = String(taxClass || "").toLowerCase();

  if (taxClassLower.includes("hgv")) {
    finalType = "Lorry";
  } else if (taxClassLower.includes("goods")) {
    finalType = "Van";
  } else {
    const makeLower = String(vehicleMake || "").toLowerCase();

    const bikeBrands = [
      "honda",
      "yamaha",
      "kawasaki",
      "ducati",
      "triumph",
      "ktm",
      "bsa",
      "suzuki",
    ];
    if (bikeBrands.some((b) => makeLower.includes(b))) {
      finalType = "Motorcycle";
    }

    const vanKeywords = [
      "transit",
      "sprinter",
      "vivaro",
      "trafic",
      "crafter",
      "ducato",
    ];
    if (vanKeywords.some((v) => makeLower.includes(v))) {
      finalType = "Van";
    }

    const lorryBrands = ["daf", "scania", "volvo", "man", "iveco"];
    if (lorryBrands.some((l) => makeLower.includes(l))) {
      finalType = "Lorry";
    }
  }

  if (manualType) {
    finalType = normaliseVehicleType(manualType);
  }

  setResultMessage(`
    <div class="result-card">
      <div class="reg">${escapeHtml(reg)}</div>
      <div class="meta">${escapeHtml(finalName)} ${escapeHtml(finalColour)}</div>
      <div class="status-row" style="margin-top:10px;">
        <div class="status-pill ${
          motStatus === "Valid"
            ? "status-green"
            : motStatus === "Due soon"
              ? "status-yellow"
              : "status-red"
        }">
          <span class="status-dot"></span>
          <span class="status-text">MOT</span>
          <span class="status-value">${escapeHtml(motStatus)} (${motDays ?? "-" }d)</span>
        </div>
        <div class="status-pill ${
          taxStatus === "Taxed"
            ? "status-green"
            : taxStatus === "SORN"
              ? "status-grey"
              : "status-red"
        }">
          <span class="status-dot"></span>
          <span class="status-text">TAX</span>
          <span class="status-value">${escapeHtml(taxStatus)}</span>
        </div>
      </div>
    </div>
  `);

  try {
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return;

    const payload = {
      user_id: user.id,
      reg,
      name: finalName,
      mot_status: motStatus,
      mot_days: motDays,
      tax_status: taxStatus,
      make: vehicleMake || null,
      colour: finalColour || null,
      vehicle_type: finalType,
      insurance_expiry: insuranceExpiry || null,
      alert_email: alertEmail || null,
    };

    let vehicleId = null;
    let lastAlertSent = null;

    const { data: existing, error: existingError } = await client
      .from("vehicles")
      .select("id, last_alert_sent")
      .eq("reg", reg)
      .eq("user_id", user.id)
      .limit(1);

    if (existingError) {
      console.error("Existing vehicle lookup failed:", existingError);
      return;
    }

    if (existing && existing.length > 0) {
      const { error: updateError } = await client
        .from("vehicles")
        .update(payload)
        .eq("id", existing[0].id);

      if (updateError) {
        console.error("Vehicle update failed:", updateError);
        return;
      }

      vehicleId = existing[0].id;
      lastAlertSent = existing[0].last_alert_sent;
    } else {
      const { data: inserted, error: insertError } = await client
        .from("vehicles")
        .insert([payload])
        .select();

      if (insertError) {
        console.error("Vehicle insert failed:", insertError);
        return;
      }

      vehicleId = inserted?.[0]?.id || null;
    }

    if (isPremium && alertEmail && typeof motDays === "number" && motDays < 30) {
      const lastSent = lastAlertSent ? new Date(lastAlertSent) : null;
      const now = new Date();
      const daysSince = lastSent
        ? (now - lastSent) / (1000 * 60 * 60 * 24)
        : null;

      if (!lastSent || daysSince >= 7) {
        await sendReminderIfNeeded({ reg, motDays, alertEmail });

        if (vehicleId) {
          await client
            .from("vehicles")
            .update({ last_alert_sent: new Date().toISOString() })
            .eq("id", vehicleId);
        }
      }
    }

    setResultMessage("");
    await loadVehicles();
  } catch (err) {
    console.error("Save failed:", err);
  }
}

// ==========================
// LOAD VEHICLES
// ==========================
async function loadVehicles() {
  if (isLoadingVehicles) return;

  try {
    isLoadingVehicles = true;

    const list = getEl("vehicleList");
    if (!list) return;

    list.innerHTML = "";

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      list.innerHTML = "<p>No vehicles yet</p>";
      return;
    }

    const { data: vehicles, error } = await client
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load vehicles failed:", error);
      list.innerHTML = "<p>Could not load vehicles.</p>";
      return;
    }

    if (!vehicles || vehicles.length === 0) {
      list.innerHTML = "<p>No vehicles yet</p>";
      return;
    }

    for (const v of vehicles) {
      let cardClass = "vehicle-card valid";

      if (
        String(v.mot_status).includes("Expired") ||
        String(v.mot_status).includes("Expiring")
      ) {
        cardClass = "vehicle-card expired";
      } else if (String(v.mot_status).includes("Due soon")) {
        cardClass = "vehicle-card warning";
      }

      let motClass = "status-green";
      if (v.mot_days !== null && v.mot_days < 30) motClass = "status-yellow";
      if (v.mot_days !== null && v.mot_days <= 0) motClass = "status-red";

      let taxClassName = "status-grey";
      if (v.tax_status === "Taxed") taxClassName = "status-green";
      else if (v.tax_status === "Untaxed" || v.tax_status === "Failed") {
        taxClassName = "status-red";
      }

      let insClass = "status-grey";
      let insText = "Not set";

      if (v.insurance_expiry) {
        const today = new Date();
        const expiry = new Date(v.insurance_expiry);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          insText = "Expired";
          insClass = "status-red";
        } else if (diffDays < 30) {
          insText = `Due soon (${diffDays}d)`;
          insClass = "status-yellow";
        } else {
          insText = `Valid (${diffDays}d)`;
          insClass = "status-green";
        }
      }

      const safeReg = escapeHtml(v.reg || "");
      const safeMake = escapeHtml(v.make || v.name || "Vehicle");
      const safeType = escapeHtml(v.vehicle_type || "Car");
      const safeColour = escapeHtml(v.colour || "Unknown");
      const safeMotStatus = escapeHtml(v.mot_status || "Unknown");
      const safeTaxStatus = escapeHtml(v.tax_status || "Unknown");
      const safeMotDays =
        v.mot_days === null || v.mot_days === undefined
          ? "-"
          : escapeHtml(v.mot_days);

      const icon = getVehicleIcon(v.vehicle_type, v.make);

      const row = document.createElement("div");
      row.className = cardClass;

      row.innerHTML = `
        <div class="vehicle-top">
          <div class="vehicle-reg">${safeReg}</div>

          <div class="vehicle-right">
            <div class="vehicle-icon">${icon}</div>
            <button class="delete-btn" type="button">✖</button>
          </div>
        </div>

        <div class="vehicle-details">
          ${safeMake} - ${safeType} - ${safeColour}
        </div>

        <div class="status-row">
          <div class="status-pill ${motClass}">
            <span class="status-dot"></span>
            <span class="status-text">MOT</span>
            <span class="status-value">${safeMotStatus} (${safeMotDays}d)</span>
          </div>

          <div class="status-pill ${taxClassName}">
            <span class="status-dot"></span>
            <span class="status-text">TAX</span>
            <span class="status-value">${safeTaxStatus}</span>
          </div>

          <div class="status-pill ${insClass}">
            <span class="status-dot"></span>
            <span class="status-text">INS</span>
            <span class="status-value">${escapeHtml(insText)}</span>
          </div>
        </div>
      `;

      list.appendChild(row);

      const deleteBtn = row.querySelector(".delete-btn");

      if (deleteBtn) {
        deleteBtn.onclick = async () => {
          const confirmed = confirm(`Delete ${v.reg}?`);
          if (!confirmed) return;

          const vehicleId = v?.id;

          if (!vehicleId) {
            console.error("Delete aborted: Missing vehicle ID", v);
            alert("Error: Vehicle ID missing. Cannot delete.");
            return;
          }

          try {
            const { error: deleteError } = await client
              .from("vehicles")
              .delete()
              .eq("id", vehicleId);

            if (deleteError) {
              console.error("Delete failed:", deleteError);
              alert("Delete failed");
              return;
            }

            await loadVehicles();
          } catch (err) {
            console.error("Unexpected delete error:", err);
            alert("Unexpected error during delete");
          }
        };
      }
    }
  } catch (err) {
    console.error("loadVehicles crashed:", err);
  } finally {
    isLoadingVehicles = false;
  }
}

// ==========================
// CLEAN INIT + AUTH SYSTEM
// ==========================
async function initApp() {
  console.log("🚀 Initialising App...");

  setupAuthButtons();
  initAlertControls();

  // Get current session (NOT just user)
  const {
    data: { session },
  } = await client.auth.getSession();

  currentSession = session ?? null;
  premiumCache = null;

  await renderAppForSession(currentSession);
}

// ==========================
// AUTH STATE LISTENER
// ==========================
let authListenerInitialised = false;

if (!authListenerInitialised) {
  authListenerInitialised = true;

  client.auth.onAuthStateChange(async (event, session) => {
    console.log("🔄 Auth change:", event);

    currentSession = session ?? null;
    premiumCache = null;

    await renderAppForSession(currentSession);
  });
}

// ==========================
// START APP
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((err) => {
    console.error("❌ App init failed:", err);
    showLogin();
  });
  });