// =======================
// SUPABASE SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSession = null;
let isLoadingVehicles = false;

// =======================
// MOT CALCULATION
// =======================
function getMotStatus(motExpiryDate) {
  if (!motExpiryDate) {
    return { status: "Unknown", days: null, color: "grey" };
  }

  const today = new Date();
  const expiry = new Date(motExpiryDate);

  const diffTime = expiry - today;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) return { status: "Expired", days, color: "red" };
  if (days <= 7) return { status: "Expiring", days, color: "red" };
  if (days <= 30) return { status: "Due Soon", days, color: "orange" };

  return { status: "Valid", days, color: "green" };
}

function getMotStatusFromDays(days) {
  if (days === null || days === undefined) {
    return { status: "Unknown", color: "grey" };
  }

  if (days < 0) return { status: "Expired", color: "red" };
  if (days <= 7) return { status: "Expiring", color: "red" };
  if (days <= 30) return { status: "Due Soon", color: "orange" };

  return { status: "Valid", color: "green" };
}

// =======================
// DATE COUNTDOWN (TAX / INSURANCE)
// =======================
function getDaysRemaining(dateString) {
  if (!dateString) return null;

  const today = new Date();
  const target = new Date(dateString);

  const diffTime = target - today;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return days;
}

// =======================
// TAX STATUS
// =======================
function getTaxStatus(taxStatus) {
  if (!taxStatus) {
    return { status: "Unknown", color: "grey" };
  }

  const status = taxStatus.toLowerCase();

  if (status.includes("taxed")) {
    return { status: "Taxed", color: "green" };
  }

  if (status.includes("sorn")) {
    return { status: "SORN", color: "grey" };
  }

  if (status.includes("untaxed")) {
    return { status: "Untaxed", color: "red" };
  }

  return { status: taxStatus, color: "grey" };
}

// =======================
// HELPERS
// =======================
function getEl(id) {
  return document.getElementById(id);
}

function setAuthMessage(msg = "") {
  const el = getEl("authMessage");
  if (el) el.innerText = msg;
}

function setResultMessage(html = "") {
  const el = getEl("resultBox");
  if (!el) return;
  el.style.display = html ? "block" : "none";
  el.innerHTML = html;
}

// =======================
// VIEW SWITCHER (PREMIUM)
// =======================
function showView(viewId) {
  const views = ["vehiclesView", "alertsView", "settingsView"];
  const navItems = ["navVehicles", "navAlerts", "navSettings"];

  // Hide all views
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("fade-in");
    }
  });

  // Remove active from all nav
  navItems.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  // Show selected view
  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.remove("hidden");

    // trigger animation
    setTimeout(() => {
      activeView.classList.add("fade-in");
    }, 10);
  }

  // Activate correct nav item
  if (viewId === "vehiclesView") document.getElementById("navVehicles")?.classList.add("active");
  if (viewId === "alertsView") document.getElementById("navAlerts")?.classList.add("active");
  if (viewId === "settingsView") document.getElementById("navSettings")?.classList.add("active");
}

// =======================
// UI CONTROL
// =======================
function showLogin() {
 const authBox = getEl("authBox");
 const dashboardBox = getEl("dashboardBox");
 const logoutBtn = getEl("logoutBtn");
 const headerEmail = getEl("headerUserEmail");

 if (authBox) authBox.classList.remove("hidden");
 if (dashboardBox) dashboardBox.classList.add("hidden");

 if (logoutBtn) logoutBtn.style.display = "none";
 if (headerEmail) headerEmail.innerText = "";
}

