document.addEventListener('DOMContentLoaded', function() {
    const menuContainer = document.getElementById('menuContainer');
    const menuToggle = document.getElementById('menuToggle');
    const toggleText = document.getElementById('toggleText');
    const tabNavigation = document.querySelector('.tab-navigation');
    const menuToggleDesktop = document.getElementById('menuToggleDesktop');
    const ARButton = document.getElementById('ARButton');

    let startY = 0;
    let startX = 0;
    let isMenuExpanded = false;
    let isMobileView = window.innerWidth < 768;
    let currentTab = 'メインメニュー';

    // 商品とモデルの関連付け
    const productModels = {
        '九種盛り': './models/9種盛り編集済(完).glb',
        'カルビ盛り': './models/カルビ盛り編集済.glb',
        'コプチャン': './models/コプチャン(味噌)1人前.glb',
        'ご飯大': './models/ご飯大.glb',
        'サンチュ': './models/サンチュ1人前.glb',
        'テッチャン': './models/テッチャン2人前.glb',
        'ニンニク焼き': './models/ニンニク焼き.glb',
        'ハラミ': './models/ハラミ2人前.glb',
        'もやしナムル': './models/もやしナムル1.glb',
        'レバー塩': './models/レバー塩1人前.glb',
        '上カルビ': './models/上カルビ1人前.glb',
        '上タン塩２人前': './models/Tun_of2.glb',
        '盛岡冷麺': './models/盛岡冷麺.glb',
        '特上カルビ': './models/特上カルビ1人前編集済.glb',
        '豚トロ': './models/豚トロ2人前.glb',
        '馬刺し': './models/馬刺し.glb',
        '並カルビ': './models/並カルビ1人前.glb',
        '和牛のタン先': './models/タン先1人前.glb',
    };

    // 商品のカテゴリごとの情報を格納した連想配列
    const recMenuItems = {
        '特上カルビ': {
            'image': './images/特上カルビ.PNG',
            'model': './models/特上カルビ1人前編集済.glb',
            'description': '特上カルビの説明文',
            'price': 2000,
        },
        '上カルビ': {
            'image': './images/上カルビ１人前.PNG',
            'model': './models/上カルビ1人前.glb',
            'description': '上カルビの説明文',
            'price': 1500,
        },
        '並カルビ': {
            'image': './images/並カルビ.PNG',
            'model': './models/並カルビ1人前.glb',
            'description': '並カルビの説明文',
            'price': 1000,
        },
        '豚トロ': {
            'image': './images/豚トロ２人前.PNG',
            'model': './models/豚トロ2人前.glb',
            'description': '豚トロの説明文',
            'price': 3000,
        },
        '盛岡冷麺': {
            'image': './images/盛岡冷麺.PNG',
            'model': './models/盛岡冷麺.glb',
            'description': '盛岡冷麺の説明文',
            'price': 980,
        },
    }

    // 画面サイズによってメニューの状態を初期化
    function initMenuBasedOnScreenSize() {
        isMobileView = window.innerWidth < 768;

        if (isMobileView) {
            // モバイル表示: 下部からスライドアップ
            menuContainer.classList.add('mobile-view');
            menuContainer.classList.remove('desktop-view', 'desktop-expanded', 'desktop-collapsed');
            // 画面回転時にもメニューが見えるようにする
            if (!menuContainer.classList.contains('collapsed') && !menuContainer.classList.contains('expanded')) {
                menuContainer.classList.add('collapsed');
            }
        } else {
            // デスクトップ表示: 右側から表示
            menuContainer.classList.add('desktop-view');
            menuContainer.classList.remove('mobile-view', 'collapsed', 'expanded');
            // デスクトップでデフォルトで閉じる
            if (!menuContainer.classList.contains('desktop-collapsed') && !menuContainer.classList.contains('desktop-expanded')) {
                menuContainer.classList.add('desktop-expanded');
            }
            // containsメソッドを使用するとtrue,falseで含まれているかを確認できる
            isMenuExpanded = menuContainer.classList.contains('desktop-expanded');
            toggleText.textContent = isMenuExpanded ? 'メニューを閉じる' : 'メニューを開く';
        }
    }

    // ウィンドウリサイズ時にメニュー状態を更新
    window.addEventListener('resize', initMenuBasedOnScreenSize);

    // 画面の向きが変わったときのイベント
    window.addEventListener('orientationchange', function() {
        // 少し遅延を入れて正確なサイズを取得
        setTimeout(function() {
            initMenuBasedOnScreenSize();
        }, 100);
    });

    // 初期表示時のメニュー状態を設定
    initMenuBasedOnScreenSize();

    // Toggle menu state on click
    menuToggle.addEventListener('click', function() {
        toggleMenuState();
    });

    // デスクトップ用トグルボタンのイベント
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
            // モバイル表示時の動作
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
            // デスクトップ表示時の動作
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
        // eはタッチイベント(touchstart, touchmove, touchendなど)、
        // e.touchesは画面上に現在触れている指の一覧(例：２本指でタッチされていればe.touches.length= 2)
        // .clientYはふれた指のY座標を返す
        startY = e.touches[0].clientY;

        // タッチ開始時のX座標も記録（右から左へのスワイプ用）
        startX = e.touches[0].clientX;
    });

    menuContainer.addEventListener('touchmove', function(e) {
        // タブナビゲーション内でのタッチムーブは通常のスクロールを許可
        if (e.target.closest('.tab-navigation')) {
            return; // タブナビゲーション内のタッチはデフォルト動作を止めない
        }

        // メニューコンテンツ内のスクロールを許可する
        if (e.target.closest('.menu-content') && isMenuExpanded) {
            // すでに展開されている場合、ドラッグをスクロールとして扱う
            return;
        }

        const currentY = e.touches[0].clientY;
        const diffY = startY - currentY;

        // モバイル表示時の上下スワイプ処理
        if (isMobileView) {
            // Swiping up to expand
            if (diffY > 50 && !isMenuExpanded) {
                e.preventDefault(); // Prevent scrolling while swiping
                toggleMenuState(true);
            }
            // Swiping down to collapse
            else if (diffY < -50 && isMenuExpanded) {
                e.preventDefault(); // Prevent scrolling while swiping
                toggleMenuState(false);
            }
        }
        // デスクトップ表示時の左右スワイプ処理
        else {
            const currentX = e.touches[0].clientX;
            const diffX = startX - currentX;

            // 右から左へのスワイプで開く
            if (diffX > 50 && !isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(true);
            }
            // 左から右へのスワイプで閉じる
            else if (diffX < -50 && isMenuExpanded) {
                e.preventDefault();
                toggleMenuState(false);
            }
        }
    });

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
        // 通常のクリックを妨げないように、短いタイマーを設定
        setTimeout(() => {
            if (isDragging) {
                tabNavigation.style.userSelect = 'none';
            }
        }, 150);
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
    
        const x = e.pageX;
        const walk = (x - dragStartX) * 1.5; // スクロール倍率を調整
        tabNavigation.scrollLeft = scrollLeft - walk;
    });
    
    document.addEventListener('mouseup', function() {
        if (!isDragging) return;
        
        isDragging = false;
        tabNavigation.style.cursor = 'grab';
        tabNavigation.style.userSelect = '';
    });
    
    // スクロール中にカーソルがナビゲーションから外れた場合も対応
    document.addEventListener('mouseleave', function() {
        if (isDragging) {
            isDragging = false;
            tabNavigation.style.cursor = 'grab';
            tabNavigation.style.userSelect = '';
        }
    });
    
    // タブ切り替え機能
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            // タブの内容に応じてコンテンツを変更
            currentTab = this.textContent;
            updateContent(currentTab);
        });
    });

    // 元のメニューコンテンツを保存
    const originalMenuContent = document.querySelector('.menu-content').innerHTML;

    // タブに応じてコンテンツを更新する関数
    function updateContent(tabName) {
        const menuContent = document.querySelector('.menu-content');

        // タブに応じてコンテンツを変更
        if (tabName === 'メインメニュー') {
            // メインメニューのコンテンツを表示（元のコンテンツを復元）
            menuContent.innerHTML = originalMenuContent;
            setupProductButtons();

        } else if (tabName === 'おすすめ') {
            // おすすめメニューのコンテンツを上で指定した連想配列から表示
            let modelHTML = '';
            for (const recMenuItem in recMenuItems) {
                modelHTML += `
                <div class="menu-item load-item-panel">
                    <img src="${recMenuItems[recMenuItem]['image']}" alt="${recMenuItem}" class="menu-item-image">
                    <div class="menu-item-info">
                        <div class="menu-item-title">${recMenuItem}</div>
                        <div class="menu-item-description">${recMenuItems[recMenuItem]['description']}</div>
                        <div class="menu-item-price">¥${recMenuItems[recMenuItem]['price']}</div>
                        <button class="view-item-btn">商品を表示</button>
                    </div>
                </div>`;
            }
            console.log('この関数は発火されていますか？')
            // なんか表示されないので修正必要！！！
            menuContent.innerHTML = modelHTML;
            setupProductButtons();

        } else if (tabName === 'ドリンク') {
            // ドリンクメニューのコンテンツを表示
            menuContent.innerHTML = `
            <div class="menu-item">
                <img src="/api/placeholder/300/200" alt="生ビール" class="menu-item-image">
                <div class="menu-item-info">
                    <div class="menu-item-title">生ビール</div>
                    <div class="menu-item-price">¥600</div>
                    <button class="view-item-btn">商品を表示</button>
                </div>
            </div>
            <div class="menu-item">
                <img src="/api/placeholder/300/200" alt="日本酒" class="menu-item-image">
                <div class="menu-item-info">
                    <div class="menu-item-title">日本酒</div>
                    <div class="menu-item-price">¥800</div>
                    <button class="view-item-btn">商品を表示</button>
                </div>
            </div>
            <div class="menu-item">
                <img src="/api/placeholder/300/200" alt="ソフトドリンク" class="menu-item-image">
                <div class="menu-item-info">
                    <div class="menu-item-title">ソフトドリンク</div>
                    <div class="menu-item-price">¥400</div>
                    <button class="view-item-btn">商品を表示</button>
                </div>
            </div>`;

            setupProductButtons();
        }
    }

    // モデルを読み込んで表示する関数
    function loadAndDisplayModel(modelPath) {
        // モデルの読み込みと表示処理をglobalのloadModelメソッドに委譲
        // window.loadModelメソッドが存在しているか、またそれが関数として機能しているかを確かめ
        if (window.loadModel && typeof window.loadModel === 'function') {
            // 存在していたらThree.jsに記述してあるwindow.loadModel関数にモデルのパスを渡して起動
            window.loadModel(modelPath);

            // メニューを閉じる
            if (isMobileView) {
                toggleMenuState(false);
            }
        } else {
            console.error('loadModel関数が定義されていません');
        }
    }

    // 商品表示ボタンのイベントリスナーを設定
    function setupProductButtons() {
        const viewItemButtons = document.querySelectorAll('.view-item-btn');
        const viewItemPanels = document.querySelectorAll('.load-item-panel');

        viewItemButtons.forEach(button => {
            button.addEventListener('click', function() {
                const productName = this.closest('.menu-item-info').querySelector('.menu-item-title').textContent;

                // 製品名に対応するモデルパスを取得
                const modelPath = productModels[productName];

                if (modelPath) {
                    // モデルを読み込んで表示
                    loadAndDisplayModel(modelPath);
                } else {
                    alert(`${productName}の3Dモデルは利用できません。`);
                }
            });
        });
        viewItemPanels.forEach(panel => {
            panel.addEventListener('click', function() {
                const productName = this.querySelector('.menu-item-title').textContent;

                // 製品名に対応するモデルパスを取得
                const modelPath = productModels[productName];

                if (modelPath) {
                    // モデルを読み込んで表示
                    loadAndDisplayModel(modelPath);
                } else {
                    alert(`${productName}の3Dモデルは利用できません。`);
                }
            });
        });
    }

    // 初期設定：商品表示ボタンのイベントリスナーを設定
    setupProductButtons();
});