const UPI_ID = "6304515849@ybl";
const MERCHANT_NAME = "CupQuest Coffee Fest";

let items = [];
let cart = JSON.parse(localStorage.getItem("cupquestCart") || "{}");
let category = "All";
let pendingCupQuestOrder = null;

const $ = (id) => document.getElementById(id);

fetch("menu.json")
  .then((response) => {
    if (!response.ok) throw new Error("Menu request failed");
    return response.json();
  })
  .then((data) => {
    items = data;
    renderCategories();
    renderMenu();
    updateCartCount();
  })
  .catch((error) => {
    console.error(error);
    showToast("Menu could not load. Please refresh the page.");
  });

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}

function renderCategories() {
  const categories = ["All", ...new Set(items.map((item) => item.category))];

  $("cats").innerHTML = categories
    .map(
      (itemCategory) => `
        <button
          class="chip ${itemCategory === category ? "on" : ""}"
          data-category="${escapeHtml(itemCategory)}"
          type="button">
          ${escapeHtml(itemCategory)}
        </button>
      `
    )
    .join("");

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.onclick = () => {
      category = button.dataset.category;
      renderCategories();
      renderMenu();
    };
  });
}

function productCard(item) {
  const alternative = items.find(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.available &&
      candidate.flavours.some((flavour) => item.flavours.includes(flavour))
  );

  return `
    <article class="card">
      <div class="imageWrap">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
        <span class="badge">${escapeHtml(item.label)}</span>
        ${
          !item.available
            ? '<div class="oos">This cup is taking a coffee break 😴☕</div>'
            : ""
        }
      </div>

      <div class="pad">
        <div class="marketing">${escapeHtml(item.label)}</div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="desc">${escapeHtml(item.description)}</p>

        <div class="flavours">
          ${item.flavours
            .map((flavour) => `<span>${escapeHtml(flavour)}</span>`)
            .join("")}
        </div>

        <div class="meta">
          <span class="price">₹${Number(item.price)}</span>
          <button
            class="add"
            data-add="${Number(item.id)}"
            type="button"
            ${!item.available ? "disabled" : ""}>
            ${item.available ? "Add to cup +" : "Sold out"}
          </button>
        </div>

        ${
          !item.available && alternative
            ? `<div class="similar">Try <b>${escapeHtml(
                alternative.name
              )}</b> for a similar flavour.</div>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderMenu() {
  const searchText = ($("search")?.value || "").toLowerCase();

  let filteredItems = items.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const searchableText = `${item.name} ${item.flavours.join(" ")} ${
      item.description
    }`.toLowerCase();

    return matchesCategory && searchableText.includes(searchText);
  });

  const sortValue = $("sort")?.value || "popular";

  if (sortValue === "low") {
    filteredItems.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortValue === "high") {
    filteredItems.sort((a, b) => Number(b.price) - Number(a.price));
  } else {
    filteredItems.sort(
      (a, b) => Number(b.popularity || 0) - Number(a.popularity || 0)
    );
  }

  $("menu").innerHTML =
    filteredItems.map(productCard).join("") ||
    "<p>No matching coffee found.</p>";

  $("recommended").innerHTML = [...items]
    .filter((item) => item.available)
    .sort(
      (a, b) => Number(b.popularity || 0) - Number(a.popularity || 0)
    )
    .slice(0, 4)
    .map(productCard)
    .join("");

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.onclick = () => addToCart(Number(button.dataset.add));
  });
}

function addToCart(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item || !item.available) return;

  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  showToast(`${item.name} added to My Cup`);
}

function saveCart() {
  localStorage.setItem("cupquestCart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  $("count").textContent = Object.values(cart).reduce(
    (total, quantity) => total + Number(quantity),
    0
  );
}

function changeQuantity(id, difference) {
  cart[id] = Math.max(0, Number(cart[id] || 0) + difference);
  if (!cart[id]) delete cart[id];
  saveCart();
  openCart();
}

function getSelectedItems() {
  return items
    .filter((item) => cart[item.id])
    .map((item) => ({
      ...item,
      quantity: Number(cart[item.id]),
      lineTotal: Number(item.price) * Number(cart[item.id])
    }));
}

function getCartTotal() {
  return getSelectedItems().reduce(
    (total, item) => total + item.lineTotal,
    0
  );
}