function showDashboard(session) {
 const authBox = getEl("authBox");
 const dashboardBox = getEl("vehiclesView");
 const logoutBtn = getEl("logoutBtn");
 const emailEl = getEl("dashboardUserEmail");
 const headerEmail = getEl("headerUserEmail");
 const alertsToggle = document.getElementById("alertsToggle");
 const alertsLabel = document.getElementById("alertsLabel");

 if (authBox) authBox.classList.add("hidden");
 if (dashboardBox) dashboardBox.classList.remove("hidden");

 if (emailEl) emailEl.innerText = session.user.email;
 if (headerEmail) headerEmail.innerText = session.user.email;

 if (logoutBtn) logoutBtn.style.display = "inline-flex";
 if (logoutBtn) logoutBtn.style.display = "inline-block";

  // Prevent duplicate listeners
  if (logoutBtn && !logoutBtn.dataset.bound) {
    console.log("Binding logout button");
    logoutBtn.addEventListener("click", logout);
    logoutBtn.dataset.bound = "true";
  }

  if (alertsToggle) {
 alertsToggle.addEventListener("change", updateAlertText);
}

  function showView(viewId) {
  const views = ["vehiclesView", "alertsView", "settingsView"];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  const active = document.getElementById(viewId);
  if (active) active.classList.remove("hidden");
}

  showView("vehiclesView");
  
  loadVehicles();
}

// =======================
// AUTH
// =======================
async function signup() {
  const email = getEl("email").value.trim();
  const password = getEl("password").value;

  if (!email || !password) {
    setAuthMessage("Enter email and password");
    return;
  }

  const { error } = await client.auth.signUp({ email, password });

  setAuthMessage(error ? error.message : "Check your email");
}

async function login() {
  const email = getEl("email").value.trim();
  const password = getEl("password").value;

  if (!email || !password) {
    setAuthMessage("Enter email and password");
    return;
  }

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMessage(error.message);
  } else {
    setAuthMessage("");
  }
}

async function logout() {
  console.log("Logout clicked");

  const { error } = await client.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
  } else {
    console.log("Signed out successfully");

    // 🔥 CLEAR ALL SESSION DATA
    localStorage.clear();
    sessionStorage.clear();

    // 🔥 FORCE HARD RESET
    window.location.href = "/index.html";
  }
}

// =======================
// PASSWORD RESET
// =======================
async function forgotPasswordHandler(e) {
  e.preventDefault();

  const email = getEl("email").value.trim();

  if (!email) {
    alert("Enter your email first");
    return;
  }

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: "https://www.getfleetsignal.com/reset-password.html"
  });

  if (error) alert(error.message);
  else alert("Password reset email sent");
}

