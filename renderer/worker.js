const PackDecryptor = require("../packDecrypter");

self.addEventListener("message", async function (e) {
  const decryptor = new PackDecryptor(e.data.path, e.data.outPath);

  try {
    await decryptor.start();
    self.postMessage("end");
  } catch (err) {
    console.error("Decryptor error:", err);
    // 失敗でも queue を止めないように "end" を返す
    self.postMessage("end");
  }
});
