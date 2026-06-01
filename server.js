const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors()); // Cho phép Live Server hoặc Vercel gọi API không bị chặn

// --- [BỔ SUNG CẤU HÌNH REALTIME: HTTP SERVER & SOCKET.IO] ---
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // 🔥 ĐÃ SỬA: Khai báo đích danh các domain được phép kết nối để Browser không chặn luồng chat
        origin: [
            "http://127.0.0.1:5500",        // Link chạy máy nhà Live Server
            "http://localhost:5500",
            "https://mangic.vercel.app" // 🌟 THAY BẰNG LINK VERCEL THỰC TẾ CỦA ÔNG ÔNG DUY NHÉ
        ],
        methods: ["GET", "POST"],
        credentials: true // Cho phép truyền nhận định danh an toàn giữa Vercel và Render
    }
});

// ==========================================
// 1. KẾT NỐI CƠ SỞ DỮ LIỆU (MONGODB LOCAL / CLOUD)
// ==========================================
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/Mangic";

mongoose.connect(mongoURI)
    .then(() => console.log(">>> Đã kết nối Database MongoDB thành công!"))
    .catch(err => console.log("Lỗi kết nối DB:", err));

// ==========================================
// 2. ĐỊNH NGHĨA CẤU TRÚC BẢNG TÀI KHOẢN (USER) - THEO DÕI ACTIVE TRỰC TUYẾN
// ==========================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    fullName: String,
    isOnline: { type: Boolean, default: false },       // Tình trạng online/offline
    lastActive: { type: Date, default: Date.now }       // Thời gian tương tác cuối cùng
});
const User = mongoose.model('User', UserSchema);

// ==========================================
// 3. ĐỊNH NGHĨA CẤU TRÚC BẢNG SẢN PHẨM (PRODUCT)
// ==========================================
const ProductSchema = new mongoose.Schema({
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
// 6. ĐỊNH NGHĨA CẤU TRÚC BẢNG THEO DÕI TRAFFIC & CLICKS
// ==========================================
const TrafficSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // Định dạng ngày "YYYY-MM-DD"
    visits: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
});
const Traffic = mongoose.model('Traffic', TrafficSchema);

// ==========================================
// 7. ĐỊNH NGHĨA CẤU TRÚC NHẬT KÝ TRUY CẬP (ACTIVITY LOG)
// ==========================================
const UserActivitySchema = new mongoose.Schema({
    username: { type: String, default: "Khách vãng lai" },
    action: { type: String, required: true },             
    details: String,                                      
    createdAt: { type: Date, default: Date.now }
});
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);

// ==========================================
// [BỔ SUNG SCHEMA] ĐỊNH NGHĨA CẤU TRÚC CƠ SỞ DỮ LIỆU TIN NHẮN CHAT REALTIME
// ==========================================
const MessageSchema = new mongoose.Schema({
    username: { type: String, required: true }, // Phòng chat định danh theo username của khách
    sender: { type: String, required: true },   // Định danh người gửi: 'customer' hoặc 'admin'
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);


// ==========================================
// SYSTEM API: QUẢN LÝ SẢN PHẨM KHÔNG DÙNG OBJECTID MẶC ĐỊNH
// ==========================================

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách sản phẩm!" });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(">>> [LOG BACKEND] Thiết bị đang yêu cầu bốc dữ liệu ID truyện:", id);

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
// USER & CORE API: CÁC TIẾN TRÌNH CHO CLIENT KHÁCH HÀNG
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

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

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
        
        const initialPayStatus = paymentMethod === 'COD' ? 'Chờ thanh toán COD' : 'Chờ thanh toán';
        const initialOrderStatus = 'Chờ xử lý';

        const newOrder = new Order({ 
            username, 
            items, 
            totalAmount, 
            discountCode, 
            paymentMethod, 
            shippingInfo, 
            orderCode: String(orderCode).trim(), 
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
            order.paymentStatus = 'Thất bại'; 
            await order.save();
            return res.status(400).json({ error: "Đơn hàng đã quá hạn 15 phút quy định và bị hệ thống hủy bỏ!" });
        }

        order.paymentStatus = 'Đã thanh toán';
        order.orderStatus = 'Đang giao'; 
        await order.save();
        res.json({ message: "Xác thực trạng thái thanh toán đơn hàng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Gặp lỗi trong quá trình cập nhật trạng thái đơn hàng!" });
    }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        
        if (!order) {
            return res.status(404).json({ error: "Đơn hàng yêu cầu xử lý hủy không tồn tại!" });
        }

        if (order.paymentMethod !== 'COD') {
            return res.status(400).json({ error: "Hệ thống không hỗ trợ tự hủy đơn hàng QR Online. Vui lòng liên hệ Admin để xử lý hoàn tiền!" });
        }

        if (order.orderStatus !== 'Chờ xử lý') {
            return res.status(400).json({ error: `Đơn hàng đã chuyển sang trạng thái [${order.orderStatus}], không thể tự hủy!` });
        }

        order.orderStatus = 'Hủy đơn';
        order.paymentStatus = 'Thất bại'; 
        await order.save();

        const cancelLog = new UserActivity({
            username: order.username,
            action: "Khách hủy đơn",
            details: `User @${order.username} đã chủ động hủy hóa đơn COD mã ${order.orderCode} thành công.`
        });
        await cancelLog.save();

        res.json({ message: "Hủy đơn hàng thành công!", order });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ không thể xử lý tiến trình hủy đơn!" });
    }
});