// =======================
// VEHICLE CHECK
// =======================
 async function checkVehicle() {

  const regInput = document.getElementById("regInput");
  const reg = regInput.value.trim();

  if (!reg) {
    setResultMessage("Enter a registration");
    return;
  }

  setResultMessage("Checking...");

  try {
    // ==========================
    // FETCH FROM API
    // ==========================
    const res = await fetch(`/api/mot?reg=${reg}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    console.log("DVLA DATA:", data);

    // ==========================
    // EXTRACT DATA
    // ==========================
    const motExpiryDate = data.motExpiryDate || null;
    const taxStatus = data.taxStatus || "Unknown";
    const make = data.make || "";
    const colour = data.colour || "";

    // ==========================
    // CALCULATE MOT STATUS
    // ==========================
    const motInfo = getMotStatus(motExpiryDate);

    // ==========================
    // DISPLAY RESULT (PREMIUM STYLE)
    // ==========================
    setResultMessage(`
      <div class="result-card">
        <strong>${reg}</strong><br>
        ${make} ${colour}<br><br>

        MOT: ${motInfo.status}
        ${motInfo.days !== null ? `(${motInfo.days} days)` : ""}<br>

        TAX: ${taxStatus}
      </div>
    `);

    // ==========================
    // SAVE TO SUPABASE
    // ==========================
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    await client.from("vehicles").upsert([
      {
        user_id: user.id,
        reg,
        make,
        colour,

        // MOT
        mot_status: motInfo.status,
        mot_days: motInfo.days,

        // TAX (DVLA)
        tax_status: taxStatus,

        // TAX DATE (user input)
        tax_due_date: document.getElementById("taxDueDate")?.value || null,

        // INSURANCE DATE (user input)
        insurance_expiry: document.getElementById("insuranceInput")?.value || null,

        // ALERTS
        alert_email: user.email,
        alerts_enabled: document.getElementById("alertsToggle")?.checked || false
      }
    ], { onConflict: "user_id,reg" });

    // reload vehicles
    loadVehicles();

  } catch (err) {
    console.error(err);
    setResultMessage("Error checking vehicle");
  }
}


// =======================
// REG INPUT SETUP (SAFE)
// =======================

const regInputSetup = document.getElementById("regInput");

if (regInputSetup) {

  // FORMAT INPUT
  regInputSetup.addEventListener("input", (e) => {
    let value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (value.length > 4) {
      value = value.slice(0, 4) + " " + value.slice(4);
    }

    e.target.value = value;
  });

  // ENTER KEY = CHECK
  regInputSetup.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("checkBtn")?.click();
    }
  });

  // AUTO FOCUS
  window.addEventListener("load", () => {
    setTimeout(() => {
      regInputSetup.focus();
    }, 300);
  });

}

// =======================
// LOAD VEHICLES (PREMIUM FINAL)
// =======================
async function loadVehicles() {
  if (isLoadingVehicles) return;

  isLoadingVehicles = true;

  const list = getEl("vehicleList");
  if (!list) return;

  list.innerHTML = "";

  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    list.innerHTML = "<p>No vehicles</p>";
    isLoadingVehicles = false;
    return;
  }

  const { data, error } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    list.innerHTML = "<p>No vehicles</p>";
    isLoadingVehicles = false;
    return;
  }

  for (const v of data) {
    
    const taxDays = getDaysRemaining(v.tax_due_date);
    const insuranceDays = getDaysRemaining(v.insurance_expiry);
    const urgentAlert =(v.mot_days !== null && v.mot_days <= 7) || 
      (taxDays !== null && taxDays <= 7) ||
      (insuranceDays !== null && insuranceDays <= 7) ||
      (v.tax_status && v.tax_status.toLowerCase() !== "taxed");

    const warningAlert =
      (v.mot_days !== null && v.mot_days <= 30) ||
      (taxDays !== null && taxDays <= 30) ||
      (insuranceDays !== null && insuranceDays <= 30);
    const mot = getMotStatusFromDays(v.mot_days);
    v.mot_status = mot.status;
   // DO NOT overwrite v.mot_days

    const shouldSendAlert = urgentAlert || warningAlert;
    const now = new Date();
    const lastSent = v.last_alert_sent ? new Date(v.last_alert_sent) : null;

    const daysSinceLastAlert = lastSent
      ? (now - lastSent) / (1000 * 60 * 60 * 24)
      : null;

    const canSendAlert =
      shouldSendAlert &&
      (!lastSent || daysSinceLastAlert >= 7); // 7 day cooldown

    if (canSendAlert && v.alerts_enabled && v.alert_email) {
       try {
    const res = await fetch("/api/sendAlert", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    reg: v.reg,
    email: v.alert_email,
    mot_days: v.mot_days,
    tax_days: taxDays,
    insurance_days: insuranceDays
  })
});

if (!res.ok) {
  throw new Error("Email failed");
}

// Save last alert timestamp only after email succeeds
await client
  .from("vehicles")
  .update({ last_alert_sent: new Date().toISOString() })
  .eq("id", v.id);

  } catch (err) {
    console.error("Alert error:", err);
  }
}
    const row = document.createElement("div");

    const motClass = getMotClass(v.mot_status, v.mot_days);
    const icon = getVehicleIcon(v);
    const tax = getTaxStatus(v.tax_status);

    row.className = `vehicle-card ${motClass}`;

    row.innerHTML = `
      <div class="vehicle-top">
        <div class="vehicle-left">
          <div class="vehicle-icon">${icon}</div>
          <div>
            <div class="vehicle-reg">${v.reg}</div>
            <div class="vehicle-meta">${v.make || ""} ${v.colour || ""}</div>
          </div>
        </div>

        <button class="delete-btn">✕</button>
      </div>
     
      <div class="vehicle-status">
       ${urgentAlert ? `
       <div class="status-pill alert red">
        ⚠ Urgent
      </div>
    ` : warningAlert ? `
      <div class="status-pill alert yellow">
        ⚠ Due soon
    </div>
    ` : ""}
    
  <div class="status-pill ${motClass}">
    <span class="dot"></span>
    MOT: ${v.mot_status}${v.mot_days != null ? ` (${v.mot_days} days)` : ""}
  </div>

  <div class="status-pill ${tax.color}">
    <span class="dot"></span>
     TAX: ${tax.status}${taxDays !== null ? ` (${taxDays} days)` : ""}
  </div>

  <div class="status-pill ${insuranceDays !== null && insuranceDays < 7 ? 'red' : insuranceDays !== null && insuranceDays < 30 ? 'orange' : 'green'}">
  <span class="dot"></span>
   INS: ${insuranceDays !== null ? `${insuranceDays} days` : "Not set"}
   </div>
  </div>
    `;

    row.querySelector(".delete-btn").onclick = async () => {
      await client.from("vehicles").delete().eq("id", v.id);
      loadVehicles();
    };

    list.appendChild(row);
  }

  isLoadingVehicles = false;
}

// =======================
// VEHICLE HELPERS (CLEAN + WORKING)
// =======================
function getMotClass(status, days) {
  const s = (status || "").toLowerCase();

  if (s.includes("expired")) return "red";
  if (days === null || days === undefined || Number.isNaN(Number(days))) return "yellow";
  if (Number(days) <= 7) return "red";
  if (Number(days) <= 30) return "yellow";

  return "green";
}

function getTaxClass(status) {
  const s = (status || "").toLowerCase();

  if (s.includes("taxed")) return "green";
  if (s.includes("sorn")) return "yellow";
  if (s.includes("untaxed")) return "red";

  return "yellow";
}

// =======================
// MOT COUNTDOWN (SAFE + FIXED)
// =======================
function getMotCountdown(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "";
  }

  const n = Number(days);

  if (n < 0) {
    return `<div class="mot-countdown red">Expired</div>`;
  }

  if (n === 0) {
    return `<div class="mot-countdown red">Expires today</div>`;
  }

  if (n <= 7) {
    return `<div class="mot-countdown red">${n} day${n === 1 ? "" : "s"} left</div>`;
  }

  if (n <= 30) {
    return `<div class="mot-countdown yellow">${n} days left</div>`;
  }

  return `<div class="mot-countdown green">${n} days left</div>`;
}

// =======================
// INIT
// =======================
function setupButtons() {
 const loginBtn = getEl("loginBtn");
 const signupBtn = getEl("signupBtn");
 const logoutBtn = getEl("logoutBtn");
 const checkBtn = getEl("checkBtn");
 const forgotLink = getEl("forgotPasswordLink");

 if (loginBtn) loginBtn.onclick = login;
 if (signupBtn) signupBtn.onclick = signup;
 if (checkBtn) checkBtn.onclick = checkVehicle;
 if (forgotLink) forgotLink.onclick = forgotPasswordHandler;

 if (logoutBtn && !logoutBtn.dataset.bound) {
   logoutBtn.onclick = logout;
   logoutBtn.dataset.bound = "true";
 }
}

// =======================
// VIEW SWITCHER (FIX)
// =======================
function showView(viewId) {
  const views = ["vehiclesView", "alertsView", "settingsView"];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  const active = document.getElementById(viewId);
  if (active) active.classList.remove("hidden");
}

async function initApp() {
 console.log("App starting...");
 updateAlertText();
 
 setupButtons();
 setupNavigation();

 const { data, error } = await client.auth.getSession();

 if (error || !data.session) {
   currentSession = null;
   showLogin();
   return;
 }

 currentSession = data.session;
 showDashboard(data.session);
}

 function updateAlertText() {
  if (!alertsToggle || !alertsLabel) return;

  if (alertsToggle.checked) {
    alertsLabel.textContent = "Alerts On";
    alertsLabel.style.color = "#22c55e";
  } else {
    alertsLabel.textContent = "Alerts Off";
    alertsLabel.style.color = "#6b7280";
  }
}

// =======================
// NAVIGATION (BOTTOM TABS)
// =======================
function setupNavigation() {
  const navVehicles = document.getElementById("navVehicles");
  const navAlerts = document.getElementById("navAlerts");
  const navSettings = document.getElementById("navSettings");

  if (navVehicles) navVehicles.onclick = () => showView("vehiclesView");
  if (navAlerts) navAlerts.onclick = () => showView("alertsView");
  if (navSettings) navSettings.onclick = () => showView("settingsView");
}

// =======================
// AUTH LISTENER
// =======================
client.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);

  if (event === "SIGNED_IN") {
    currentSession = session;
    showDashboard(session);
  }

  if (event === "SIGNED_OUT") {
    currentSession = null;
    showLogin();
  }
});

// =======================
// START
// =======================
document.addEventListener("DOMContentLoaded", initApp);

// =======================
// VEHICLE ICON
// =======================
function getVehicleIcon(v) {
 const make = (v.make || "").toLowerCase();
 const type = (v.vehicle_type || "").toLowerCase();
 const name = (v.name || "").toLowerCase();

 const text = `${make} ${type} ${name}`;

 const motorcycles = [
   "motorcycle","motorbike","bike","scooter","moped",
   "honda","yamaha","kawasaki","ducati","ktm","suzuki",
   "triumph","harley","aprilia","vespa","piaggio","royal enfield",
   "bsa","moto guzzi","indian"
 ];

 const vans = [
   "van","panel van","transit","sprinter","vivaro","trafic",
   "crafter","ducato","boxer","relay","partner","berlingo",
   "caddy","kangoo","nv200","nv300","nv400","vito","expert",
   "dispatch","proace","doblo","combo","movano","master"
 ];

 const hgvs = [
   "hgv","lorry","truck","rigid","artic","tractor unit",
   "daf","scania","man","iveco","volvo trucks","actros",
   "atego","axor","renault trucks","isuzu truck","fuso"
 ];

 const cars = [
   "car","hatchback","saloon","estate","suv","mpv",
   "ford","vauxhall","volkswagen","vw","audi","bmw",
   "mercedes","toyota","nissan","hyundai","kia","peugeot",
   "citroen","renault","skoda","seat","mazda","tesla",
   "jaguar","land rover","range rover","mini","fiat","volvo"
 ];

 if (motorcycles.some(x => text.includes(x))) return "🏍️";
 if (hgvs.some(x => text.includes(x))) return "🚛";
 if (vans.some(x => text.includes(x))) return "🚐";
 if (cars.some(x => text.includes(x))) return "🚗";

 return "🚗";
}

document.getElementById("upgradeBtn")?.addEventListener("click", async () => {
  try {
    console.log("Starting checkout...");

    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
      alert("You must be logged in");
      return;
    }

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Checkout server error:", data);
      alert(data.error || "Payment failed. Try again.");
      return;
    }

    if (!data.url) {
      alert("No checkout URL returned");
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    console.error("Stripe error:", err);
    alert("Payment failed. Try again.");
  }
});

// =======================
// STRIPE SUCCESS HANDLER
// =======================
async function checkStripeReturn() {
  console.log("🔥 checkStripeReturn running");

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");

  if (!sessionId) return;

  try {
    console.log("Verifying payment...");

    const res = await fetch(`/api/verify-session?session_id=${sessionId}`);
    const data = await res.json();

    if (data.success) {
      console.log("✅ Premium activated");

      // Clean URL
      window.history.replaceState({}, document.title, "/app.html");

      // Reload to update UI
      location.reload();
    } else {
      console.warn("Verification failed response:", data);
    }

  } catch (err) {
    console.error("Verification failed:", err);
  }
}

checkStripeReturn();

// =======================
// SHOW USER EMAIL
// =======================
(async () => {
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    document.getElementById("headerUserEmail").textContent = user.email;
  }
})();

// =======================
// CHECK PREMIUM STATUS
// =======================
(async () => {
 const { data: { user } } = await client.auth.getUser();
 if (!user) return;

 const { data, error } = await client
   .from("profiles")
   .select("is_premium")
   .eq("id", user.id)
   .single();

 if (error) {
   console.error("Premium check error:", error);
   return;
 }

 if (data?.is_premium) {
   console.log("✅ User is premium");

   document.querySelector(".upgrade-box")?.remove();

   // OPTIONAL: turn alerts on automatically
   const toggle = document.getElementById("alertsToggle");
   if (toggle) toggle.checked = true;
 }
})();