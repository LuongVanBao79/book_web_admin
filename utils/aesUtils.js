// file: utils/aesUtils.js
const crypto = require("crypto");

const RAW_STRING = process.env.AES_SECRET;

const SECRET_KEY = Buffer.from(RAW_STRING, "utf8").subarray(0, 32);

const ALGORITHM = "aes-256-gcm";

module.exports = {
  // Hàm mã hóa: Dùng khi Admin thêm/sửa chương
  encrypt: (text) => {
    if (!text) return "";
    try {
      // a. Tạo IV ngẫu nhiên 12 byte (Giống Kotlin: ByteArray(12))
      const iv = crypto.randomBytes(12);

      // b. Khởi tạo Cipher
      const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

      // c. Mã hóa
      let encrypted = cipher.update(text, "utf8");
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // d. Lấy Auth Tag (16 byte - Android tự động thêm cái này vào cuối, Node phải lấy thủ công)
      const authTag = cipher.getAuthTag();

      // e. Đóng gói giống hệt Android: [IV (12)] + [Encrypted Content] + [Auth Tag (16)]
      // Bên Android: ByteBuffer.allocate(iv.size + cipherText.size)...put(iv).put(cipherText)
      // Lưu ý: Java GCM tự động gắn Tag vào cuối cipherText, nên ta phải gắn Tag vào cuối ở đây.
      const payload = Buffer.concat([iv, encrypted, authTag]);

      // f. Trả về Base64
      return payload.toString("base64");
    } catch (error) {
      console.error("Lỗi mã hóa Node.js:", error);
      return text;
    }
  },

  // Hàm giải mã: Dùng để Admin xem lại nội dung
  decrypt: (cipherTextBase64) => {
    if (!cipherTextBase64) return "";
    try {
      // a. Giải nén Base64 ra Buffer
      const payload = Buffer.from(cipherTextBase64, "base64");

      // b. Tách các thành phần ra (Ngược lại với lúc đóng gói)
      // - 12 byte đầu là IV
      const iv = payload.subarray(0, 12);

      // - 16 byte cuối là Auth Tag
      const authTag = payload.subarray(payload.length - 16);

      // - Phần ở giữa là nội dung đã mã hóa
      const encrypted = payload.subarray(12, payload.length - 16);

      // c. Khởi tạo Decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);

      // d. Cài đặt Auth Tag (Bắt buộc với GCM để chống giả mạo)
      decipher.setAuthTag(authTag);

      // e. Giải mã
      let decrypted = decipher.update(encrypted, null, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error(
        "Lỗi giải mã Node.js (Có thể do sai Key hoặc sai định dạng):",
        error.message
      );
      // Trả về nguyên gốc nếu không giải mã được (để tránh crash web admin)
      return cipherTextBase64;
    }
  },
};
