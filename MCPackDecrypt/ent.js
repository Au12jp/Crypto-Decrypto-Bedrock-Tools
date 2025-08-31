const fs = require("fs");
const path = require("path");
const aescfb = require("./aes");

const skinKey = "s5s5ejuDru4uchuF2drUFuthaspAbepE";

const localStatePath = path.join(
  "/Users/~/Library/Application Support/mcpelauncher-aoki/"
);
const mcpePath = path.join(localStatePath, "/games/com.mojang/minecraftpe");

const keyDb = {};

console.log("=== mcpackdecrypt 開始 ===");
console.log("localStatePath:", localStatePath);
console.log("mcpePath:", mcpePath);

getEntFile();

function getTitleAccountId() {
  console.log("getTitleAccountId() 実行中...");
  const optionsTxt = path.join(mcpePath, "options.txt");
  console.log("options.txtのパス:", optionsTxt);

  if (fs.existsSync(optionsTxt)) {
    console.log("options.txt が存在します");
    const options = fs.readFileSync(optionsTxt).toString();
    const lines = options.split("\n");
    console.log("options.txt の行数:", lines.length);

    for (let i = 0; i < lines.length; i++) {
      const [key, value] = lines[i].split(":");
      if (key === "last_title_account_id") {
        const accountId = value.replace("\n", "").replace("\r", "");
        console.log("last_title_account_id 見つかりました:", accountId);
        return accountId;
      }
    }
    console.log("last_title_account_id が見つかりませんでした");
  } else {
    console.log("options.txt が存在しません");
  }
}

function getEntKey() {
  console.log("getEntKey() 実行中...");
  const titleAccountId = getTitleAccountId();
  console.log("titleAccountId:", titleAccountId);

  const entXorKey = "X(nG*ejm&E8)m+8c;-SkLTjF)*QdN6_Y";
  const entKey = Buffer.alloc(32);

  for (let i = 0; i < 32; i++) {
    entKey[i] =
      titleAccountId.charCodeAt(i % titleAccountId.length) ^
      entXorKey.charCodeAt(i);
  }

  console.log("entKey 生成完了 (長さ:", entKey.length, ")");

  // entKeyの内容を表示
  console.log("=== entKey の詳細 ===");
  console.log("entKey (hex):", entKey.toString("hex"));
  console.log("entKey (base64):", entKey.toString("base64"));
  console.log("entKey (バイト配列):", Array.from(entKey));
  console.log("entKey (文字列):", entKey.toString("binary"));
  console.log("========================");

  return entKey;
}

function lookupKey(uuid) {
  const key = keyDb[uuid] || skinKey;
  console.log("lookupKey() - uuid:", uuid, "-> key found:", !!keyDb[uuid]);
  return key;
}

function getEntFile() {
  console.log("getEntFile() 実行中...");
  console.log("localStatePath の存在確認:", fs.existsSync(localStatePath));

  if (fs.existsSync(localStatePath)) {
    const files = fs.readdirSync(localStatePath);
    console.log("localStatePath のファイル数:", files.length);
    console.log("ファイル一覧:", files);

    const entFileNames = files.filter((file) => file.endsWith(".ent"));
    console.log(".ent ファイル数:", entFileNames.length);
    console.log(".ent ファイル一覧:", entFileNames);

    const entFiles = entFileNames.map((file) => {
      console.log("読み込み中:", file);
      return fs
        .readFileSync(path.join(localStatePath, file))
        .toString()
        .substring("Version2".length);
    });

    console.log("entFiles 処理開始...");
    for (let index = 0; index < entFiles.length; index++) {
      console.log(`entFile[${index}] 処理中...`);
      const entFile = entFiles[index];
      const cipherText = Buffer.from(entFile, "base64");
      console.log("cipherText 長さ:", cipherText.length);

      const decrypted = decryptBuffer(cipherText, getEntKey());
      console.log("復号化完了、長さ:", decrypted.length);

      try {
        const json = JSON.parse(decrypted.toString());
        console.log("JSON パース成功");
        console.log("JSON の主要キー:", Object.keys(json));
        console.log(
          "JSON の内容（最初の500文字）:",
          JSON.stringify(json).substring(0, 500)
        );
        parseEnt(json);
      } catch (error) {
        console.log("JSON パースエラー:", error.message);
        console.log(
          "復号化されたデータの最初の200文字:",
          decrypted.toString().substring(0, 200)
        );
        continue;
      }
    }
  } else {
    console.log("localStatePath が存在しません");
  }

  console.log("=== keyDb の最終状態 ===");
  console.log("登録されたキー数:", Object.keys(keyDb).length);
  console.log("keyDb:", keyDb);
}

