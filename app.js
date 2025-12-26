const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

// 1. KẾT NỐI FIREBASE ADMIN
const fs = require("fs"); // Thêm module này để kiểm tra file

let serviceAccount;

// --- LOGIC TỰ ĐỘNG TÌM KEY ---

// CÁCH 1: Tìm file ở máy Local (ngay cạnh app.js)
const localKeyPath = path.join(__dirname, "serviceAccountKey.json");

// CÁCH 2: Tìm file "Secret File" trên Render (Đường dẫn cố định của Render)
const renderSecretPath = "/etc/secrets/serviceAccountKey.json";

if (fs.existsSync(localKeyPath)) {
  // A. Nếu đang ở máy tính cá nhân
  serviceAccount = require(localKeyPath);
  console.log("✅ Đang chạy LOCAL: Đã tìm thấy serviceAccountKey.json");
} else if (fs.existsSync(renderSecretPath)) {
  // B. Nếu đang ở trên Render (đã cấu hình Secret File)
  serviceAccount = require(renderSecretPath);
  console.log("✅ Đang chạy RENDER: Đã tìm thấy Secret File tại /etc/secrets/");
} else {
  // C. Không tìm thấy đâu cả -> Lỗi
  console.error("❌ LỖI NGHIÊM TRỌNG: Không tìm thấy file Key Firebase!");
  console.error(
    "👉 Hãy tạo file serviceAccountKey.json (Local) hoặc Secret File (Render)"
  );
  process.exit(1); // Dừng Server ngay lập tức
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Thay đường link dưới bằng link Database của bạn (xem trong Firebase Console > Realtime Database)
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// 2. CẤU HÌNH SERVER
const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình view engine là EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Cấu hình đọc dữ liệu từ form
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public")); // Để load file css/js tĩnh
// app.use(bodyParser.json()); // <--- Cần thêm dòng này để đọc JSON từ fetch
app.use(bodyParser.json({ limit: "50mb" }));
app.use(cookieParser()); // <--- Kích hoạt Cookie Parser

const checkAuth = require("./middleware/authMiddleware");

// --- 1. ROUTE ĐĂNG NHẬP (Công khai - Ai cũng vào được) ---

app.get("/login", (req, res) => {
  res.render("login");
});

// Xử lý tạo Session (Nhận Token từ client gửi lên)
app.post("/sessionLogin", async (req, res) => {
  const idToken = req.body.idToken;

  // Thời gian hết hạn session: 5 ngày (đơn vị mili giây)
  const expiresIn = 60 * 60 * 24 * 5 * 1000;

  try {
    // 1. Kiểm tra Token và tạo Cookie
    const sessionCookie = await admin
      .auth()
      .createSessionCookie(idToken, { expiresIn });

    // 2. Xác thực xem User này có phải là ADMIN không? (Quan trọng)
    // Verify lại cookie vừa tạo để lấy UID
    const claims = await admin.auth().verifySessionCookie(sessionCookie);
    const uid = claims.uid;

    // Query vào Database xem userType có phải admin không
    const userSnapshot = await db.ref("Users").child(uid).once("value");
    const userData = userSnapshot.val();

    if (userData && userData.userType === "admin") {
      // Đúng là Admin -> Set Cookie vào trình duyệt
      const options = { maxAge: expiresIn, httpOnly: true, secure: false }; // secure: true nếu chạy https
      res.cookie("session", sessionCookie, options);
      res.end(JSON.stringify({ status: "success" }));
    } else {
      // Không phải Admin -> Chặn luôn
      res.status(403).send("Bạn không có quyền Admin!");
    }
  } catch (error) {
    console.log(error);
    res.status(401).send("Đăng nhập thất bại");
  }
});

// Route Đăng xuất
app.get("/logout", (req, res) => {
  res.clearCookie("session");
  res.redirect("/login");
});

// --- 2. CÁC ROUTE CẦN BẢO VỆ (Đặt sau middleware checkAuth) ---

// Áp dụng middleware cho TẤT CẢ các route bên dưới dòng này
app.use(checkAuth);

// 3. CÁC ROUTE (Đường dẫn trang web)

const categoryRoute = require("./routes/category");
const bookRoute = require("./routes/book");
const chapterRoute = require("./routes/chapter");

const commentRoute = require("./routes/comment");

// Khi user vào đường dẫn /categories thì gọi file category.js xử lý
app.use("/categories", categoryRoute);

app.use("/books", bookRoute);

app.use("/chapters", chapterRoute);

app.use("/comments", commentRoute);

// Trang chủ (Dashboard)
app.get("/", async (req, res) => {
  try {
    const [booksSnap, usersSnap, categoriesSnap] = await Promise.all([
      db.ref("Books").once("value"),
      db.ref("Users").once("value"),
      db.ref("Categories").once("value"),
    ]);

    const books = booksSnap.val() || {};
    const users = usersSnap.val() || {};
    const categories = categoriesSnap.val() || {};

    // 1. Thống kê số lượng
    const totalBooks = Object.keys(books).length;
    const totalUsers = Object.keys(users).length;
    const totalCategories = Object.keys(categories).length;

    // 2. Tính tổng lượt xem & Tìm sách hot
    let totalViews = 0;
    const bookList = [];

    for (let key in books) {
      const b = books[key];
      const views = parseInt(b.viewsCount) || 0;
      totalViews += views;

      bookList.push({
        title: b.title,
        views: views,
        img: b.imageUrl,
      });
    }

    // Sắp xếp sách theo view giảm dần để lấy Top 5
    bookList.sort((a, b) => b.views - a.views);
    const top5Books = bookList.slice(0, 10);

    res.render("home", {
      title: "Dashboard Quản Trị",
      stats: {
        books: totalBooks,
        users: totalUsers,
        categories: totalCategories,
        views: totalViews,
      },
      topBooks: top5Books,
    });
  } catch (error) {
    console.log(error);
    res.send("Lỗi tải Dashboard");
  }
});

// 4. CHẠY SERVER
app.listen(PORT, () => {
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});
