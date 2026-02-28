// 8th Wall FoodModel メニューUI
// AlvaAR_FoodModel/ui.js を 8th Wall 向けに移植

import storeInfo from '../data/storeInfo'
import { productCategory as dendenCategories, productModels as dendenProducts } from '../data/denden_MenuInfo'
import { productCategory as kaishuCategories, productModels as kaishuProducts } from '../data/kaishu_MenuInfo'

// URLクエリパラメータから店舗名を取得
function getStoreName() {
    const params = new URLSearchParams(window.location.search)
    return params.get('') || params.get('store') || 'kaishu'
}

const storeName = getStoreName()
const store = storeInfo.find(s => s.use_name === storeName) || storeInfo[0]

const storeDataMap = {
    denden: { categories: dendenCategories, products: dendenProducts },
    kaishu: { categories: kaishuCategories, products: kaishuProducts },
}
const storeData = storeDataMap[storeName] || storeDataMap['kaishu']
const productCategories = storeData.categories
const productModels = storeData.products

// グローバルに公開
window.currentStoreName = storeName
window.currentStore = store

// 3Dビュワーページへ遷移
window.onExit = function() {
    window.location.href = `https://www.food.in3d.world/ja/${storeName}/viewer/`
}

// 現在表示中のモデルをすべてクリア
window.onClear = function() {
    if (window.clearModels && typeof window.clearModels === 'function') {
        window.clearModels()
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const menuContainer = document.getElementById('menuContainer')
    const menuToggle = document.getElementById('menuToggle')
    const toggleText = document.getElementById('toggleText')
    const tabNavigation = document.getElementById('tabNavigation')
    const menuToggleDesktop = document.getElementById('menuToggleDesktop')

    let startY = 0
    let startX = 0
    let isMenuExpanded = false
    let isMobileView = window.innerWidth < 768
    let currentTab = productCategories[0] || 'メインメニュー'

    // --- タブの動的生成 ---
    function buildTabs() {
        tabNavigation.innerHTML = ''
        productCategories.forEach((cat, index) => {
            const btn = document.createElement('button')
            btn.className = 'tab-btn' + (index === 0 ? ' active' : '')
            btn.textContent = cat
            tabNavigation.appendChild(btn)
        })
        setupTabListeners()
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
        </div>`
    }

    // --- メニューコンテンツの生成 ---
    function generateMenuContent(tabName) {
        const menuContent = document.getElementById('menuContent')
        let html = ''

        if (tabName === productCategories[0]) {
            // 最初のタブ（メインメニュー）: 全商品をカテゴリ別に表示
            productCategories.forEach(cat => {
                if (cat === productCategories[0]) return
                const items = productModels.filter(p => p.category === cat)
                if (items.length === 0) return
                html += `<div class="menu-category"><h3 class="category-title">${cat}</h3></div>`
                items.forEach(product => { html += generateProductHTML(product) })
            })
        } else {
            const items = productModels.filter(p => p.category === tabName)
            items.forEach(product => { html += generateProductHTML(product) })
        }

        menuContent.innerHTML = html
        setupProductButtons()
    }

    // --- 初期表示 ---
    buildTabs()
    generateMenuContent(currentTab)

    // 画面サイズによってメニューの状態を初期化
    function initMenuBasedOnScreenSize() {
        const body = document.querySelector('body')
        isMobileView = body.offsetWidth < 768

        if (isMobileView) {
            menuContainer.classList.add('mobile-view')
            menuContainer.classList.remove('desktop-view', 'desktop-expanded', 'desktop-collapsed')
            if (!menuContainer.classList.contains('collapsed') && !menuContainer.classList.contains('expanded')) {
                menuContainer.classList.add('collapsed')
            }
        } else {
            menuContainer.classList.add('desktop-view')
            menuContainer.classList.remove('mobile-view', 'collapsed', 'expanded')
            if (!menuContainer.classList.contains('desktop-collapsed') && !menuContainer.classList.contains('desktop-expanded')) {
                menuContainer.classList.add('desktop-expanded')
            }
            isMenuExpanded = menuContainer.classList.contains('desktop-expanded')
            if (toggleText) toggleText.textContent = isMenuExpanded ? 'メニューを閉じる' : 'メニューを開く'
        }
    }

    window.addEventListener('resize', initMenuBasedOnScreenSize)
    window.addEventListener('orientationchange', () => {
        setTimeout(initMenuBasedOnScreenSize, 100)
    })
    initMenuBasedOnScreenSize()

    // メニュートグル
    menuToggle.addEventListener('click', function() { toggleMenuState() })
    if (menuToggleDesktop) {
        menuToggleDesktop.addEventListener('click', function() { toggleMenuState() })
    }

    function toggleMenuState(forceState = null) {
        isMenuExpanded = forceState !== null ? forceState : !isMenuExpanded

        if (isMobileView) {
            if (isMenuExpanded) {
                menuContainer.classList.remove('collapsed')
                menuContainer.classList.add('expanded')
                if (toggleText) toggleText.textContent = 'メニューを閉じる'
            } else {
                menuContainer.classList.remove('expanded')
                menuContainer.classList.add('collapsed')
                if (toggleText) toggleText.textContent = 'メニューを開く'
            }
        } else {
            if (isMenuExpanded) {
                menuContainer.classList.remove('desktop-collapsed')
                menuContainer.classList.add('desktop-expanded')
                if (toggleText) toggleText.innerHTML = 'メニューを閉じる'
            } else {
                menuContainer.classList.remove('desktop-expanded')
                menuContainer.classList.add('desktop-collapsed')
                if (toggleText) toggleText.textContent = 'メニューを開く'
            }
        }
    }

    // メニュー部分のタッチイベント処理
    menuContainer.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY
        startX = e.touches[0].clientX
    }, { passive: true })

    menuContainer.addEventListener('touchmove', function(e) {
        if (e.target.closest('.tab-navigation')) return
        if (e.target.closest('.menu-content') && isMenuExpanded) return

        const currentY = e.touches[0].clientY
        const diffY = startY - currentY

        if (isMobileView) {
            if (diffY > 50 && !isMenuExpanded) {
                e.preventDefault()
                toggleMenuState(true)
            } else if (diffY < -50 && isMenuExpanded) {
                e.preventDefault()
                toggleMenuState(false)
            }
        } else {
            const currentX = e.touches[0].clientX
            const diffX = startX - currentX
            if (diffX > 50 && !isMenuExpanded) {
                e.preventDefault()
                toggleMenuState(true)
            } else if (diffX < -50 && isMenuExpanded) {
                e.preventDefault()
                toggleMenuState(false)
            }
        }
    }, { passive: true })

    // タブナビゲーションのスクロール処理（タッチ）
    let isScrolling = false
    let scrollStartX

    tabNavigation.addEventListener('touchstart', function(e) {
        isScrolling = true
        scrollStartX = e.touches[0].clientX
    }, { passive: true })

    tabNavigation.addEventListener('touchmove', function(e) {
        if (!isScrolling) return
        const currentX = e.touches[0].clientX
        tabNavigation.scrollLeft += scrollStartX - currentX
        scrollStartX = currentX
    }, { passive: true })

    tabNavigation.addEventListener('touchend', function() {
        isScrolling = false
    }, { passive: true })

    // タブナビゲーションのマウスドラッグ（デスクトップ）
    let isDragging = false
    let dragStartX
    let scrollLeft

    tabNavigation.addEventListener('mousedown', function(e) {
        isDragging = true
        dragStartX = e.pageX
        scrollLeft = tabNavigation.scrollLeft
        tabNavigation.style.cursor = 'grabbing'
        setTimeout(() => { if (isDragging) tabNavigation.style.userSelect = 'none' }, 150)
    })

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return
        tabNavigation.scrollLeft = scrollLeft - (e.pageX - dragStartX) * 1.5
    })

    document.addEventListener('mouseup', function() {
        if (!isDragging) return
        isDragging = false
        tabNavigation.style.cursor = 'grab'
        tabNavigation.style.userSelect = ''
    })

    document.addEventListener('mouseleave', function() {
        if (isDragging) {
            isDragging = false
            tabNavigation.style.cursor = 'grab'
            tabNavigation.style.userSelect = ''
        }
    })

    // タブ切り替え
    function setupTabListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn')
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                tabButtons.forEach(btn => btn.classList.remove('active'))
                this.classList.add('active')
                currentTab = this.textContent
                generateMenuContent(currentTab)
            })
        })
    }

    // 商品表示ボタンのイベントリスナー設定
    function setupProductButtons() {
        const viewItemPanels = document.querySelectorAll('.load-item-panel')
        viewItemPanels.forEach(panel => {
            panel.addEventListener('click', function() {
                const productId = parseInt(this.dataset.productId)
                const product = productModels.find(p => p.id === productId)
                if (product && product.model) {
                    if (window.loadModel && typeof window.loadModel === 'function') {
                        window.loadModel(product.model, product.name, product.description, product.price)
                        if (isMobileView) toggleMenuState(false)
                    } else {
                        console.error('loadModel関数が定義されていません')
                    }
                } else {
                    const productName = this.querySelector('.menu-item-title').textContent
                    alert(`${productName}の3Dモデルは利用できません。`)
                }
            })
        })
    }
})
