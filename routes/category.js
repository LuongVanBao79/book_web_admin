// routes/category.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.database();

// 1. HIỂN THỊ DANH SÁCH DANH MỤC
router.get("/", (req, res) => {
  const ref = db.ref("Categories"); // Lưu ý chữ C viết hoa cho khớp với Books
  ref.once("value", (snapshot) => {
    const data = snapshot.val();
    const categories = [];

    // Chuyển đổi Object sang Array để hiển thị
    if (data) {
      for (let key in data) {
        categories.push(data[key]);
      }
    }

    // Sắp xếp mới nhất lên đầu (optional)
    categories.sort((a, b) => b.timestamp - a.timestamp);

    res.render("category/index", { categories: categories });
  });
});

// 2. THÊM DANH MỤC MỚI
router.post("/add", (req, res) => {
  const timestamp = Date.now(); // Lấy thời gian hiện tại làm ID (cho giống dữ liệu cũ của bạn)
  const id = "" + timestamp; // Chuyển thành chuỗi

  const newCategory = {
    id: id,
    category: req.body.categoryName, // Tên danh mục lấy từ form
    timestamp: timestamp,
    uid: "admin", // Hoặc lấy uid của admin đang đăng nhập
  };

  db.ref("Categories")
    .child(id)
    .set(newCategory)
    .then(() => res.redirect("/categories"))
    .catch((err) => {
      console.log(err);
      res.redirect("/categories");
    });
});

// 3. SỬA DANH MỤC
router.post("/edit", (req, res) => {
  const id = req.body.id;
  const newName = req.body.categoryName;

  db.ref("Categories")
    .child(id)
    .update({
      category: newName,
    })
    .then(() => res.redirect("/categories"))
    .catch((err) => console.log(err));
});

// 4. XÓA DANH MỤC
router.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  // Lưu ý: Sau này nên check xem danh mục có sách không trước khi xóa
  db.ref("Categories")
    .child(id)
    .remove()
    .then(() => res.redirect("/categories"))
    .catch((err) => console.log(err));
});

module.exports = router;
