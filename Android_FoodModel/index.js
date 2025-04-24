import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let container;
let scene, camera, light, renderer;
let controller;

let reticle;

// ユーザー周囲の空間平面の検出用オブジェクトを格納する
let hitTestSource = null;
// ヒットテストをリクエストしていないかどうかを確認するための変数
let hitTestSourceRequested = false;

init();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, width / height, 0.005, 10);

    light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set( 0, 1, 0);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setAnimationLoop(animate);
    renderer.xr.enabled = true;
    // container(div要素)に<canvas>を追加
    container.appendChild(renderer.domElement);

    // rendererのオプションとして{requiredFeatures: ['hit-test']}を記述して
    // 「ユーザーの周囲の平面を検出する」機能をオンにしているこれによりframe.getHitTestResults()を有効化
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // レティクルのvisible=trueの時に表示するオブジェクトの作成
    // モデルの読み込み
    const loader = new GLTFLoader();
    async function onSelect() {
        if (reticle.visible) {
            const objects = await loader.loadAsync('./foodModels/Tun_of2.glb');
            const model = objects.scene;
            const clone = model.clone(true);
            // レティクルが示すワールド座標、向き、大きさをmeshに適応させreticleの会った場所にオブジェクトを表示
            reticle.matrix.decompose( clone.position, clone.quaternion, clone.scale);
            scene.add(clone);
        }
    }

    // レティクルの作成
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.12, 32).rotateX( -Math.PI / 2),
        new THREE.MeshBasicMaterial(),
    );
    // 自動更新をオフに
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onResize);

    // タッチなどを受け取るコントローラーを作成
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);
}

/* animate 関数は、WebGLRendererのsetAnimationLoopによって
毎フレーム呼ばれ、その際にtimestamp, frameの二つの引数が渡される
timestampおよび performance.now()はページが読み込まれてからの経過時間を、
frameは、XRFrameオブジェクトであり、そのフレームにおけるWebXRの様々な状態情報を提供する。 */
function animate(timestamp, frame) {
    if (frame) {
        // rendererReferenceSpaceはXRコンテンツの座標系（カメラが何処に在って、何処を向いているのか）を表すオブジェクト
        // 例えるなら、現実世界の「地図上の座標」のようなもので、どこに何かを置くかの基準となる場所。
        const rendererReferenceSpace = renderer.xr.getReferenceSpace();
        // 現在実行中のAR体験そのものを指す。
        // 例えるなら、AR体験が始まっている「部屋」や「セッション」のようなもので、その中でユーザーの動きやカメラの情報、入力デバイスの状態などを管理している。
        // この session を使って、例えばヒットテストの要求やデバイスからの入力を扱う。
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            // viewerReferenceSpace は取得した座標系（カメラが何処に在って、何処を向いているのか）の情報で、後でヒットテストに使う。
            /* .thenは左側で成功した物を右側の引き数として使用する！ */
            session.requestReferenceSpace('viewer').then( function (viewerReferenceSpace) {
                // ヒットテストソースとは、ユーザーの環境内にある平面や表面などを検出するためのデータを取得するためのオブジェクト
                // 例えば、ARで「どこにオブジェクトを置くか」を判断するために、ユーザーの周りに実際に存在する床やテーブルなどの平面情報を得るために使われる
                // この処理も Promise を返すので、.then(function (source) {...}) により、成功した場合に取得したソースを処理
                session.requestHitTestSource({ space: viewerReferenceSpace }).then( function (source) {
                    // ここで、Promise が返したヒットテストソース（source）を、グローバル変数 hitTestSource に保存
                    hitTestSource = source;
                });
                // session.requestHitTestSource({ space: referenceSpace })が成功すると、WebXR API は XRHitTestSource オブジェクトを返す。
                // この操作によって次からはframe.getHitTestResults(hitTestSource) を使うことでヒットテストの結果の配列を取得できるようになる。
                // frame.getHitTestResultsはユーザーの環境内に存在する平面（床、テーブルなど）との交差情報を取得できる「窓口」のような存在となる。
            });

            hitTestSourceRequested = true;

            session.addEventListener('end', function() {
                hitTestSource = null;
                hitTestSourceRequested = false;
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