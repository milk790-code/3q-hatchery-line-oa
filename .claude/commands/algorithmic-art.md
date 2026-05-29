# Algorithmic Art

在 `algorithmic-art.html` 中產生或調整演算法藝術 Canvas 效果。

## 用法

```
/algorithmic-art [描述你想要的效果]
```

範例：
- `/algorithmic-art` — 開啟現有生成器說明
- `/algorithmic-art 增加粒子連線效果` — 修改 Canvas 腳本加入連線
- `/algorithmic-art 換成圓形擴散波` — 改變粒子運動模式

## 設計原則（Karpathy 風格）

- 全部 vanilla JS，不引入任何框架
- 每個視覺參數都要有對應的 UI 滑桿（用戶可即時調整）
- 程式碼行數 < 200 行（canvas 主邏輯）
- 預設配色使用 3Q 金色系：`#B8924A`、`#D4AA6A`、`#0A0A0A`

## 輸出規格

修改 `algorithmic-art.html` 中的 Canvas 腳本，確保：
1. `requestAnimationFrame` 動畫迴圈
2. 視口縮放（`window.devicePixelRatio`）
3. `downloadCanvas()` 匯出 PNG 功能正常
4. 控制面板參數即時生效（不需重新整理頁面）

## 對應頁面

`algorithmic-art.html` — 瀏覽器直接開啟測試
