const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const PackDecryptor = require("./packDecrypter");

const minecraftFolderPath = path.join(
  "/Users/hinonaoki/Library/Application Support/mcpelauncher-aoki/"
);
const premiumCachePath = path.join(minecraftFolderPath, "premium_cache");
const worldsPath = path.join(
  minecraftFolderPath,
  "/games/com.mojang/minecraftWorlds"
);

// ---------- ワールドが暗号化されているか確認 ----------
function checkWorldEncrypted(worldPath) {
  const worldDbFolder = path.join(worldPath, "db");

  // db フォルダが存在しない or ディレクトリじゃない場合はスキップ
  if (
    !fs.existsSync(worldDbFolder) ||
    !fs.statSync(worldDbFolder).isDirectory()
  ) {
    return false;
  }

  const dbFiles = fs.readdirSync(worldDbFolder);

  for (let index = 0; index < dbFiles.length; index++) {
    if (path.extname(dbFiles[index]).toLowerCase() === ".ldb") {
      return PackDecryptor.isContentFileEncrypted(
        path.join(worldDbFolder, dbFiles[index])
      );
    }
  }
  return false;
}

// ---------- ワールド一覧を取得 ----------
function getWorlds() {
  const worlds = [];
  if (fs.existsSync(worldsPath)) {
    const files = fs.readdirSync(worldsPath).filter((f) => {
      const fullPath = path.join(worldsPath, f);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    });

    for (let index = 0; index < files.length; index++) {
      const worldPath = path.join(worldsPath, files[index]);
      const isEncrypted = checkWorldEncrypted(worldPath);
      if (!isEncrypted) continue;

      const name = fs.readFileSync(
        path.join(worldPath, "levelname.txt"),
        "utf8"
      );
      const packIcon = getPackIcon(worldPath);
      worlds.push({
        name: replaceName(name),
        packPath: worldPath,
        packIcon,
      });
    }
  }
  return worlds;
}

// ---------- Premium Cache からパックを取得 ----------
function getPremiumCache() {
  const packTypes = {};
  if (fs.existsSync(premiumCachePath)) {
    const files = fs.readdirSync(premiumCachePath).filter((f) => {
      const fullPath = path.join(premiumCachePath, f);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    });

    for (let index = 0; index < files.length; index++) {
      const dirname = files[index];
      const packs = getPacks(path.join(premiumCachePath, dirname));
      if (packs.length === 0) continue;
      packTypes[dirname] = packs;
    }
  }
  return packTypes;
}

// ---------- Pack 一覧を取得 ----------
function getPacks(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }

  const packList = fs.readdirSync(dirPath).filter((packDir) => {
    const packPath = path.join(dirPath, packDir);
    return fs.existsSync(packPath) && fs.statSync(packPath).isDirectory();
  });

  return packList.map((packDir) => {
    const packPath = path.join(dirPath, packDir);
    const packName = getPackName(packPath);
    return {
      name: replaceName(packName),
      packPath: packPath,
      packIcon: getPackIcon(packPath),
    };
  });
}

// ---------- 名前のクリーンアップ ----------
function replaceName(name) {
  return name
    .replaceAll("#", "")
    .replaceAll("?", "")
    .replaceAll("*", "")
    .replaceAll("<", "")
    .replaceAll(">", "")
    .replaceAll("|", "")
    .replaceAll(":", "")
    .replaceAll("\\", "")
    .replaceAll("/", "")
    .trim();
}

// ---------- パックアイコンを取得 ----------
function getPackIcon(packPath) {
  const packIconNames = [
    "pack_icon.png",
    "pack_icon.jpeg",
    "world_icon.jpeg",
    "world_icon.png",
  ];
  for (let index = 0; index < packIconNames.length; index++) {
    const packIconName = packIconNames[index];
    const iconPath = path.join(packPath, packIconName);
    if (fs.existsSync(iconPath)) {
      return fs.readFileSync(iconPath, "base64");
    }
  }
  return null;
}

// ---------- Pack の名前を取得 ----------
function getPackName(packPath) {
  try {
    const langFile = fs.readFileSync(
      path.join(packPath, "texts", "en_US.lang"),
      "utf8"
    );
    return langFile
      .split("\n")[0]
      .split("=")
      .at(-1)
      .replace("\n", "")
      .replace("\r", "");
  } catch (e) {
    return "Unknown Pack";
  }
}

// ---------- Electron アプリ起動 ----------
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegrationInWorker: true,
    },
  });
  win.removeMenu();
  win.loadFile("./renderer/index.html");

  // win.webContents.openDevTools({mode: 'detach'})

  ipcMain.handle("get-packs", (event) => {
    packs = { worlds: getWorlds(), ...getPremiumCache() };
    if (packs["worlds"].length == 0) delete packs["worlds"];
    return packs;
  });

  ipcMain.handle("pick-path", async (event, { path, type, name }) => {
    const filter = {};
    if (type === "world_templates") {
      filter.name = "World Template";
      filter.extensions = ["mctemplate"];
    }
    if (type === "resource_packs") {
      filter.name = "Resource Pack";
      filter.extensions = ["mcpack"];
    }
    if (type === "skin_packs") {
      filter.name = "Skin Pack";
      filter.extensions = ["mcpack"];
    }
    if (type === "persona") {
      filter.name = "Persona Piece";
      filter.extensions = ["mcpersona"];
    }
    if (type === "worlds") {
      filter.name = "World";
      filter.extensions = ["mcworld"];
    }

    const dialogReturnValue = await dialog.showSaveDialog({
      defaultPath: name,
      filters: [filter],
    });
    if (dialogReturnValue.canceled) return;
    return dialogReturnValue.filePath;
  });
});
