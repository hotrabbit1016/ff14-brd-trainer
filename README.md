# BRD Train

FF14 吟遊詩人鍵位、爆發軸與高壓窗口訓練器。

目前訓練資料固定為 Patch 7.2 語境，包含 Dawntrail 詩人核心技能、Radiant Encore、Resonant Arrow、Heartbreak Shot，以及 BRD 職業量譜提示。

職業量譜以 CSS 重建遊戲內一般模式的結構，避免截圖素材殘留數字、背景或透明邊緣。資源邏輯依照歌曲、詩心、靈魂吟唱、尾聲與技能施放事件推進。

完整產品規格與目前實作細節見 [docs/SPEC.md](docs/SPEC.md)。

## 本機使用

```bash
npm install
npm run dev
```

開啟 `http://localhost:5173/`。

## GitHub Pages 部署

本 repo 使用 `gh-pages` 分支部署靜態 build。推送流程：

1. 在本機執行 `npm run build`。
2. 將 `dist` 內容推到 `gh-pages` 分支。
3. 到 repo 的 `Settings > Pages`，Source 選 `Deploy from a branch`，Branch 選 `gh-pages / root`。

Vite 已設定 `base: "./"`，部署在 `https://你的帳號.github.io/ff14-brd-trainer/` 這類 repo 子路徑也能載入資源。

## 技能圖標

UI 已內建主要詩人技能圖標，來源使用 XIVAPI 的遊戲圖標靜態檔。技能名稱以 FINAL FANTASY XIV 繁體中文版官方職業指南為準。

在 [src/main.tsx](/Users/hotrabbit1016/Documents/BRD-Train/src/main.tsx) 的 `skillIcons` 補上：

```ts
const skillIcons: Record<string, string> = {
  "狂風蝕箭": "https://xivapi.com/i/002000/002614_hr1.png",
  "烈毒咬箭": "https://xivapi.com/i/002000/002613_hr1.png",
};
```

若圖檔失效，介面會自動改用技能名前兩字作為 fallback。
