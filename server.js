const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors()); // Cho phép Live Server (cổng 5500) hoặc Vercel gọi API không bị chặn

// ==========================================
// 1. KẾT NỐI CƠ SỞ DỮ LIỆU (MONGODB LOCAL / CLOUD)
// ==========================================
// ĐÃ SỬA: Sử dụng biến môi trường process.env.MONGO_URI để nạp chuỗi MongoDB Atlas khi lên Render
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/Mangic";

mongoose.connect(mongoURI)
    .then(() => console.log(">>> Đã kết nối Database MongoDB thành công!"))
    .catch(err => console.log("Lỗi kết nối DB:", err));

// ==========================================
// 2. ĐỊNH NGHĨA CẤU TRÚC BẢNG TÀI KHOẢN (USER)
// ==========================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    fullName: String
});
const User = mongoose.model('User', UserSchema);

// ==========================================
// 3. ĐỊNH NGHĨA CẤU TRÚC BẢNG ĐƠN HÀNG MỚI (ORDER)
// ==========================================
const OrderSchema = new mongoose.Schema({
    username: { type: String, required: true },
    items: Array,
    totalAmount: Number,
    discountCode: String,
    paymentMethod: { type: String, required: true }, // Nhận giá trị 'COD' hoặc 'QR'
    shippingInfo: {                                  // Lưu thông tin nhận hàng chi tiết
        fullName: String,
        phone: String,
        address: String
    },
    // Tách làm 2 trường độc lập chuẩn hệ thống thương mại điện tử
    orderStatus: { type: String, default: 'Chờ xử lý' },      // Chờ xử lý, Đang giao, Giao hàng thành công, Hủy đơn
    paymentStatus: { type: String, default: 'Chờ thanh toán' }, // Chờ thanh toán, Đã thanh toán
    orderCode: { type: String, required: true },    // Mã đối chiếu đơn hàng mẫu (MGCxxxxxx)
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// ==========================================
// 3.5. ĐỊNH NGHĨA CẤU TRÚC MÃ GIẢM GIÁ (COUPON)
// ==========================================
const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountPercent: { type: Number, required: true }, // % giảm giá
    applicableProducts: [String],                      // Mảng chứa ID/Key của truyện áp dụng
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },                           // Có thể null (dùng đến khi hết số lượng)
    usageLimit: { type: Number, required: true },      // Tổng số lượng mã phát ra
    usedCount: { type: Number, default: 0 },           // Số lượng đã sử dụng
    createdAt: { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', CouponSchema);

// ==========================================
// 4. HỆ THỐNG CÁC API XỬ LÝ CHO KHÁCH HÀNG (CLIENT)
// ==========================================

// --- [API ĐĂNG KÝ TÀI KHOẢN] ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, fullName } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10); // Mã hóa bảo mật mật khẩu
        
        const newUser = new User({ username, password: hashedPassword, role, fullName });
        await newUser.save();
        res.status(201).json({ message: "Tạo tài khoản thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Tài khoản đã tồn tại hoặc dính lỗi hệ thống!" });
    }
});

// --- [API ĐĂNG NHẬP HỆ THỐNG] ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).json({ error: "Tài khoản không tồn tại trên hệ thống!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại." });
    }

    res.json({
        message: "Đăng nhập thành công!",
        user: {
            username: user.username,
            role: user.role,
            fullName: user.fullName
        }
    });
});

// --- [API LẤY TOÀN BỘ USER - QUẢN TRỊ ADMIN] ---
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Ẩn mật khẩu để bảo mật dữ liệu
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách người dùng!" });
    }
});

// --- [API XÓA USER - QUẢN TRỊ ADMIN] ---
app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (username === 'admin') {
            return res.status(400).json({ error: "Không thể xóa tài khoản Admin tối cao!" });
        }

        await User.findOneAndDelete({ username });
        res.json({ message: "Đã xóa người dùng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống, không thể xóa user!" });
    }
});

// --- [API KHỞI TẠO ĐƠN HÀNG TRÊN TRANG THANH TOÁN CLIENT] ---
app.post('/api/orders', async (req, res) => {
    try {
        const { username, items, totalAmount, discountCode, paymentMethod, shippingInfo, orderCode } = req.body;
        
        // TỰ ĐỘNG HÓA: Nếu điền QR thì mặc định Đã thanh toán, nếu COD thì Chờ thanh toán
        const initialPayStatus = (paymentMethod === 'QR') ? 'Đã thanh toán' : 'Chờ thanh toán';
        const initialOrderStatus = 'Chờ xử lý';

        const newOrder = new Order({ 
            username, items, totalAmount, discountCode, paymentMethod, shippingInfo, orderCode,
            orderStatus: initialOrderStatus,
            paymentStatus: initialPayStatus
        });
        
        await newOrder.save();
        res.status(201).json({ message: "Khởi tạo đơn hàng thành công!", orderId: newOrder._id });
    } catch (error) {
        res.status(500).json({ error: "Không thể khởi tạo đơn hàng!" });
    }
});

