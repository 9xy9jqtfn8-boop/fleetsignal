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
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("checkBtn")?.addEventListener("click", checkVehicle);
  document.getElementById("signupBtn")?.addEventListener("click", signup);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("resetBtn")?.addEventListener("click", resetPassword);
}

// ==========================
// AUTH
// ==========================
async function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    authMessage.innerText = "Enter email and password.";
    return;
  }

  const { error } = await client.auth.signUp({ email, password });

  authMessage.innerText = error
    ? error.message
    : "Signup successful. Check your email.";
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    authMessage.innerText = error.message;
  } else {
    authMessage.innerText = "";
    showDashboard();
  }
}

async function logout() {
  await client.auth.signOut();
  authBox?.classList.remove("hidden");
  dashboardBox?.classList.add("hidden");
}

async function resetPassword() {
  const email = document.getElementById("email").value.trim();

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: "https://www.getfleetsignal.com/reset-password.html",
  });

  authMessage.innerText = error
    ? error.message
    : "Password reset email sent.";
}

// ==========================
// SESSION
// ==========================
async function checkSession() {
  const { data } = await client.auth.getSession();

  if (data.session) {
    showDashboard();
  }
}

function showDashboard() {
  authBox?.classList.add("hidden");
  dashboardBox?.classList.remove("hidden");

  loadVehicles();

  setTimeout(() => {
    document.getElementById("regInput")?.focus();
  }, 200);
}

// ==========================
// ICON HELPER
// ==========================
function getVehicleImage(type) {
  if (!type) return "/icons/car.png";

  const t = type.toLowerCase();

  if (t.includes("van")) return "/icons/van.png";
  if (t.includes("motorcycle")) return "/icons/bike.png";

  return "/icons/car.png";
}

// ==========================
// VEHICLE CHECK
// ==========================
async function checkVehicle() {
  const regInput = document.getElementById("regInput");
  const resultBox = document.getElementById("resultBox");

  if (!regInput || !resultBox) return;

  const reg = regInput.value.trim().toUpperCase();

  resultBox.style.display = "block";
  resultBox.innerHTML = "⏳ Checking vehicle...";

  if (!reg) {
    resultBox.innerHTML = "⚠️ Enter a registration";
    return;
  }

  let motStatus = "🟢 Valid";
  let taxStatus = "🟢 Taxed";
  let motDays = 999;

  let vehicleMake = null;
  let vehicleColor = null;
  let vehicleType = "Car";

  try {
    const response = await fetch(`${window.location.origin}/api/mot?reg=${encodeURIComponent(reg)}`);
    const data = await response.json();

    vehicleMake = data.make || data.vehicleMake || null;
    vehicleColor = data.colour || data.color || null;

    const makeLower = (vehicleMake || "").toLowerCase();

    if (makeLower.includes("transit") || makeLower.includes("sprinter")) {
      vehicleType = "Van";
    } else if (makeLower.includes("yamaha") || makeLower.includes("honda")) {
      vehicleType = "Motorcycle";
    }

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();

      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) motStatus = "🔴 Expired";
      else if (motDays < 7) motStatus = "🔴 Expiring";
      else if (motDays < 30) motStatus = "🟡 Due soon";
    }

    taxStatus =
      data.taxStatus === "Taxed"
        ? "🟢 Taxed"
        : data.taxStatus === "SORN"
        ? "⚪ SORN"
        : "🔴 Untaxed";

  } catch (err) {
    console.error(err);
    motStatus = "⚠️ Error";
    taxStatus = "⚠️ Failed";
  }

  resultBox.innerHTML = `
    <div class="result-card">
      <div class="reg">${reg}</div>
      <div class="meta">${vehicleMake || ""} ${vehicleColor || ""}</div>
      <div class="badges">
        <span class="badge">${motStatus} (${motDays} days)</span>
        <span class="badge">${taxStatus}</span>
      </div>
    </div>
  `;

  const { data } = await client.auth.getUser();
  const user = data?.user;
  if (!user) return;

  const { data: existing } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .eq("reg", reg);

  if (!existing || existing.length === 0) {
    await client.from("vehicles").insert([
      {
        user_id: user.id,
        reg,
        mot_status: motStatus,
        mot_days: motDays,
        tax_status: taxStatus,
        make: vehicleMake,
        colour: vehicleColor,
        type: vehicleType,
      },
    ]);
  }

  loadVehicles();
}

// ==========================
// LOAD VEHICLES (RESTORED)
// ==========================
async function loadVehicles() {
  if (isLoadingVehicles) return;
  isLoadingVehicles = true;

  const list = document.getElementById("vehicleList");
  if (!list) return;

  list.innerHTML = "";

  const { data } = await client.auth.getUser();
  const user = data?.user;
  if (!user) return;

  const { data: vehicles } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!vehicles || vehicles.length === 0) {
    list.innerHTML = "<p>No vehicles yet</p>";
    isLoadingVehicles = false;
    return;
  }

  for (const v of vehicles) {
    const row = document.createElement("div");
    row.className = "vehicle-card";

    row.innerHTML = `
      <div>${v.reg} - ${v.make || ""}</div>
      <div>${v.mot_status} (${v.mot_days} days)</div>
      <div>${v.tax_status}</div>
    `;

    list.appendChild(row);
  }

  isLoadingVehicles = false;
}