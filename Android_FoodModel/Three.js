import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;

let scene, camera, light, renderer;

let reticle;

let detailDiv = null;
let detailNum = 0;

let labelRenderer;
let mouse;
let raycaster;

let loader;
let ktx2;
// レイキャストで反応させたい物を格納しておくリスト
let objectList = [];

let currentSession;

// 表示するオブジェクトのレイヤーの番号を格納する変数
let layerNum = 1;

// ユーザー周囲の空間平面の検出用オブジェクトを格納する
let hitTestSource = null;
// ヒットテストをリクエストしていないかどうかを確認するための変数
let hitTestSourceRequested = false;

// ガイド用DOM要素の取得
const startOverlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
const statusText = document.getElementById('status-text');
const loadingSpinner = document.getElementById('loading-spinner');
const arUI = document.getElementById('ar-ui');
const scanningOverlay = document.getElementById('scanning-overlay');
const exitButton = document.getElementById('exit-button');
const menuContainer = document.getElementById('menuContainer');

// WebXR対応自動確認
autoStart();
async function autoStart() {
    const isArSupported = navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'));
    console.log(isArSupported);

    if (isArSupported) {
        startButton.addEventListener('click', init);
        exitButton.addEventListener('click', exitAR);
    } else {
        showError(`AR権限の確認に失敗しました<br><small>ブラウザの設定をご確認ください</small>`);
    }
};

function exitAR() {
    if (currentSession) {
        currentSession.end();
    }
}

function showError(message) {
    startOverlay.innerHTML = `
        <div class="error-message">
            <h3>エラー</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="background: white; color: #333; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                再試行
            </button>
        </div>
    `;
}

async function init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, width / height, 0.005, 10);

    light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set( 0, 1, 0);
    scene.add(light);

    const canvasElement = document.querySelector('#myCanvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    renderer.xr.enabled = true;

    // モデルデータを読み込むためのローダーを作成
    // KTX2を準備
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('./basis/');
    ktx2.detectSupport(renderer);
    loader = new GLTFLoader();
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    // レティクルの作成
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.065, 32).rotateX( -Math.PI / 2),
        new THREE.MeshBasicMaterial(),
    );
    // レティクルの交差情報の自動更新をオフに
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.id = 'label';
    document.body.appendChild(labelRenderer.domElement);

    mouse = new THREE.Vector2();

    raycaster = new THREE.Raycaster();
    labelRenderer.domElement.addEventListener('click', handleClick);

    startARSession();
    // ARButtonの代わりをここに作成
    async function startARSession() {
        try {
            updateStatus('ARセッションを開始中...', true);

            const sessionInit = {
                requiredFeatures: ['local'],
                optionalFeatures: ['dom-overlay', 'hit-test'],
                domOverlay: {root: document.body}
            };

            // セッション開始時の処理
            const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
            currentSession = session;
            renderer.xr.setReferenceSpaceType('local');
            renderer.xr.setSession(session);

            // UIの更新
            hideStartOverlay();
            showScanningOverlay();
            console.log('ARセッション開始成功')

        } catch (error) {
            console.error('ARセッション開始エラー:', error);
            showError('ARセッションの開始に失敗しました: ' + error.message);
        }
    };

    window.addEventListener('resize', onResize);
}

// レティクルのvisible=trueの時に表示するオブジェクトの作成
// モデルの読み込み
window.loadModel = async function(modelPath, modelDetail) {
    try {
        // ローディングインジケーターの表示
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay) {
            loadingOverlay.classList.add('visible');
        }
        console.log(modelDetail);

        // 詳細情報を設定
        detailDiv = document.createElement('div');
        detailDiv.className = 'detail';
        detailDiv.textContent = modelDetail;

        // 作成したdiv情報をオブジェクトとして作成
        const detail = new CSS2DObject(detailDiv);
        detail.position.set(0.01, 0.08, -0.03);
        detail.center.set(0, 1);
        detail.layers.set(layerNum);

        // 今回表示するモデルの読み込み
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        const clone = model.clone(true);
        // 詳細オブジェクトの表示状態をboolean値で設定
        clone.userData.isDetail = true;
        // レティクルが示すワールド座標、向き、大きさをmeshに適応させreticleの在った場所にオブジェクトを表示
        reticle.matrix.decompose(clone.position, clone.quaternion, clone.scale);
        // cloneも同じレイヤーに所属させるために設定
        clone.layers.set(layerNum);
        clone.add(detail);
        scene.add(clone);
        objectList.push(clone);

        // ローディングインジケーターを非表示
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.remove('visible');
                // 初回だけ無条件で表示を行う
                if (detailNum == 0) {
                    camera.layers.enable(layerNum);
                }
                detailNum += 1;
            }, 100);
        }

        return true;
    } catch(error) {
        const loadingOverlay = document.getElementById('loading');
        if(loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.remove('visible');
            }, 100);
        alert('モデルの読み込みに失敗しました。');
        return false;
        }
    }
}

