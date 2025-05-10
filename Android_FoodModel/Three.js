import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let scene, camera, light, renderer;
let controller;

let reticle;

// 初回オブジェクト表示に使用
let viewerNum = null;

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
    // 自動更新をオフに
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onResize);

    // タッチなどを受け取るコントローラーを作成
    controller = renderer.xr.getController(0);
    // controller.addEventListener('select', await loadModel('./models/Tun_of2.glb'));
    scene.add(controller);
}

// レティクルのvisible=trueの時に表示するオブジェクトの作成
// モデルの読み込み
window.loadModel = async function(modelPath) {
    try {
        const loader = new GLTFLoader();
        const objects = await loader.loadAsync(modelPath);
        const model = objects.scene;
        const clone = model.clone(true);
        // レティクルが示すワールド座標、向き、大きさをmeshに適応させreticleの在った場所にオブジェクトを表示
        reticle.matrix.decompose(clone.position, clone.quaternion, clone.scale);
        scene.add(clone);
    } catch(error) {
        alert('モデルの読み込みに失敗しました。');
        return false;
    }
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
                window.loadModel('./models/Tun_of2.glb');
                viewNum = 1;
                reticleShowTime = null;
            }
        }
    }

    renderer.render(scene, camera);
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}