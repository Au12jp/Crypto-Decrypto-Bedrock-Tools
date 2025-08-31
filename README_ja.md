# Crypto-Decrypto-Bedrock-Tools

> [English version here](README.md)

Minecraft Bedrock のパックを暗号化・復号・操作するためのツールセットです。  
このリポジトリは、複数の関連プロジェクトをサブモジュールとして整理しています。

## 📂 リポジトリ構成

- **MCPackDecrypt/**  
  Node.js 製のツールで、Minecraft の `.mcpack` / `.mctemplate` ファイルを復号します。

- **bedrockpack/**（サブモジュール）  
  [AkmalFairuz/bedrockpack](https://github.com/AkmalFairuz/bedrockpack)  
  Bedrock Edition のコンテンツパックを扱う Go 製 CLI ツール。

- **bedrocktool/**（サブモジュール）  
  [bedrock-tool/bedrocktool](https://github.com/bedrock-tool/bedrocktool)  
  Bedrock Edition のパック操作を行う Go 製のユーティリティ & CLI ツール。

## 🚀 クローン方法

サブモジュール込みでクローンしてください：

```bash
git clone --recurse-submodules https://github.com/Au12jp/Crypto-Decrypto-Bedrock-Tools.git
```
