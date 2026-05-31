const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors()); // Cho phép Live Server hoặc Vercel gọi API không bị chặn

// ==========================================
// 1. KẾT NỐI CƠ SỞ DỮ LIỆU (MONGODB LOCAL / CLOUD)
// ==========================================
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
// 3. ĐỊNH NGHĨA CẤU TRÚC BẢNG SẢN PHẨM (PRODUCT)
// ==========================================
const ProductSchema = new mongoose.Schema({
    // Đổi kiểu dữ liệu _id thành String để nạp được mọi loại ID tự chế lẫn ID mặc định
    _id: { type: String, required: true }, 
    name: { type: String, required: true },
    price: { type: Number, required: true },
    oldPrice: { type: Number },
    discount: { type: Number, default: 0 },
    img: { type: String },       
    image: { type: String },     
    category: { type: String },
    author: { type: String },
    desc: { type: String },      
    description: { type: String } 
});
const Product = mongoose.model('Product', ProductSchema);

// ==========================================
// 4. ĐỊNH NGHĨA CẤU TRÚC BẢNG ĐƠN HÀNG (ORDER)
// ==========================================
const OrderSchema = new mongoose.Schema({
    username: { type: String, required: true },
    items: Array,
    totalAmount: Number,
    discountCode: String,
    paymentMethod: { type: String, required: true }, 
    shippingInfo: {                                  
        fullName: String,
        phone: String,
        address: String
    },
    orderStatus: { type: String, default: 'Chờ xử lý' },      
    paymentStatus: { type: String, default: 'Chờ thanh toán' }, 
    orderCode: { type: String, required: true },    
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// ==========================================
// 5. ĐỊNH NGHĨA CẤU TRÚC MÃ GIẢM GIÁ (COUPON)
// ==========================================
const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountPercent: { type: Number, required: true }, 
    applicableProducts: [String],                      
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },                           
    usageLimit: { type: Number, required: true },      
    usedCount: { type: Number, default: 0 },           
    createdAt: { type: Date, default: Date.now }
});
const Coupon = mongoose.model('Coupon', CouponSchema);


// ==========================================
// 6. HỆ THỐNG CÁC API XỬ LÝ SẢN PHẨM (ĐÃ SỬA: CHẤP NHẬN ID TỰ CHẾ)
// ==========================================

// --- [API LẤY TOÀN BỘ SẢN PHẨM] ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách sản phẩm!" });
    }
});

// --- [API LẤY CHI TIẾT 1 SẢN PHẨM THEO ID] ---
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(">>> [LOG BACKEND] Thiết bị đang yêu cầu bốc dữ liệu ID truyện:", id);

        // ĐÃ SỬA: Bỏ hàm check isValid của Mongoose để chấp nhận chuỗi tự chế "a000..." của ông
        const product = await Product.findById(id);
        
        if (!product) {
            console.log(`>>> [LOG BACKEND] Thất bại: Không tìm thấy ID ${id} trong database!`);
            return res.status(404).json({ error: "Không tìm thấy cuốn truyện này trên database!" });
        }
        
        console.log(`>>> [LOG BACKEND] Thành công: Đã tìm thấy truyện "${product.name}"!`);
        res.json(product);
    } catch (error) {
        console.error("Lỗi hệ thống Backend:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi tải chi tiết sản phẩm!" });
    }
});


// ==========================================
// 7. HỆ THỐNG CÁC API XỬ XỬ LÝ CHO KHÁCH HÀNG (CLIENT)
// ==========================================

app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, fullName } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10); 
        
        const newUser = new User({ username, password: hashedPassword, role, fullName });
        await newUser.save();
        res.status(201).json({ message: "Tạo tài khoản thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Tài khoản đã tồn tại hoặc dính lỗi hệ thống!" });
    }
});

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

app.post('/api/orders', async (req, res) => {
    try {
        const { username, items, totalAmount, discountCode, paymentMethod, shippingInfo, orderCode } = req.body;
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

app.put('/api/orders/:id/pay', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ error: "Đơn hàng không tồn tại trên hệ thống!" });
        
        const now = new Date();
        const timeDiff = (now - new Date(order.createdAt)) / 1000 / 60; 
        
        if (timeDiff > 15 || order.orderStatus === 'Hủy đơn') {
            order.orderStatus = 'Hủy đơn';
            await order.save();
            return res.status(400).json({ error: "Đơn hàng đã quá hạn 15 phút quy định và bị hệ thống hủy bỏ!" });
        }

        order.paymentStatus = 'Đã thanh toán';
        await order.save();
        res.json({ message: "Xác thực trạng thái thanh toán đơn hàng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Gặp lỗi trong quá trình cập nhật trạng thái đơn hàng!" });
    }
});


// ==========================================
// 8. HỆ THỐNG API DÀNH RIÊNG CHO QUẢN TRỊ (ADMIN)
// ==========================================

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); 
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách người dùng!" });
    }
});

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

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách đơn hàng!" });
    }
});

app.put('/api/admin/orders/:id/update-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body; 
        
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

app.get('/api/admin/customer-stats', async (req, res) => {
    try {
        const stats = await Order.aggregate([
            {
                $group: {
                    _id: "$username", 
                    totalOrders: {
                        $sum: { $cond: [{ $ne: ["$orderStatus", "Hủy đơn"] }, 1, 0] }
                    },
                    canceledOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "Hủy đơn"] }, 1, 0] }
                    },
                    totalSpent: {
                        $sum: { $cond: [{ $eq: ["$paymentStatus", "Đã thanh toán"] }, "$totalAmount", 0] }
                    }
                }
            },
            { $sort: { totalOrders: -1 } } 
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy thống kê khách hàng!" });
    }
});

app.get('/api/admin/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách coupon!" });
    }
});

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

app.delete('/api/admin/coupons/:id', async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa coupon thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống, không thể xóa coupon!" });
    }
});

// ==========================================
// 9. KHỞI CHẠY HỆ THỐNG MÁY CHỦ
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`>>> Server Back-end đang chạy ổn định ở cổng ${PORT}`));