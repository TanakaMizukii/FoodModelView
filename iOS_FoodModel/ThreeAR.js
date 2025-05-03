import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


let renderer, camera, scene;
let arToolkitContext, arToolkitSource, arMarkerControls;

let markerRoot;

let nowModel = null;
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

    // 初回モデル表示の実装
    await loadModel('./models/Tun_of2.glb')

    window.addEventListener('resize', handleResize, {
        passive: true,
    });
}

window.loadModel = async function (modelPath) {
    // まずは標示していたモデルを分解してメモリを解放する関数を定義
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
            console.log('メモリの解放が行われました');
        })
    };

    try {
        if (nowModel) {
            markerRoot.remove(nowModel);
            // 変更する前に今まで映していたモデルのメモリの解放
            disposeModel(nowModel);
        }

        // ローディングインジケーターの標示

        // 今回表示するモデルの読み込み
        const loader = new GLTFLoader();
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        model.scale.set(8, 8, 8);
        markerRoot.add(model);
        nowModel = model;
        console.log(nowModel);

        return true;
    } catch (error) {
        console.log(error);
        alert('モデルの読み込みに失敗しました。');
        return false;
    }
}

init();
animate();
handleResize();

// 表示するモデルを作成


function animate() {
    if (arToolkitSource.ready) {
        arToolkitContext.update(arToolkitSource.domElement);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function handleResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    if (arToolkitSource.ready) {
        arToolkitSource.onResize();
        arToolkitSource.copyElementSizeTo(renderer.domElement);
    }

    renderer.setPixelRatio(window.devicePixelRatio);
}
