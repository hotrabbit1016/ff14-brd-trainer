# FF14 BRD Trainer Specification

本文件記錄目前實作版本的產品規格、訓練行為與技術設計。目標是讓專案後續調整鍵位、技能軸、FF14 手感模擬時有明確依據。

## 目標

`ff14-brd-trainer` 是本地優先的 FF14 吟遊詩人訓練器，核心目的不是一般反應小遊戲，而是：

- 熟悉自訂鍵位。
- 練習詩人開場、120 秒爆發、傷頭插入等高壓窗口。
- 用資料回饋哪個技能、按鍵或 weave 窗口最容易慢、漏、誤觸或 clip。

目前專案固定在 Patch 7.2 訓練語境，重點是手感、鍵位與節奏，不做 DPS 計算、不做完整戰鬥模擬、不接後端。

## 技術架構

- Vite + React + TypeScript
- 單頁前端 app
- `localStorage` 保存使用者設定、鍵位與自訂軸
- 無登入、無後端、無雲端同步
- GitHub Pages 以 `gh-pages` 分支部署 `dist`
- Vite `base: "./"`，可在 repo 子路徑正常載入資源

主要檔案：

- `src/main.tsx`：資料模型、預設鍵位、預設軸、訓練引擎、頁面元件
- `src/styles.css`：所有 UI、職業量表、Rotation Display、回饋動畫
- `README.md`：啟動與部署說明

## 主要頁籤

### 訓練

訓練頁目前是單主面板布局，不再保留左側節奏監控欄。

主要區塊：

- 控制列：選擇訓練軸、開始、停止
- `focusCue`：顯示準備戰鬥 / 判定窗口 / 下一拍、技能名與按鍵
- 戰鬥狀態：歌曲、Coda、Soul Voice、團輔窗口
- CSS 詩人職業量表
- 3 秒準備戰鬥倒數
- 流動式 `Rotation Display`
- 即時手感面板
- 下一步提示
- 下方摘要：分數、GCD/oGCD 準確率、核心完成率、漏按、誤觸、Clip 風險、最近輸入
- 鍵盤 / 滑鼠熱區

### 爆發軸

可編輯目前選取 rotation：

- 時間
- 類型：GCD / oGCD / Mechanic / State
- 技能
- 預期按鍵
- early / late window
- 備註

支援新增技能、刪除技能、複製軸。

### 鍵位

顯示並編輯技能鍵位，支援：

- 鍵盤單鍵
- `Ctrl+` 組合鍵
- 滑鼠側鍵 M4 / M5
- 滾輪中鍵 / 左傾 / 右傾
- DPI 鍵映射後的自訂按鍵
- 自訂名稱，例如 `扳機`

按鍵校準會在瀏覽器收到事件時更新該技能鍵位。若硬體鍵未送出瀏覽器可偵測事件，使用者需要在滑鼠驅動或 Razer Synapse 類工具中映射成鍵盤鍵或滑鼠按鍵。

### 分析

分析頁基於目前訓練輸入即時計算：

- 總分
- 平均延遲
- p95 最慢延遲
- 核心完成率
- 最慢技能
- 鍵位判斷建議

資料保留在本機瀏覽器，不匯出。

### 設定

設定頁保留與 FF14 手感模擬直接相關的參數：

- `GCD 長度`
- `Action Queue 窗口 ms`
- `Ping 往返 ms`
- `動畫鎖基準 ms`
- `前端 FPS / 輸入輪詢`
- `允許倒數搶開`
- `顯示下一步提示`
- `啟用錯誤音效`
- `使用 80% Repertoire proc 模擬`

已移除的舊設定：

- GCD 判定寬容度
- oGCD 判定寬容度
- 允許雙插
- 節拍器

原因：這些不是玩家在 FF14 內能直接調整的行為。現在改由 action queue、ping、frame delay、animation lock 推導結果。

## 預設鍵位

目前預設鍵位：

