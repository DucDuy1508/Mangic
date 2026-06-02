const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(cors()); 

// --- [BỔ SUNG CẤU HÌNH REALTIME: HTTP SERVER & SOCKET.IO] ---
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://127.0.0.1:5500", 
            "http://localhost:5500",
            "https://mangic.vercel.app" 
        ],
        methods: ["GET", "POST"],
        credentials: true 
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
// 2. ĐỊNH NGHĨA CẤU TRÚC BẢNG (SCHEMAS)
// ==========================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    fullName: String,
    isOnline: { type: Boolean, default: false }, 
    lastActive: { type: Date, default: Date.now } 
});
const User = mongoose.model('User', UserSchema);

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
    createdAt: { type: Date, default: Date.now },
    rating: { type: Number, default: 0 },
    reviewText: { type: String, default: "" }
});
const Order = mongoose.model('Order', OrderSchema);

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountPercent: { type: Number, required: true }, 
    applicableProducts: [String],                      
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },                           
    usageLimit: { type: Number, required: true },      
    usedCount: { type: Number, default: 0 },           
    createdAt: { type: Date, default: Date.now },
    discountType: { type: String, default: 'total' } 
});
const Coupon = mongoose.model('Coupon', CouponSchema);

const TrafficSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, 
    visits: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
});
const Traffic = mongoose.model('Traffic', TrafficSchema);

const UserActivitySchema = new mongoose.Schema({
    username: { type: String, default: "Khách vãng lai" },
    action: { type: String, required: true },             
    details: String,                                      
    createdAt: { type: Date, default: Date.now }
});
const UserActivity = mongoose.model('UserActivity', UserActivitySchema);

const MessageSchema = new mongoose.Schema({
    username: { type: String, required: true }, 
    sender: { type: String, required: true },   
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);


// ==========================================
// 3. API SẢN PHẨM & TÀI KHOẢN KHÁCH HÀNG
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
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Không tìm thấy cuốn truyện này trên database!" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống khi tải chi tiết sản phẩm!" });
    }
});

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
    if (!user) return res.status(400).json({ error: "Tài khoản không tồn tại trên hệ thống!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Mật khẩu không chính xác." });

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    res.json({ message: "Đăng nhập thành công!", user: { username: user.username, role: user.role, fullName: user.fullName } });
});

app.post('/api/auth/logout-status', async (req, res) => {
    try {
        const { username } = req.body;
        if (username) await User.findOneAndUpdate({ username }, { isOnline: false, lastActive: new Date() });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Lỗi đồng bộ trạng thái đăng xuất!" });
    }
});

// ==========================================
// 4. API ĐƠN HÀNG VÀ ĐÁNH GIÁ (GIỮ LẠI BẢN CHUẨN NHẤT)
// ==========================================
app.get('/api/orders/history/:username', async (req, res) => {
    try {
        const userOrders = await Order.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ error: "Không thể tải lịch sử đơn hàng!" });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { username, items, totalAmount, discountCode, paymentMethod, shippingInfo, orderCode } = req.body;
        const newOrder = new Order({ 
            username, items, totalAmount, discountCode, paymentMethod, shippingInfo, 
            orderCode: String(orderCode).trim(), 
            orderStatus: 'Chờ xử lý',
            paymentStatus: paymentMethod === 'COD' ? 'Chờ thanh toán COD' : 'Chờ thanh toán'
        });
        await newOrder.save();
        res.status(201).json({ message: "Khởi tạo đơn hàng thành công!", orderId: newOrder._id });
    } catch (error) {
        res.status(500).json({ error: "Không thể khởi tạo đơn hàng!" });
    }
});

app.put('/api/orders/:id/cancel', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: "Đơn hàng không tồn tại!" });
        if (order.paymentMethod !== 'COD') return res.status(400).json({ error: "Không hỗ trợ tự hủy đơn hàng chuyển khoản!" });
        if (order.orderStatus !== 'Chờ xử lý') return res.status(400).json({ error: "Đơn hàng đã xử lý, không thể tự hủy!" });

        order.orderStatus = 'Hủy đơn';
        order.paymentStatus = 'Thất bại'; 
        await order.save();

        const cancelLog = new UserActivity({ username: order.username, action: "Khách hủy đơn", details: `Hủy COD mã ${order.orderCode}.` });
        await cancelLog.save();

        res.json({ message: "Hủy đơn hàng thành công!", order });
    } catch (error) {
        res.status(500).json({ error: "Lỗi máy chủ!" });
    }
});

