# Crypto-Decrypto-Bedrock-Tools

> [日本語版はこちら](README_ja.md)

A toolkit for **encrypting, decrypting, and analyzing** Minecraft Bedrock packs.  
This repository organizes three related projects as submodules:

- **MCPackDecrypt** (Node.js) → Marketplace `.mcpack` / `.mctemplate` decryption
- **bedrockpack** (Go) → Pack decryption / encryption / management
- **bedrocktool** (Go) → Proxy & utility for downloading worlds, packs, and skins

---

## 📂 Repository Structure

### 🔹 MCPackDecrypt/

A small Node.js tool.  
Specialized for **official Marketplace `.mcpack` / `.mctemplate`** decryption.

👉 Mainly used for analyzing packs and worlds distributed in the Marketplace.

---

### 🔹 bedrockpack/ (submodule)

[AkmalFairuz/bedrockpack](https://github.com/AkmalFairuz/bedrockpack)  
A Go CLI tool to **decrypt, encrypt, manage, and extract resource packs**.

#### Features

- Decrypt / Encrypt resource packs
- **Steal resource packs from a server** (Xbox authentication required)

#### Example usage

```bash
# Decrypt
bedrockpack decrypt <path to pack> <key>

# Encrypt (key optional, can be auto-generated)
bedrockpack encrypt <path to pack> <key (optional)>

# Steal directly from a server
bedrockpack steal <server ip:port>
```

---

### 🔹 bedrocktool/ (submodule)

[bedrock-tool/bedrocktool](https://github.com/bedrock-tool/bedrocktool)
A Go CLI tool serving as a **Minecraft Bedrock proxy and utility**.
Notably allows **downloading worlds, skins, and packs from servers**.

#### Key subcommands

- `worlds` : Download a world from a server
- `packs` : Download resource packs from a server
- `skins` : Download player skins
- `merge` : Merge two or more worlds
- `list-realms` : List available Realms
- `capture` : Capture packets into a pcap file

#### Example usage

```bash
# Download a world
bedrocktool worlds -debug=false <server info>

# Save server resource packs
bedrocktool packs <server info>

# List your Realms
bedrocktool list-realms
```

---

## 🚀 Cloning

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/Au12jp/Crypto-Decrypto-Bedrock-Tools.git
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

---

## 📦 Requirements

- Node.js (for MCPackDecrypt)
- Go (for bedrockpack, bedrocktool)