module.exports = lookupKey;

function parseEnt(ent) {
  console.log("parseEnt() 実行中...");
  console.log("ent の構造:", Object.keys(ent));

  // 新しいJSONフォーマットに対応
  // メインレシートの処理（これでマーケットプレイスキーが復号化される）
  if (ent.receipt) {
    console.log("メインレシート (receipt) を処理中...");
    parseReceipt(ent.receipt, "メインレシート");
  }

  // インベントリ内のエンタイトルメントを処理（既存キーを保護）
  if (
    ent.inventory &&
    ent.inventory.entitlements &&
    Array.isArray(ent.inventory.entitlements)
  ) {
    console.log(
      "inventory.entitlements を処理中...",
      ent.inventory.entitlements.length,
      "個のアイテム"
    );

    for (let index = 0; index < ent.inventory.entitlements.length; index++) {
      const entitlement = ent.inventory.entitlements[index];
      console.log(`Entitlement[${index}]:`, {
        id: entitlement.id,
        packId: entitlement.packId,
        type: entitlement.type,
        ownership: entitlement.ownership,
      });

      // 既存のマーケットプレイスキーを保護
      if (entitlement.packId) {
        if (!keyDb[entitlement.packId]) {
          keyDb[entitlement.packId] = skinKey;
          console.log(
            "パックキー登録: NEW ->",
            entitlement.packId,
            "-> デフォルトキー"
          );
        } else {
          console.log(
            "パックキー保持: EXISTING ->",
            entitlement.packId,
            "-> マーケットプレイスキー保持"
          );
        }
      }
      if (entitlement.id) {
        if (!keyDb[entitlement.id]) {
          keyDb[entitlement.id] = skinKey;
          console.log(
            "IDキー登録: NEW ->",
            entitlement.id,
            "-> デフォルトキー"
          );
        } else {
          console.log(
            "IDキー保持: EXISTING ->",
            entitlement.id,
            "-> マーケットプレイスキー保持"
          );
        }
      }
    }
  } else {
    console.log("inventory.entitlements が存在しないか、配列ではありません");
  }

  // サードパーティレシート処理（重複を削除）
  if (ent.thirdPartyReceipts && Array.isArray(ent.thirdPartyReceipts)) {
    console.log(
      "thirdPartyReceipts処理開始:",
      ent.thirdPartyReceipts.length,
      "個"
    );
    for (let index = 0; index < ent.thirdPartyReceipts.length; index++) {
      console.log(`ThirdPartyReceipt[${index}] 処理中...`);
      if (ent.thirdPartyReceipts[index]) {
        parseReceipt(
          ent.thirdPartyReceipts[index],
          `ThirdPartyReceipt[${index}]`
        );
      }
    }
  }
}

function parseReceipt(receipt, label = "") {
  console.log(`parseReceipt() 実行中... (${label})`);
  console.log(`受信したレシートタイプ: ${typeof receipt}`);

  if (typeof receipt === "string") {
    console.log(`レシート文字列長さ: ${receipt.length}`);
    console.log(`レシート最初の100文字: ${receipt.substring(0, 100)}`);

    try {
      const decodedReceipt = atob(receipt);
      console.log(`Base64デコード成功: ${decodedReceipt.length} 文字`);
      console.log(
        `デコード結果の最初の200文字: ${decodedReceipt.substring(0, 200)}`
      );

      try {
        const receiptData = JSON.parse(decodedReceipt);
        console.log(`レシートJSON解析成功!`);
        console.log(
          `レシートJSONキー: [${Object.keys(receiptData).join(", ")}]`
        );

        if (receiptData.EntityId) {
          console.log(`EntityId: ${receiptData.EntityId}`);
        }
        if (receiptData.TitleId) {
          console.log(`TitleId: ${receiptData.TitleId}`);
        }

        // EntitlementReceipts の処理
        if (
          receiptData.EntitlementReceipts &&
          Array.isArray(receiptData.EntitlementReceipts)
        ) {
          console.log(
            `EntitlementReceipts発見: ${receiptData.EntitlementReceipts.length}個`
          );
          console.log(
            `EntitlementReceipts内容: ${JSON.stringify(
              receiptData.EntitlementReceipts
            ).substring(0, 500)}`
          );
        }

        // ReceiptData の処理
        if (receiptData.ReceiptData) {
          console.log(`ReceiptData発見!`);
          console.log(
            `ReceiptData内容: ${JSON.stringify(receiptData.ReceiptData)}`
          );

          const deviceId = receiptData.ReceiptData.DeviceId;
          console.log(`DeviceId: ${deviceId || "なし"}`);

          if (
            deviceId &&
            receiptData.EntityId &&
            receiptData.EntitlementReceipts
          ) {
            processMarketplaceKeys(
              receiptData.EntitlementReceipts,
              receiptData.EntityId,
              deviceId,
              label
            );
          }
        }
      } catch (jsonError) {
        console.log(`レシートJSON解析失敗: ${jsonError.message}`);
      }
    } catch (base64Error) {
      console.log(`Base64デコード失敗: ${base64Error.message}`);
    }
  }
}

