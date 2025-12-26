const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.database();

// Import bộ mã hóa vừa tạo
const aesUtils = require("../utils/aesUtils"); // <--- MỚI THÊM

// 1. XEM DANH SÁCH CHƯƠNG CỦA 1 CUỐN SÁCH
router.get("/:bookId", async (req, res) => {
  try {
    const bookId = req.params.bookId;

    const bookSnapshot = await db.ref("Books").child(bookId).once("value");
    const book = bookSnapshot.val();

    if (!book) {
      return res.send("Không tìm thấy sách!");
    }

    const chaptersSnapshot = await db
      .ref("Chapters")
      .child(bookId)
      .once("value");
    const chaptersData = chaptersSnapshot.val();

    const chapters = [];
    if (chaptersData) {
      for (let key in chaptersData) {
        let chapter = chaptersData[key];

        // <--- MỚI THÊM: Giải mã nội dung để Admin đọc được
        // (Chỉ giải mã lúc hiển thị, trên DB vẫn là mã hóa)
        chapter.content = aesUtils.decrypt(chapter.content);

        chapters.push(chapter);
      }
    }

    chapters.sort((a, b) => a.timestamp - b.timestamp);

    res.render("chapter/index", { book: book, chapters: chapters });
  } catch (error) {
    console.log(error);
    res.send("Lỗi lấy dữ liệu chương.");
  }
});

// 2. THÊM CHƯƠNG MỚI (Lưu Text đã mã hóa)
router.post("/add", async (req, res) => {
  try {
    const bookId = req.body.bookId;
    const timestamp = Date.now();
    const chapterId = "" + timestamp;

    // <--- MỚI THÊM: Mã hóa nội dung trước khi lưu
    const encryptedContent = aesUtils.encrypt(req.body.content);

    const newChapter = {
      id: chapterId,
      bookId: bookId,
      title: req.body.title,
      content: encryptedContent, // <--- Lưu bản mã hóa
      timestamp: timestamp,
    };

    await db.ref("Chapters").child(bookId).child(chapterId).set(newChapter);

    res.redirect("/chapters/" + bookId);
  } catch (error) {
    console.log(error);
    res.send("Lỗi thêm chương.");
  }
});

// 3. SỬA CHƯƠNG (Cập nhật Text mã hóa)
router.post("/edit", async (req, res) => {
  try {
    const bookId = req.body.bookId;
    const chapterId = req.body.chapterId;

    // <--- MỚI THÊM: Mã hóa nội dung mới trước khi cập nhật
    const encryptedContent = aesUtils.encrypt(req.body.content);

    await db.ref("Chapters").child(bookId).child(chapterId).update({
      title: req.body.title,
      content: encryptedContent, // <--- Lưu bản mã hóa
    });

    res.redirect("/chapters/" + bookId);
  } catch (error) {
    console.log(error);
    res.send("Lỗi sửa chương.");
  }
});

// 4. XÓA CHƯƠNG (Giữ nguyên)
router.get("/delete/:bookId/:chapterId", async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const chapterId = req.params.chapterId;
    await db.ref("Chapters").child(bookId).child(chapterId).remove();
    res.redirect("/chapters/" + bookId);
  } catch (error) {
    console.log(error);
    res.redirect("/books");
  }
});

module.exports = router;
