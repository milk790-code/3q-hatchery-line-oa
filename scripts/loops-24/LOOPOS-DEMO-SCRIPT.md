# LoopOS Demo Script

## One-Line Pitch

我只做兩件事：派工和拍板；中間由 LoopOS 讀記憶、排優先級、產 handoff，然後停在安全紅線。

## 60-Second Demo

1. Open the latest dashboard:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\loops-24\show-dashboard.ps1
   ```

2. Point to `Today First`.

   Say: "這裡不是 analytics，是今天最該拍板的一件事。它會標出 lane、預期產物、人工 gate。"

3. Point to `Safe Local Actions Completed`.

   Say: "這些是系統已經能自己做的低風險本地工作，例如 snapshot、checklist、health report。"

4. Point to `Manual Red Lines`.

   Say: "它不會自己 push、deploy、發 LINE、送 email、碰 secrets。這些都要我拍板。"

5. Point to `Next Approval Gate`.

   Say: "所以我每天不用重讀所有 thread，只要看下一個 approval gate，就知道該補 secret、審草稿、還是准許部署。"

## Customer Framing

LoopOS is for small teams that already have scattered automations but still rely on the owner to remember what is safe, blocked, or worth doing next.

Sell it as:

- A morning decision dashboard.
- A safety layer around automations.
- A local handoff factory for deploys, outreach, and GitHub work.

Do not sell it as fully autonomous outbound sending. The safer promise is:

"老闆只拍板，系統把可安全自動化的部分先整理好。"

## First Paid Offer

Offer: LoopOS setup for one LINE OA / content / Cloudflare workflow.

Deliverables:

- One local runner.
- One dashboard.
- One lane map.
- One manual-gate checklist.
- One recordable demo.

Price test:

- Setup: NT$10,000-30,000.
- Maintenance: NT$3,000-10,000/month.

## Demo Boundaries

- Use real dashboard evidence.
- Do not show secret values.
- Do not click deploy, send, merge, or create PR during the demo.
- If the dashboard is stale, say it is stale and run report-only mode first.