function openCart() {
  const selectedItems = getSelectedItems();
  const total = getCartTotal();

  $("sheetBody").innerHTML = selectedItems.length
    ? `
      <h2>Review and pay</h2>

      ${selectedItems
        .map(
          (item) => `
            <div class="line">
              <div>
                <b>${escapeHtml(item.name)}</b><br>
                <small>₹${Number(item.price)} each</small>
              </div>

              <div class="qty">
                <button data-change="${item.id},-1" type="button">−</button>
                <b>${item.quantity}</b>
                <button data-change="${item.id},1" type="button">+</button>
              </div>

              <b>₹${item.lineTotal}</b>
            </div>
          `
        )
        .join("")}

      <div class="total">
        <span>Total payable</span>
        <span>₹${total}</span>
      </div>

      <label for="customerName">Your name</label>
      <input
        id="customerName"
        class="field"
        maxlength="60"
        autocomplete="name"
        placeholder="Enter your name">

      <label for="pickupTime">Pickup time</label>
      <input id="pickupTime" class="field" type="time">

      <div class="upiApps">
        ${["PhonePe", "Google Pay", "Navi UPI", "Paytm", "BHIM", "Any UPI app"]
          .map(
            (application) => `
              <button data-pay="${escapeHtml(application)}" type="button">
                <b>${escapeHtml(application)}</b>
                <small>Pay ₹${total}</small>
              </button>
            `
          )
          .join("")}
      </div>

      <p class="warning">
        Verify the recipient and amount. Never share your UPI PIN.
        Payment will remain pending until the organizer verifies it.
      </p>
    `
    : `
      <h2>Your cup is empty</h2>
      <p>Add a coffee from the menu first.</p>
      <button id="goMenu" class="pay" type="button">Explore menu</button>
    `;

  showOverlay();

  document.querySelectorAll("[data-change]").forEach((button) => {
    button.onclick = () => {
      const [id, difference] = button.dataset.change.split(",");
      changeQuantity(Number(id), Number(difference));
    };
  });

  document.querySelectorAll("[data-pay]").forEach((button) => {
    button.onclick = () => openPayment(total, button.dataset.pay);
  });

  if ($("goMenu")) {
    $("goMenu").onclick = () => {
      closeOverlay();
      exploreMenu();
    };
  }
}

function openPayment(total, paymentApplication) {
  const customerName = $("customerName").value.trim();
  const pickupTime = $("pickupTime").value;

  if (!customerName) return showToast("Enter your name");
  if (!pickupTime) return showToast("Select pickup time");

  const temporaryReference = `CUP-${Date.now().toString().slice(-7)}`;
  const upiUri =
    "upi://pay?" +
    `pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(MERCHANT_NAME)}` +
    `&am=${Number(total).toFixed(2)}` +
    "&cu=INR" +
    `&tn=${encodeURIComponent(`${temporaryReference} ${customerName}`)}`;

  pendingCupQuestOrder = {
    customerName,
    pickupTime,
    paymentApplication,
    expectedTotal: Number(total)
  };

  $("sheetBody").innerHTML = `
    <div class="payment">
      <small>UPI PAYMENT</small>
      <h2>Pay ₹${total} with ${escapeHtml(paymentApplication)}</h2>

      <div class="payTotal">
        <span>Exact total</span>
        <strong>₹${total}</strong>
      </div>

      <div id="paymentQR" class="qrbox"></div>

      <p>
        Customer: <b>${escapeHtml(customerName)}</b><br>
        Pickup: <b>${escapeHtml(pickupTime)}</b>
      </p>

      <a class="pay" href="${upiUri}">
        Open ${escapeHtml(paymentApplication)}
      </a>

      <div class="order-submit-panel">
        <h3>After completing payment</h3>
        <p>
          Return to this page and enter the UPI transaction reference
          shown in the payment application.
        </p>

        <label for="upiTransactionReference">UPI transaction reference</label>
        <input
          id="upiTransactionReference"
          class="field"
          maxlength="60"
          placeholder="Enter the UPI transaction reference">

        <button id="submitOrderButton" class="pay" type="button">
          Submit order for preparation
        </button>

        <p class="warning">
          The payment status will initially be Verification pending.
          Never enter a UPI PIN, bank password, card number or CVV here.
        </p>
      </div>
    </div>
  `;

  setTimeout(() => {
    const qrContainer = $("paymentQR");
    if (window.QRCode) {
      new QRCode(qrContainer, {
        text: upiUri,
        width: 250,
        height: 250
      });
    } else {
      qrContainer.textContent = "Use the UPI payment button.";
    }
  }, 30);

  $("submitOrderButton").onclick = submitLiveOrder;
}

