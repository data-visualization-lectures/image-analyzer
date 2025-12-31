# 画像色数分析ツール 設計書 (Image Color Analyzer Design)

## 1. 概要 (Overview)
`sharp` (High performance Node.js image processing) を使用して、アップロードされた画像を解析し、含まれる色の種類とその出現数を計算するWebツールです。
**Vercel / Netlify などのサーバーレス環境での動作を想定**し、OSレベルの依存（GraphicsMagick等）を排除した設計とします。

**主な機能:**
*   画像の全ピクセル解析による色数カウント
*   **類似色のグルーピング機能**: スライダーで「色のまとまり具合」を調整可能
*   **複数画像の一括処理**: 複数の画像をまとめてアップロードし、それぞれの結果を表示・ダウンロード可能

## 2. システム要件 (Requirements)
*   **Environment:** Node.js (Local or Serverless Function)
*   **Dependencies:**
    *   **NPM Packages:**
        *   `sharp`: 高速画像処理ライブラリ (Native modules included)
        *   `express`: Webサーバー (またはVercel API Routes)
        *   `multer`: ファイルアップロード処理 (複数ファイル対応)

## 3. アーキテクチャ (Architecture)

### 3.1 ディレクトリ構成
```text
image-analyzer/
├── package.json
├── server.js          # Backend: API & Processing logic
├── public/
│   ├── index.html     # Frontend: UI
│   ├── script.js      # Frontend: Logic (Upload, Slider, Download)
│   └── styles.css     # Frontend: Styles
└── uploads/           # Temporary storage (memory or /tmp in serverless)
```

### 3.2 データフロー
1.  **User**: ブラウザから**複数画像**を選択し、**閾値スラ―ダー**を調整してアップロード。
2.  **Frontend**: `/api/analyze` エンドポイントへ画像群と設定値をPOST送信。
3.  **Backend (Serverless Function)**:
    *   `multer` (MemoryStorage) で画像をメモリ上で受け取る。
    *   各画像に対して以下の処理を実行:
        1.  `sharp` でピクセル(Buffer)取得。
        2.  全色を抽出・カウント。
        3.  **指定された閾値(threshold)に基づいて類似色をグルーピング (Euclidean Distance)**。
    *   全画像の結果をまとめてJSONで返却。
4.  **Frontend**:
    *   結果を受け取り、画像ごとに集計表を表示。
    *   CSVダウンロード機能を提供。

## 4. API設計 (API Design)

### POST `/api/analyze`

*   **Request:**
    *   Content-Type: `multipart/form-data`
    *   Body:
        *   `images`: Files (Multiple)
        *   `threshold`: Number (0-100) - 類似色の許容範囲

*   **Processing Logic (Backend) per Image:**
    1.  **Pixel Extraction**: Fetch raw RGB data via `sharp`.
    2.  **Initial Counting**: Count all exact unique colors first.
    3.  **Grouping Algorithm (if threshold > 0)**:
        *   Sort unique colors by frequency (descending).
        *   Take the most frequent color as a "Group Leader".
        *   Find all other colors within Euclidean distance `threshold`.
        *   Merge them into the "Group Leader" (sum counts).
        *   Repeat until all colors are assigned.
    4.  **Formatting**: Calculate Hex, RGB string, and percentage.

*   **Response (JSON):**
    ```json
    {
      "success": true,
      "results": [
        {
          "filename": "image1.png",
          "totalPixels": 2000,
          "uniqueColorGroups": 5, // グルーピング後の色数
          "colors": [
            {
              "hex": "#FF0000",
              "rgb": "rgb(255, 0, 0)",
              "count": 1200,
              "percentage": "60.0%",
              "mergedColorsCount": 3 // このグループに統合された色の数
            },
            ...
          ]
        },
        ...
      ]
    }
    ```

## 5. フロントエンド機能 (Frontend Features)

*   **UI Components:**
    *   File Dropzone (Multiple files supported)
    *   **Threshold Slider** (Label: "Color Similarity", Range: 0-100)
    *   "Analyze" Button
    *   **Results Area**:
        *   List of analyzed images.
        *   For each image: Thumbnail, Color Table, CSV Download Button.

*   **CSV Format:**
    ```csv
    Hex,RGB,Count,Percentage,MergedColors
    #FF0000,"rgb(255, 0, 0)",1200,60.0%,3
    ...
    ```

## 6. 次のステップ (Next Steps Implementation Plan)
1.  `npm init -y`
2.  `npm install express multer sharp`
3.  Backend (`server.js`) 実装
    *   `sharp` ピクセル取得処理
    *   **類似色グルーピングロジック (`ColorGrouping` class/function)**
    *   複数ファイルループ処理
4.  Frontend (`index.html`, `script.js`) 実装
    *   スライダーUI追加
    *   複数結果の表示ロジック
5.  動作確認