app.put('/api/orders/:id/request-return', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        if (order.orderStatus !== 'Đã giao') return res.status(400).json({ error: "Chỉ đơn hàng đã giao mới được yêu cầu trả!" });

        order.orderStatus = 'Yêu cầu trả hàng';
        await order.save();
        res.json({ message: "Đã báo cáo hệ thống! Vui lòng mở khung Chat để trao đổi lý do với Admin." });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống!" });
    }
});

app.put('/api/orders/:id/review', async (req, res) => {
    try {
        const { rating, reviewText } = req.body;
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        
        order.rating = Number(rating);
        order.reviewText = reviewText;
        await order.save();
        
        const reviewLog = new UserActivity({ username: order.username, action: "Đánh giá đơn hàng", details: `Khách đánh giá ${rating} sao cho đơn ${order.orderCode}.` });
        await reviewLog.save();

        res.json({ message: "Cảm ơn bạn đã đánh giá đơn hàng!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống khi lưu đánh giá!" });
    }
});

// ==========================================
// 5. API QUẢN TRỊ ADMIN (CRM) VÀ COUPON
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
        
        res.json({ totalRevenue, totalVisits, totalClicks, onlineUsersCount, chartTimeline: chartData.reverse() });
    } catch (error) { res.status(500).json({ error: "Lỗi lấy dữ liệu tổng hợp!" }); }
});

app.get('/api/admin/recent-activities', async (req, res) => {
    try {
        const activities = await UserActivity.find().sort({ createdAt: -1 }).limit(20);
        res.json(activities);
    } catch (error) { res.status(500).json({ error: "Lỗi hệ thống!" }); }
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

            return { username: user.username, fullName: user.fullName || "Người dùng mới", role: user.role, totalOrders, canceledOrders, totalSpent, rank };
        }));
        res.json(stats.sort((a, b) => b.totalSpent - a.totalSpent));
    } catch (error) { res.status(500).json({ error: "Lỗi thống kê!" }); }
});

app.get('/api/admin/users-status', async (req, res) => {
    try {
        const users = await User.find({}, 'username fullName role isOnline lastActive');
        const now = new Date();
        const updatedUsers = await Promise.all(users.map(async (user) => {
            if (user.isOnline && (now - new Date(user.lastActive)) > 30000) {
                user.isOnline = false; 
                await User.updateOne({ _id: user._id }, { isOnline: false }); 
            }
            return user;
        }));
        res.json(updatedUsers.sort((a, b) => a.isOnline === b.isOnline ? new Date(b.lastActive) - new Date(a.lastActive) : b.isOnline - a.isOnline));
    } catch (error) { res.status(500).json({ error: "Lỗi trạng thái!" }); }
});

app.delete('/api/users/:username', async (req, res) => {
    try {
        if (req.params.username === 'admin') return res.status(400).json({ error: "Không thể xóa Admin!" });
        const deletedUser = await User.findOneAndDelete({ username: req.params.username });
        if (!deletedUser) return res.status(404).json({ error: "Không tìm thấy!" });
        res.json({ message: "Xóa thành công!" });
    } catch (error) { res.status(500).json({ error: "Lỗi xóa!" }); }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) { res.status(500).json({ error: "Lỗi dữ liệu đơn hàng!" }); }
});

app.put('/api/admin/orders/:id/update-status', async (req, res) => {
    try {
        const { orderStatus, paymentStatus } = req.body; 
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        
        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;
        if (order.orderStatus === 'Đã giao') order.paymentStatus = 'Đã thanh toán'; 
        if (order.orderStatus === 'Hủy đơn') order.paymentStatus = 'Thất bại'; 

        await order.save();
        res.json({ message: "Cập nhật thành công!", order });
    } catch (error) { res.status(500).json({ error: "Lỗi hệ thống!" }); }
});

app.get('/api/admin/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) { res.status(500).json({ error: "Lỗi coupon!" }); }
});