| 技能 | 按鍵 |
| --- | --- |
| 魔法爆裂 | `1` |
| 輝煌箭 | `R` |
| 伶牙俐齒 | `2` |
| 狂風蝕箭 | `3` |
| 烈毒咬箭 | `4` |
| 光明神的返場餘音 | `Q` |
| 紛亂箭 / 共鳴箭 | `E` |
| 側風誘導箭 | `F` |
| 絕峰箭 / 爆破箭 | `G` |
| 碎心箭 | `M4` |
| 九天連箭 | `扳機` |
| 完美音調 | `M5` |
| 猛者強擊 | `T` |
| 光明神的最終樂章 | `C` |
| 戰鬥之聲 | `V` |
| 巧力之幻藥 | `X` |
| 行吟 | `Z` |
| 大地神的抒情戀歌 | `DPI1` |
| 光陰神的禮讚凱歌 | `DPI2` |
| 內丹 | `滾輪中鍵` |
| 親疏自行 | `滾輪左傾` |
| 傷頭 | `滾輪右傾` |
| 放浪神的小步舞曲 | `Ctrl+1` |
| 賢者的敘事謠 | `Ctrl+2` |
| 軍神的讚美歌 | `Ctrl+3` |

注意：如果使用者已經在瀏覽器 `localStorage` 存過舊鍵位，程式會優先載入本機資料。要套用新的預設鍵位，需要清除該站 localStorage 或重設設定資料。

## 預設訓練軸

目前內建：

- `2GCD 開場`
- `3GCD 開場`
- `120 秒爆發`
- `120 秒爆發 + 傷頭`

2GCD / 3GCD 開場已同步使用：

- 0.0s `狂風蝕箭` -> `3`
- 2.5s `烈毒咬箭` -> `4`

120 秒爆發片段假設進入爆發前已有三 Coda、Soul Voice 100、Wanderer 詩心 3 層，之後由技能事件消耗與推進資源。

## 訓練開始與倒數

按下開始後不會直接進入 0 秒。

流程：

1. 時間軸從 `-3.0s` 開始。
2. 畫面顯示「戰鬥開始倒數」。
3. `Rotation Display` 在倒數期間已經開始流動。
4. `0.0s` 時第一個技能抵達判定線。
5. 倒數期間輸入會被偵測。

搶開處理：

- 在 queue window 前過早按第一個技能，預設記為 `Pull`。
- `Pull` 會扣分並計入誤觸。
- `Pull` 不會把技能算成成功施放，因此不會錯誤觸發歌曲、Coda、Soul Voice 或其他職業資源。
- 若設定啟用 `允許倒數搶開`，搶開會改判為 `Early`，但仍不等同於成功技能資源事件。

## 技能釋放引擎

目前引擎目標是模擬 FF14 的輸入手感，而不是只做時間點反應判斷。

### 時間模型

使用者按鍵時記錄 client-side input time：

```text
rawDelta = (inputTime - expectedEventTime) * 1000
```

GCD 和 oGCD 的處理不同。

### GCD Action Queue

GCD 在 `Action Queue 窗口` 內提前按下時，判定為 `Queued`。

目前預設：

```text
Action Queue 窗口 = 500ms
```

行為：

- 若 GCD 在 `-queueWindow ~ -120ms` 之間按下，視為已進 FF14 action queue。
- `Queued` 的分析 delta 記為 `0ms`，因為實際施放應貼齊 GCD 可用瞬間。
- Queue 成功不會因為「按得很早」被當成 Early。

這是目前引擎和一般反應遊戲最大的差異。

### oGCD / Ability 有效釋放時間

oGCD 不使用 GCD queue。

有效釋放時間由以下參數推導：

```text
effectiveDelta = rawDelta + frameDelay + ping / 2
frameDelay = 1000 / frameRate
```

用途：

- 判斷 oGCD 是否太早 / 太晚
- 判斷是否 clip 下一個 GCD
- 即時手感面板顯示 `釋放 +N ms`

### Animation Lock 與 Clip

目前有效動畫鎖：

```text
effectiveAnimationLock = animationLock + ping
```

Clip 判定：

```text
timeToNextGcd - max(0, effectiveDelta) < effectiveAnimationLock
```

意思是：如果 oGCD 實際送出後剩餘到下一個 GCD 的時間不足以容納動畫鎖，就標記 `Clip`。

### 判定種類

| 判定 | 意義 |
| --- | --- |
| `Queued` | GCD 已在 action queue window 內排隊 |
| `Perfect` | 有效釋放偏差在 ±120ms |
| `Good` | 在合法輸入窗口內 |
| `Early` | 太早 |
| `Late` | 太晚 |
| `Clip` | oGCD 會壓到下一個 GCD |
| `Wrong` | 按到錯鍵或沒有匹配技能 |
| `Pull` | 倒數期間過早搶開 |
| `Miss` | 保留給漏按分析，目前漏按由未完成事件推導 |

候選技能選擇：

