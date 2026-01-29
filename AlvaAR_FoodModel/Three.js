import * as THREE from 'three';

/**
 * Three.js アプリを作って返す（初期化はここ）
 * @param {HTMLElement} container
 * @param {number} width
 * @param {number} height
 * @param {string} modelUrl
 */
export async function createThreeApp(container, width, height)
{
    // Renderer
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    // DOMに追加（どこに入れるかは呼び出し側で決めてもOKだが、ここでやるなら）
    container.appendChild(renderer.domElement);

    // Scene / Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    scene.add(camera);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    return {
        renderer,
        scene,
        camera,
    };
}

window.loadModel = async function (modelPath, modelDetail) {
    try {
        if (nowModel) {
            smoothedRoot.remove(nowModel);
            // 変更する前に今まで映していたモデルのメモリの解放
            disposeModel(nowModel);

            // オブジェクトのリストをクリア
            objectList = [];
        }

        // ローディングインジケーターの標示
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay) {
            loadingOverlay.classList.add('visible');
        }

        // 今回表示するモデルの読み込み
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        model.scale.set(5, 5, 5);
        // 詳細情報の表示状態をboolean値で設定
        model.userData.isDetail = true;
        smoothedRoot.add(model);
        // レイキャスト用の配列に保存
        objectList.push(model);
        nowModel = model;

        // モデル内のすべてのメッシュをobjectListに追加
        model.traverse(function(child) {
            if (child instanceof THREE.Mesh) {
                objectList.push(child);
                // 各メッシュにもユーザーデータを設定
                // child.userData.isDetail = true;
            }
        })

        // 詳細情報を設定
        detailDiv = document.createElement('div');
        detailDiv.className = 'detail';
        detailDiv.textContent = modelDetail;

        // 作成したdiv情報をオブジェクトとして作成
        const detail = new CSS2DObject(detailDiv);
        detail.position.set(0.1, 0.08, -0.03);
        detail.center = new THREE.Vector2();
        detail.center.set(0, 0.8);
        model.add(detail);
        detail.layers.set(1);

        // ローディングを非表示に
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.remove('visible');
                // 初回だけ詳細情報を無条件で表示させる
                if (detailNum == 0) {
                    camera.layers.enable(1);
                    detailNum += 1;
                }
            }, 100);
        }

        return true;
    } catch (error) {
        const loadingOverlay = document.getElementById('loading');
        if(loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.remove('visible');
            }, 100);
        }
        console.log(error);
        alert('モデルの読み込みに失敗しました。');
        return false;
    }
}

// 表示していたモデルを分解してメモリを解放する関数
function disposeModel(targetModel) {
    const detailElement = document.querySelector('.detail');
    if (detailElement) {
        detailElement.remove();
    }
    targetModel.traverse(function (obj) {
        // objにはtargetModelが入る
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose(); // ジオメトリの開放
            if (obj.material.isMaterial) {
                obj.material.dispose(); // 単一マテリアルの解放
            } else {
                for (const material of obj.material) {
                    material.dispose(); // マルチマテリアルの解放
                }
            }
            if (obj.material.map) {
                obj.material.map.dispose(); // テクスチャの解放
            }
        }
    })
}

// canvas内をクリックした際に発動する関数
function handleClick(event) {
    const element = event.currentTarget;
    // canvas要素上のXY座標
    const x = event.clientX - element.offsetLeft;
    const y = event.clientY - element.offsetTop;
    // canvas要素の幅・高さ
    const w = element.offsetWidth;
    const h = element.offsetHeight;

    // クリックしたマウスの座標を-1~+1の範囲で判定し登録する
    mouse.x = (x / w) * 2 - 1;
    mouse.y = -(y / h) * 2 + 1;

    // マウス位置にまっすぐ伸びる光線ベクトルを作成
    raycaster.setFromCamera(mouse, camera);
    // 作成した光線とぶつかったオブジェクトを取得
    const intersects = raycaster.intersectObjects(objectList, true);

    // クリックしたオブジェクトがそこに存在していれば値を変更
    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && clickedObject !== nowModel && clickedObject !== markerRoot) {
            clickedObject = clickedObject.parent;
        }

        // この操作で今の値(boolean値)を反転させる
        if (clickedObject.userData.isDetail == undefined) {
            clickedObject.userData.isDetail = true;
        };
        clickedObject.userData.isDetail = !clickedObject.userData.isDetail;
        const detailElement = document.querySelector('.detail');

        if (clickedObject.userData.isDetail) {
            detailElement.style.visibility = 'visible';
            // camera.layers.enable(1);
        } else {
            detailElement.style.visibility = 'hidden';
            // camera.layers.disable(1);
        };
    };
}