app.post('/api/admin/coupons', async (req, res) => {
    try {
        // ĐÃ SỬA: Lấy biến discountType từ request
        const { code, discountType, discountPercent, applicableProducts, startDate, endDate, usageLimit } = req.body;
        const newCoupon = new Coupon({ 
            code, discountType, discountPercent, applicableProducts, startDate, endDate, usageLimit 
        });
        await newCoupon.save();
        res.status(201).json({ message: "Tạo coupon thành công!", coupon: newCoupon });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: "Mã code này đã tồn tại!" });
        res.status(500).json({ error: "Lỗi hệ thống!" });
    }
});

app.put('/api/admin/coupons/use', async (req, res) => {
    try {
        const coupon = await Coupon.findOneAndUpdate(
            { code: req.body.code.toUpperCase() }, { $inc: { usedCount: 1 } }, { new: true }
        );
        res.json({ message: "Khấu trừ thành công!", coupon });
    } catch (error) { res.status(500).json({ error: "Lỗi server!" }); }
});

app.delete('/api/admin/coupons/:id', async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: "Đã xóa coupon!" });
    } catch (error) { res.status(500).json({ error: "Lỗi!" }); }
});

// ==========================================
// 6. THỐNG KÊ, WEBHOOK & AI CHAT
// ==========================================
app.post('/api/webhook/payment', async (req, res) => {
    try {
        const paymentData = req.body; 
        const orderCode = paymentData.orderCode || (paymentData.data && paymentData.data.orderCode) || paymentData.content; 
        const amountPaid = paymentData.amount || (paymentData.data && paymentData.data.amount);

        if (!orderCode) return res.status(400).json({ error: "Không bốc được orderCode!" });

        const order = await Order.findOne({ orderCode: String(orderCode).trim() });
        if (!order) return res.status(404).json({ error: "Không tồn tại!" });
        if (order.paymentStatus === 'Đã thanh toán') return res.json({ success: true });

        order.paymentStatus = 'Đã thanh toán';
        order.orderStatus = 'Đang giao'; 
        await order.save();

        const paymentLog = new UserActivity({ username: order.username, action: "Thanh toán tự động", details: `Xác thực Webhook: ${Number(amountPaid).toLocaleString()} VND.` });
        await paymentLog.save();

        res.status(200).json({ success: true });
    } catch (error) { res.status(500).json({ error: "Lỗi Webhook!" }); }
});

app.post('/api/analytics/track', async (req, res) => {
    try {
        const { type, username, details } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const updateData = {};
        if (type === 'visit') updateData.$inc = { visits: 1 };
        if (type === 'click') updateData.$inc = { clicks: 1 };

        await Traffic.findOneAndUpdate({ date: today }, updateData, { upsert: true, new: true });

        if (username) {
            await User.findOneAndUpdate({ username }, { isOnline: true, lastActive: new Date() });
            const newActivity = new UserActivity({ username, action: type === 'visit' ? "Truy cập hệ thống" : "Click chuột", details: details || "Tương tác" });
            await newActivity.save();
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Lỗi ghi nhận!" }); }
});

// Socket.IO Chat
app.get('/api/chat/history/:username', async (req, res) => {
    try {
        const messages = await Message.find({ username: req.params.username }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) { res.status(500).json({ error: "Lỗi tải chat!" }); }
});

io.on('connection', (socket) => {
    socket.on('join_room', (username) => { socket.join(username); });
    socket.on('send_message', async (data) => {
        try {
            const newMessage = new Message({ username: data.username, sender: data.sender, text: data.text });
            await newMessage.save();
            io.to(data.username).emit('receive_message', newMessage);
        } catch (err) { console.error("Lỗi socket:", err); }
    });
});

app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ reply: "Chưa nhập câu hỏi!" });

        const promptData = {
            contents: [{
                parts: [{
                    text: `Bạn là nhân viên tư vấn dễ thương của Mangic. Danh sách truyện: Dr. Stone, Jujutsu Kaisen, Spy x Family... Khách hỏi: ${message}`
                }]
            }]
        };

        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-goog-api-key': process.env.GOOGLE_API_KEY },
            body: JSON.stringify(promptData)
        });
        const data = await response.json();
        
        if (!data.error) return res.json({ reply: data.candidates[0].content.parts[0].text });
        res.json({ reply: "AI đang bận, xin chờ!" });
    } catch (error) {
        res.json({ reply: "Hệ thống AI bảo trì." });
    }
});

// ==========================================
// KHỞI CHẠY SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`>>> Server Back-end đang chạy tại cổng ${PORT}`));