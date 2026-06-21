# cdg-core-eyes checkout unification

BLUF: 3Q / tudigong / POP 的金流入口統一走 `cdg-core-eyes`。品牌前台只送 `brand + items + cid/ref_code`，ECPay MerchantID、HashKey、HashIV、ReturnURL 都留在 Cloudflare Worker。

## Worker endpoint

```text
https://cdg-core-eyes.milk790.workers.dev/api/checkout
```

等同別名：

```text
https://cdg-core-eyes.milk790.workers.dev/checkout/ecpay
```

## Static page usage

在 HTML 加：

```html
<script src="assets/checkout/cdg-core-eyes-checkout.js"></script>
```

3Q 按鈕：

```html
<button
  data-cdg-checkout
  data-brand="3q"
  data-item-name="3Q Hatchery starter pack"
  data-sku="3q-starter"
  data-amount="1280">
  立即付款
</button>
```

tudigong 按鈕：

```html
<button
  data-cdg-checkout
  data-brand="tudigong"
  data-item-name="土地公顧問體驗包"
  data-sku="tdg-starter"
  data-amount="1680">
  立即付款
</button>
```

## Programmatic usage

```html
<script src="assets/checkout/cdg-core-eyes-checkout.js"></script>
<script>
  CdgCoreEyesCheckout.submit({
    brand: "3q",
    items: [{ name: "3Q Hatchery starter pack", sku: "3q-starter", price: 1280, qty: 1 }],
    refCode: new URLSearchParams(location.search).get("ref") || ""
  });
</script>
```

## cdg-core-eyes mapping

| ECPay field | Value |
|---|---|
| `ReturnURL` | `https://cdg-core-eyes.milk790.workers.dev/webhooks/ecpay` |
| `CustomField1` | `line_user_id` or `cid` |
| `CustomField2` | `ref_code` |
| `CustomField3` | `brand` (`pop`, `3q`, `tudigong`) |
| `CustomField4` | first SKU / plan |

## Production gate

Do not enable live buttons until:

1. `cdg-core-eyes` has `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, and `EYES_KEY` as Worker secrets.
2. `cdg-core-eyes` is deployed.
3. `/health?deep=1` and `/admin/ping` pass.
4. One low-value test order writes exactly one `outcomes.status='paid'` row and one `paid_client:{brand}:...` KV flag.