async function submitLiveOrder() {
  if (!pendingCupQuestOrder) {
    return showToast("Return to My Cup and try again.");
  }

  if (typeof supabaseClient === "undefined") {
    return showToast("Order service is not connected. Please try again later.");
  }

  const transactionReference = $("upiTransactionReference").value.trim();

  if (transactionReference.length < 6) {
    return showToast("Enter a valid UPI transaction reference.");
  }

  const selectedItems = getSelectedItems().map((item) => ({
    coffee_id: Number(item.id),
    coffee_name: item.name,
    unit_price: Number(item.price),
    quantity: Number(item.quantity)
  }));

  if (!selectedItems.length) return showToast("Your cart is empty.");

  const actualTotal = selectedItems.reduce(
    (total, item) => total + item.unit_price * item.quantity,
    0
  );

  if (actualTotal !== pendingCupQuestOrder.expectedTotal) {
    return showToast("The cart total changed. Please restart payment.");
  }

  const button = $("submitOrderButton");

  try {
    button.disabled = true;
    button.textContent = "Submitting order...";

    const { data, error } = await supabaseClient.rpc(
      "create_cupquest_order",
      {
        p_customer_name: pendingCupQuestOrder.customerName,
        p_pickup_time: pendingCupQuestOrder.pickupTime,
        p_payment_application: pendingCupQuestOrder.paymentApplication,
        p_upi_transaction_reference: transactionReference,
        p_items: selectedItems
      }
    );

    if (error) throw error;

    const createdOrder = Array.isArray(data) ? data[0] : data;
    if (!createdOrder) throw new Error("No order details were returned.");

    cart = {};
    saveCart();
    pendingCupQuestOrder = null;

    $("sheetBody").innerHTML = `
      <div class="success">
        <div class="tick">✓</div>
        <h2>Order submitted</h2>
        <p>Your order has reached the event organizer.</p>

        <div class="order-confirmation">
          <span>Order reference</span>
          <strong>${escapeHtml(createdOrder.order_reference)}</strong>
        </div>

        <div class="order-confirmation">
          <span>Total amount</span>
          <strong>₹${Number(createdOrder.total_amount).toFixed(2)}</strong>
        </div>

        <div class="order-confirmation">
          <span>Payment status</span>
          <strong>Verification pending</strong>
        </div>

        <div class="order-confirmation">
          <span>Preparation status</span>
          <strong>New order</strong>
        </div>

        <p class="warning">
          Keep the successful UPI payment screen available until the
          organizer verifies the transaction.
        </p>

        <button id="finishOrderButton" class="pay" type="button">
          Back to CupQuest
        </button>
      </div>
    `;

    $("finishOrderButton").onclick = closeOverlay;
  } catch (error) {
    console.error("Order submission failed:", error);
    showToast(error.message || "The order could not be submitted.");
    button.disabled = false;
    button.textContent = "Submit order for preparation";
  }
}

function exploreMenu() {
  $("fullMenu").scrollIntoView({ behavior: "smooth" });
}

function findCoffee() {
  exploreMenu();
  setTimeout(() => {
    $("search").focus();
    $("search").classList.add("pulse");
    setTimeout(() => $("search").classList.remove("pulse"), 1600);
  }, 450);
}

function showOverlay() {
  $("overlay").classList.remove("hidden");
}

function closeOverlay() {
  $("overlay").classList.add("hidden");
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").style.display = "block";
  setTimeout(() => ($("toast").style.display = "none"), 1800);
}

function openDuo() {
  const availableItems = items.filter((item) => item.available);

  $("sheetBody").innerHTML = `
    <div class="sectionLabel">BUILD A DUO</div>
    <h2>Two cups, one happy moment</h2>
    <p class="sheetIntro">
      Select any two available coffees. This is a bundle builder,
      not a discount.
    </p>

    <div class="comboGrid">
      ${availableItems
        .map(
          (item) => `
            <label class="comboOption">
              <input type="checkbox" data-duo="${item.id}">
              <span>${escapeHtml(item.name)}</span>
              <b>₹${Number(item.price)}</b>
            </label>
          `
        )
        .join("")}
    </div>

    <div id="comboError" class="comboError"></div>

    <div class="comboTotal">
      <span>Duo total</span>
      <span id="duoTotal">₹0</span>
    </div>

    <button id="addDuo" class="duoAdd" type="button">
      Add selected duo
    </button>
  `;

  showOverlay();
  document
    .querySelectorAll("[data-duo]")
    .forEach((checkbox) => (checkbox.onchange = updateDuoTotal));
  $("addDuo").onclick = addDuoToCart;
}

function updateDuoTotal(event) {
  let checked = [...document.querySelectorAll("[data-duo]:checked")];

  if (checked.length > 2) {
    event.target.checked = false;
    checked = [...document.querySelectorAll("[data-duo]:checked")];
    $("comboError").textContent = "Please select only two coffees.";
  } else {
    $("comboError").textContent = "";
  }

  const total = checked.reduce((sum, checkbox) => {
    const item = items.find(
      (candidate) => candidate.id === Number(checkbox.dataset.duo)
    );
    return sum + Number(item.price);
  }, 0);

  $("duoTotal").textContent = `₹${total}`;
}

function addDuoToCart() {
  const checked = [...document.querySelectorAll("[data-duo]:checked")];

  if (checked.length !== 2) {
    $("comboError").textContent = "Choose exactly two coffees to continue.";
    return;
  }

  checked.forEach((checkbox) => {
    const id = Number(checkbox.dataset.duo);
    cart[id] = (cart[id] || 0) + 1;
  });

  saveCart();
  showToast("Your two-cup moment was added ☕☕");
  openCart();
}

$("duoBtn").onclick = openDuo;
$("explore").onclick = exploreMenu;
$("finder").onclick = findCoffee;
$("cartBtn").onclick = openCart;
$("close").onclick = closeOverlay;
$("overlay").onclick = (event) => {
  if (event.target.id === "overlay") closeOverlay();
};
$("search").oninput = renderMenu;
$("sort").onchange = renderMenu;
