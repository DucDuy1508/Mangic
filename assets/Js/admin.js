document.addEventListener("DOMContentLoaded", function() {
    // 1. Bảo mật: Kiểm tra quyền Admin
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser || currentUser.role !== 'admin') {
        Swal.fire({
            icon: 'error',
            title: 'Truy cập bị từ chối',
            text: 'Bạn không có quyền hạn truy cập vào khu vực quản trị này.',
            confirmButtonColor: '#212529',
            allowOutsideClick: false
        }).then(() => {
            window.location.href = "index.html";
        });
        return;
    }

    const adminNameSpan = document.getElementById("adminName");
    if (adminNameSpan) {
        adminNameSpan.innerText = `Quản trị: ${currentUser.fullName}`;
    }

    // Tự động tải dữ liệu các bảng khi vừa mở trang (ĐÃ BỎ hàm chọn sản phẩm)
    loadOrdersData();
    loadCustomerStats();
    loadUsers();
    loadCoupons();

    // 2. HÀM CHÍNH: ĐỌC ĐƠN HÀNG & TỰ ĐỘNG HÓA TRẠNG THÁI THANH TOÁN
    function loadOrdersData() {
        fetch('http://localhost:5000/api/admin/orders') 
        .then(res => res.json())
        .then(orders => {
            const tbody = document.getElementById("tblOrdersBody");
            if (!tbody) return;
            tbody.innerHTML = "";
            
            let totalRevenue = 0;
            let validOrderCount = 0; // Đếm số đơn hàng không bị hủy

            if(orders.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Chưa có đơn hàng nào.</td></tr>`;
                document.getElementById("dashRevenue").innerText = "0 đ";
                document.getElementById("dashOrdersCount").innerText = "0 đơn";
                return;
            }

            orders.forEach(order => {
                // TỰ ĐỘNG HÓA LOGIC CỘT THANH TOÁN
                let finalPaymentStatus = order.paymentStatus; 

                if (order.orderStatus === 'Hủy đơn') {
                    finalPaymentStatus = 'Thất bại';
                } else if (order.paymentMethod === 'COD') {
                    if (order.orderStatus === 'Giao hàng thành công') {
                        finalPaymentStatus = 'Đã thanh toán';
                    } else {
                        finalPaymentStatus = 'Chờ thanh toán';
                    }
                } else if (order.paymentMethod === 'QR') {
                    finalPaymentStatus = 'Đã thanh toán';
                }

                // TỔNG SỐ ĐƠN HÀNG: Loại bỏ các đơn bị Hủy
                if (order.orderStatus !== 'Hủy đơn') {
                    validOrderCount++;
                }

                // TỔNG DOANH THU: Chỉ cộng dồn đơn Đã thanh toán thực tế
                if(finalPaymentStatus === 'Đã thanh toán') {
                    totalRevenue += order.totalAmount;
                }

                let itemsHtml = order.items.map(item => `
                    <div style="font-size: 12px;">• ${item.name} <strong>(x${item.quantity})</strong></div>
                `).join('');

                // Gán màu sắc Badge cho Trạng thái đơn hàng
                let oStatusClass = "bg-secondary";
                if (order.orderStatus === "Đang giao") oStatusClass = "bg-warning text-dark";
                if (order.orderStatus === "Giao hàng thành công") oStatusClass = "bg-success";
                if (order.orderStatus === "Hủy đơn") oStatusClass = "bg-danger";

                // Gán màu sắc Badge cho Trạng thái thanh toán
                let pStatusClass = "bg-danger";
                if (finalPaymentStatus === "Đã thanh toán") pStatusClass = "bg-success";
                if (finalPaymentStatus === "Thất bại") pStatusClass = "bg-dark text-white";

                const row = `
                    <tr>
                        <td class="fw-bold">${order.orderCode}</td>
                        <td class="text-muted small">${order.username}</td>
                        <td style="font-size: 12px;">
                            <strong>${order.shippingInfo?.fullName || 'N/A'}</strong><br>
                            SĐT: ${order.shippingInfo?.phone || 'N/A'}<br>
                            ĐC: ${order.shippingInfo?.address || 'N/A'}
                        </td>
                        <td>${itemsHtml}</td>
                        <td class="fw-bold text-danger">${order.totalAmount.toLocaleString('vi-VN')} đ</td>
                        <td><span class="badge bg-light text-dark border">${order.paymentMethod}</span></td>
                        <td>
                            <span class="badge ${oStatusClass} mb-2 d-inline-block">${order.orderStatus || 'Chờ xử lý'}</span>
                            <select class="form-select form-select-sm" style="font-size: 11px;" onchange="updateOrderStatusThongMinh('${order._id}', this.value)">
                                <option value="" disabled selected>Thay đổi...</option>
                                <option value="Chờ xử lý">Chờ xử lý</option>
                                <option value="Đang giao">Đang giao</option>
                                <option value="Giao hàng thành công">Giao hàng thành công</option>
                                <option value="Hủy đơn">Hủy đơn</option>
                            </select>
                        </td>
                        <td>
                            <span class="badge ${pStatusClass} px-3 py-2 fs-6">${finalPaymentStatus}</span>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });

            // Đổ con số thống kê Dashboard sau khi đã tính toán tự động
            document.getElementById("dashRevenue").innerText = totalRevenue.toLocaleString('vi-VN') + " đ";
            document.getElementById("dashOrdersCount").innerText = validOrderCount + " đơn";
        })
        .catch(err => console.error("Lỗi tải đơn hàng:", err));
    }

    // 3. HÀM CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG LÊN BACKEND
    window.updateOrderStatusThongMinh = function(id, selectedValue) {
        const payload = { orderStatus: selectedValue };

        if (selectedValue === 'Giao hàng thành công') {
            payload.paymentStatus = 'Đã thanh toán';
        } else if (selectedValue === 'Hủy đơn') {
            payload.paymentStatus = 'Thất bại';
        }

        fetch(`http://localhost:5000/api/admin/orders/${id}/update-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            Swal.fire({ icon: 'success', title: 'Hệ thống tự động cập nhật!', timer: 1000, showConfirmButton: false });
            loadOrdersData(); 
            loadCustomerStats(); 
        });
    }

    // 4. TAB THỐNG KÊ LỊCH SỬ KHÁCH HÀNG
    // --- [SỬA LẠI HÀM 4 TRONG FILE admin.js ĐỂ THỂ HIỆN BẬC THÀNH VIÊN VIP] ---
    function loadCustomerStats() {
        fetch('http://localhost:5000/api/admin/customer-stats')
        .then(res => res.json())
        .then(stats => {
            const tbody = document.getElementById("tblCustomersBody");
            if (!tbody) return;
            tbody.innerHTML = "";
            document.getElementById("dashCustomersCount").innerText = stats.length + " người";

            stats.forEach(stat => {
                const totalSpent = stat.totalSpent || 0;
                let tierBadge = "";

                // Thuật toán tự động quét chi tiêu để gắn danh hiệu VIP
                if (totalSpent >= 3000000) {
                    tierBadge = `<span class="badge bg-dark text-info border border-info px-2 py-1 fw-bold">KIM CƯƠNG 💎</span>`;
                } else if (totalSpent >= 1500000) {
                    tierBadge = `<span class="badge bg-warning text-dark px-2 py-1 fw-bold">VÀNG 🥇</span>`;
                } else if (totalSpent >= 500000) {
                    tierBadge = `<span class="badge bg-primary px-2 py-1 fw-bold">BẠC 🥈</span>`;
                } else {
                    tierBadge = `<span class="badge bg-secondary px-2 py-1 fw-bold">ĐỒNG 🥉</span>`;
                }

                // Đổ dữ liệu có kèm cột tierBadge vừa tính được vào mảng hàng
                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold"><i class="ti ti-user text-muted me-2"></i>${stat._id}</td>
                        <td class="text-center">${tierBadge}</td>
                        <td class="text-center fw-bold text-success">${stat.totalOrders} đơn</td>
                        <td class="text-center fw-bold text-danger">${stat.canceledOrders} đơn</td>
                        <td class="fw-bold text-primary">${totalSpent.toLocaleString('vi-VN')} đ</td>
                    </tr>
                `;
            });
        })
        .catch(err => console.error("Lỗi tải thống kê khách hàng:", err));
    }

    // 5. TAB QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG
    function loadUsers() {
        fetch('http://localhost:5000/api/users')
            .then(res => res.json())
            .then(users => {
                const tbody = document.getElementById("tblUsersListBody");
                if (!tbody) return;
                tbody.innerHTML = ""; 

                users.forEach(user => {
                    const roleBadge = user.role === 'admin' 
                        ? `<span class="badge bg-danger">Quản trị viên</span>` 
                        : `<span class="badge bg-primary">Khách hàng</span>`;

                    const row = `
                        <tr>
                            <td class="ps-3 fw-semibold">${user.username}</td>
                            <td>${user.fullName || 'Chưa cập nhật'}</td>
                            <td>${roleBadge}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-danger btn-delete-user fw-bold" data-username="${user.username}">
                                    <i class="ti ti-trash me-1"></i> Xóa
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
                addDeleteEvents();
            })
            .catch(err => console.error("Lỗi lấy danh sách user:", err));
    }

    function addDeleteEvents() {
        document.querySelectorAll(".btn-delete-user").forEach(btn => {
            btn.onclick = function() {
                const usernameToDelete = this.getAttribute("data-username");
                Swal.fire({
                    title: 'Xóa thành viên?',
                    text: `Hành động này sẽ xóa vĩnh viễn tài khoản [${usernameToDelete}]!`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    confirmButtonText: 'Đồng ý xóa'
                }).then((result) => {
                    if (result.isConfirmed) {
                        fetch(`http://localhost:5000/api/users/${usernameToDelete}`, { method: 'DELETE' })
                        .then(res => res.json())
                        .then(data => {
                            if (data.error) Swal.fire('Thất bại', data.error, 'error');
                            else {
                                Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1000, showConfirmButton: false });
                                loadUsers();
                            }
                        });
                    }
                });
            };
        });
    }

    // 6. TAB QUẢN LÝ MÃ GIẢM GIÁ (COUPON)
    function loadCoupons() {
        fetch('http://localhost:5000/api/admin/coupons')
            .then(res => res.json())
            .then(coupons => {
                const tbody = document.getElementById("couponTableBody");
                if (!tbody) return;
                tbody.innerHTML = "";

                coupons.forEach(cp => {
                    const products = cp.applicableProducts.length > 0 ? cp.applicableProducts.join(', ') : 'Tất cả';
                    const expiry = cp.endDate ? new Date(cp.endDate).toLocaleDateString('vi-VN') : 'Vĩnh viễn';
                    
                    const row = `
                        <tr>
                            <td class="fw-bold text-primary">${cp.code}</td>
                            <td>${cp.discountPercent}%</td>
                            <td><small>${products}</small></td>
                            <td>${cp.usedCount}/${cp.usageLimit}</td>
                            <td>${expiry}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-danger btn-delete-coupon" data-id="${cp._id}">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += row;
                });
                addCouponDeleteEvents();
            });
    }

    // ĐÃ CẬP NHẬT: Form tạo Coupon tự động gán mảng rỗng để giảm giá toàn sàn
    const couponForm = document.getElementById("couponForm");
    if (couponForm) {
        couponForm.addEventListener("submit", function(e) {
            e.preventDefault();
            const couponData = {
                code: document.getElementById("cpCode").value.trim().toUpperCase(),
                discountPercent: Number(document.getElementById("cpDiscount").value),
                usageLimit: Number(document.getElementById("cpLimit").value),
                startDate: document.getElementById("cpStart").value || new Date(),
                endDate: document.getElementById("cpEnd").value ? new Date(document.getElementById("cpEnd").value) : null,
                applicableProducts: [] // Mặc định mảng rỗng để áp dụng tự động cho toàn shop
            };

            fetch('http://localhost:5000/api/admin/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(couponData)
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    Swal.fire('Lỗi', data.error, 'error');
                } else {
                    Swal.fire('Thành công', 'Đã tạo mã giảm giá mới áp dụng toàn shop!', 'success');
                    couponForm.reset();
                    loadCoupons();
                }
            });
        });
    }

    function addCouponDeleteEvents() {
        document.querySelectorAll(".btn-delete-coupon").forEach(btn => {
            btn.onclick = function() {
                const id = this.getAttribute("data-id");
                Swal.fire({
                    title: 'Xóa Coupon?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Xóa ngay'
                }).then(result => {
                    if (result.isConfirmed) {
                        fetch(`http://localhost:5000/api/admin/coupons/${id}`, { method: 'DELETE' })
                        .then(() => {
                            Swal.fire({ icon: 'success', title: 'Đã xóa!', timer: 1000, showConfirmButton: false });
                            loadCoupons();
                        });
                    }
                });
            };
        });
    }

    // 7. Xử lý nút Đăng xuất Admin chính chủ
    const btnAdminLogout = document.getElementById("btnLogoutAdmin");
    if (btnAdminLogout) {
        btnAdminLogout.addEventListener("click", function() {
            Swal.fire({
                title: 'Xác nhận đăng xuất',
                text: "Bạn muốn thoát khỏi hệ thống quản trị?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#212529',
                confirmButtonText: 'Đăng xuất'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem("currentUser");
                    window.location.href = "dangnhap.html";
                }
            });
        });
    }
});