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
  if (!vehicle.alert_email || vehicle.mot_days === null) return;

  if (vehicle.mot_days > 30) return;

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
 const dashboardBox = getEl("dashboardBox");
 const logoutBtn = getEl("logoutBtn");
 const emailEl = getEl("dashboardUserEmail");
 const headerEmail = getEl("headerUserEmail");

 if (authBox) authBox.classList.add("hidden");
 if (dashboardBox) dashboardBox.classList.remove("hidden");

 if (emailEl) emailEl.innerText = session.user.email;
 if (headerEmail) headerEmail.innerText = session.user.email;

 if (logoutBtn) logoutBtn.style.display = "inline-flex";

 loadVehicles();
}

  // ✅ SHOW the logout button (this was your issue)
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  // Prevent duplicate listeners
  if (logoutBtn && !logoutBtn.dataset.bound) {
    console.log("Binding logout button");
    logoutBtn.addEventListener("click", logout);
    logoutBtn.dataset.bound = "true";
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
        tax_status: taxStatus
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
  v.mot_days = mot.days;

  const row = document.createElement("div");

  const motClass = getMotClass(v.mot_status, v.mot_days);
    const taxClass = getTaxClass(v.tax_status);
    const icon = getVehicleIcon(v);

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
         MOT: ${v.mot_status}${v.mot_days != null ? ` (${v.mot_days} days)` : ''}
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

async function initApp() {
 console.log("App starting...");

 setupButtons();

 const { data, error } = await client.auth.getSession();

 if (error || !data.session) {
   currentSession = null;
   showLogin();
   return;
 }

 currentSession = data.session;
 showDashboard(data.session);
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
// VEHICLE HELPERS
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

function getMotCountdown(days) {
 if (days === null || days === undefined || Number.isNaN(Number(days))) return "";

 const n = Number(days);

 if (n < 0) return `<div class="mot-countdown" style="color:#ef4444;">Expired</div>`;
 if (n === 0) return `<div class="mot-countdown" style="color:#ef4444;">Expires today</div>`;
 if (n <= 7) return `<div class="mot-countdown" style="color:#ef4444;">${n} day${n === 1 ? "" : "s"} left</div>`;
 if (n <= 30) return `<div class="mot-countdown" style="color:#f59e0b;">${n} days left</div>`;

 return `<div class="mot-countdown">${n} days left</div>`;
}

function getEmptyVehicleState() {
 return `
   <div class="empty-state">
     <div class="empty-state-icon">🚗</div>
     <div>No vehicles yet</div>
     <p>Add a registration above to start tracking your fleet.</p>
   </div>
 `;
}

function getVehicleIcon(v) {
 const make = (v.make || "").toLowerCase();
 const type = (v.vehicle_type || "").toLowerCase();
 const name = (v.name || "").toLowerCase();

 const text = `${make} ${type} ${name}`;

 const motorcycles = [
   "motorcycle", "motorbike", "bike", "scooter", "moped",
   "honda", "yamaha", "kawasaki", "ducati", "ktm", "suzuki",
   "triumph", "harley", "aprilia", "vespa", "piaggio", "royal enfield",
   "bsa", "moto guzzi", "indian"
 ];

 const vans = [
   "van", "panel van", "transit", "sprinter", "vivaro", "trafic",
   "crafter", "ducato", "boxer", "relay", "partner", "berlingo",
   "caddy", "kangoo", "nv200", "nv300", "nv400", "vito", "expert",
   "dispatch", "proace", "doblo", "combo", "movano", "master"
 ];

 const hgvs = [
   "hgv", "lorry", "truck", "rigid", "artic", "tractor unit",
   "daf", "scania", "man", "iveco", "volvo trucks", "actros",
   "atego", "axor", "renault trucks", "isuzu truck", "fuso"
 ];

 const cars = [
   "car", "hatchback", "saloon", "estate", "suv", "mpv",
   "ford", "vauxhall", "volkswagen", "vw", "audi", "bmw",
   "mercedes", "toyota", "nissan", "hyundai", "kia", "peugeot",
   "citroen", "renault", "skoda", "seat", "mazda", "tesla",
   "jaguar", "land rover", "range rover", "mini", "fiat", "volvo"
 ];

 if (motorcycles.some(x => text.includes(x))) return "🏍️";
 if (hgvs.some(x => text.includes(x))) return "🚛";
 if (vans.some(x => text.includes(x))) return "🚐";
 if (cars.some(x => text.includes(x))) return "🚗";

 return "🚗";
}