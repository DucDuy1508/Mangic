var API_URL = window.API_URL || (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" ? "http://localhost:5000" : "https://mangic.onrender.com");

// ==========================================
// 1. XỬ LÝ THANH ĐIỀU HƯỚNG (NAVBAR ACTIVE)
// ==========================================
const navItems = document.querySelectorAll('.nav-link');
navItems.forEach(item => {
    item.onclick = function(){
        var activeNavbarItem = document.querySelector('.nav-item .active');
        if(activeNavbarItem && this.classList.contains('active') === false) {
            activeNavbarItem.classList.remove('active');
            this.classList.add('active');
        }
    }
});

// ==========================================
// 2. LOGIC TÌM KIẾM VÀ LỌC THEO THỂ LOẠI
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const checkboxes = document.querySelectorAll('.form-check-input');
    const products = document.querySelectorAll('.product-item');

    function filterManga() {
        if (!searchInput) return; 
        const keyword = searchInput.value.toLowerCase().trim();
        const activeCategories = Array.from(checkboxes).filter(box => box.checked).map(box => box.id); 

        products.forEach(item => {
            const nameEl = item.querySelector('.product-name');
            if (!nameEl) return;
            const name = nameEl.textContent.toLowerCase();
            const itemCategories = item.getAttribute('data-category') ? item.getAttribute('data-category').split(' ') : [];

            const matchesSearch = name.includes(keyword);
            const matchesCategory = activeCategories.length === 0 || activeCategories.every(cat => itemCategories.includes(cat));

            if (matchesSearch && matchesCategory) {
                item.style.display = "block";
            } else {
                item.style.display = "none";
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', filterManga);
    checkboxes.forEach(box => {
        box.addEventListener('change', filterManga);
    });
});

// ==========================================
// 3. CHUYỂN HƯỚNG SANG TRANG CHI TIẾT (ĐÃ SỬA: TRUYỀN ID MONGODB CHUẨN)
// ==========================================
const productCards = document.querySelectorAll('.product-card');
productCards.forEach(card => {
    card.style.cursor = 'pointer'; 
    card.addEventListener('click', function() {
        const parentItem = card.closest('.product-item');
        
        // Bốc cái ID thực tế được lưu trong data-id của thẻ HTML (Ví dụ: data-id="${item._id}")
        let productId = card.getAttribute('data-id') || (parentItem ? parentItem.getAttribute('data-id') : null);
        
        // Phương án sơ cua: Nếu không có data-id, tự động bốc từ thuộc tính onclick của nút mua nhanh nếu có
        if (!productId && parentItem) {
            const btnAddToCart = parentItem.querySelector('[onclick^="addToCart"]');
            if (btnAddToCart) {
                const match = btnAddToCart.getAttribute('onclick').match(/addToCart\('([^']+)'/);
                if (match) productId = match[1];
            }
        }

        if (productId) {
            // Đá sang trang chi tiết kèm cái ID chuẩn khít để detail.js bốc dữ liệu
            window.location.href = `sanpham.html?id=${productId}`;
        } else {
            console.error("Không tìm thấy ID của sản phẩm này trên giao diện HTML!");
        }
    });
});

// ==========================================
// 4. KIỂM TRA PHIÊN ĐĂNG NHẬP & ĐĂNG XUẤT
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const userLink = document.getElementById("userLink");
    const userInfoBlock = document.getElementById("userInfoBlock");
    const welcomeName = document.getElementById("welcomeName");
    const btnLogout = document.getElementById("btnLogout");

    if (currentUser) {
        if (userLink) userLink.style.setProperty('display', 'none', 'important');
        if (userInfoBlock) userInfoBlock.style.setProperty('display', 'flex', 'important');
        if (welcomeName) welcomeName.innerText = "Xin chào, " + currentUser.fullName;
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", function() {
            Swal.fire({
                title: 'Xác nhận đăng xuất',
                text: "Bạn có chắc chắn muốn thoát khỏi phiên làm việc này?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#212529',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Đăng xuất',
                cancelButtonText: 'Hủy bỏ'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem("currentUser");
                    Swal.fire({
                        icon: 'success',
                        title: 'Đã đăng xuất',
                        text: 'Phiên làm việc đã kết thúc an toàn.',
                        timer: 1200,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload(); 
                    });
                }
            });
        });
    }
});

