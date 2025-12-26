const admin = require("firebase-admin");

const checkAuth = async (req, res, next) => {
  // Lấy cookie tên là 'session'
  const sessionCookie = req.cookies.session || "";

  try {
    // Nhờ Firebase Admin xác thực cookie này có hợp lệ không
    const decodedClaims = await admin
      .auth()
      .verifySessionCookie(sessionCookie, true);

    // Nếu hợp lệ, lưu thông tin user vào biến req để dùng sau này
    req.user = decodedClaims;

    next(); // Cho phép đi tiếp vào trang admin
  } catch (error) {
    // Nếu cookie lỗi hoặc hết hạn -> Đá về trang login
    res.redirect("/login");
  }
};

module.exports = checkAuth;
