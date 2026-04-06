// =======================
// SUPABASE SETUP
// =======================
const SUPABASE_URL = "https://bufhopdljmpaerrvigay.supabase.co";
const SUPABASE_KEY = "sb_publishable_syvITTAJPgDewBp19skDkQ_TGnU6u7d";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =======================
// SAFE UI GETTERS (prevents crashes)
// =======================
const getEl = (id) => document.getElementById(id);

// =======================
// INIT
// =======================
document.addEventListener("DOMContentLoaded", () => {
  setupButtons();
  checkSession();
});

// =======================
// BUTTONS
// =======================
function setupButtons() {
  getEl("loginBtn")?.addEventListener("click", login);
  getEl("signupBtn")?.addEventListener("click", signup);
  getEl("checkBtn")?.addEventListener("click", checkVehicle);
  getEl("logoutBtn")?.addEventListener("click", logout);
}

// =======================
// SESSION
// =======================
async function checkSession() {
  const { data } = await client.auth.getSession();

  if (data?.session?.user) {
    showDashboard();
    await loadVehicles();
  } else {
    showAuth();
  }
}

function showAuth() {
  getEl("authBox")?.classList.remove("hidden");
  getEl("dashboardBox")?.classList.add("hidden");
}

function showDashboard() {
  getEl("authBox")?.classList.add("hidden");
  getEl("dashboardBox")?.classList.remove("hidden");
}

// =======================
// AUTH
// =======================
async function signup() {
  const email = getEl("email")?.value.trim();
  const password = getEl("password")?.value.trim();

  if (!email || !password) return alert("Enter email + password");

  const { error } = await client.auth.signUp({ email, password });

  alert(error ? error.message : "Signup successful");
}

async function login() {
  const email = getEl("email")?.value.trim();
  const password = getEl("password")?.value.trim();

  if (!email || !password) return alert("Enter email + password");

  const { error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) return alert(error.message);

  showDashboard();
  await loadVehicles();
}

async function logout() {
  await client.auth.signOut();
  location.reload();
}

// =======================
// MAIN FUNCTION
// =======================
async function checkVehicle() {
  const reg = getEl("regInput")?.value.trim().toUpperCase();
  const name = getEl("vehicleNameInput")?.value.trim() || "Vehicle";
  const typeInput = getEl("vehicleTypeInput")?.value.trim();
  const colourInput = getEl("vehicleColourInput")?.value.trim(); // FIXED
  const alertEmail = getEl("alertEmailInput")?.value.trim();

  if (!reg) return alert("Enter registration");
  if (!alertEmail) return alert("Enter email");

  const { data } = await client.auth.getUser();
  const user = data?.user;
  if (!user) return alert("Login required");

  try {
    // =======================
    // FETCH MOT DATA
    // =======================
    const res = await fetch(`/api/mot?reg=${encodeURIComponent(reg)}`);
    if (!res.ok) throw new Error("MOT fetch failed");

    const data = await res.json();

    const make = (data.make || "").toUpperCase();
    const colour = (colourInput || data.colour || "Unknown").toUpperCase();
    let vehicleType = typeInput || "Car";

    // Simple type detection
    const makeLower = make.toLowerCase();
    if (makeLower.includes("transit") || makeLower.includes("van")) {
      vehicleType = "Van";
    }

    // =======================
    // MOT STATUS
    // =======================
    let motStatus = "🟢 Valid";
    let motDays = 999;

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();
      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) motStatus = "🔴 Expired";
      else if (motDays < 7) motStatus = "🔴 Expiring";
      else if (motDays < 30) motStatus = "🟡 Soon";
    }

    const taxStatus =
      data.taxStatus === "Taxed"
        ? "🟢 Taxed"
        : data.taxStatus === "SORN"
        ? "⚪ SORN"
        : "🔴 Untaxed";

    // =======================
    // SHOW RESULT
    // =======================
    getEl("resultBox").innerHTML = `
      <div class="result-card">
        <div><strong>${reg}</strong></div>
        <div>${make} ${colour}</div>
        <div>${motStatus} (${motDays} days)</div>
        <div>${taxStatus}</div>
      </div>
    `;

    // =======================
    // SAVE TO DATABASE (CLEAN)
    // =======================
    const payload = {
      user_id: user.id,
      reg,
      name,
      make,
      vehicle_type: vehicleType,
      colour,
      mot_status: motStatus,
      mot_days: motDays,
      tax_status: taxStatus,
      alert_email: alertEmail
    };

    const { error } = await client.from("vehicles").upsert(payload, {
      onConflict: "reg,user_id"
    });

    if (error) console.error("DB error:", error);

    // =======================
    // EMAIL ALERT
    // =======================
    if (motDays < 30 && motDays > 0) {
      fetch("/api/sendAlert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alertEmail, reg, days: motDays })
      });
    }

    await loadVehicles();
  } catch (err) {
    console.error(err);
    getEl("resultBox").innerHTML = "Error checking vehicle";
  }
}

// =======================
// LOAD VEHICLES
// =======================
async function loadVehicles() {
  const { data } = await client.auth.getUser();
  const user = data?.user;
  if (!user) return;

  const { data: vehicles } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!vehicles || vehicles.length === 0) {
    getEl("vehicleList").innerHTML = "<p>No vehicles yet</p>";
    return;
  }

  getEl("vehicleList").innerHTML = vehicles
    .map(
      (v) => `
    <div class="vehicle-card">
      <strong>${v.reg}</strong><br>
      ${v.name}<br>
      ${v.mot_status} (${v.mot_days ?? "-"} days)
    </div>
  `
    )
    .join("");
}