// ==========================================
// 5. HÀM MUA NHANH TẠI TRANG CHỦ / CỬA HÀNG
// ==========================================
function addToCart(id, name, price, image) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Yêu cầu đăng nhập',
            text: 'Bạn cần đăng nhập tài khoản để có thể thêm sản phẩm vào giỏ hàng!',
            confirmButtonColor: '#212529',
            showCancelButton: true,
            cancelButtonText: 'Xem tiếp',
            confirmButtonText: 'Đăng nhập ngay'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = "dangnhap.html";
            }
        });
        return; 
    }

    const cartKey = "cart_" + currentUser.username;
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const existingProduct = cart.find(item => item.id === id);

    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        cart.push({
            id: id,
            name: name,
            price: Number(price), 
            image: image,
            quantity: 1
        });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));

    Swal.fire({
        icon: 'success',
        title: 'Đã thêm vào giỏ hàng!',
        text: `Bạn đã thêm thành công cuốn "${name}"`,
        timer: 1500,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
        didOpen: (toast) => {
            toast.style.marginTop = '85px'; 
            toast.style.marginRight = '20px';
        }
    });
}

// ==========================================
// 6. XỬ LÝ NÚT THÊM VÀO GIỎ TẠI TRANG CHI TIẾT (ĐÃ SỬA CHECK ID)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const btnAdd = document.getElementById("btnAddToCartDetail");
    
    if (btnAdd) {
        btnAdd.addEventListener("click", function() {
            const currentUser = JSON.parse(localStorage.getItem("currentUser"));
            if (!currentUser) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Yêu cầu đăng nhập',
                    text: 'Bạn cần đăng nhập tài khoản để có thể thêm sản phẩm vào giỏ hàng!',
                    confirmButtonColor: '#212529',
                    showCancelButton: true,
                    cancelButtonText: 'Xem tiếp',
                    confirmButtonText: 'Đăng nhập ngay'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = "dangnhap.html";
                    }
                });
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id'); 
            
            if (!productId) {
                Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Không tìm thấy mã sản phẩm hợp lệ!' });
                return;
            }

            const productName = document.getElementById("detail-name").innerText;
            const priceText = document.getElementById("detail-price").innerText;
            const productPrice = Number(priceText.replace(/[^0-9]/g, ''));
            const productImage = document.getElementById("main-img").getAttribute("src");
            
            const inputQty = document.getElementById("detail-quantity");
            const quantityToAdd = inputQty ? parseInt(inputQty.value) : 1;

            const cartKey = "cart_" + currentUser.username;
            let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
            const existingProduct = cart.find(item => item.id === productId);

            if (existingProduct) {
                existingProduct.quantity += quantityToAdd;
            } else {
                cart.push({
                    id: productId,
                    name: productName,
                    price: productPrice,
                    image: productImage,
                    quantity: quantityToAdd
                });
            }

            localStorage.setItem(cartKey, JSON.stringify(cart));

            Swal.fire({
                icon: 'success',
                title: 'Đã thêm vào giỏ hàng!',
                text: `Bạn đã thêm thành công ${quantityToAdd} cuốn "${productName}" vào giỏ.`,
                timer: 1800,
                showConfirmButton: false,
                position: 'top-end',
                toast: true,
                didOpen: (toast) => {
                    toast.style.marginTop = '85px'; 
                    toast.style.marginRight = '20px';
                }
            });
        });
    }
});
// ==========================================
// TỰ ĐỘNG HÓA ANALYTICS: THEO DÕI VISITS VÀ CLICKS CHO ADMIN
// ==========================================
(function() {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    const currentUsername = user ? user.username : "Khách vãng lai";

    // 1. Tự động ghi nhận lượt truy cập khi trang này được tải xong
    fetch(`${API_URL}/api/analytics/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type: "visit",
            username: currentUsername,
            details: `Xem trang: ${window.location.pathname.split('/').pop() || 'Trang chủ'}`
        })
    }).catch(err => console.log("Lỗi gửi track visit"));

    // 2. Tự động lắng nghe và đếm mọi click chuột trên giao diện hệ thống
    document.addEventListener("click", function(e) {
        // Chỉ đếm các cụm click vào các phần tử quan trọng như nút, link thẻ a, thẻ i icon, ảnh sản phẩm
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.product-card') || e.target.closest('i')) {
            let targetText = e.target.innerText || e.target.className || "Nút chức năng";
            if (targetText.length > 50) targetText = targetText.substring(0, 50) + "...";

            fetch(`${API_URL}/api/analytics/track`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "click",
                    username: currentUsername,
                    details: `Click vào: ${targetText.trim()}`
                })
            }).catch(err => console.log("Lỗi gửi track click"));
        }
    });
})();

// CẬP NHẬT THÊM: Sửa lại chức năng Đăng xuất cũ của ông để gửi tín hiệu Offline lên server
// Ông tìm sự kiện click của nút 'btnLogout' cũ trong app.js, chèn thêm cái fetch này vào trước khi xóa localStorage nha:
if (btnLogout) {
    // Đoạn code xử lý Swall.fire của ông giữ nguyên...
    // Lúc mà chuẩn bị xóa localStorage.removeItem("currentUser"), chèn dòng này:
    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (user) {
        fetch(`${API_URL}/api/auth/logout-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user.username })
        });
    }
}