// --- [API MỚI: BỐC LẠI LỊCH SỬ TIN NHẮN CŨ KHI USER/ADMIN REFRESH TRANG] ---
app.get('/api/chat/history/:username', async (req, res) => {
    try {
        const messages = await Message.find({ username: req.params.username }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: "Không thể tải lịch sử cuộc trò chuyện!" });
    }
});

app.post('/api/analytics/track', async (req, res) => {
    try {
        const { type, username, details } = req.body;
        const today = new Date().toISOString().split('T')[0];

        const updateData = {};
        if (type === 'visit') updateData.$inc = { visits: 1 };
        if (type === 'click') updateData.$inc = { clicks: 1 };

        await Traffic.findOneAndUpdate(
            { date: today },
            updateData,
            { upsert: true, new: true }
        );

        const newActivity = new UserActivity({
            username: username || "Khách vãng lai",
            action: type === 'visit' ? "Truy cập hệ thống" : "Tương tác click chuột",
            details: details || "Người dùng tương tác phần mềm"
        });
        await newActivity.save();

        if (username && username !== "Khách vãng lai") {
            await User.findOneAndUpdate(
                { username },
                { isOnline: true, lastActive: new Date() }
            );
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Lỗi ghi nhận thống kê hệ thống!" });
    }
});

app.post('/api/auth/logout-status', async (req, res) => {
    try {
        const { username } = req.body;
        if (username) {
            await User.findOneAndUpdate({ username }, { isOnline: false, lastActive: new Date() });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Lỗi đồng bộ trạng thái đăng xuất!" });
    }
});


// ==========================================
// 8. HỆ THỐNG API DÀNH RIÊNG CHO QUẢN TRỊ (ADMIN) - BẢN NÂNG CẤP CHUYÊN NGHIỆP CRM
// ==========================================

app.get('/api/admin/dashboard-stats', async (req, res) => {
    try {
        const paidOrders = await Order.find({ paymentStatus: 'Đã thanh toán' });
        const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        const trafficData = await Traffic.find({});
        const totalVisits = trafficData.reduce((sum, t) => sum + t.visits, 0);
        const totalClicks = trafficData.reduce((sum, t) => sum + t.clicks, 0);

        const onlineUsersCount = await User.countDocuments({ isOnline: true });

        const chartData = await Traffic.find({}).sort({ date: -1 }).limit(7);
        chartData.reverse(); 

        res.json({
            totalRevenue,
            totalVisits,
            totalClicks,
            onlineUsersCount,
            chartTimeline: chartData 
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy dữ liệu tổng hợp Admin!" });
    }
});

app.get('/api/admin/recent-activities', async (req, res) => {
    try {
        const activities = await UserActivity.find().sort({ createdAt: -1 }).limit(20);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: "Không thể tải lịch sử truy cập!" });
    }
});

app.get('/api/admin/customer-stats', async (req, res) => {
    try {
        const users = await User.find({}, '-password');

        const stats = await Promise.all(users.map(async (user) => {
            const totalOrders = await Order.countDocuments({ username: user.username, orderStatus: { $ne: 'Hủy đơn' } });
            const canceledOrders = await Order.countDocuments({ username: user.username, orderStatus: 'Hủy đơn' });
            
            const paidOrders = await Order.find({ username: user.username, paymentStatus: 'Đã thanh toán' });
            const totalSpent = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            let rank = "Thành viên Đồng 🥉";
            if (totalSpent >= 500000) rank = "Thành viên Bạc 🥈";
            if (totalSpent >= 1500000) rank = "Thành viên Vàng 🥇";
            if (totalSpent >= 3000000) rank = "Thành viên Kim Cương 💎";

            return {
                username: user.username,
                fullName: user.fullName || "Người dùng mới",
                role: user.role,
                totalOrders,
                canceledOrders,
                totalSpent,
                rank
            };
        }));

        stats.sort((a, b) => b.totalSpent - a.totalSpent);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Không thể xử lý bảng thống kê khách hàng nâng cao!" });
    }
});

app.get('/api/admin/users-status', async (req, res) => {
    try {
        const users = await User.find({}, 'username fullName role isOnline lastActive');
        const now = new Date();
        const timeoutLimit = 30 * 1000; 

        const updatedUsers = await Promise.all(users.map(async (user) => {
            const timeDiff = now - new Date(user.lastActive);
            if (user.isOnline && timeDiff > timeoutLimit) {
                user.isOnline = false; 
                await User.updateOne({ _id: user._id }, { isOnline: false }); 
            }
            return user;
        }));

        updatedUsers.sort((a, b) => {
            if (a.isOnline === b.isOnline) {
                return new Date(b.lastActive) - new Date(a.lastActive);
            }
            return b.isOnline - a.isOnline;
        });

        res.json(updatedUsers);
    } catch (error) {
        console.error("Lỗi đồng bộ trạng thái tài khoản:", error);
        res.status(500).json({ error: "Không thể lấy trạng thái các tài khoản!" });
    }
});

app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (username === 'admin') {
            return res.status(400).json({ error: "Không thể xóa tài khoản Admin tối cao!" });
        }
        
        const deletedUser = await User.findOneAndDelete({ username });
        if (!deletedUser) {
            return res.status(404).json({ error: "Tài khoản không tồn tại trên hệ thống!" });
        }
        res.json({ message: "Đã xóa người dùng khỏi hệ thống thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống, không thể xóa user!" });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: "Không thể lấy danh sách đơn hàng!" });
    }
});

