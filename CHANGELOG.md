# CHANGELOG

## [v0.4.0] — 2026-05-22

### 新增
- **動態模型選單**：前端 header 新增下拉選單，自動從 LM Studio `/v1/models` 載入所有已安裝模型
- 選擇記憶：模型選擇存入 `localStorage`，重啟後自動還原
- 所有 AI 端點（圖片辨識、批次篩選、相似物種）均接受 `model` 參數，可個別指定模型
- Footer 動態顯示當前選用的模型名稱
- 新增 `/api/models` 後端端點

### 新增
- **批次篩選：主體偵測範圍滑桿**（20%–100%，預設 70%）
- 解決飛鳥照片主體不在畫面正中央時偵測失敗的問題
- 偵測範圍公式：以畫面中心為基準，裁切指定比例的矩形區域進行 Laplacian 分析

### 新增
- **Windows 開機自動啟動服務**
  - `bird_service.bat`：直接呼叫 uvicorn，不帶 `--reload`（適合服務模式）
  - `BirdAI.vbs`：放置於 Windows Startup 資料夾，靜默背景啟動（不彈視窗）
  - Windows Firewall 規則：開放 TCP 8000 入站，允許區網存取
  - 服務日誌：`logs/service.log`
- 區網其他裝置可透過 `http://10.0.4.2:8000` 存取

### 修正
- 確認 Qwen3.6-27B 為純語言模型（無視覺），不可用於圖片辨識任務
- 建議改用 Qwen2.5-VL-7B（專用視覺語言模型）

---

## [v0.3.0] — 2026-05-22

### 新增
- **批次篩選功能**（新標籤頁）
  - 來源 / 目的資料夾設定，支援自動建立目的資料夾
  - 操作模式：複製 / 移動
  - 整體模糊偵測（Laplacian Variance，全圖）
  - 主體對焦偵測（畫面中央區域裁切）
  - AI 主題判斷（可選，預設關閉）：指定任意主題（鳥類、松鼠、蜻蜓…）
  - 批次進度即時顯示，支援中止
  - 結果列表：縮圖、分數、通過 / 拒絕原因，支援 CSV 匯出
- 篩選順序優化：品質檢查（毫秒級）優先，AI 呼叫僅對品質通過的照片執行
- 影像分析前縮放至 1024px，大幅降低記憶體與運算耗時
- AI 主題判斷縮圖 512px + `max_tokens=5`，加速推論

### 新增
- **RAW 檔案支援**：CR2、CR3、NEF、ARW、ORF、RW2、DNG、RAF、PEF 等
  - 使用 `rawpy` 解碼 RAW 格式
  - `_open_any_image()` 統一處理 PIL 與 RAW 兩種來源
  - 所有流程（縮圖、品質分析、AI 辨識）均支援 RAW

### 修正
- 上傳大小上限調整為 100MB（原 10MB）
- 圖片辨識前統一轉為 JPEG 再傳送 Vision API，解決 RAW 格式 `Invalid image` 錯誤

---

## [v0.2.0] — 2026-05-21

### 變更
- **AI 後端從 Ollama 改為 OpenAI-compatible API**（支援 LM Studio / Jan / Ollama）
  - 移除 `import ollama`，改用 `openai.OpenAI(base_url=..., api_key=...)`
  - 解決 Python 3.14 IPv6/IPv4 衝突問題（`localhost` → 明確 IPv4 位址）
  - 環境變數：`LLM_API_BASE`、`LLM_API_KEY`、`LLM_MODEL`
- `requirements.txt`：`ollama` 替換為 `openai`，新增 `rawpy`

### 新增
- LM Studio 連線支援（`http://10.0.4.2:1234/v1`）
- Vision API 訊息格式改為 OpenAI 標準：`image_url` + base64

---

## [v0.1.0] — 2026-05-20

### 新增
- **圖片辨識**：Ollama Gemma4 視覺模型，返回中英文名、學名、信心度、棲地、分布
- **鳴聲辨識**：BirdNET-Analyzer，支援 MP3 / WAV / OGG / FLAC / M4A
- **觀察記錄 CRUD**：SQLite 儲存，支援搜尋、日期篩選、分頁、刪除
- **辨識更正**：AI 推薦 5 種相似物種（含 Wikipedia 圖片），確認後同步更新記錄
- **前端 i18n**：繁體中文 / English 切換
- **儲存提示**：辨識後提示儲存，支援 GPS 自動取得、自訂日期、備註
- 中文鳥名對照表（`bird_names_zh.json`）
- Docker / docker-compose 支援
