let allOrders = [];
let ordersChannel = null;
const adminElement = (id) => document.getElementById(id);

async function initializeAdmin() {
  if (typeof supabaseClient === "undefined") {
    showAdminToast("Supabase is not connected. Check supabase-config.js.");
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  updateLoginState(session);

  supabaseClient.auth.onAuthStateChange((_event, newSession) => {
    updateLoginState(newSession);
  });
}

function updateLoginState(session) {
  const loggedIn = Boolean(session);
  adminElement("loginSection").classList.toggle("hidden", loggedIn);
  adminElement("dashboardSection").classList.toggle("hidden", !loggedIn);
  adminElement("signOutButton").classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    loadOrders();
    subscribeToOrders();
  } else if (ordersChannel) {
    supabaseClient.removeChannel(ordersChannel);
    ordersChannel = null;
  }
}

async function sendLoginLink() {
  const email = adminElement("organizerEmail").value.trim();
  if (!email) return showAdminToast("Enter the organizer email.");

  adminElement("loginButton").disabled = true;
  adminElement("loginButton").textContent = "Sending link...";

  const redirectUrl = new URL("admin.html", window.location.href).href;
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl }
  });

  adminElement("loginButton").disabled = false;
  adminElement("loginButton").textContent = "Send secure login link";

  if (error) return showAdminToast(error.message);
  adminElement("loginMessage").textContent =
    "Login link sent. Open the email on this phone and tap the link.";
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function loadOrders() {
  adminElement("orders").innerHTML = '<div class="emptyState">Loading live orders...</div>';

  const { data, error } = await supabaseClient
    .from("orders")
    .select(`
      id, order_reference, customer_name, pickup_time, total_amount,
      ordered_at, payment_application, upi_transaction_reference,
      payment_status, preparation_status,
      order_items (id, coffee_name, unit_price, quantity, line_total)
    `)
    .order("ordered_at", { ascending: false });

  if (error) {
    adminElement("orders").innerHTML = '<div class="emptyState">Orders could not be loaded.</div>';
    return showAdminToast(error.message);
  }

  allOrders = data || [];
  renderOrders();
}

function renderOrders() {
  const search = adminElement("orderSearch").value.trim().toLowerCase();
  const status = adminElement("statusFilter").value;

  const filtered = allOrders.filter((order) => {
    const searchable = [
      order.customer_name,
      order.order_reference,
      order.upi_transaction_reference,
      order.payment_application,
      ...(order.order_items || []).map((item) => item.coffee_name)
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);
    const matchesStatus =
      status === "all" ||
      order.payment_status === status ||
      order.preparation_status === status;

    return matchesSearch && matchesStatus;
  });

  updateSummary();
  adminElement("orders").innerHTML = filtered.length
    ? filtered.map(orderCard).join("")
    : '<div class="emptyState">No matching orders yet.</div>';

  document.querySelectorAll("[data-status-field]").forEach((select) => {
    select.onchange = () => updateOrderStatus(
      select.dataset.orderId,
      select.dataset.statusField,
      select.value
    );
  });
}

function orderCard(order) {
  const orderedAt = new Date(order.ordered_at);
  const items = order.order_items || [];
  const paymentClass = ["paid", "failed"].includes(order.payment_status)
    ? order.payment_status
    : "pending";

  return `
    <article class="orderCard">
      <div class="orderHeader">
        <div>
          <div class="orderRef">${escapeText(order.order_reference)}</div>
          <h2>${escapeText(order.customer_name)}</h2>
          <div class="meta">
            Ordered: ${orderedAt.toLocaleDateString()} ${orderedAt.toLocaleTimeString()}<br>
            Pickup: ${escapeText(order.pickup_time)}
          </div>
        </div>
        <div class="amount">₹${Number(order.total_amount).toFixed(2)}</div>
      </div>

      <div class="items">
        ${items.map((item) => `
          <div class="itemRow">
            <span>${escapeText(item.coffee_name)} × ${Number(item.quantity)}</span>
            <strong>₹${Number(item.line_total).toFixed(2)}</strong>
          </div>
        `).join("") || "No item details"}
      </div>

      <div class="paymentInfo">
        <span class="statusPill ${paymentClass}">${formatStatus(order.payment_status)}</span><br>
        <b>Payment app:</b> ${escapeText(order.payment_application || "Not provided")}<br>
        <b>UPI reference:</b> ${escapeText(order.upi_transaction_reference || "Not provided")}
      </div>

      <div class="statusGrid">
        <label>
          Payment status
          <select data-order-id="${order.id}" data-status-field="payment_status">
            ${statusOption("verification_pending", "Verification pending", order.payment_status)}
            ${statusOption("paid", "Payment verified", order.payment_status)}
            ${statusOption("failed", "Payment failed", order.payment_status)}
            ${statusOption("refunded", "Refunded", order.payment_status)}
          </select>
        </label>

        <label>
          Preparation status
          <select data-order-id="${order.id}" data-status-field="preparation_status">
            ${statusOption("new", "New order", order.preparation_status)}
            ${statusOption("preparing", "Preparing", order.preparation_status)}
            ${statusOption("ready", "Ready", order.preparation_status)}
            ${statusOption("collected", "Collected", order.preparation_status)}
            ${statusOption("cancelled", "Cancelled", order.preparation_status)}
          </select>
        </label>
      </div>
    </article>
  `;
}

function statusOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function formatStatus(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function updateOrderStatus(orderId, field, value) {
  if (!["payment_status", "preparation_status"].includes(field)) return;

  const update = { [field]: value };
  const { error } = await supabaseClient.from("orders").update(update).eq("id", orderId);

  if (error) {
    showAdminToast(error.message);
    return loadOrders();
  }

  showAdminToast("Order status updated.");
  await loadOrders();
}

function subscribeToOrders() {
  if (ordersChannel) return;

  ordersChannel = supabaseClient
    .channel("cupquest-mobile-admin")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, loadOrders)
    .subscribe();
}

function updateSummary() {
  adminElement("newCount").textContent = allOrders.filter((o) => o.preparation_status === "new").length;
  adminElement("pendingCount").textContent = allOrders.filter((o) => o.payment_status === "verification_pending").length;
  adminElement("preparingCount").textContent = allOrders.filter((o) => o.preparation_status === "preparing").length;
  adminElement("readyCount").textContent = allOrders.filter((o) => o.preparation_status === "ready").length;
}

function escapeText(value) {
  const element = document.createElement("div");
  element.textContent = String(value || "");
  return element.innerHTML;
}

function showAdminToast(message) {
  const toast = adminElement("toast");
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2200);
}

adminElement("loginButton").onclick = sendLoginLink;
adminElement("signOutButton").onclick = signOut;
adminElement("refreshButton").onclick = loadOrders;
adminElement("orderSearch").oninput = renderOrders;
adminElement("statusFilter").onchange = renderOrders;
initializeAdmin();
