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
const vehicleColorInput = document.getElementById("vehicleColorInput");
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

async function checkSession() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error("Session check failed:", error);
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
    authMessage.textContent = "Please enter email and password.";
    return;
  }

  const { error } = await client.auth.signUp({
    email,
    password
  });

  authMessage.textContent = error
    ? error.message
    : "Sign-up successful. Check your email if confirmation is required.";
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    authMessage.textContent = "Please enter email and password.";
    return;
  }

  const { error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  authMessage.textContent = "";
  showDashboard();
  await loadVehicles();
}

async function logout() {
  await client.auth.signOut();
  resultBox.innerHTML = "";
  vehicleList.innerHTML = "";
  regInput.value = "";
  vehicleNameInput.value = "";
  vehicleTypeInput.value = "";
  vehicleColorInput.value = "";
  alertEmailInput.value = "";
  showAuth();
}

// =======================
// VEHICLE CHECK
// =======================
async function checkVehicle() {
  const reg = regInput.value.trim().toUpperCase();
  const vehicleName = vehicleNameInput.value.trim();
  const manualVehicleType = vehicleTypeInput.value.trim();
  const manualVehicleColor = vehicleColorInput.value.trim();
  const alertEmail = alertEmailInput.value.trim();

  if (!reg) {
    alert("Please enter a registration.");
    return;
  }

  if (!alertEmail) {
    alert("Please enter an email for alerts.");
    return;
  }

  let user;
  {
    const { data } = await client.auth.getUser();
    user = data?.user;
  }

  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    const motResponse = await fetch(`/api/mot?reg=${encodeURIComponent(reg)}`);
    if (!motResponse.ok) {
      throw new Error("Failed to fetch MOT data.");
    }

    const data = await motResponse.json();
    console.log("Vehicle response:", data);

    const vehicleMake = (data.make || "").toUpperCase();
    const vehicleColor = (manualVehicleColor || data.colour || "Unknown").toUpperCase();
    let vehicleType = manualVehicleType || "Car";

    const makeLower = vehicleMake.toLowerCase();
    if (makeLower.includes("ford transit") || makeLower.includes("sprinter") || makeLower.includes("van")) {
      vehicleType = "Van";
    }
    if (makeLower.includes("ducati") || makeLower.includes("yamaha") || makeLower.includes("honda cbr")) {
      vehicleType = "Motorcycle";
    }

    let motStatus = "🟢 Valid";
    let taxStatus = "⚪ Unknown";
    let motDays = 999;

    if (data.motExpiryDate) {
      const expiry = new Date(data.motExpiryDate);
      const today = new Date();
      motDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (motDays < 0) {
        motStatus = "🔴 Expired";
      } else if (motDays < 7) {
        motStatus = "🔴 Expiring";
      } else if (motDays < 30) {
        motStatus = "🟡 Due soon";
      }

      if (motDays < 30 && motDays > 0) {
        fetch("/api/sendAlert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: alertEmail,
            reg: reg,
            days: motDays
          })
        })
          .then(res => res.json())
          .then(data => console.log("Alert sent:", data))
          .catch(err => console.error("Alert error:", err));
      }
    }

    taxStatus =
      data.taxStatus === "Taxed"
        ? "🟢 Taxed"
        : data.taxStatus === "SORN"
          ? "⚪ SORN"
          : "🔴 Untaxed";

    resultBox.innerHTML = `
      <div class="result-card">
        <div class="reg">${reg}</div>
        <div class="meta">${vehicleMake || ""} ${vehicleColor || ""}</div>
        <div class="meta">Alert email: ${escapeHtml(alertEmail)}</div>
        <div class="badges">
          <span class="badge">${motStatus} (${motDays} days)</span>
          <span class="badge">${taxStatus}</span>
        </div>
      </div>
    `;

    const { data: existing, error: existingError } = await client
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .eq("reg", reg);

    if (existingError) {
      console.error("Error checking existing vehicle:", existingError);
      throw existingError;
    }

    const payload = {
      user_id: user.id,
      reg: reg,
      name: vehicleName || "Vehicle",
      make: vehicleMake || "",
      vehicle_type: vehicleType || "Car",
      colour: vehicleColor || "Unknown",
      mot_status: motStatus,
      mot_days: motDays,
      tax_status: taxStatus,
      alert_email: alertEmail
    };

    if (!existing || existing.length === 0) {
      const { error: insertError } = await client.from("vehicles").insert([payload]);
      if (insertError) {
        console.error("Insert failed:", insertError);
        throw insertError;
      }
    } else {
      const { error: updateError } = await client
        .from("vehicles")
        .update(payload)
        .eq("user_id", user.id)
        .eq("reg", reg);

      if (updateError) {
        console.error("Update failed:", updateError);
        throw updateError;
      }
    }

    await loadVehicles();
  } catch (err) {
    console.error(err);
    resultBox.innerHTML = `
      <div class="result-card">
        <div class="reg">${reg}</div>
        <div class="meta">⚠ Error checking vehicle</div>
      </div>
    `;
  }
}

// =======================
// LOAD VEHICLES
// =======================
async function loadVehicles() {
  const { data: authData } = await client.auth.getUser();
  const user = authData?.user;
  if (!user) return;

  const { data: vehicles, error } = await client
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load vehicles failed:", error);
    vehicleList.innerHTML = "<p>Could not load vehicles.</p>";
    return;
  }

  if (!vehicles || vehicles.length === 0) {
    vehicleList.innerHTML = "<p>No vehicles saved yet.</p>";
    return;
  }

  vehicleList.innerHTML = vehicles.map(vehicle => `
    <div class="vehicle-card">
      <div class="vehicle-main">
        <img src="/fleet-visual.png" alt="Vehicle" class="vehicle-thumb">
        <div class="vehicle-info">
          <div class="vehicle-reg">${escapeHtml(vehicle.reg || "")}</div>
          <div>${escapeHtml(vehicle.name || "Vehicle")}</div>
          <div>${escapeHtml(vehicle.make || "")} · ${escapeHtml(vehicle.vehicle_type || "Car")} · ${escapeHtml(vehicle.colour || "Unknown")}</div>
          <div class="vehicle-email">Alerts: ${escapeHtml(vehicle.alert_email || "None")}</div>
        </div>
      </div>

      <div class="vehicle-status">
        <div class="status-pill">${escapeHtml(vehicle.mot_status || "Unknown")} (${vehicle.mot_days ?? "-" } days)</div>
        <div class="status-pill">${escapeHtml(vehicle.tax_status || "Unknown")}</div>
      </div>

      <button class="delete-btn" onclick="deleteVehicle('${escapeJs(vehicle.reg || "")}')">✕</button>
    </div>
  `).join("");
}

// =======================
// DELETE VEHICLE
// =======================
async function deleteVehicle(reg) {
  const confirmed = confirm(`Delete ${reg}?`);
  if (!confirmed) return;

  const { data: authData } = await client.auth.getUser();
  const user = authData?.user;
  if (!user) return;

  const { error } = await client
    .from("vehicles")
    .delete()
    .eq("user_id", user.id)
    .eq("reg", reg);

  if (error) {
    console.error("Delete failed:", error);
    alert("Could not delete vehicle.");
    return;
  }

  await loadVehicles();
}

window.deleteVehicle = deleteVehicle;

// =======================
// HELPERS
// =======================
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}