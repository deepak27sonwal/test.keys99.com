/* =========================================================
   KEYS99 - ADMIN SHARED AUTH GUARD + SIDEBAR
   Loaded (after js/config.js) by every admin-*.html page
   except admin-login.html. Confirms the visitor is signed in
   AND profiles.is_admin is true before anything renders, then
   builds the sidebar nav for the current page.
========================================================= */

const ADMIN_NAV = [
  {
    group: "Overview",
    items: [
      { href: "admin-dashboard.html", label: "Dashboard" },
      { href: "admin-reports.html", label: "Reports" }
    ]
  },
  {
    group: "Listings",
    items: [
      { href: "admin-properties.html", label: "Properties" },
      { href: "admin-reviews.html", label: "Reviews" }
    ]
  },
  {
    group: "People",
    items: [
      { href: "admin-users.html", label: "Users" },
      { href: "admin-agents.html", label: "Agents" },
      { href: "admin-developers.html", label: "Developers" }
    ]
  },
  {
    group: "Leads",
    items: [
      { href: "admin-enquiries.html", label: "Enquiries" }
    ]
  },
  {
    group: "Locations",
    items: [
      { href: "admin-cities.html", label: "Cities" },
      { href: "admin-localities.html", label: "Localities" }
    ]
  },
  {
    group: "System",
    items: [
      { href: "admin-settings.html", label: "Settings" }
    ]
  }
];

let adminCurrentUser = null;


/* =========================================================
   LOADING GATE
   Call showAdminGate() at the top of the page (before the
   auth check) and hideAdminGate() once requireAdmin() resolves.
========================================================= */

function showAdminGate(){

  if(document.getElementById("adminLoadingGate")) return;

  const gate = document.createElement("div");
  gate.className = "admin-loading-gate";
  gate.id = "adminLoadingGate";
  gate.innerHTML = '<div class="spinner"></div>';

  document.body.appendChild(gate);

}

function hideAdminGate(){
  const gate = document.getElementById("adminLoadingGate");
  if(gate) gate.remove();
}


/* =========================================================
   requireAdmin()
   Redirects to admin-login.html if not signed in, or if
   signed in but not an admin (and signs that account out, so
   it doesn't sit in a half-authenticated state). Resolves with
   the user object on success.
========================================================= */

async function requireAdmin(){

  showAdminGate();

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if(sessionError || !sessionData || !sessionData.session){
    window.location.href = "admin-login.html";
    return null;
  }

  const user = sessionData.session.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if(profileError || !profile || !profile.is_admin){
    await supabaseClient.auth.signOut();
    window.location.href = "admin-login.html?denied=1";
    return null;
  }

  adminCurrentUser = user;
  adminCurrentUser.full_name = profile.full_name;

  hideAdminGate();

  return adminCurrentUser;

}


/* =========================================================
   SIDEBAR
========================================================= */

function renderAdminSidebar(activeHref){

  const mount = document.getElementById("adminSidebar");
  if(!mount) return;

  const navHtml = ADMIN_NAV.map(group => `
    <div class="admin-nav-group-label">${escapeAdminHtml(group.group)}</div>
    ${group.items.map(item => `
      <a href="${item.href}" class="${item.href === activeHref ? "active" : ""}">${escapeAdminHtml(item.label)}</a>
    `).join("")}
  `).join("");

  mount.innerHTML = `
    <div class="admin-sidebar-brand">
      <img src="../assets/logo.png" alt="Keys99.com">
    </div>
    <div class="admin-sidebar-tag" style="padding:0 20px 14px;">Admin Panel</div>
    <nav class="admin-nav">${navHtml}</nav>
    <div class="admin-sidebar-foot">
      <button type="button" class="admin-signout" id="adminSignOutBtn">Sign Out</button>
    </div>
  `;

  const signOutBtn = document.getElementById("adminSignOutBtn");
  if(signOutBtn){
    signOutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "admin-login.html";
    });
  }

}


/* =========================================================
   SMALL SHARED HELPERS
========================================================= */

function escapeAdminHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminBadge(value){
  const clean = String(value || "").toLowerCase().trim();
  const label = clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "-";
  return `<span class="admin-badge badge-${clean}">${escapeAdminHtml(label)}</span>`;
}

function adminFormatDate(value){
  if(!value) return "-";
  const d = new Date(value);
  if(isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}

function showAdminMessage(elId, text, type){
  const el = document.getElementById(elId);
  if(!el) return;
  el.textContent = text;
  el.className = "admin-message admin-message-" + (type || "error");
  el.hidden = false;
}

function hideAdminMessage(elId){
  const el = document.getElementById(elId);
  if(el) el.hidden = true;
}
