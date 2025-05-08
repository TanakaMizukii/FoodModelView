import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"

let renderer, camera, scene;
let arToolkitContext, arToolkitSource, arMarkerControls;

let markerRoot;

let nowModel = null;
let detailDiv = null;
let detailNum = 0;

// マウスの情報を入れる変数を作成
let mouse;
// レイキャストを作成
let raycaster;
// レイキャストで反応させたいオブジェクトを格納しておくリストを作成
let objectList = [];

let labelRenderer;

const canvasElement = document.querySelector('#myCanvas');

async function init() {
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        alpha: true,
        antialias: false,
    });

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set( 0, 1, 0);
    scene.add(light);

    // カメラのキャリブレーションと利用するマークの指定、画面のリサイズ処理
    // THREEx.ArToolkitContextは「マーカー検出エンジン」の初期化を行うためのオブジェクト
    arToolkitContext = new THREEx.ArToolkitContext({
        // カメラのキャリブレーションを行うためのdatファイルを挿入
        cameraParametersUrl: './data/camera_para.dat',
        // 比率を記述
        patternRatio: 0.6,
        // モードの選択
        detectionMode: 'mono_and_matrix',
    });

    // THREEx.ArToolkitSourceではARとして使用する情報源(ソース)を指定
    arToolkitSource = new THREEx.ArToolkitSource({
        sourceType: 'webcam',
    });

    markerRoot = new THREE.Group();
    scene.add(markerRoot);

    // THREEx.ArMarkerControlsでは使用するマーカーの種類と、そのURLを指定
    arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
        type: 'pattern',
        patternUrl: './data/pattern-qrcode_www.ryusei2024mymake.com (1).patt',
    });

    // それぞれの初期化を行う
    arToolkitContext.init(() => {
        // Three.jsカメラの画角やアスペクト比を、実際のカメラ映像とぴったり一致させる。
        camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
    });

    arToolkitSource.init(() => {
        // videoタグを.wrapper配下に移動させる。
        document.querySelector('.wrapper').appendChild(arToolkitSource.domElement);
        setTimeout(handleResize, 400); // リサイズイベントを発火
    });

    // 詳細情報表示用のRendererを作成
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.id = 'label';
    document.body.appendChild(labelRenderer.domElement);

    // マウスの位置を格納するベクトルを作成
    mouse = new THREE.Vector2();
    // レイキャストの作成
    raycaster = new THREE.Raycaster();
    labelRenderer.domElement.addEventListener('click', handleClick);

    // 初回モデル表示の実装
    await loadModel('./models/Tun_of2.glb', 'タンの中の上質な部分を選別 程よい油が口の中に広がります')

    window.addEventListener('resize', handleResize, {
        passive: true,
    });
}

window.loadModel = async function (modelPath, modelDetail) {
    try {
        if (nowModel) {
            markerRoot.remove(nowModel);
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
        const loader = new GLTFLoader();
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        model.scale.set(8, 8, 8);
        // 詳細情報の表示状態をboolean値で設定
        model.userData.isDetail = true;
        markerRoot.add(model);
        // レイキャスト用の配列に保存
        objectList.push(model);
        nowModel = model;

        // モデル内のすべてのメッシュをobjectListに追加
        model.traverse(function(child) {
            if (child instanceof THREE.Mesh) {
                objectList.push(child);
                // 各メッシュにもユーザーデータを設定
                child.userData.isDetail = true;
            }
        })

        // 詳細情報を設定
        const detailElement = document.querySelector('.detail');
        if (detailElement) {
            detailElement.remove();
        }
        detailDiv = document.createElement('div');
        detailDiv.className = 'detail';
        detailDiv.textContent = modelDetail;

        // 作成したdiv情報をオブジェクトとして作成
        const detail = new CSS2DObject(detailDiv);
        detail.position.set(0.01, 0.08, -0.03);
        detail.center = new THREE.Vector2();
        detail.center.set(0, 0.8);
        model.add(detail);
        detail.layers.set(1);

        // ローディングを非表示に
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.remove('visible');
                // 初回だけ詳細情報を無条件で表示させる
                if (detailNum = 0) {
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
        const clickedObject = intersects[0].object;
        // この操作で今の値(boolean値)を反転させる
        if (clickedObject.userData.isDetail == undefined) {
            clickedObject.userData.isDetail = true;
        };
        clickedObject.userData.isDetail =! clickedObject.userData.isDetail;

        if (clickedObject.userData.isDetail) {
            camera.layers.enable(1);
        } else {
            camera.layers.disable(1);
        };
    };
}

init();
animate();
handleResize();

function animate() {
    if (arToolkitSource.ready) {
        arToolkitContext.update(arToolkitSource.domElement);
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);

    if (arToolkitSource.ready) {
        arToolkitSource.onResize();
        arToolkitSource.copyElementSizeTo(renderer.domElement);
    }

    renderer.setPixelRatio(window.devicePixelRatio);
}