function handleClick(event) {
    const element = event.currentTarget;
    // canvas要素上のXY座標
    const x = event.clientX - element.offsetLeft;
    const y = event.clientY - element.offsetTop;
    // canvas要素の幅・高さ
    const w = element.offsetWidth;
    const h = element.offsetHeight;

    // クリックしたらマウスの座標を-1~1の範囲で登録
    mouse.x = (x / w) * 2 - 1;
    mouse.y = -(y / h) * 2 + 1;

    // マウス位置に光線ベクトルを作成
    raycaster.setFromCamera(mouse, camera);
    // 光線とぶつかったオブジェクトを取得
    const intersects = raycaster.intersectObjects(objectList);

    // クリックした場所にオブジェクトが存在していれば値を変更
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log(clickedObject);

        // 値を反転させる
        if (clickedObject.userData.isDetail==undefined) {
            clickedObject.userData.isDetail = true;
        }
        clickedObject.userData.isDetail = !clickedObject.userData.isDetail;
        // レイヤーに合致する詳細情報を操作できるようにする
        if (clickedObject.userData.isDetail) {
            camera.layers.enable(clickedObject.layers['mask']);
        } else {
            camera.layers.disable(clickedObject.layers['mask']);
        }
    };
}

// 初回オブジェクト表示に使用する変数を作成
let reticleShowTime = null;  // visible になった瞬間の timestamp を記録
let viewNum = 0; // 表示回数を格納

function animate(timestamp, frame) {
    if (frame) {
        // rendererReferenceSpaceはXRコンテンツの座標系（カメラが何処に在って、何処を向いているのか）を格納
        const rendererReferenceSpace = renderer.xr.getReferenceSpace();
        // 現在実行中のAR体験そのもの。「部屋」のようなもの
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then( function (viewerReferenceSpace) {
                session.requestHitTestSource({ space: viewerReferenceSpace }).then( function (source) {
                    hitTestSource = source;
                });
            });

            hitTestSourceRequested = true;

            session.addEventListener('end', function() {
                hitTestSource.cancel();
                hitTestSource = null;
                hitTestSourceRequested = false;
                scene.remove(reticle);
                reticleShowTime = null;
                viewNum = 0;

                const label = document.getElementById('label');
                const parent = label.parentNode;
                parent.removeChild(label);

                // オブジェクトを削除
                const objectsToRemove = [];
                scene.children.forEach(child => {
                    // レティクル、ライト、は残す
                    if (child !== reticle && child !== light && child ) {
                        // GLTFから読み込まれたオブジェクトや他の追加オブジェクトを削除対象に
                        objectsToRemove.push(child);
                    }
                });
                objectsToRemove.forEach(obj => {
                    scene.remove(obj);
                    // メモリリークを防ぐためのクリーンアップ
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(material => material.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                });
                // UIの復元
                hideARUI();
                hideScanningOverlay();
                hideMenuContainer();
                showStartOverlay();
                resetUI();
            });
        };
        if ( hitTestSource ) {
            const hitTestResults = frame.getHitTestResults( hitTestSource );

            if (hitTestResults.length) {
                // hitTestResults[0] は、ユーザーのデバイスからのレイと平面との最初の交差結果（多くの場合、最も近い、もしくは最も信頼できる交差結果）を表し、[1] 以降はその他の候補が入っている。
                const hit = hitTestResults[0];

                reticle.visible = true;
                // ヒットテストで検出された平面の位置と向きを取得し、その結果をもとにreticle（ターゲットリング）の変換行列を更新する
                reticle.matrix.fromArray(
                    hit.getPose(rendererReferenceSpace).transform.matrix,
                );
                // ガイドを非表示
                hideScanningOverlay();
                showARUI();
                showMenuContainer();
            } else {
                // もしヒットテストに失敗したらreticleを非表示に
                reticle.visible = false;
            }
            // 初めてレティクルが見えた２秒後に初期オブジェクトを配置
            if (reticle.visible && reticleShowTime === null ) {
                reticleShowTime = timestamp;
            }
            if (!reticle.visible) {
                reticleShowTime = null; // reticleが消えたら経過時間を削除
            }
            // reticleが見えてから2秒以上経ったらモデル表示を一度だけ発火
            if (viewNum === 0  && reticleShowTime !== null && timestamp - reticleShowTime > 1500) {
                window.loadModel('./models/Tun_of2.glb', 'タンの中の上質な部分を選別 程よい油が口の中に広がります');
                viewNum = 1;
                reticleShowTime = null;
            }
        }
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
}

// UI更新関数
function updateStatus(message, showSpinner = false) {
    statusText.textContent = message;
    loadingSpinner.style.display = showSpinner ? 'block' : 'none';
}

function showMenuContainer() {
    menuContainer.style.display = 'block';
}
function hideMenuContainer() {
    menuContainer.style.display = 'none';
}

function hideStartOverlay() {
    startOverlay.style.display = 'none';
}

function showStartOverlay() {
    startOverlay.style.display = 'flex';
}

function showARUI() {
    arUI.style.display = 'block';
    exitButton.style.display = 'block';
}

function hideARUI() {
    arUI.style.display = 'none';
    exitButton.style.display = 'none';
}

function showScanningOverlay() {
    scanningOverlay.style.display = 'flex';
}

function hideScanningOverlay() {
    scanningOverlay.style.display = 'none';
}
function resetUI() {
    startOverlay.innerHTML = `
    <div id="status-text" class="status-text">ARエクスペリエンスを開始</div>
    <button id="start-button" class="start-button">AR体験を始める</button>
    <div id="loading-spinner" class="loading-spinner" style="display: none;"></div>
    `;
    // 新しいボタンにイベントリスナーを再設定
    document.getElementById('start-button').addEventListener('click', init);
}
