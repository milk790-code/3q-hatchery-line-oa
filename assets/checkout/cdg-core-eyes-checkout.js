(function (global) {
  const ENDPOINT = "https://cdg-core-eyes.milk790.workers.dev/api/checkout";
  const SUPPORTED_BRANDS = new Set(["3q", "tudigong", "pop"]);

  function ensureCid(brand) {
    const key = `cdg_checkout_cid_${brand}`;
    let cid = global.localStorage && global.localStorage.getItem(key);
    if (!cid) {
      cid = global.crypto && global.crypto.randomUUID
        ? global.crypto.randomUUID()
        : `${brand}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      if (global.localStorage) global.localStorage.setItem(key, cid);
    }
    return cid;
  }

  function toItem(input) {
    const amount = Number(input.amount || input.price);
    const qty = Number(input.qty || input.quantity || 1);
    return {
      name: String(input.name || input.itemName || input.sku || "checkout"),
      sku: String(input.sku || ""),
      price: Number.isFinite(amount) ? Math.round(amount) : 0,
      qty: Number.isFinite(qty) ? Math.max(1, Math.round(qty)) : 1,
    };
  }

  async function submit(options) {
    const brand = String(options.brand || "").toLowerCase();
    if (!SUPPORTED_BRANDS.has(brand)) throw new Error(`Unsupported brand: ${brand}`);

    const items = Array.isArray(options.items) ? options.items.map(toItem) : [toItem(options)];
    const body = {
      brand,
      items,
      cid: options.cid || ensureCid(brand),
      line_user_id: options.lineUserId || options.line_user_id || "",
      ref_code: options.refCode || options.ref_code || new URLSearchParams(global.location.search).get("ref") || "",
      client_back_url: options.clientBackUrl || global.location.href,
      sku: options.sku || items[0]?.sku || "",
    };

    const response = await fetch(options.endpoint || ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const html = await response.text();
    if (!response.ok) throw new Error(html || `Checkout failed: ${response.status}`);
    global.document.open();
    global.document.write(html);
    global.document.close();
  }

  function bindButtons(root) {
    const scope = root || global.document;
    scope.querySelectorAll("[data-cdg-checkout]").forEach((button) => {
      if (button.dataset.cdgCheckoutBound === "1") return;
      button.dataset.cdgCheckoutBound = "1";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await submit({
            brand: button.dataset.brand,
            name: button.dataset.itemName || button.textContent,
            sku: button.dataset.sku,
            amount: button.dataset.amount,
            qty: button.dataset.qty || 1,
          });
        } catch (error) {
          button.disabled = false;
          global.alert(error.message || "付款頁建立失敗，請稍後再試");
        }
      });
    });
  }

  global.CdgCoreEyesCheckout = { endpoint: ENDPOINT, submit, bindButtons };
  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", () => bindButtons());
  }
})(window);
