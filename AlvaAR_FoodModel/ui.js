import storeInfo, { findStoreBySlug } from './data/storeInfo.js';
import { productCategory as dendenCategories, productModels as dendenProducts } from './data/denden_MenuInfo.js';
import { productCategory as kaishuCategories, productModels as kaishuProducts } from './data/kaishu_MenuInfo.js';

// URLクエリパラメータから店舗名を取得 (例: ?=denden, ?=kaishu)
function getStoreName() {
    const params = new URLSearchParams(window.location.search);
    // ?=denden 形式をサポート
    return params.get('') || params.get('store') || 'kaishu';
}

const storeName = getStoreName();
const store = findStoreBySlug(storeName);

// 店舗に応じたデータを選択
const storeDataMap = {
    denden: { categories: dendenCategories, products: dendenProducts },
    kaishu: { categories: kaishuCategories, products: kaishuProducts },
};
const storeData = storeDataMap[storeName] || storeDataMap['kaishu'];
const productCategories = storeData.categories;
const productModels = storeData.products;

// index.js から参照できるようにグローバルに公開
window.currentStoreName = storeName;
window.currentStore = store;

document.addEventListener('DOMContentLoaded', function() {
    const menuContainer = document.getElementById('menuContainer');
    const menuToggle = document.getElementById('menuToggle');
    const toggleText = document.getElementById('toggleText');
    const tabNavigation = document.getElementById('tabNavigation');
    const menuToggleDesktop = document.getElementById('menuToggleDesktop');

    let startY = 0;
    let startX = 0;
    let isMenuExpanded = false;
    let isMobileView = window.innerWidth < 768;
    let currentTab = productCategories[0] || 'メインメニュー';

    // --- タブの動的生成 ---
    function buildTabs() {
        tabNavigation.innerHTML = '';
        productCategories.forEach((cat, index) => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
            btn.textContent = cat;
            tabNavigation.appendChild(btn);
        });
        setupTabListeners();
    }

    // --- メニュー項目のHTML生成 ---
    function generateProductHTML(product) {
        return `
        <div class="menu-item load-item-panel" data-product-id="${product.id}">
            <img src="${product.image}" alt="${product.name}" class="menu-item-image">
            <div class="menu-item-info">
                <div class="menu-item-title">${product.name}</div>
                <div class="menu-item-price">${product.price}円</div>
                <button class="view-item-btn">商品を表示</button>
            </div>
        </div>`;
    }

    // --- メニューコンテンツの生成 ---
    function generateMenuContent(tabName) {
        const menuContent = document.getElementById('menuContent');
        let html = '';

        if (tabName === productCategories[0]) {
            // 最初のタブ（メインメニュー）: 全商品をカテゴリ別に表示
            productCategories.forEach(cat => {
                if (cat === productCategories[0]) return;
                const items = productModels.filter(p => p.category === cat);
                if (items.length === 0) return;
                html += `<div class="menu-category"><h3 class="category-title">${cat}</h3></div>`;
                items.forEach(product => {
                    html += generateProductHTML(product);
                });
            });
        } else {
            // 特定カテゴリのみ表示
            const items = productModels.filter(p => p.category === tabName);
            items.forEach(product => {
                html += generateProductHTML(product);
            });
        }

        menuContent.innerHTML = html;
        setupProductButtons();
    }

    // --- 初期表示 ---
    buildTabs();
    generateMenuContent(currentTab);

    // 画面サイズによってメニューの状態を初期化
    function initMenuBasedOnScreenSize() {
        const body = document.querySelector('body');
        isMobileView = body.offsetWidth < 768;

        if (isMobileView) {
            menuContainer.classList.add('mobile-view');
            menuContainer.classList.remove('desktop-view', 'desktop-expanded', 'desktop-collapsed');
            if (!menuContainer.classList.contains('collapsed') && !menuContainer.classList.contains('expanded')) {
                menuContainer.classList.add('collapsed');
            }
        } else {
            menuContainer.classList.add('desktop-view');
            menuContainer.classList.remove('mobile-view', 'collapsed', 'expanded');
            if (!menuContainer.classList.contains('desktop-collapsed') && !menuContainer.classList.contains('desktop-expanded')) {
                menuContainer.classList.add('desktop-expanded');
            }
            isMenuExpanded = menuContainer.classList.contains('desktop-expanded');
            toggleText.textContent = isMenuExpanded ? 'メニューを閉じる' : 'メニューを開く';
        }
    }

    window.addEventListener('resize', initMenuBasedOnScreenSize);

    window.addEventListener('orientationchange', function() {
        setTimeout(function() {
            initMenuBasedOnScreenSize();
        }, 100);
    });

    initMenuBasedOnScreenSize();

    // Toggle menu state on click
    menuToggle.addEventListener('click', function() {
        toggleMenuState();
    });

    if (menuToggleDesktop) {
        menuToggleDesktop.addEventListener('click', function() {
            toggleMenuState();
        });
    }

    function toggleMenuState(forceState = null) {
        if (forceState !== null) {
            isMenuExpanded = forceState;
        } else {
            isMenuExpanded = !isMenuExpanded;
        }

        if (isMobileView) {
            if (isMenuExpanded) {
                menuContainer.classList.remove('collapsed');
                menuContainer.classList.add('expanded');
                toggleText.textContent = 'メニューを閉じる';
            } else {
                menuContainer.classList.remove('expanded');
                menuContainer.classList.add('collapsed');
                toggleText.textContent = 'メニューを開く';
            }
        } else {
            if (isMenuExpanded) {
                menuContainer.classList.remove('desktop-collapsed');
                menuContainer.classList.add('desktop-expanded');
                toggleText.innerHTML = 'メニューを閉じる';
            } else {
                menuContainer.classList.remove('desktop-expanded');
                menuContainer.classList.add('desktop-collapsed');
                toggleText.textContent = 'メニューを開く';
            }
        }
    }

    // メニュー部分のタッチイベント処理
    menuContainer.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
    },{passive: true});

    menuContainer.addEventListener('touchmove', function(e) {
        if (e.target.closest('.tab-navigation')) {
            return;
        }

        if (e.target.closest('.menu-content') && isMenuExpanded) {
            return;
        }

        const currentY = e.touches[0].clientY;
        const diffY = startY - currentY;

        if (isMobileView) {
            if (diffY > 50 && !isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(true);
            }
            else if (diffY < -50 && isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(false);
            }
        }
        else {
            const currentX = e.touches[0].clientX;
            const diffX = startX - currentX;

            if (diffX > 50 && !isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(true);
            }
            else if (diffX < -50 && isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(false);
            }
        }
    },{passive: true});

    // タブナビゲーションのスクロール処理（タッチデバイス用）
    let isScrolling = false;
    let scrollStartX;

    tabNavigation.addEventListener('touchstart', function(e) {
        isScrolling = true;
        scrollStartX = e.touches[0].clientX;
    }, { passive: true });

    tabNavigation.addEventListener('touchmove', function(e) {
        if (!isScrolling) return;

        const currentX = e.touches[0].clientX;
        const scrollDiff = scrollStartX - currentX;

        tabNavigation.scrollLeft += scrollDiff;
        scrollStartX = currentX;
    }, { passive: true });

    tabNavigation.addEventListener('touchend', function() {
        isScrolling = false;
    }, { passive: true });

    // タブナビゲーションのマウススクロール処理（デスクトップ用）
    let isDragging = false;
    let dragStartX;
    let scrollLeft;

    tabNavigation.addEventListener('mousedown', function(e) {
        isDragging = true;
        dragStartX = e.pageX;
        scrollLeft = tabNavigation.scrollLeft;
        tabNavigation.style.cursor = 'grabbing';
        setTimeout(() => {
            if (isDragging) {
                tabNavigation.style.userSelect = 'none';
            }
        }, 150);
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        const x = e.pageX;
        const walk = (x - dragStartX) * 1.5;
        tabNavigation.scrollLeft = scrollLeft - walk;
    });

    document.addEventListener('mouseup', function() {
        if (!isDragging) return;

        isDragging = false;
        tabNavigation.style.cursor = 'grab';
        tabNavigation.style.userSelect = '';
    });

    document.addEventListener('mouseleave', function() {
        if (isDragging) {
            isDragging = false;
            tabNavigation.style.cursor = 'grab';
            tabNavigation.style.userSelect = '';
        }
    });

    // タブ切り替え機能
    function setupTabListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                currentTab = this.textContent;
                generateMenuContent(currentTab);
            });
        });
    }

    // モデルを読み込んで表示する関数
    function loadAndDisplayModel(modelPath, modelDetail) {
        if (window.loadModel && typeof window.loadModel === 'function') {
            window.loadModel(modelPath, modelDetail);

            if (isMobileView) {
                toggleMenuState(false);
            }
        } else {
            console.error('loadModel関数が定義されていません');
        }
    }

    // 商品表示ボタンのイベントリスナーを設定
    function setupProductButtons() {
        const viewItemPanels = document.querySelectorAll('.load-item-panel');

        viewItemPanels.forEach(panel => {
            panel.addEventListener('click', function() {
                const productId = parseInt(this.dataset.productId);
                const product = productModels.find(p => p.id === productId);

                if (product && product.model) {
                    loadAndDisplayModel(product.model, product.description);
                } else {
                    const productName = this.querySelector('.menu-item-title').textContent;
                    alert(`${productName}の3Dモデルは利用できません。`);
                }
            });
        });
    }
});
