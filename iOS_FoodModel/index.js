import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvasElement = document.querySelector('#myCanvas');
const renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    alpha: true,
    antialias: true,
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const markerRoot = new THREE.Group();
scene.add(markerRoot);

// カメラのキャリブレーションと利用するマークの指定、画面のリサイズ処理
// THREEx.ArToolkitContextは「マーカー検出エンジン」の初期化を行うためのオブジェクト
const arToolkitContext = new THREEx.ArToolkitContext({
    // カメラのキャリブレーションを行うためのdatファイルを挿入
    cameraParametersUrl: '../data/camera_para.dat',
    // モードの選択
    detectionMode: 'mono',
});

// THREEx.ArToolkitSourceではARとして使用する情報源(ソース)を指定
const arToolkitSource = new THREEx.ArToolkitSource({
    sourceType: 'webcam',
});

// THREEx.ArMarkerControlsでは使用するマーカーの種類と、そのURLを指定
const arMarkerControls = new THREEx.ArMarkerControls(arToolkitContext, markerRoot, {
    type: 'pattern',
    patternUrl: '../data/patt.hiro',
});

// それぞれの初期化を行う
arToolkitContext.init(() => {
    // Three.jsカメラの画角やアスペクト比を、実際のカメラ映像とぴったり一致させる。
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
});

arToolkitSource.init(() => {
    // videoタグを.wrapper配下に移動させる。
    document.querySelector('.wrapper').appendChild(arToolkitSource.domElement);
    setTimeout(handleResize, 200); // リサイズイベントを発火
});

window.addEventListener('resize', handleResize, {
    passive: true,
});

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(1, 1, 1).normalize()
const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(directionalLight, ambientLight);

// 表示するモデルを作成
const loader = new GLTFLoader();
const objects = await loader.loadAsync('./models/Tun_of2.glb');
const model = objects.scene;
model.scale.set(10, 10, 10);
markerRoot.add(model);

animate();
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