function processMarketplaceKeys(
  entitlementReceipts,
  entityId,
  deviceId,
  label
) {
  console.log(`\n=== マーケットプレイスキー処理開始 (${label}) ===`);
  console.log(`EntityId: ${entityId}`);
  console.log(`DeviceId: ${deviceId}`);
  console.log(`EntitlementReceipts数: ${entitlementReceipts.length}`);

  const userKey = deriveUserKey(deviceId, entityId);
  console.log(`UserKey生成完了: ${userKey.length} bytes`);
  console.log(`UserKey (hex): ${userKey.toString("hex")}`);

  for (let index = 0; index < entitlementReceipts.length; index++) {
    const entitlement = entitlementReceipts[index];
    console.log(`\n--- EntitlementReceipt[${index}] ---`);
    console.log(`Id: ${entitlement.Id}`);
    console.log(`PackId: ${entitlement.PackId}`);
    console.log(`InstanceId: ${entitlement.InstanceId}`);

    // ContentKeyの確認
    if (entitlement.ContentKey) {
      console.log(`ContentKey発見: ${entitlement.ContentKey}`);

      try {
        const marketplaceKey = deobfuscateContentKey(
          entitlement.ContentKey,
          userKey
        );

        // PackIdとIdの両方にキーを登録
        keyDb[entitlement.PackId] = marketplaceKey;
        keyDb[entitlement.Id] = marketplaceKey;

        console.log(`マーケットプレイスキー登録成功!`);
        console.log(`PackId: ${entitlement.PackId} -> ${marketplaceKey}`);
        console.log(`Id: ${entitlement.Id} -> ${marketplaceKey}`);
      } catch (error) {
        console.log(`マーケットプレイスキー復号化失敗: ${error.message}`);
      }
    } else {
      console.log(`ContentKeyなし - デフォルトキー使用`);
    }
  }

  console.log(`=== マーケットプレイスキー処理完了 ===\n`);
}

function deriveUserKey(deviceId, entityId) {
  console.log("deriveUserKey() 実行中...");
  const deviceIdBuffer = Buffer.from(deviceId, "utf16le");
  const entityIdBuffer = Buffer.from(entityId, "utf16le");
  console.log("deviceIdBuffer 長さ:", deviceIdBuffer.length);
  console.log("entityIdBuffer 長さ:", entityIdBuffer.length);

  let length = deviceIdBuffer.length;
  if (entityIdBuffer.length < length) length = entityIdBuffer.length;
  const userKey = Buffer.alloc(length);

  for (let index = 0; index < userKey.length; index++) {
    userKey[index] = deviceIdBuffer[index] ^ entityIdBuffer[index];
  }

  console.log("UserKey 生成完了、最終長さ:", userKey.length);
  return userKey;
}

function deobfuscateContentKey(contentKey, userKey) {
  console.log("deobfuscateContentKey() 実行中...");
  const b64DecodedKey = Buffer.from(contentKey, "base64");
  console.log("base64デコード後の長さ:", b64DecodedKey.length);

  let length = b64DecodedKey.length;
  if (userKey.length < length) length = userKey.length;
  const deobfuscatedKey = Buffer.alloc(length);

  for (let index = 0; index < deobfuscatedKey.length; index++) {
    deobfuscatedKey[index] = b64DecodedKey[index] ^ userKey[index];
  }

  const result = deobfuscatedKey.toString("utf16le");
  console.log("難読化解除完了、結果の長さ:", result.length);
  return result;
}

function decryptBuffer(buffer, key) {
  console.log("decryptBuffer() 実行中...");
  console.log("入力バッファ長さ:", buffer.length);
  console.log("キー長さ:", key.length);

  const bufferKey = Buffer.from(key, "binary");
  const result = aescfb(buffer, bufferKey);

  console.log("復号化完了、出力長さ:", result.length);
  return result;
}
