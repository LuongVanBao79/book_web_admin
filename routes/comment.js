const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.database();

// 1. IMPORT MODULE GIẢI MÃ (QUAN TRỌNG)
// Đảm bảo đường dẫn "../utils/aesUtils" là đúng với cấu trúc thư mục của bạn
const aesUtils = require("../utils/aesUtils");

// 1. XEM TẤT CẢ BÌNH LUẬN
router.get("/", async (req, res) => {
  try {
    const [booksSnapshot, usersSnapshot] = await Promise.all([
      db.ref("Books").once("value"),
      db.ref("Users").once("value"),
    ]);

    const booksData = booksSnapshot.val() || {};
    const usersData = usersSnapshot.val() || {};
    const allComments = [];

    for (let bookId in booksData) {
      const book = booksData[bookId];
      if (book.Comments) {
        const commentsInBook = book.Comments;

        for (let commentId in commentsInBook) {
          const cmt = commentsInBook[commentId];

          // --- BẮT ĐẦU ĐOẠN SỬA ---

          // Mặc định là Khách nếu không tìm thấy User
          let userName = "Khách (UID: " + cmt.uid + ")";

          if (usersData[cmt.uid]) {
            const userObj = usersData[cmt.uid];

            // 1. Lấy email và giải mã nó
            let decryptedEmail = "";
            if (userObj.email) {
              // Hàm decrypt này sẽ trả về Email thật (hoặc trả về gốc nếu chưa mã hóa)
              decryptedEmail = aesUtils.decrypt(userObj.email);
            }

            // 2. Logic ưu tiên hiển thị: Email thật -> Tên -> Mặc định
            userName = decryptedEmail || userObj.name || userName;
          }

          // --- KẾT THÚC ĐOẠN SỬA ---

          allComments.push({
            id: commentId,
            bookId: bookId,
            bookTitle: book.title,
            content: cmt.comment,
            user: userName, // Biến này giờ đã là Text đọc được
            timestamp: parseInt(cmt.timestamp),
            adminReply: cmt.adminReply || null,
          });
        }
      }
    }

    // Sắp xếp mới nhất lên đầu
    allComments.sort((a, b) => b.timestamp - a.timestamp);

    res.render("comment/index", { comments: allComments });
  } catch (error) {
    console.log(error);
    res.send("Lỗi lấy danh sách bình luận: " + error.message);
  }
});

// 2. TRẢ LỜI BÌNH LUẬN (Giữ nguyên)
router.post("/reply", async (req, res) => {
  try {
    const { bookId, commentId, replyContent } = req.body;

    await db.ref(`Books/${bookId}/Comments/${commentId}`).update({
      adminReply: replyContent,
      replyTimestamp: Date.now(),
    });

    res.redirect("/comments");
  } catch (error) {
    console.error(error);
    res.redirect("/comments");
  }
});

// 3. XÓA BÌNH LUẬN (Giữ nguyên)
router.get("/delete/:bookId/:commentId", async (req, res) => {
  try {
    const { bookId, commentId } = req.params;
    await db.ref(`Books/${bookId}/Comments/${commentId}`).remove();
    res.redirect("/comments");
  } catch (error) {
    console.log(error);
    res.redirect("/comments");
  }
});

module.exports = router;
