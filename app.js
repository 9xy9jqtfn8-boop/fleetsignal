// =======================
// SUPABASE SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSession = null;
let isLoadingVehicles = false;

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

  if (authBox) authBox.classList.remove("hidden");
  if (dashboardBox) dashboardBox.classList.add("hidden");

  // Hide logout on login screen
  if (logoutBtn) logoutBtn.style.display = "none";
}

function showDashboard(session) {
  const authBox = getEl("authBox");
  const dashboardBox = getEl("dashboardBox");
  const logoutBtn = getEl("logoutBtn");

  if (authBox) authBox.classList.add("hidden");
  if (dashboardBox) dashboardBox.classList.remove("hidden");

  const emailEl = getEl("dashboardUserEmail");
  if (emailEl) emailEl.innerText = session.user.email;

  loadVehicles();

  // ✅ SHOW the logout button (this was your issue)
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  // Prevent duplicate listeners
  if (logoutBtn && !logoutBtn.dataset.bound) {
    console.log("Binding logout button");
    logoutBtn.addEventListener("click", logout);
    logoutBtn.dataset.bound = "true";
  }
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
  const reg = getEl("regInput").value.trim().toUpperCase();

  if (!reg) {
    setResultMessage("Enter a registration");
    return;
  }

  setResultMessage("Checking...");

  try {
    const res = await fetch(`/api/mot?reg=${reg}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const motStatus = data.motStatus || "Unknown";
    const taxStatus = data.taxStatus || "Unknown";

    setResultMessage(`
      <strong>${reg}</strong><br>
      MOT: ${motStatus}<br>
      TAX: ${taxStatus}
    `);

    const { data: { user } } = await client.auth.getUser();

    if (!user) return;

    await client.from("vehicles").insert([
      {
        user_id: user.id,
        reg,
        mot_status: motStatus,
        tax_status: taxStatus
      }
    ]);

    loadVehicles();

  } catch (err) {
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

  if (error || !data || !data.length) {
    list.innerHTML = "<p>No vehicles</p>";
    isLoadingVehicles = false;
    return;
  }

  data.forEach(v => {
    const row = document.createElement("div");

    const motClass = getMotClass(v.mot_status, v.mot_days);
    const taxClass = getTaxClass(v.tax_status);
    const icon = getVehicleIcon(v);

    // Apply card + MOT urgency class
    row.className = `vehicle-card premium ${motClass}`;

    row.innerHTML = `
      <div class="vehicle-top">

        <div class="vehicle-left">
          <div class="vehicle-icon">${icon}</div>
          <div>
            <div class="vehicle-reg">${v.reg}</div>
            <div class="vehicle-meta">
              ${v.make || ""} ${v.colour || ""}
              ${getMotCountdown(v.mot_days)}
            </div>
          </div>
        </div>

        <button class="delete-btn" data-id="${v.id}">✕</button>

      </div>

      <div class="vehicle-status">

        <div class="status-pill ${motClass}">
          <span class="dot"></span>
          MOT: ${v.mot_status || "Unknown"}
        </div>

        <div class="status-pill ${taxClass}">
          <span class="dot"></span>
          TAX: ${v.tax_status || "Unknown"}
        </div>

      </div>
    `;

    // Clean delete binding (no duplicates)
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
 if (logoutBtn) {
  console.log("Logout button found");
  logoutBtn.onclick = () => {
    console.log("CLICK WORKED");
    logout();
  };
}

 if (checkBtn) checkBtn.onclick = checkVehicle;
 if (forgotLink) forgotLink.onclick = forgotPasswordHandler;
}

async function initApp() {
  console.log("App starting...");

  setupButtons();

  const { data, error } = await client.auth.getSession();

  if (error || !data.session) {
    console.log("No valid session");
    currentSession = null;
    showLogin();
    return;
  }

  currentSession = data.session;

  console.log("Valid session:", data.session.user.email);

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
// START
// =======================
document.addEventListener("DOMContentLoaded", initApp);

// =======================
// VEHICLE HELPERS (UPGRADED)
// =======================

function getMotClass(status, days) {
  if (status === "Expired") return "red";
  if (days === null || days === undefined) return "yellow";
  if (days <= 7) return "red";
  if (days <= 30) return "yellow";
  return "green";
}

function getTaxClass(status) {
  if (!status) return "yellow";
  if (status === "Taxed") return "green";
  if (status === "SORN") return "yellow";
  return "red";
}

function getVehicleIcon(v) {
  const make = (v.make || "").toLowerCase();
  const type = (v.vehicle_type || "").toLowerCase();

  // MOTORBIKES
  const bikes = [
    "honda","yamaha","kawasaki","ducati","ktm","suzuki","triumph","bmw motorrad"
  ];

  // VANS
  const vans = [
    "transit","sprinter","vivaro","trafic","crafter","ducato","boxer","relay","nv200","nv300","nv400"
  ];

  // HGV / LORRIES
  const hgvs = [
    "daf","scania","volvo","man","iveco","mercedes actros","renault trucks"
  ];

  // MOTORBIKE DETECT
  if (bikes.some(b => make.includes(b)) || type.includes("motorcycle")) {
    return "🏍️";
  }

  // VAN DETECT
  if (vans.some(vn => make.includes(vn)) || type.includes("van")) {
    return "🚐";
  }

  // HGV DETECT
  if (hgvs.some(h => make.includes(h)) || type.includes("hgv") || type.includes("lorry")) {
    return "🚛";
  }

  // DEFAULT CAR
  return "🚗";
}

function getMotCountdown(days) {
  if (days === null || days === undefined) return "";

  if (days < 0) {
    return `<div class="mot-countdown" style="color:#ef4444;">Expired</div>`;
  }

  if (days === 0) {
    return `<div class="mot-countdown" style="color:#ef4444;">Expires today</div>`;
  }

  if (days <= 7) {
    return `<div class="mot-countdown" style="color:#ef4444;">${days} day${days === 1 ? "" : "s"} left</div>`;
  }

  if (days <= 30) {
    return `<div class="mot-countdown" style="color:#eab308;">${days} days left</div>`;
  }

  return `<div class="mot-countdown">${days} days left</div>`;
}