app.put('/api/admin/orders/:id/update-status', async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body; 
        
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng trên hệ thống!" });
        
        if (order.orderStatus === 'Hủy đơn' && orderStatus !== 'Hủy đơn') {
            return res.status(400).json({ error: "Đơn hàng đã hủy bỏ, không thể chuyển đổi trạng thái!" });
        }
        if (order.orderStatus === 'Đã giao') {
            return res.status(400).json({ error: "Đơn hàng đã hoàn tất giao hàng thành công, không cho phép chỉnh sửa!" });
        }

        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        if (order.orderStatus === 'Đã giao') {
            order.paymentStatus = 'Đã thanh toán'; 
        }

        if (order.orderStatus === 'Hủy đơn') {
            order.paymentStatus = 'Thất bại'; 
        }

        await order.save();

        const adminLog = new UserActivity({
            username: "Hệ thống Quản trị",
            action: "Chỉnh sửa đơn hàng",
            details: `Cập nhật đơn hàng ${order.orderCode} -> Vận chuyển: [${order.orderStatus}], Tiền hàng: [${order.paymentStatus}].`
        });
        await adminLog.save();
        
        res.json({ message: "Điều chỉnh thông tin và trạng thái đơn hàng thành công!", order });
    } catch (error) {
        res.status(500).json({ error: "Lỗi cập nhật trạng thái hệ thống!" });
    }
});

