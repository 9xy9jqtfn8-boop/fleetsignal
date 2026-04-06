// =======================
// SUPABASE SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================
// UI ELEMENTS
// =======================
const authBox = document.getElementById("authBox");
const dashboardBox = document.getElementById("dashboardBox");
const authMessage = document.getElementById("authMessage");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

const regInput = document.getElementById("regInput");
const vehicleNameInput = document.getElementById("vehicleNameInput");
const vehicleTypeInput = document.getElementById("vehicleTypeInput");
const vehicleColourInput = document.getElementById("vehicleColourInput");
const alertEmailInput = document.getElementById("alertEmailInput");

const checkBtn = document.getElementById("checkBtn");
const resultBox = document.getElementById("resultBox");
const vehicleList = document.getElementById("vehicleList");
const logoutBtn = document.getElementById("logoutBtn");

// =======================
// INIT
// =======================
document.addEventListener("DOMContentLoaded", () => {
  setupButtons();
  checkSession();
});

function setupButtons() {
  loginBtn?.addEventListener("click", login);
  signupBtn?.addEventListener("click", signup);
  checkBtn?.addEventListener("click", checkVehicle);
  logoutBtn?.addEventListener("click", logout);
}

// =======================
// SESSION
// =======================
async function checkSession() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error(error);
    showAuth();
    return;
  }

  if (data?.session?.user) {
    showDashboard();
    await loadVehicles();
  } else {
    showAuth();
  }
}

function showAuth() {
  authBox.classList.remove("hidden");
  dashboardBox.classList.add("hidden");
}

function showDashboard() {
  authBox.classList.add("hidden");
  dashboardBox.classList.remove("hidden");
}

// =======================
// AUTH
// =======================
async function signup() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    authMessage.textContent = "Enter email + password";
    return;
  }

  const { error } = await client.auth.signUp({ email, password });
  authMessage.textContent = error ? error.message : "Signup OK";
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  showDashboard();
  await loadVehicles();
}

async function logout() {
  await client.auth.signOut();
  showAuth();
}

// =======================
// MAIN FUNCTION
// =======================
async function checkVehicle() {
  const reg = regInput.value.trim().toUpperCase();
  const vehicleName = vehicleNameInput.value.trim();
  const manualVehicleType = vehicleTypeInput.value.trim();
  const manualVehicleColour = vehicleColourInput.value.trim();
  const alertEmail = alertEmailInput.value.trim();

  if (!reg) return alert("Enter registration");
  if (!alertEmail) return alert("Enter email");

  const { data: userData } = await client.auth.getUser();
  const user = userData?.user;
  if (!user) return alert("Login required");

  try {
    // =======================
    // DVLA API
    // =======================
    const motResponse = await fetch(`/api/mot?reg=${encodeURIComponent(reg)}`);
    if (!motResponse.ok) throw new Error("DVLA failed");

    const data = await motResponse.json();

    const vehicleMake = (data.make || "").toUpperCase();
    const vehicleColour = (manualVehicleColour || data.colour || "Unknown").toUpperCase();

    let vehicleType = manualVehicleType || "Car";

    if (vehicleMake.toLowerCase().includes("van")) vehicleType = "Van";

    // =======================
    // STATUS
    // =======================
    let motDays = 999;
    let motStatus = "🟢 Valid";

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();
      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) motStatus = "🔴 Expired";
      else if (motDays < 7) motStatus = "🔴 Urgent";
      else if (motDays < 30) motStatus = "🟡 Soon";
    }

    const taxStatus =
      data.taxStatus === "Taxed" ? "🟢 Taxed" :
      data.taxStatus === "SORN" ? "⚪ SORN" :
      "🔴 Untaxed";

    // =======================
    // EMAIL ALERT
    // =======================
    if (motDays < 30 && motDays > 0) {
      fetch("/api/sendAlert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: alertEmail,
          reg,
          days: motDays
        })
      });
    }

    // =======================
    // SAVE TO DB (FIXED)
    // =======================
    const payload = {
      user_id: user.id,
      reg,
      name: vehicleName || "Vehicle",
      make: vehicleMake || "",
      vehicle_type: vehicleType || "Car",
      colour: vehicleColour || "Unknown",
      mot_status: motStatus,
      mot_days: motDays,
      tax_status: taxStatus,
      alert_email: alertEmail
    };

    const { data: existing } = await client
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .eq("reg", reg);

    if (!existing || existing.length === 0) {
      await client.from("vehicles").insert([payload]);
    } else {
      await client.from("vehicles")
        .update(payload)
        .eq("user_id", user.id)
        .eq("reg", reg);
    }

    // =======================
    // UI
    // =======================
    resultBox.innerHTML = `
      <div class="result-card">
        <div class="reg">${reg}</div>
        <div>${vehicleMake} ${vehicleColour}</div>
        <div>${motStatus} (${motDays} days)</div>
        <div>${taxStatus}</div>
      </div>
    `;

    await loadVehicles();

  } catch (err) {
    console.error(err);
    resultBox.innerHTML = "Error checking vehicle";
  }
}

// =======================
// LOAD VEHICLES
// =======================
async function loadVehicles() {
  const { data: authData } = await client.auth.getUser();
  const user = authData?.user;
  if (!user) return;

  const { data } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) {
    vehicleList.innerHTML = "<p>No vehicles yet</p>";
    return;
  }

  vehicleList.innerHTML = data.map(v => `
    <div class="vehicle-card">
      <b>${v.reg}</b> - ${v.name}
      <br>${v.mot_status} (${v.mot_days} days)
      <br>${v.tax_status}
    </div>
  `).join("");
}