- 先找所有在合法窗口內的未完成事件。
- 排序時，GCD queue 成功的 scoring delta 視為 0。
- 優先選擇與實際按鍵相符的候選事件。
- 若沒有按鍵相符事件，再以時間最近事件判斷 Wrong。

這避免了「正確按 GCD queue，卻被鄰近 oGCD 或其他事件搶走判定」的問題。

## 詩人職業量表

職業量表目前用 CSS 重建，不使用截圖素材，避免殘影、舊數字、背景藍底或透明邊緣。

顯示內容：

- 歌曲譜線
- 歌曲倒數
- Wanderer / Army 詩心層數
- Soul Voice 條與數字
- 三顆 Coda

資源推進由成功技能事件驅動，不是無腦照時間成長。

### 歌曲與 Coda

成功施放以下技能會開歌並取得對應 Coda：

- `放浪神的小步舞曲` -> Wanderer Coda
- `賢者的敘事謠` -> Mage Coda
- `軍神的讚美歌` -> Army Coda

歌曲持續時間目前設為 45 秒。

### Repertoire

歌曲期間每 3 秒做一次 Repertoire tick。

若 `使用 80% Repertoire proc 模擬` 開啟：

- 使用 deterministic 模擬，約 80% tick 給 Repertoire。
- 目前用 `tickIndex % 5 !== 0` 作為可重現的 80% 模型。

若關閉：

- 每次 tick 都給 Repertoire。

### 九天連箭

`九天連箭` 在歌曲中成功施放會直接給一次 Repertoire。

### Soul Voice

每次 Repertoire：

- Soul Voice `+5`
- 上限 100

`絕峰箭 / 爆破箭` 成功施放後消耗 Soul Voice，目前簡化為歸 0。

### Wanderer / Army 層數

Wanderer：

- Repertoire 增加完美音調層數
- 上限 3
- `完美音調` 成功施放後清空

Army：

- Repertoire 增加軍神層數
- 上限 4

Mage：

- 不顯示層數
- 仍會產生 Soul Voice

### 光明神的最終樂章

`光明神的最終樂章` 成功施放後消耗目前 Coda，量表 Coda 歸空。

## Rotation Display

`Rotation Display` 是訓練頁中心視覺，不是靜態時間表。

目前行為：

- 技能依照 `event.time - now` 從右往左流動。
- 中間有固定判定線。
- GCD 在上排。
- oGCD / Mechanic / State 在下排。
- 每個技能圖標下方顯示按鍵 chip。
- oGCD / Mechanic 的按鍵 chip 使用不同顏色。
- 命中時掃描線閃綠。
- 錯誤 / clip / pull 時掃描線紅色抖動。
- 已判定技能會顯示 verdict badge。
- 成功、偏慢、錯誤分別有不同動畫與外框。

目前速度：

```text
centerX = 220px
pixelsPerSecond = 74
```

## 統計與分析

即時統計：

- 總分
- GCD 準確率
- oGCD 準確率
- 核心完成率
- 漏按
- 誤觸
- Clip 風險

分數扣分：

- Miss：每個 -8
- Wrong：每個 -5
- Pull：每個 -6
- Early / Late：每個 -3
- Clip：每個 -4
- 平均延遲超過 140ms 後額外扣分

`Queued`、`Perfect`、`Good` 視為有效成功。

## 已知限制

- 不做 DPS 計算。
- 不模擬完整 FF14 伺服器狀態與網路封包。
- 不模擬所有技能冷卻共享細節。
- 不模擬 DoT tick / party buff snapshot / damage application。
- Repertoire 使用 deterministic 80% 模型，不是真隨機。
- `絕峰箭 / 爆破箭` 的 Soul Voice 消耗目前簡化為歸 0。
- 目前 localStorage 舊資料不會自動被新版預設鍵位覆蓋。
- 技能圖標使用 XIVAPI 靜態圖源，若外部圖源不可用會 fallback 到技能名前兩字。

## 部署

目前 remote：

```text
https://github.com/hotrabbit1016/ff14-brd-trainer
```

Pages URL：

```text
https://hotrabbit1016.github.io/ff14-brd-trainer/
```

部署方式：

1. `npm run build`
2. 將 `dist` 內容推到 `gh-pages` 分支 root
3. GitHub Pages 設定來源為 `gh-pages / root`

目前沒有使用 GitHub Actions，因為先前 GitHub token 沒有 `workflow` scope，無法 push workflow 檔。
