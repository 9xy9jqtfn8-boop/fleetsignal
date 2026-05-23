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
 const dashboardBox = getEl("vehiclesView");
 const logoutBtn = getEl("logoutBtn");
 const headerEmail = getEl("headerUserEmail");

 if (authBox) authBox.classList.remove("hidden");
 if (dashboardBox) dashboardBox.classList.add("hidden");
 if (bottomNav) bottomNav.classList.add("hidden");
 if (logoutBtn) logoutBtn.style.display = "none";
 if (headerEmail) headerEmail.innerText = "";

 const signedInBanner = document.getElementById("signedInBanner");
const signedInEmailText = document.getElementById("signedInEmailText");

if (signedInBanner) signedInBanner.classList.add("hidden");
if (signedInEmailText) signedInEmailText.textContent = "";
}

async function showDashboard(session) {
 const authBox = getEl("authBox");
 const dashboardBox = getEl("vehiclesView");
 const logoutBtn = getEl("logoutBtn");
 const emailEl = getEl("dashboardUserEmail");
 const headerEmail = getEl("headerUserEmail"); 
 const alertsToggle = document.getElementById("alertsToggle");
 const alertsLabel = document.getElementById("alertsLabel");
 const upgradeBox = document.querySelector(".upgrade-box");

 if (authBox) authBox.classList.add("hidden");
 if (dashboardBox) dashboardBox.classList.remove("hidden");

 const bottomNav = document.getElementById("bottomNav");
 
 if (bottomNav) bottomNav.classList.remove("hidden");
 if (emailEl) emailEl.innerText = session.user.email;
 if (headerEmail) headerEmail.innerText = session.user.email;
 
 const signedInBanner = document.getElementById("signedInBanner");
 const signedInEmailText = document.getElementById("signedInEmailText");

if (signedInBanner && signedInEmailText && session?.user?.email) {
  signedInEmailText.textContent = session.user.email;
  signedInBanner.classList.remove("hidden");
}

 const alertEmailInput = document.getElementById("alertEmailInput");

 if (alertEmailInput && session?.user?.email) {
   alertEmailInput.value = session.user.email;
   alertEmailInput.style.opacity = "0.6";
 }

 if (logoutBtn) logoutBtn.style.display = "inline-flex";
 if (logoutBtn) logoutBtn.style.display = "inline-block";
 
 let isPremium = false;
let alertsEnabled = false;

try {
  const { data: profile } = await client
    .from("profiles")
    .select("is_premium, alerts_enabled")
    .eq("id", session.user.id)
    .maybeSingle();

  isPremium = profile?.is_premium ?? false;
  alertsEnabled = profile?.alerts_enabled ?? false;
  updatePremiumActiveBanner(isPremium);

  const headerPlanBadge = document.getElementById("headerPlanBadge");
  const headerUpgradeBtn = document.getElementById("headerUpgradeBtn");
  const dashboardPlanBadge = document.getElementById("dashboardPlanBadge");

  if (headerPlanBadge) {
    headerPlanBadge.textContent = isPremium ? "PREMIUM" : "FREE";
    headerPlanBadge.className = isPremium ? "badge premium" : "badge free";
  }

  if (headerUpgradeBtn) {
    headerUpgradeBtn.classList.toggle("hidden", isPremium);
  }

  if (dashboardPlanBadge) {
    dashboardPlanBadge.textContent = isPremium ? "PREMIUM" : "FREE";
    dashboardPlanBadge.className = isPremium ? "badge premium" : "badge free";
  }

  if (upgradeBox) {
    upgradeBox.style.display = isPremium ? "none" : "block";
  }

} catch (err) {
  console.error("Profile fetch error", err);
  updatePremiumActiveBanner(false);
}

  // Prevent duplicate listeners
  if (logoutBtn && !logoutBtn.dataset.bound) {
    console.log("Binding logout button");
    logoutBtn.addEventListener("click", logout);
    logoutBtn.dataset.bound = "true";
  }

  if (alertsToggle) {
  alertsToggle.addEventListener("change", async () => {
    const newValue = alertsToggle.checked;

    updateAlertText();

    try {
      const { data, error } = await client
        .from("profiles")
        .update({ alerts_enabled: newValue })
        .eq("id", session.user.id)
        .select("id, email, alerts_enabled")
        .single();

      if (error) {
        console.error("Failed to save alerts setting:", error);
        alertsToggle.checked = !newValue;
        updateAlertText();
        alert("Could not save alert setting. Please try again.");
        return;
      }
     
/* Also enable alerts on all existing vehicles when account alerts are switched on */
    if (newValue === true) {
      const { error: vehiclesAlertError } = await client
        .from("vehicles")
        .update({ alerts_enabled: true })
        .eq("user_id", session.user.id);

    if (vehiclesAlertError) {
      console.error("Failed to enable vehicle alerts:", vehiclesAlertError);
      alert("Account alerts were saved, but vehicle alerts could not be enabled. Please check Supabase.");
      return;
  }
}

console.log("Alerts setting saved:", data);
      
    } catch (err) {
      console.error("Unexpected alerts setting error:", err);
      alertsToggle.checked = !newValue;
      updateAlertText();
      alert("Could not save alert setting. Please try again.");
    }
  });

  if (!isPremium) {
    alertsToggle.checked = false;
    alertsToggle.disabled = true;
    alertsLabel.textContent = "Premium only";
    alertsLabel.style.color = "#9ca3af";

    const alertEmailInput = document.getElementById("alertEmailInput");
    if (alertEmailInput) {
      alertEmailInput.disabled = true;
      alertEmailInput.placeholder = "Upgrade to enable alerts";
    }
  } else {
    alertsToggle.disabled = false;
    alertsToggle.checked = !!alertsEnabled;

     updateAlertText();

    const alertEmailInput = document.getElementById("alertEmailInput");
    if (alertEmailInput) {
      alertEmailInput.disabled = false;
    }
  }
}

  showView("vehiclesView");
  
  loadVehicles();
  updateSettingsView();
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

   if (!res.ok) throw new Error(data.error || "Vehicle not found");

// Stop invalid / unknown registrations being saved
if (
  !data ||
  data.error ||
  !data.make ||
  data.make.trim() === "" ||
  data.make.toLowerCase() === "unknown"
) {
  setResultMessage(`
    <div class="result-card error">
      <strong>Vehicle not found</strong><br>
      Please check the registration and try again.
    </div>
  `);
  return;
}

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

/* =========================================
   FREE PLAN LIMIT
   Free users can save 1 vehicle only.
   Premium users can save unlimited vehicles.
========================================= */

const { data: limitProfile, error: limitProfileError } = await client
  .from("profiles")
  .select("is_premium")
  .eq("id", user.id)
  .maybeSingle();

if (limitProfileError) {
  console.error("Could not check premium status:", limitProfileError);
  alert("Could not check your plan. Please try again.");
  return;
}

const userIsPremium = limitProfile?.is_premium === true;

if (!userIsPremium) {
  const { data: existingVehicles, error: vehicleLimitError } = await client
    .from("vehicles")
    .select("reg")
    .eq("user_id", user.id);

  if (vehicleLimitError) {
    console.error("Could not check vehicle limit:", vehicleLimitError);
    alert("Could not check your vehicle limit. Please try again.");
    return;
  }

  const cleanNewReg = reg.toUpperCase().replace(/\s/g, "");

  const alreadySaved = existingVehicles?.some((vehicle) => {
    const cleanSavedReg = (vehicle.reg || "").toUpperCase().replace(/\s/g, "");
    return cleanSavedReg === cleanNewReg;
  });

  if (!alreadySaved && existingVehicles && existingVehicles.length >= 1) {
    alert("Free plan allows 1 saved vehicle. Upgrade to Premium to add unlimited vehicles and enable MOT, tax and insurance alerts.");
    return;
  }
}

await client.from("vehicles").upsert([
      {
        user_id: user.id,
        reg,
        make,
        colour,
      
        vehicle_name: document.getElementById("vehicleNameInput")?.value || null,
        vehicle_type: document.getElementById("vehicleTypeInput")?.value || null,
        
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

   // Clear optional vehicle detail fields after successful save
const taxDueDate = document.getElementById("taxDueDate");
const insuranceInput = document.getElementById("insuranceInput");
const vehicleNameInput = document.getElementById("vehicleNameInput");
const vehicleTypeInput = document.getElementById("vehicleTypeInput");
const vehicleColourInput = document.getElementById("vehicleColourInput");

if (taxDueDate) taxDueDate.value = "";
if (insuranceInput) insuranceInput.value = "";
if (vehicleNameInput) vehicleNameInput.value = "";
if (vehicleTypeInput) vehicleTypeInput.value = "";
if (vehicleColourInput) vehicleColourInput.value = "";

// reload vehicles
loadVehicles();
updateSettingsView();

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

// =========================================
// EMPTY FLEET ONBOARDING STATE
// =========================================

function updateEmptyFleetState(vehicleCount) {
  const emptyFleetState = document.getElementById("emptyFleetState");

  if (!emptyFleetState) return;

  if (vehicleCount === 0) {
    emptyFleetState.classList.remove("hidden");
  } else {
    emptyFleetState.classList.add("hidden");
  }
}

// =========================================
// EMPTY ALERTS STATE
// =========================================

function updateEmptyAlertsState(alertCount) {
  const emptyAlertsState = document.getElementById("emptyAlertsState");

  if (!emptyAlertsState) return;

  if (alertCount === 0) {
    emptyAlertsState.classList.remove("hidden");
  } else {
    emptyAlertsState.classList.add("hidden");
  }
}

// =========================================
// DASHBOARD SUMMARY CARD
// =========================================

function updateDashboardSummary(summaryState, message) {
  const card = document.getElementById("dashboardSummaryCard");
  const icon = document.querySelector(".dashboard-summary-icon");
  const text = document.getElementById("dashboardSummaryText");

  if (!card || !icon || !text) return;

  card.classList.remove("hidden", "warning", "urgent");

  if (summaryState === "urgent") {
    card.classList.add("urgent");
    icon.textContent = "!";
  } else if (summaryState === "warning") {
    card.classList.add("warning");
    icon.textContent = "!";
  } else {
    icon.textContent = "✓";
  }

  text.textContent = message;
}

// =========================================
// PREMIUM ACTIVE DASHBOARD CONFIRMATION
// =========================================

function updatePremiumActiveBanner(isPremium) {
  const banner = document.getElementById("premiumActiveBanner");

  if (!banner) return;

  if (isPremium) {
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
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

  const alertsList = document.getElementById("alertsList");

if (alertsList) {
  alertsList.innerHTML = "";
}

let alertCount = 0;
let urgentCount = 0;
let warningCount = 0;

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

    console.log(data);
    
  if (error || !data || data.length === 0) {
  updateEmptyFleetState(0);
  updateEmptyAlertsState(0);

  updateDashboardSummary(
    "clear",
    "No vehicles added yet — add your first vehicle to start tracking reminders."
  );

  isLoadingVehicles = false;
  return;
}

updateEmptyFleetState(data.length);

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

    if (urgentAlert) {
      urgentCount++;
      alertCount++;
    } else if (warningAlert) {
      warningCount++;
      alertCount++;
    }

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
       let alertType = "MOT";

if (insuranceDays != null && insuranceDays <= 30) {
  alertType = "Insurance";
}

if (taxDays != null && taxDays <= 30) {
  alertType = "Tax";
}

if (
  v.mot_days != null &&
  taxDays != null &&
  insuranceDays != null &&
  v.mot_days <= 30 &&
  taxDays <= 30 &&
  insuranceDays <= 30
) {
  alertType = "Vehicle Compliance";
} 
    const res = await fetch("/api/sendAlert", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
 body: JSON.stringify({
 reg: v.reg,
 email: v.alert_email,

 motDays: v.mot_days,
 taxStatus: v.tax_status,
insuranceExpiry:
 insuranceDays != null
   ? `${insuranceDays} days remaining`
   : "Not added",
 make: v.make,
 alertType
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
    const tax =
     taxDays !== null
      ? {
        status:
          taxDays < 0
            ? "Expired"
            : taxDays <= 7
            ? "Due now"
            : taxDays <= 30
            ? "Due soon"
            : "Valid",
        color:
          taxDays <= 7
            ? "red"
            : taxDays <= 30
            ? "yellow"
            : "green"
      }
    : getTaxStatus(v.tax_status);

    row.className = `vehicle-card ${motClass}`;

    const vehicleDisplayName =
    v.vehicle_name && v.vehicle_name.trim() !== ""
    ? v.vehicle_name.trim()
    : `${v.make || ""} ${v.colour || ""}`.trim();

    row.innerHTML = `
      <div class="vehicle-top">
        <div class="vehicle-left">
          <div class="vehicle-icon">${icon}</div>
          <div>
           <div class="saved-reg-plate">
            <span class="gb-badge"></span>
            <span class="reg-text">${v.reg}</span>
          </div> 
            <div class="vehicle-meta">${vehicleDisplayName}</div>
          </div>
        </div>

         <div class="vehicle-card-actions">
          <button class="edit-btn" type="button">Edit</button>
          <button class="delete-btn" type="button">×</button>
         </div>
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

  <div class="vehicle-edit-panel hidden">
  <h4>Edit vehicle details</h4>

  <label>
    Vehicle type
    <input class="edit-vehicle-type" type="text" value="${v.vehicle_type || ""}" placeholder="Car / Van / Bike" />
  </label>

  <label>
    TAX renewal date
    <input class="edit-tax-date" type="date" value="${v.tax_due_date || ""}" />
  </label>

  <label>
    Insurance expiry
    <input class="edit-insurance-date" type="date" value="${v.insurance_expiry || ""}" />
  </label>

  <button class="save-edit-btn" type="button">Save changes</button>
</div>
    `;

    row.querySelector(".edit-btn").onclick = () => {
  const panel = row.querySelector(".vehicle-edit-panel");
  if (!panel) return;

  panel.classList.toggle("hidden");
};

  row.querySelector(".save-edit-btn").onclick = async () => {
  const typeInput = row.querySelector(".edit-vehicle-type");
  const taxInput = row.querySelector(".edit-tax-date");
  const insuranceInput = row.querySelector(".edit-insurance-date");

  const vehicleType = typeInput?.value.trim() || null;
  const taxDate = taxInput?.value || null;
  const insuranceDate = insuranceInput?.value || null;

  const { error } = await client
    .from("vehicles")
    .update({
      vehicle_type: vehicleType,
      tax_due_date: taxDate,
      insurance_expiry: insuranceDate,
    })
    .eq("id", v.id);

  if (error) {
    console.error("Vehicle edit save error:", error);
    alert("Could not save vehicle changes. Please try again.");
    return;
  }

  await loadVehicles();
  updateSettingsView();
};

    row.querySelector(".delete-btn").onclick = async () => {
      await client.from("vehicles").delete().eq("id", v.id);
      loadVehicles();
      updateSettingsView();
    };

    list.appendChild(row);
  }
  
 buildAlertsPanel(data);
updateEmptyAlertsState(alertCount);

if (urgentCount > 0) {
  updateDashboardSummary(
    "urgent",
    `${urgentCount} vehicle${urgentCount === 1 ? "" : "s"} need urgent attention.`
  );
} else if (warningCount > 0) {
  updateDashboardSummary(
    "warning",
    `${warningCount} vehicle${warningCount === 1 ? "" : "s"} due soon.`
  );
} else {
  updateDashboardSummary(
    "clear",
    "All clear — no urgent reminders today."
  );
}

isLoadingVehicles = false;
}

// ===============================
// UPDATE SETTINGS VIEW
// ===============================

async function updateSettingsView() {
  const settingsUserEmail = document.getElementById("settingsUserEmail");
  const settingsPlanStatus = document.getElementById("settingsPlanStatus");
  const settingsAlertEmail = document.getElementById("settingsAlertEmail");

  const { data: { user } } = await client.auth.getUser();

  if (!user) return;

  if (settingsUserEmail) {
    settingsUserEmail.textContent = user.email;
  }

  const { data: profile } = await client
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  if (settingsPlanStatus) {
    settingsPlanStatus.textContent = profile?.is_premium
      ? "Premium plan active"
      : "Free plan";
  }

  const { data: vehicles } = await client
    .from("vehicles")
    .select("alert_email")
    .eq("user_id", user.id)
    .limit(1);

  if (settingsAlertEmail) {
    settingsAlertEmail.textContent =
      vehicles && vehicles.length > 0 && vehicles[0].alert_email
        ? vehicles[0].alert_email
        : user.email;
  }
}

// ===============================
// BUILD ALERTS PANEL
// ===============================

function buildAlertsPanel(vehicles) {
 const alertsList = document.getElementById("alertsList");

 if (!alertsList) return;

 alertsList.innerHTML = "";

 let hasAlerts = false;

 vehicles.forEach(vehicle => {
   const reg = vehicle.reg || "Unknown vehicle";

   const motDays =
     vehicle.mot_days !== null && vehicle.mot_days !== undefined
       ? Number(vehicle.mot_days)
       : null;

   const taxDays = vehicle.tax_due_date
     ? Math.ceil(
         (new Date(vehicle.tax_due_date) - new Date()) /
           (1000 * 60 * 60 * 24)
       )
     : null;

   const insuranceDays = vehicle.insurance_expiry
     ? Math.ceil(
         (new Date(vehicle.insurance_expiry) - new Date()) /
           (1000 * 60 * 60 * 24)
       )
     : null;

   // =========================
   // INSURANCE ALERT
   // =========================

   if (insuranceDays !== null && insuranceDays <= 30) {
     hasAlerts = true;

     const level = insuranceDays <= 7 ? "red" : "orange";

     alertsList.innerHTML += `
       <div class="alert-card ${level}">
         <div class="alert-title">🚨 Insurance Alert</div>
         <div class="alert-big">${insuranceDays} days remaining</div>
         <div class="alert-text">
           ${reg} insurance expires soon.
         </div>
       </div>
     `;
   }

   // =========================
   // MOT ALERT
   // =========================

   if (motDays !== null && motDays <= 30) {
     hasAlerts = true;

     const level = motDays <= 7 ? "red" : "orange";

     alertsList.innerHTML += `
       <div class="alert-card ${level}">
         <div class="alert-title">⚠️ MOT Warning</div>
         <div class="alert-big">${motDays} days remaining</div>
         <div class="alert-text">
           ${reg} MOT expires soon.
         </div>
       </div>
     `;
   }

   // =========================
   // TAX ALERT
   // =========================

   if (taxDays !== null && taxDays <= 30) {
     hasAlerts = true;

     const level = taxDays <= 7 ? "red" : "orange";

     alertsList.innerHTML += `
       <div class="alert-card ${level}">
         <div class="alert-title">📄 Tax Reminder</div>
         <div class="alert-big">${taxDays} days remaining</div>
         <div class="alert-text">
           ${reg} tax renewal is approaching.
         </div>
       </div>
     `;
   }
 });

 // =========================
 // EMPTY STATE
 // =========================

 if (!hasAlerts) {
   alertsList.innerHTML = `
     <div class="alert-empty">
       ✅ All vehicles are currently compliant.
     </div>
   `;
 }
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

  if (s.includes("untaxed")) return "red";
  if (s.includes("sorn")) return "yellow";
  if (s.includes("taxed")) return "green";

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

async function initApp() {
 console.log("App starting...");
 const urlParams = new URLSearchParams(window.location.search);
 const sessionId = urlParams.get("session_id");

 if (sessionId) {
  console.log("Stripe return detected");

  try {
    const verifyRes = await fetch(`/api/verify-session?session_id=${sessionId}`);
    const verifyData = await verifyRes.json();

    console.log("Stripe verification response:", verifyData);

    if (!verifyRes.ok || verifyData.success !== true) {
      throw new Error(verifyData.error || "Stripe verification failed");
    }

    // Clean URL so the session_id disappears
    window.history.replaceState({}, document.title, "/app.html");

    // Get the current logged-in session again
    const { data: sessionData } = await client.auth.getSession();

    if (sessionData?.session) {
      currentSession = sessionData.session;

      // Reload dashboard so Premium appears immediately
      await showDashboard(sessionData.session);

      // Show Premium success popup
      if (typeof showPremiumSuccessPopup === "function") {
        showPremiumSuccessPopup();
      }
    }

  } catch (err) {
    console.error("Verification failed", err);
  }
}
 
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
  const type = (v.vehicle_type || v.type || "").toLowerCase();
  const name = (v.name || v.vehicle_name || "").toLowerCase();

  const text = `${type} ${name} ${make}`;

  // 1. MANUAL TYPE WINS FIRST
  if (
    type.includes("motorbike") ||
    type.includes("motorcycle") ||
    type.includes("bike") ||
    type.includes("scooter") ||
    type.includes("moped")
  ) {
    return "🏍️";
  }

  if (
    type.includes("van") ||
    type.includes("panel van") ||
    type.includes("camper")
  ) {
    return "🚐";
  }

  if (
    type.includes("truck") ||
    type.includes("lorry") ||
    type.includes("hgv")
  ) {
    return "🚛";
  }

  if (
    type.includes("car") ||
    type.includes("hatchback") ||
    type.includes("saloon") ||
    type.includes("estate") ||
    type.includes("suv") ||
    type.includes("mpv")
  ) {
    return "🚗";
  }

  // 2. MODEL / NAME FALLBACK
  // These are safer because they are vehicle models or body types, not just brand names.

  const motorcycleWords = [
    "motorcycle", "motorbike", "bike", "scooter", "moped",
    "vespa", "piaggio", "harley", "ducati", "triumph",
    "ktm", "ninja", "gsxr", "hayabusa", "bandit"
  ];

  const vanWords = [
    "van", "panel van", "transit", "sprinter", "vivaro",
    "trafic", "crafter", "ducato", "boxer", "relay",
    "partner", "berlingo", "caddy", "kangoo", "nv200",
    "nv300", "nv400", "vito", "expert", "dispatch",
    "proace", "doblo", "combo", "movano", "master"
  ];

  const hgvWords = [
    "hgv", "lorry", "truck", "rigid", "artic", "tractor unit",
    "daf", "scania", "iveco", "actros", "atego", "axor", "fuso"
  ];

  const carWords = [
    "car", "hatchback", "saloon", "estate", "suv", "mpv",
    "golf", "fiesta", "focus", "astra", "corsa", "polo",
    "clio", "yaris", "aygo", "civic", "corolla", "prius"
  ];

  if (motorcycleWords.some(x => text.includes(x))) return "🏍️";
  if (hgvWords.some(x => text.includes(x))) return "🚛";
  if (vanWords.some(x => text.includes(x))) return "🚐";
  if (carWords.some(x => text.includes(x))) return "🚗";

  // 3. DEFAULT
  return "🚗";
}

// ========================================
// PREMIUM CHECKOUT - MONTHLY / ANNUAL
// ========================================

async function startPremiumCheckout(plan = "monthly") {
  try {
    console.log("Starting checkout:", plan);

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
        email: user.email,
        plan: plan,
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
    console.error("Checkout error:", err);
    alert("Payment failed. Please try again.");
  }
}

document.getElementById("upgradeMonthlyBtn")?.addEventListener("click", () => {
  startPremiumCheckout("monthly");
});

document.getElementById("upgradeAnnualBtn")?.addEventListener("click", () => {
  startPremiumCheckout("annual");
});

// ========================================
// HEADER UPGRADE BUTTON
// Scrolls to the main upgrade box so user can choose Monthly or Annual
// ========================================
document.getElementById("headerUpgradeBtn")?.addEventListener("click", () => {
  const upgradeBox = document.getElementById("upgradeBox");

  if (upgradeBox) {
    upgradeBox.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
});

// =========================================
// PREMIUM SUCCESS POPUP
// =========================================

function showPremiumSuccessPopup() {
  const popup = document.getElementById("premiumSuccessPopup");
  const closeBtn = document.getElementById("premiumSuccessCloseBtn");

  if (!popup) return;

  popup.classList.remove("hidden");

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "true";

    closeBtn.addEventListener("click", () => {
      popup.classList.add("hidden");
    });
  }
}

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

     // Show premium success popup
      showPremiumSuccessPopup();
    } else {
      console.warn("Verification failed response:", data);
    }

  } catch (err) {
    console.error("Verification failed:", err);
  }
}

// checkStripeReturn();

// =======================
// SHOW USER EMAIL
// =======================
(async () => {
  const { data: { user } } = await client.auth.getUser();

  if (user) {
    document.getElementById("headerUserEmail").textContent = user.email;
  }
})();