// --- [API CẬP NHẬT TRẠNG THÁI KHÁCH BẤM XÁC NHẬN QR TRÊN CLIENT] ---
app.put('/api/orders/:id/pay', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        
        if (!order) return res.status(404).json({ error: "Đơn hàng không tồn tại trên hệ thống!" });
        
        // Kiểm tra thời gian đếm ngược 15 phút thực tế của máy chủ
        const now = new Date();
        const timeDiff = (now - new Date(order.createdAt)) / 1000 / 60; // Quy đổi ra số phút
        
        if (timeDiff > 15 || order.orderStatus === 'Hủy đơn') {
            order.orderStatus = 'Hủy đơn';
            await order.save();
            return res.status(400).json({ error: "Đơn hàng đã quá hạn 15 phút quy định và bị hệ thống hủy bỏ!" });
        }

        // Khách quét QR thành công thì cập nhật trạng thái thanh toán
        order.paymentStatus = 'Đã thanh toán';
        await order.save();
        res.json({ message: "Xác thực trạng thái thanh toán đơn hàng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Gặp lỗi trong quá trình cập nhật trạng thái đơn hàng!" });
    }
});

// --- [API LẤY LỊCH SỬ ĐƠN HÀNG CỦA RIÊNG USER ĐANG ĐĂNG NHẬP] ---
app.get('/api/orders/history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const userOrders = await Order.find({ username }).sort({ createdAt: -1 });
        res.json(userOrders);
    } catch (error) {
        console.error("Lỗi lấy lịch sử đơn hàng:", error);
        res.status(500).json({ error: "Không thể tải lịch sử đơn hàng của người dùng!" });
    }
});


// ==========================================
// 5. HỆ THỐNG API DÀNH RIÊNG CHO QUẢN TRỊ (ADMIN)
// ==========================================

// --- [API 1: LẤY TOÀN BỘ ĐƠN HÀNG HỆ THỐNG] ---
app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách đơn hàng!" });
    }
});

// --- [API 2: CẬP NHẬT TÁCH BIỆT 2 LOẠI TRẠNG THÁI THỦ CÔNG] ---
app.put('/api/admin/orders/:id/update-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body; // Nhận tách biệt lẻ từng trường từ Admin gửi lên
        
        const updateData = {};
        if (orderStatus) updateData.orderStatus = orderStatus;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;

        const order = await Order.findByIdAndUpdate(id, updateData, { new: true });
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        
        res.json({ message: "Cập nhật dữ liệu trạng thái đơn hàng thành công!", order });
    } catch (error) {
        res.status(500).json({ error: "Lỗi cập nhật trạng thái hệ thống!" });
    }
});

// --- [API 3: THỐNG KÊ TÁCH BIỆT ĐƠN ĐẶT / ĐƠN HỦY THEO KHÁCH HÀNG] ---
app.get('/api/admin/customer-stats', async (req, res) => {
    try {
        const stats = await Order.aggregate([
            {
                $group: {
                    _id: "$username", // Gom dữ liệu theo từng tài khoản khách
                    // 1. Đếm tổng số đơn hợp lệ (Mọi trạng thái khác 'Hủy đơn')
                    totalOrders: {
                        $sum: { $cond: [{ $ne: ["$orderStatus", "Hủy đơn"] }, 1, 0] }
                    },
                    // 2. Đếm tổng số đơn bị hủy (Trạng thái bằng 'Hủy đơn')
                    canceledOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "Hủy đơn"] }, 1, 0] }
                    },
                    // 3. Chỉ cộng dồn số tiền tích lũy từ những đơn đã thu tiền thành công ('Đã thanh toán')
                    totalSpent: {
                        $sum: { $cond: [{ $eq: ["$paymentStatus", "Đã thanh toán"] }, "$totalAmount", 0] }
                    }
                }
            },
            { $sort: { totalOrders: -1 } } // Sắp xếp khách mua nhiều đơn lên trước
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy thống kê khách hàng!" });
    }
});

// --- [API 4: QUẢN LÝ COUPON - LẤY DANH SÁCH] ---
app.get('/api/admin/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách coupon!" });
    }
});

// --- [API 5: QUẢN LÝ COUPON - TẠO MỚI] ---
app.post('/api/admin/coupons', async (req, res) => {
    try {
        const { code, discountPercent, applicableProducts, startDate, endDate, usageLimit } = req.body;
        const newCoupon = new Coupon({ 
            code, discountPercent, applicableProducts, startDate, endDate, usageLimit 
        });
        await newCoupon.save();
        res.status(201).json({ message: "Tạo coupon thành công!", coupon: newCoupon });
    } catch (error) {
        res.status(500).json({ error: "Lỗi tạo coupon hoặc mã đã tồn tại!" });
    }
});

// --- [API TỰ ĐỘNG TĂNG SỐ LƯỢT DÙNG CỦA COUPON LÊN +1 KHI ĐẶT HÀNG THÀNH CÔNG] ---
app.put('/api/admin/coupons/use', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Thiếu mã coupon!" });

        const coupon = await Coupon.findOneAndUpdate(
            { code: code.toUpperCase() },
            { $inc: { usedCount: 1 } },
            { new: true }
        );

        if (!coupon) return res.status(404).json({ error: "Không tìm thấy mã giảm giá!" });
        res.json({ message: "Khấu trừ lượt dùng coupon thành công!", coupon });
    } catch (error) {
        res.status(500).json({ error: "Không thể cập nhật lượt dùng mã giảm giá!" });
    }
});

// --- [API 6: QUẢN LÝ COUPON - XÓA] ---
app.delete('/api/admin/coupons/:id', async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa coupon thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống, không thể xóa coupon!" });
    }
});

// ==========================================
// 6. KHỞI CHẠY HỆ THỐNG MÁY CHỦ
// ==========================================
// ĐÃ SỬA: Cấu hình cổng động linh hoạt thông qua biến môi trường process.env.PORT để thích ứng với mọi hạ tầng Cloud
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`>>> Server Back-end đang chạy ổn định ở cổng ${PORT}`));