// --- [API QUẢN LÝ COUPON] ---
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
// ENDPOINT WEBHOOK TỰ ĐỘNG XÁC THỰC THANH TOÁN (REALTIME PAYMENT AUTOMATION)
// ==========================================
app.post('/api/webhook/payment', async (req, res) => {
    try {
        const paymentData = req.body; 
        console.log(">>> [WEBHOOK RECEIVED] Tín hiệu biến động số dư nhận được:", paymentData);

        const orderCode = paymentData.orderCode || (paymentData.data && paymentData.data.orderCode) || paymentData.content; 
        const amountPaid = paymentData.amount || (paymentData.data && paymentData.data.amount);

        if (!orderCode) {
            return res.status(400).json({ error: "Webhook thất bại: Không bốc được trường orderCode đối chiếu đơn!" });
        }

        const cleanOrderCode = String(orderCode).trim();
        const order = await Order.findOne({ orderCode: cleanOrderCode });

        if (!order) {
            console.log(`>>> [WEBHOOK ERROR] Không tìm thấy đơn hàng mã [${cleanOrderCode}] trong Database!`);
            return res.status(404).json({ error: "Đơn hàng đối chiếu Webhook không tồn tại!" });
        }

        if (order.paymentStatus === 'Đã thanh toán') {
            return res.json({ success: true, message: "Đơn hàng này đã hoàn tất thanh toán từ trước." });
        }

        order.paymentStatus = 'Đã thanh toán';
        order.orderStatus = 'Đang giao'; 
        await order.save();

        console.log(`>>> [WEBHOOK SUCCESS] Đơn hàng [${cleanOrderCode}] đã được tự động duyệt THÀNH CÔNG!`);

        const paymentLog = new UserActivity({
            username: order.username || "Hệ thống tự động",
            action: "Thanh toán tự động",
            details: `Hóa đơn ${cleanOrderCode} tự động xác thực qua Webhook. Số tiền: ${Number(amountPaid || order.totalAmount).toLocaleString()} VND.`
        });
        await paymentLog.save();

        res.status(200).json({ success: true, message: "Webhook xử lý tự động hóa hóa đơn thành công!" });

    } catch (error) {
        console.error(">>> [WEBHOOK CRITICAL ERROR] Sập luồng Webhook:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi xử lý tự động hóa Webhook!" });
    }
});

// ==========================================
// 8b. ĐIỀU PHỐI LUỒNG TIN NHẮN REALTIME (SOCKET.IO ROUTING)
// ==========================================
io.on('connection', (socket) => {
    console.log(`>>> [SOCKET CONNECTED] Thiết bị mới tham gia kênh chat: ${socket.id}`);

    // Khi Client (User hoặc Admin) đăng ký tham gia phòng chat riêng biệt của khách
    socket.on('join_room', (username) => {
        socket.join(username);
        console.log(`>>> [SOCKET ROOM] Kênh hội thoại riêng [@${username}] đã được thiết lập ổn định!`);
    });

    // Lắng nghe sự kiện truyền tải tin nhắn từ hai đầu hệ thống
    socket.on('send_message', async (data) => {
        try {
            const { username, sender, text } = data;

            // Tiến hành ghi nhớ và lưu trữ tin nhắn vào cụm database MongoDB Atlas
            const newMessage = new Message({ username, sender, text });
            await newMessage.save();

            // Đẩy tin nhắn realtime lập tức đến đúng phòng chat định danh
            io.to(username).emit('receive_message', newMessage);
        } catch (err) {
            console.error("Lỗi phân phối tin nhắn socket:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`>>> [SOCKET DISCONNECTED] Thiết bị ngắt kết nối hội thoại: ${socket.id}`);
    });
});
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY); // Lấy key ở aistudio.google.com

// [SỬA ĐOẠN API AI-CHAT NÀY]
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ reply: "Bạn chưa nhập câu hỏi!" });

        // Dùng thư viện chính chủ, nó tự tìm Model phù hợp nhất
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Bạn là nhân viên tư vấn cho cửa hàng truyện tranh Mangic. 
        Danh sách truyện: Dr. Stone, Jujutsu Kaisen, Spy x Family, Gachiakuta, Dandadan, Konosuba, Kakegurui, Iruma-kun, Horimiya, Jigokuraku, Hanako-kun, DanMachi, Tomodachi Game, Slime, Attack on Titan. 
        Quy tắc: Luôn trả lời bằng tiếng Việt có dấu, thân thiện, chỉ tư vấn về truyện tranh.
        Khách hàng hỏi: ${message}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error("Lỗi AI:", error);
        // Trả về nội dung lỗi để ông đọc trên giao diện chat
        res.status(500).json({ reply: "Lỗi AI: " + error.message });
    }
});
// ==========================================
// 9. KHỞI CHẠY HỆ THỐNG MÁY CHỦ
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`>>> Server Back-end đang chạy ổn định ở cổng ${PORT}`));