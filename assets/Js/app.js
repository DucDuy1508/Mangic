// ==========================================
// 1. XỬ LÝ THANH ĐIỀU HƯỚNG (NAVBAR ACTIVE)
// ==========================================
const navItems = document.querySelectorAll('.nav-link');
navItems.forEach(item => {
    item.onclick = function(){
        var activeNavbarItem = document.querySelector('.nav-item .active');
        console.log(activeNavbarItem)
        if(this.classList.contains('active') === false)
        {
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
        if (!searchInput) return; // Bảo vệ nếu trang đó không có ô tìm kiếm
        const keyword = searchInput.value.toLowerCase().trim();
        
        // Lấy danh sách các thể loại đang được tích (checked)
        const activeCategories = Array.from(checkboxes)
            .filter(box => box.checked)
            .map(box => box.id); 

        products.forEach(item => {
            const nameEl = item.querySelector('.product-name');
            if (!nameEl) return;
            const name = nameEl.textContent.toLowerCase();
            const itemCategories = item.getAttribute('data-category') ? item.getAttribute('data-category').split(' ') : [];

            // Kiểm tra khớp tên
            const matchesSearch = name.includes(keyword);

            // Kiểm tra khớp thể loại
            const matchesCategory = activeCategories.length === 0 || 
                activeCategories.every(cat => itemCategories.includes(cat));

            // HIỂN THỊ: Phải khớp CẢ tìm kiếm VÀ thể loại thì mới hiện
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
// 3. CHUYỂN HƯỚNG SANG TRANG CHI TIẾT
// ==========================================
const productCards = document.querySelectorAll('.product-card');
productCards.forEach(card => {
    card.style.cursor = 'pointer'; 
    card.addEventListener('click', function() {
        const nameEl = card.querySelector('.product-name');
        const priceEl = card.querySelector('.product-price');
        const imgEl = card.querySelector('.product-img');
        const parentItem = card.closest('.product-item');

        const name = nameEl ? nameEl.innerText : '';
        const price = priceEl ? priceEl.innerText : '';
        const img = imgEl ? imgEl.src : '';
        const cate = parentItem ? parentItem.getAttribute('data-category') : '';

        window.location.href = `sanpham.html?name=${name}&price=${price}&img=${img}&cate=${cate}`;
    });
});

// ==========================================
// 4. KIỂM TRA PHIÊN ĐĂNG NHẬP & ĐĂNG XUẤT (GOM ĐƠN GIẢN)
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    const userLink = document.getElementById("userLink");
    const userInfoBlock = document.getElementById("userInfoBlock");
    const welcomeName = document.getElementById("welcomeName");
    const btnLogout = document.getElementById("btnLogout");

    // Nếu đã đăng nhập thành công
    if (currentUser) {
        if (userLink) userLink.style.setProperty('display', 'none', 'important');
        if (userInfoBlock) userInfoBlock.style.setProperty('display', 'flex', 'important');
        if (welcomeName) welcomeName.innerText = "Xin chào, " + currentUser.fullName;
    }

    // Xử lý sự kiện bấm nút Đăng xuất
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
// 5. HÀM MUA NHANH TẠI TRANG CHỦ / CỬA HÀNG (THẤP TOAST)
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

    // Bắn thông báo rớt xuống dưới thanh Header (85px)
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
// 6. XỬ LÝ NÚT THÊM VÀO GIỎ TẠI TRANG CHI TIẾT (THẤP TOAST)
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
            const productId = urlParams.get('id') || "manga_detail"; 
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

            // Bắn thông báo rớt xuống dưới thanh Header (85px)
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