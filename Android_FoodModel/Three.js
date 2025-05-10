import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

let scene, camera, light, renderer;

let reticle;

let detailDiv = null;
let detailNum = 0;

let labelRenderer;
let mouse;
let raycaster;
// レイキャストで反応させたい物を格納しておくリスト
let objectList = [];

// 表示するオブジェクトのレイヤーの番号を格納する変数
let layerNum = 1;

// ユーザー周囲の空間平面の検出用オブジェクトを格納する
let hitTestSource = null;
// ヒットテストをリクエストしていないかどうかを確認するための変数
let hitTestSourceRequested = false;

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

    // rendererのオプションとして{requiredFeatures: ['hit-test']}を記述して
    // 「ユーザーの周囲の平面を検出する」機能をオンにしているこれによりframe.getHitTestResults()を有効化
    const arButton = (ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'dom-overlay-for-handle-ar' ], // モバイルでのUIの実装のために記述
        domOverlay: { root: document.body } // どの要素をオーバーレイ領域として扱うかを指定
    }));
    document.body.appendChild( arButton );

    // レティクルの作成
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.07, 32).rotateX( -Math.PI / 2),
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

        // 今回表示するモデルの読み込み
        const loader = new GLTFLoader();
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        const clone = model.clone(true);
        // 詳細オブジェクトの表示状態をboolean値で設定
        clone.userData.isDetail = true;
        // レティクルが示すワールド座標、向き、大きさをmeshに適応させreticleの在った場所にオブジェクトを表示
        reticle.matrix.decompose(clone.position, clone.quaternion, clone.scale);
        // cloneも同じレイヤーに所属させるために設定
        clone.layers.set(layerNum);
        scene.add(clone);
        objectList.push(clone);

        // 詳細情報を設定
        detailDiv = document.createElement('div');
        detailDiv.className = 'detail';
        detailDiv.textContent = modelDetail;

        // 作成したdiv情報をオブジェクトとして作成
        const detail = new CSS2DObject(detailDiv);
        detail.position.set(0.01, 0.08, -0.03);
        detail.center.set(0, 1);
        detail.layers.set(layerNum);
        clone.add(detail);

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

init();

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
                hitTestSource = null;
                hitTestSourceRequested = false;
                reticleShowTime = null;
                viewNum = 0;
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