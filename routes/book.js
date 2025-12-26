const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.database();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// --- 1. CẤU HÌNH CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- 2. CẤU HÌNH MULTER ---
// Lưu file vào RAM (buffer) trước khi upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
});

// --- 3. HÀM UPLOAD LÊN CLOUDINARY ---
// Vì upload stream là bất đồng bộ kiểu cũ, ta gói nó vào Promise để dùng async/await cho gọn
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "Covers" }, // Tự động tạo folder 'Covers' trên Cloudinary
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// --- 4. CÁC ROUTE ---

// API: Lấy danh sách sách
router.get("/", async (req, res) => {
  try {
    const booksSnapshot = await db.ref("Books").once("value");
    const booksData = booksSnapshot.val();

    const cateSnapshot = await db.ref("Categories").once("value");
    const categories = cateSnapshot.val() || {};

    const books = [];
    if (booksData) {
      for (let key in booksData) {
        const book = booksData[key];
        // Map tên danh mục
        const cateName = categories[book.categoryId]
          ? categories[book.categoryId].category
          : "Chưa phân loại";

        books.push({
          ...book,
          categoryName: cateName,
        });
      }
    }

    // Sắp xếp theo thời gian giảm dần
    books.sort((a, b) => b.timestamp - a.timestamp);

    // Chuẩn bị list danh mục cho Modal thêm mới
    const categoriesList = [];
    for (let key in categories) categoriesList.push(categories[key]);

    res.render("book/index", { books: books, categories: categoriesList });
  } catch (error) {
    console.log(error);
    res.send("Lỗi lấy dữ liệu: " + error.message);
  }
});

// API: Thêm sách mới (Upload lên Cloudinary)
router.post("/add", upload.single("coverImage"), async (req, res) => {
  try {
    const timestamp = Date.now();
    const id = "" + timestamp;

    let imageUrl = "https://via.placeholder.com/150"; // Ảnh mặc định

    // Nếu người dùng có chọn ảnh
    if (req.file) {
      // Gọi hàm upload lên Cloudinary
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url; // Lấy link https an toàn
    }

    const newBook = {
      id: id,
      title: req.body.title,
      author: req.body.author,
      description: req.body.description,
      categoryId: req.body.categoryId,
      imageUrl: imageUrl, // Link từ Cloudinary
      viewsCount: 0,
      downloadsCount: 0,
      timestamp: timestamp,
    };

    // Lưu vào Firebase
    await db.ref("Books").child(id).set(newBook);

    console.log("Đã thêm sách thành công: " + newBook.title);
    res.redirect("/books");
  } catch (error) {
    console.log("Lỗi thêm sách:", error);
    res.send("Có lỗi xảy ra khi upload ảnh hoặc lưu dữ liệu.");
  }
});

// API: Xóa sách
router.get("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    // Xóa thông tin trong DB
    await db.ref("Books").child(id).remove();

    // Lưu ý: Code này chưa xóa ảnh trên Cloudinary để tránh phức tạp.
    // Nếu muốn xóa cả ảnh, bạn cần lưu public_id của Cloudinary vào DB lúc upload.

    res.redirect("/books");
  } catch (error) {
    console.log(error);
    res.redirect("/books");
  }
});

module.exports = router;
