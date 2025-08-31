const fs = require("fs");
const path = require("path");
const aescfb = require("./aes");
const JSZip = require("jszip");
const lookupKey = require("./ent");
const Progress = require("./progress");
const { ipcMain } = require("electron");

module.exports = class PackDecryptor extends Progress {
  inputPath = "";
  outputFilePath = "";
  zip = new JSZip();
  zippedContent = [];
  contentFiles = [];

  decryptDenylist = [
    "pack_icon.png",
    "pack_icon.jpeg",
    "world_icon.png",
    "world_icon.jpeg",
    "manifest.json",
  ];

  constructor(inputPath, outputFilePath) {
    super();
    this.inputPath = inputPath;
    this.outputFilePath = outputFilePath;
    console.log(
      `[PackDecryptor] 初期化: input=${inputPath}, output=${outputFilePath}`
    );
  }

  async start() {
    return new Promise(async (res) => {
      console.log("[PackDecryptor] 処理開始");
      const startTime = Date.now();

      const dbPath = path.join(this.inputPath, "db");
      console.log(`[PackDecryptor] ファイルリスト取得中: ${this.inputPath}`);
      this.contentFiles = recursiveReaddirrSync(this.inputPath);
      console.log(`[PackDecryptor] 総ファイル数: ${this.contentFiles.length}`);
      this._started = true;

      // DB ファイルの処理
      if (fs.existsSync(dbPath)) {
        console.log(`[PackDecryptor] DBディレクトリが存在: ${dbPath}`);
        const dbDir = recursiveReaddirrSync(dbPath);
        console.log(`[PackDecryptor] DBファイル数: ${dbDir.length}`);

        for (let index = 0; index < dbDir.length; index++) {
          const dbFilePath = dbDir[index];
          console.log(
            `[PackDecryptor] DB処理中 (${index + 1}/${
              dbDir.length
            }): ${path.basename(dbFilePath)}`
          );

          if (fs.lstatSync(dbFilePath).isDirectory()) {
            console.log(
              `[PackDecryptor] ディレクトリをスキップ: ${dbFilePath}`
            );
            continue;
          }

          try {
            const decrypted = await this.decryptContentFile(dbFilePath);
            this.addFile(dbFilePath, decrypted);
            console.log(
              `[PackDecryptor] DB復号化完了: ${path.basename(dbFilePath)}`
            );
          } catch (error) {
            console.error(
              `[PackDecryptor] DB復号化エラー: ${dbFilePath}`,
              error
            );
          }

          // 進捗更新を頻繁に行う
          if (index % 5 === 0 || index === dbDir.length - 1) {
            console.log(
              `[PackDecryptor] DB進捗: ${index + 1}/${
                dbDir.length
              } (${Math.round(((index + 1) / dbDir.length) * 100)}%)`
            );
          }
        }
      } else {
        console.log(`[PackDecryptor] DBディレクトリなし: ${dbPath}`);
      }

      // contents.json の処理
      console.log("[PackDecryptor] contents.json検索中...");
      let contentsJsonCount = 0;
      for (let index = 0; index < this.contentFiles.length; index++) {
        const name = path.basename(this.contentFiles[index]);
        if (name.toLowerCase() === "contents.json") {
          contentsJsonCount++;
          console.log(
            `[PackDecryptor] contents.json発見 #${contentsJsonCount}: ${this.contentFiles[index]}`
          );
          try {
            await this.decryptContent(this.contentFiles[index]);
            console.log(
              `[PackDecryptor] contents.json処理完了 #${contentsJsonCount}`
            );
          } catch (error) {
            console.error(`[PackDecryptor] contents.json処理エラー:`, error);
          }
        }
      }
      console.log(
        `[PackDecryptor] contents.json処理完了: ${contentsJsonCount}個`
      );

      // 残りのファイル処理
      console.log("[PackDecryptor] 残りファイル処理開始...");
      let remainingFiles = 0;
      for (let index = 0; index < this.contentFiles.length; index++) {
        const filePath = this.contentFiles[index];
        if (!this.zippedContent.includes(filePath)) {
          remainingFiles++;
          console.log(
            `[PackDecryptor] 通常ファイル追加 (${remainingFiles}): ${path.basename(
              filePath
            )}`
          );
          try {
            this.addFile(filePath, fs.readFileSync(filePath));
          } catch (error) {
            console.error(
              `[PackDecryptor] ファイル読み込みエラー: ${filePath}`,
              error
            );
          }

          // 進捗表示を頻繁に
          if (remainingFiles % 10 === 0) {
            console.log(
              `[PackDecryptor] 通常ファイル進捗: ${remainingFiles}個処理済み`
            );
          }
        }
      }
      console.log(`[PackDecryptor] 残りファイル処理完了: ${remainingFiles}個`);

      // スキンパック処理
      console.log("[PackDecryptor] スキンパック処理開始...");
      try {
        await this.crackSkinPack();
        console.log("[PackDecryptor] スキンパック処理完了");
      } catch (error) {
        console.error("[PackDecryptor] スキンパック処理エラー:", error);
      }

      // ワールド処理
      console.log("[PackDecryptor] ワールド処理開始...");
      try {
        this.crackWorld();
        console.log("[PackDecryptor] ワールド処理完了");
      } catch (error) {
        console.error("[PackDecryptor] ワールド処理エラー:", error);
      }

      // ZIP生成
      console.log("[PackDecryptor] ZIP生成開始...");
      console.log(
        `[PackDecryptor] 総ファイル数: ${Object.keys(this.zip.files).length}`
      );

      this.zip
        .generateAsync({ type: "arraybuffer" })
        .then((content) => {
          const fileSize = Buffer.from(content).length;
          console.log(`[PackDecryptor] ZIP生成完了: ${fileSize} bytes`);
          console.log(`[PackDecryptor] 出力先: ${this.outputFilePath}`);

          try {
            fs.writeFileSync(this.outputFilePath, Buffer.from(content));
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            console.log(`[PackDecryptor] 全処理完了: ${duration}秒`);
            res(0);
          } catch (error) {
            console.error("[PackDecryptor] ファイル書き込みエラー:", error);
            res(1);
          }
        })
        .catch((error) => {
          console.error("[PackDecryptor] ZIP生成エラー:", error);
          res(1);
        });
    });
  }

  crackWorld() {
    const levelDatPath = path.join(this.inputPath, "level.dat");
    console.log(`[PackDecryptor] ワールドクラック確認: ${levelDatPath}`);

    if (!fs.existsSync(levelDatPath)) {
      console.log("[PackDecryptor] level.datが存在しません");
      return;
    }

    console.log("[PackDecryptor] level.dat読み込み中...");
    const levelDat = fs.readFileSync(levelDatPath);
    console.log(`[PackDecryptor] level.datサイズ: ${levelDat.length} bytes`);

    let replaceCount = 0;
    let offset = levelDat.indexOf("prid");
    while (offset !== -1) {
      levelDat.writeUInt8("a".charCodeAt(0), offset);
      replaceCount++;
      offset = levelDat.indexOf("prid");
    }

    console.log(`[PackDecryptor] "prid"置換完了: ${replaceCount}箇所`);
    this.addFile(levelDatPath, levelDat);
  }

  addFile(filePath, content) {
    const relPath = path
      .relative(this.inputPath, filePath)
      .replaceAll("\\", "/");
    if (!this.zippedContent.includes(filePath)) {
      this.zippedContent.push(filePath);
    }
    this.zip.file(relPath, content, { binary: true });

    const currentPercentage = this.getPercentage();
    console.log(
      `[PackDecryptor] ファイル追加: ${relPath} (進捗: ${currentPercentage}%)`
    );

    // プログレス更新の問題をデバッグ
    try {
      if (typeof self !== "undefined" && self.postMessage) {
        console.log(
          `[PackDecryptor] Web Worker進捗送信: ${currentPercentage}%`
        );
        self.postMessage(currentPercentage);
      } else {
        console.log("[PackDecryptor] Web Workerコンテキストではありません");
      }
    } catch (error) {
      console.error("[PackDecryptor] 進捗送信エラー:", error);
    }
  }

  static isContentFileEncrypted(filePath) {
    const contents = fs.readFileSync(filePath);

    if (contents.length < 0x100) {
      return false;
    }

    const magic = contents.readUint32LE(0x4);

    // 暗号化ファイルのみ詳細表示
    if (magic === 2614082044) {
      console.log("\n" + "=".repeat(80));
      console.log(`[ENCRYPTED FILE] ${path.basename(filePath)}`);
      console.log("=".repeat(80));

      // ファイル基本情報
      console.log(`File Path: ${filePath}`);
      console.log(`File Size: ${contents.length.toLocaleString()} bytes`);
      console.log(
        `Magic Number: ${magic} (0x${magic.toString(16).toUpperCase()})`
      );

      // UUID情報
      const uuidSize = contents.readUInt8(0x10);
      if (uuidSize > 0 && uuidSize < 128) {
        const uuid = contents.subarray(0x11, 0x11 + uuidSize);
        const uuidString = uuid.toString();

        console.log(`\nUUID Info:`);
        console.log(`  Length: ${uuidSize} bytes`);
        console.log(`  Hex: ${uuid.toString("hex").toUpperCase()}`);
        console.log(`  String: "${uuidString}"`);

        // keyDb検索（この方法でアクセス）
        const keyDbModule = require("./ent");
        let foundKey = null;
        try {
          foundKey = keyDbModule(uuidString);
          console.log(
            `  Key Found: ${
              foundKey !== "s5s5ejuDru4uchuF2drUFuthaspAbepE"
                ? "YES (Custom)"
                : "YES (Default)"
            }`
          );
        } catch (e) {
          console.log(`  Key Found: NO`);
        }

        // 復号化試行
        console.log(`\nDecryption Attempt:`);
        try {
          const key = keyDbModule(uuidString);
          console.log(`  Using Key: ${key}`);

          const encryptedData = contents.subarray(0x100);
          const aescfb = require("./aes");
          const decrypted = aescfb(encryptedData, Buffer.from(key, "binary"));

          console.log(
            `  Decrypted Size: ${decrypted.length.toLocaleString()} bytes`
          );

          // 内容解析
          if (decrypted.length > 0) {
            const firstBytes = decrypted.subarray(
              0,
              Math.min(64, decrypted.length)
            );
            console.log(
              `  First 64 bytes: ${firstBytes.toString("hex").toUpperCase()}`
            );

            // JSON解析試行
            try {
              const jsonContent = JSON.parse(decrypted.toString("utf8"));
              console.log(`  Content Type: JSON`);
              console.log(
                `  JSON Keys: [${Object.keys(jsonContent).join(", ")}]`
              );

              // manifest.json検出
              if (jsonContent.format_version || jsonContent.header) {
                console.log(`  >> MANIFEST.JSON DETECTED <<`);
                if (jsonContent.header) {
                  const header = jsonContent.header;
                  console.log(`    Pack Name: "${header.name || "N/A"}"`);
                  console.log(
                    `    Description: "${(
                      header.description || "N/A"
                    ).substring(0, 100)}${
                      header.description && header.description.length > 100
                        ? "..."
                        : ""
                    }"`
                  );
                  console.log(
                    `    Version: [${
                      header.version ? header.version.join(".") : "N/A"
                    }]`
                  );
                  console.log(`    Pack UUID: ${header.uuid || "N/A"}`);
                  console.log(
                    `    Min Engine Version: [${
                      header.min_engine_version
                        ? header.min_engine_version.join(".")
                        : "N/A"
                    }]`
                  );

                  if (jsonContent.modules && jsonContent.modules.length > 0) {
                    const module = jsonContent.modules[0];
                    console.log(`    Module Type: ${module.type || "N/A"}`);
                    console.log(`    Module UUID: ${module.uuid || "N/A"}`);
                    console.log(
                      `    Module Version: [${
                        module.version ? module.version.join(".") : "N/A"
                      }]`
                    );
                  }

                  if (
                    jsonContent.dependencies &&
                    jsonContent.dependencies.length > 0
                  ) {
                    console.log(
                      `    Dependencies: ${jsonContent.dependencies.length}`
                    );
                    jsonContent.dependencies.forEach((dep, i) => {
                      console.log(
                        `      [${i + 1}] ${dep.uuid} v[${
                          dep.version ? dep.version.join(".") : "N/A"
                        }]`
                      );
                    });
                  }

                  if (
                    jsonContent.capabilities &&
                    jsonContent.capabilities.length > 0
                  ) {
                    console.log(
                      `    Capabilities: [${jsonContent.capabilities.join(
                        ", "
                      )}]`
                    );
                  }
                }
              }

              // contents.json検出
              else if (
                jsonContent.content &&
                Array.isArray(jsonContent.content)
              ) {
                console.log(`  >> CONTENTS.JSON DETECTED <<`);
                console.log(
                  `    Total Content Items: ${jsonContent.content.length}`
                );

                const sampleItems = jsonContent.content.slice(0, 5);
                sampleItems.forEach((item, i) => {
                  console.log(`    [${i + 1}] Path: ${item.path || "N/A"}`);
                  console.log(`        Key: ${item.key ? "Present" : "None"}`);
                  console.log(`        Size: ${item.size || "N/A"} bytes`);
                });

                if (jsonContent.content.length > 5) {
                  console.log(
                    `    ... and ${jsonContent.content.length - 5} more items`
                  );
                }

                // ファイル種別統計
                const fileTypes = {};
                jsonContent.content.forEach((item) => {
                  if (item.path) {
                    const ext = path.extname(item.path).toLowerCase();
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                  }
                });

                console.log(`    File Types:`);
                Object.entries(fileTypes).forEach(([ext, count]) => {
                  console.log(`      ${ext || "(no ext)"}: ${count} files`);
                });
              }

              // levelname検出（ワールドデータ）
              else if (jsonContent.LevelName || jsonContent.levelname) {
                console.log(`  >> WORLD DATA DETECTED <<`);
                console.log(
                  `    World Name: "${
                    jsonContent.LevelName || jsonContent.levelname || "N/A"
                  }"`
                );
                if (jsonContent.GameType !== undefined) {
                  console.log(`    Game Type: ${jsonContent.GameType}`);
                }
                if (jsonContent.Difficulty !== undefined) {
                  console.log(`    Difficulty: ${jsonContent.Difficulty}`);
                }
                if (jsonContent.RandomSeed !== undefined) {
                  console.log(`    Seed: ${jsonContent.RandomSeed}`);
                }
              }

              // その他のJSON
              else {
                console.log(`  >> OTHER JSON DATA <<`);
                const jsonStr = JSON.stringify(jsonContent, null, 2);
                console.log(
                  `    Content Preview: ${jsonStr.substring(0, 300)}${
                    jsonStr.length > 300 ? "..." : ""
                  }`
                );
              }
            } catch (jsonError) {
              // バイナリデータの場合
              console.log(`  Content Type: Binary Data`);

              // テキスト部分を抽出
              let textContent = "";
              for (let i = 0; i < Math.min(500, decrypted.length); i++) {
                const byte = decrypted[i];
                if (byte >= 32 && byte <= 126) {
                  textContent += String.fromCharCode(byte);
                } else {
                  textContent += ".";
                }
              }

              console.log(
                `  Text Extract: "${textContent.substring(0, 200)}${
                  textContent.length > 200 ? "..." : ""
                }"`
              );

              // 特定のバイナリ形式を検出
              if (decrypted.subarray(0, 4).toString() === "PK\x03\x04") {
                console.log(`  >> ZIP/MCPACK FORMAT DETECTED <<`);
              } else if (
                decrypted.subarray(0, 8).toString("hex").toUpperCase() ===
                "89504E470D0A1A0A"
              ) {
                console.log(`  >> PNG IMAGE DETECTED <<`);
              } else if (
                decrypted.subarray(0, 3).toString("hex").toUpperCase() ===
                "FFD8FF"
              ) {
                console.log(`  >> JPEG IMAGE DETECTED <<`);
              } else {
                console.log(`  >> UNKNOWN BINARY FORMAT <<`);
              }
            }
          }
        } catch (decryptError) {
          console.log(`  Decryption Failed: ${decryptError.message}`);
        }
      }

      console.log("=".repeat(80) + "\n");
      return true;
    }

    return false;
  }

  async decryptContentFile(filePath) {
    console.log(
      `[PackDecryptor] コンテンツファイル復号化: ${path.basename(filePath)}`
    );

    const contents = fs.readFileSync(filePath);
    console.log(`[PackDecryptor] ファイルサイズ: ${contents.length} bytes`);

    if (contents.length < 0x100) {
      console.log("[PackDecryptor] サイズ不足により復号化スキップ");
      return contents;
    }

    const magic = contents.readUint32LE(0x4);
    console.log(`[PackDecryptor] マジック確認: ${magic}`);

    if (magic === 2614082044) {
      console.log("[PackDecryptor] 暗号化ファイルとして処理");

      // 詳細なヘッダー情報
      console.log("=== 暗号化ファイル詳細 ===");
      const uuidSize = contents.readUInt8(0x10);
      console.log(`UUIDサイズ: ${uuidSize}`);

      if (uuidSize > 0 && uuidSize < 64) {
        const uuid = contents.subarray(0x11, 0x11 + uuidSize);
        console.log(`UUID (raw bytes): ${Array.from(uuid).join(", ")}`);
        console.log(`UUID (hex): ${uuid.toString("hex")}`);
        console.log(`UUID (string): ${uuid.toString()}`);

        // UUIDをstring形式に変換してキー検索
        const uuidString = uuid.toString();
        console.log(`キー検索用UUID: "${uuidString}"`);

        const key = lookupKey(uuidString);
        console.log(`[PackDecryptor] キー検索結果:`);
        console.log(`  - UUID: "${uuidString}"`);
        console.log(`  - キー見つかった: ${!!key}`);
        console.log(`  - キー値: ${key || "なし"}`);

        // keyDbの内容も表示
        console.log("現在のkeyDb:");
        const keyDbKeys = Object.keys(require("./ent").keyDb || {});
        keyDbKeys.forEach((k) => {
          console.log(
            `  - "${k}": ${
              require("./ent").keyDb ? require("./ent").keyDb[k] : "unknown"
            }`
          );
        });

        const cipherText = contents.subarray(0x100);
        console.log(`暗号化データサイズ: ${cipherText.length} bytes`);
        console.log(
          `暗号化データの最初の32バイト: ${cipherText
            .subarray(0, 32)
            .toString("hex")}`
        );

        console.log("========================");

        const decrypted = decryptAes(key, cipherText);
        console.log(`[PackDecryptor] 復号化完了: ${decrypted.length} bytes`);

        // 復号化結果の最初の部分を表示
        if (decrypted.length > 0) {
          console.log(
            `復号化結果の最初の100バイト: ${decrypted
              .subarray(0, Math.min(100, decrypted.length))
              .toString("hex")}`
          );

          // テキストとして読める部分があるかチェック
          try {
            const textPart = decrypted
              .subarray(0, Math.min(200, decrypted.length))
              .toString("utf8");
            console.log(
              `復号化結果 (テキスト): ${textPart.replace(/[^\x20-\x7E]/g, ".")}`
            );
          } catch (e) {
            console.log("復号化結果はテキストではありません");
          }
        }

        return decrypted;
      } else {
        console.log(`不正なUUIDサイズ: ${uuidSize}`);
        return contents;
      }
    } else {
      console.log("[PackDecryptor] 非暗号化ファイル");
      return contents;
    }
  }

  async decryptContent(filePath) {
    console.log(`[PackDecryptor] コンテンツ復号化開始: ${filePath}`);

    const dirname = path.dirname(filePath);
    const isEncrypted = PackDecryptor.isContentFileEncrypted(filePath);
    console.log(`[PackDecryptor] 暗号化状態: ${isEncrypted}`);

    const content = await this.decryptContentFile(filePath);
    console.log(`[PackDecryptor] ファイル復号化完了: ${content.length} bytes`);

    try {
      const parsedContent = JSON.parse(content);
      console.log(
        `[PackDecryptor] JSON解析完了: ${
          parsedContent.content ? parsedContent.content.length : 0
        }項目`
      );

      if (isEncrypted && parsedContent.content) {
        console.log(
          `[PackDecryptor] 暗号化コンテンツ処理開始: ${parsedContent.content.length}項目`
        );

        for (let index = 0; index < parsedContent.content.length; index++) {
          const key = parsedContent.content[index].key;
          const filePath = parsedContent.content[index].path;
          const fileName = path.basename(filePath);

          console.log(
            `[PackDecryptor] 項目処理 (${index + 1}/${
              parsedContent.content.length
            }): ${fileName}`
          );

          if (this.decryptDenylist.indexOf(fileName.toLowerCase()) !== -1) {
            console.log(
              `[PackDecryptor] 拒否リストによりスキップ: ${fileName}`
            );
            continue;
          }
          if (!key) {
            console.log(`[PackDecryptor] キーなしによりスキップ: ${fileName}`);
            continue;
          }

          const joinedPath = path.join(dirname, filePath);
          console.log(`[PackDecryptor] ファイル復号化: ${joinedPath}`);

          try {
            const file = await this.decryptFile(joinedPath, key);
            this.addFile(joinedPath, file);
            console.log(`[PackDecryptor] 復号化完了: ${fileName}`);
          } catch (error) {
            console.error(`[PackDecryptor] 復号化エラー: ${joinedPath}`, error);
          }
        }
        console.log("[PackDecryptor] 暗号化コンテンツ処理完了");
      }
    } catch (error) {
      console.error(`[PackDecryptor] JSON解析エラー: ${filePath}`, error);
    }

    this.addFile(filePath, content);
  }

  async decryptContentFile(filePath) {
    console.log(
      `[PackDecryptor] コンテンツファイル復号化: ${path.basename(filePath)}`
    );

    const contents = fs.readFileSync(filePath);
    console.log(`[PackDecryptor] ファイルサイズ: ${contents.length} bytes`);

    if (contents.length < 0x100) {
      console.log("[PackDecryptor] サイズ不足により復号化スキップ");
      return contents;
    }

    const magic = contents.readUint32LE(0x4);
    console.log(`[PackDecryptor] マジック確認: ${magic}`);

    if (magic === 2614082044) {
      console.log("[PackDecryptor] 暗号化ファイルとして処理");
      const cipherText = contents.subarray(0x100);
      const uuidSize = contents.readUInt8(0x10);
      const uuid = contents.subarray(0x11, 0x11 + uuidSize);

      console.log(
        `[PackDecryptor] UUID: ${uuid.toString("hex")} (サイズ: ${uuidSize})`
      );
      console.log(
        `[PackDecryptor] 暗号化データサイズ: ${cipherText.length} bytes`
      );

      const key = lookupKey(uuid);
      console.log(`[PackDecryptor] キー取得: ${key ? "成功" : "失敗"}`);

      const decrypted = decryptAes(key, cipherText);
      console.log(`[PackDecryptor] 復号化完了: ${decrypted.length} bytes`);
      return decrypted;
    } else {
      console.log("[PackDecryptor] 非暗号化ファイル");
      return contents;
    }
  }

  async decryptFile(filePath, key) {
    console.log(`[PackDecryptor] ファイル復号化: ${path.basename(filePath)}`);
    console.log(
      `[PackDecryptor] キー: ${key ? key.slice(0, 8) + "..." : "なし"}`
    );

    const contents = fs.readFileSync(filePath);
    console.log(`[PackDecryptor] ファイルサイズ: ${contents.length} bytes`);

    const decrypted = decryptAes(key, contents);
    console.log(`[PackDecryptor] 復号化結果: ${decrypted.length} bytes`);
    return decrypted;
  }

  async crackSkinPack() {
    const skinJsonFilePath = "skins.json";
    console.log(`[PackDecryptor] スキンパック確認: ${skinJsonFilePath}`);

    if (!this.zip.files[skinJsonFilePath]) {
      console.log("[PackDecryptor] skins.jsonが見つかりません");
      return;
    }

    console.log("[PackDecryptor] skins.json読み込み中...");
    const skinsFile = await this.zip.files[skinJsonFilePath].async("string");
    console.log(`[PackDecryptor] skins.jsonサイズ: ${skinsFile.length} bytes`);

    try {
      const skins = JSON.parse(skinsFile);
      console.log(
        `[PackDecryptor] スキン数: ${skins.skins ? skins.skins.length : 0}`
      );

      if (skins.skins) {
        for (let index = 0; index < skins.skins.length; index++) {
          const skin = skins.skins[index];
          const oldType = skin.type;
          skin.type = "free";
          console.log(`[PackDecryptor] スキン${index + 1}: ${oldType} → free`);
        }
      }

      this.addFile(
        path.join(this.inputPath, skinJsonFilePath),
        JSON.stringify(skins, null, 2)
      );
      console.log("[PackDecryptor] スキンパック修正完了");
    } catch (Exception) {
      console.error("[PackDecryptor] スキンパック処理エラー:", Exception);
    }
  }

  getPercentage() {
    if (!this._started) return 0;

    const totalFiles = this.contentFiles.length || 1;
    const processedFiles = this.zippedContent.length;
    const percentage = Math.round((processedFiles / totalFiles) * 100);

    return Math.min(percentage, 100);
  }
};

function recursiveReaddirrSync(dir) {
  console.log(`[recursiveReaddir] ディレクトリスキャン: ${dir}`);
  let results = [];

  try {
    let list = fs.readdirSync(dir);
    console.log(`[recursiveReaddir] ファイル数: ${list.length}`);

    list.forEach(function (file) {
      file = path.join(dir, file);
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        console.log(`[recursiveReaddir] サブディレクトリ: ${file}`);
        results = results.concat(recursiveReaddirrSync(file));
      } else {
        results.push(file);
      }
    });
  } catch (error) {
    console.error(
      `[recursiveReaddir] ディレクトリ読み込みエラー: ${dir}`,
      error
    );
  }

  console.log(`[recursiveReaddir] 総ファイル数: ${results.length}`);
  return results;
}

function decryptAes(key, buffer) {
  console.log(
    `[decryptAes] AES復号化: キー長=${key?.length}, データ長=${buffer.length}`
  );

  try {
    const bufferKey = Buffer.from(key, "binary");
    const result = aescfb(buffer, bufferKey);
    console.log(`[decryptAes] 復号化完了: ${result.length} bytes`);
    return result;
  } catch (error) {
    console.error("[decryptAes] AES復号化エラー:", error);
    throw error;
  }
}
