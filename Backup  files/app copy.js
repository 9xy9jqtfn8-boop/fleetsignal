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
// EMAIL ALERT SYSTEM
// =======================
async function sendMotAlert(vehicle) {
  console.log("ALERT FUNCTION CALLED")
   if (!vehicle.alert_email) {
    console.log("❌ No email");
    return;
  }

  if (vehicle.mot_days > 1000) return;

  const now = new Date();
  const lastSent = vehicle.last_alert_sent ? new Date(vehicle.last_alert_sent) : null;

  // 7 day cooldown
  if (lastSent && (now - lastSent) < (7 * 24 * 60 * 60 * 1000)) {
    return;
  }

  try {
    await fetch("/api/sendAlert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: vehicle.alert_email,
        reg: vehicle.reg,
        motDays: vehicle.mot_days
      })
    });

    await client
      .from("vehicles")
      .update({ last_alert_sent: new Date().toISOString() })
      .eq("id", vehicle.id);

  } catch (err) {
    console.error("Alert failed", err);
  }
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
  const regInput = getEl("regInput");
  const reg = regInput.value.trim().toUpperCase();
  // ✅ SAVE ALERT EMAIL
  const emailInput = document.getElementById("alertEmailInput");
  if (emailInput && emailInput.value) {
    localStorage.setItem("fleet_alert_email", emailInput.value);
  }

  if (!reg) {
    setResultMessage("Enter a registration");
    return;
  }

  setResultMessage("Checking...");

  try {
    // ==========================
    // FETCH FROM YOUR API
    // ==========================
    const res = await fetch(`/api/mot?reg=${reg}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    // ==========================
    // EXTRACT DATA
    // ==========================
    const motExpiryDate = data.motExpiryDate || null;
    const taxStatus = data.taxStatus || "Unknown";
    const make = data.make || "";
    const colour = data.colour || "";

    // ==========================
    // CALCULATE MOT STATUS + DAYS
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

    await client.from("vehicles").insert([
      {
        user_id: user.id,
        reg,
        make,
        colour,
        mot_status: motInfo.status,
        mot_days: motInfo.days,
        tax_status: taxStatus,
        alert_email: user.email,
        alerts_enabled: true
      }
    ]);

    loadVehicles();

  } catch (err) {
    console.error(err);
    setResultMessage("Error checking vehicle");
  }
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

  data.forEach(v => {

    const mot = getMotStatusFromDays(v.mot_days);
    v.mot_status = mot.status;
   // DO NOT overwrite v.mot_days

    const row = document.createElement("div");

    const motClass = getMotClass(v.mot_status, v.mot_days);
    const taxClass = getTaxClass(v.tax_status);
    const icon = getVehicleIcon(v);

   sendMotAlert({
  ...v,
  alert_email: v.alert_email,
  alerts_enabled: localStorage.getItem("fleet_alerts_enabled") === "true"
});

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
  <div class="status-pill ${motClass}">
    <span class="dot"></span>
    MOT: ${v.mot_status}${v.mot_days != null ? ` (${v.mot_days} days)` : ""}
  </div>

  <div class="status-pill ${taxClass}">
    <span class="dot"></span>
    TAX: ${v.tax_status}
  </div>
</div>
    `;

    row.querySelector(".delete-btn").onclick = async () => {
      await client.from("vehicles").delete().eq("id", v.id);
      loadVehicles();
    };

    list.appendChild(row);
  });

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