# Crypto-Decrypto-Bedrock-Tools

> [English version here](README.md)

Minecraft Bedrock のパックを **暗号化・復号・解析** するためのツールセットです。  
このリポジトリは以下の 3 つの関連プロジェクトをサブモジュールとしてまとめています：

- **MCPackDecrypt**（Node.js） → マーケットプレイス `.mcpack` / `.mctemplate` 専用復号
- **bedrockpack**（Go） → パックの暗号化 / 復号 / 管理
- **bedrocktool**（Go） → サーバーからワールド・パック・スキンを取得するプロキシ兼ユーティリティ

---

## 📂 リポジトリ構成

### 🔹 MCPackDecrypt/

Node.js 製の小型ツール。  
Minecraft **Marketplace（公式ストア）専用の `.mcpack` / `.mctemplate`** を復号できます。

👉 主にマーケットプレイス配布のワールドやパック解析に使用。

---

### 🔹 bedrockpack/（サブモジュール）

[AkmalFairuz/bedrockpack](https://github.com/AkmalFairuz/bedrockpack)  
Go 製 CLI ツールで、**リソースパックの暗号化・復号・管理・抽出** が可能。

#### 主な機能

- リソースパックの **復号 / 暗号化**
- サーバーからリソースパックを **盗んで復号（steal）**  
  ※ Xbox 認証が必要

#### 使用例

```bash
# 復号
bedrockpack decrypt <path to pack> <key>

# 暗号化（キー自動生成も可）
bedrockpack encrypt <path to pack> <key (optional)>

# サーバーから直接取得
bedrockpack steal <server ip:port>
```

---

### 🔹 bedrocktool/（サブモジュール）

[bedrock-tool/bedrocktool](https://github.com/bedrock-tool/bedrocktool)
Go 製 CLI ツールで、**Minecraft Bedrock のプロキシ兼ユーティリティ**。
特に **サーバーからワールドやスキンをダウンロード** できるのが特徴です。

#### 主なサブコマンド

- `worlds` : サーバーからワールドをダウンロード
- `packs` : サーバーからリソースパックを保存
- `skins` : プレイヤーのスキンを取得
- `merge` : ワールドを結合
- `list-realms` : 所持している Realm 一覧を表示
- `capture` : パケットをキャプチャし pcap 保存

#### 使用例

```bash
# ワールドをダウンロード
bedrocktool worlds -debug=false <server info>

# サーバーのリソースパックを保存
bedrocktool packs <server info>

# Realm 一覧を取得
bedrocktool list-realms
```

---

## 🚀 クローン方法

サブモジュール込みでクローンしてください：

```bash
git clone --recurse-submodules https://github.com/Au12jp/Crypto-Decrypto-Bedrock-Tools.git
```

もしサブモジュールを含めずにクローンした場合は：

```bash
git submodule update --init --recursive
```

---

## 📦 必要環境

- Node.js（MCPackDecrypt 用）
- Go（bedrockpack, bedrocktool 用）
