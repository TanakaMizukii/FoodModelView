import * as THREE from 'three';
import { Stats } from "./assets/stats.js";
import { AlvaAR } from './assets/alva_ar.js';
import { AlvaARConnectorTHREE } from './assets/alva_ar_three.js';
import { Camera, onFrame, resize2cover } from "./assets/utils.js";

import { createThreeApp } from './Three.js';
import storeInfo from './data/storeInfo.js';

const config = {
    video: {
        facingMode: 'environment',
        aspectRatio: 16 / 9,
        width: { ideal: 1280 }
    },
    audio: false,
}

const container = document.getElementById('container');
const canvas = document.createElement('canvas');
const overlay = document.getElementById('overlay');
const start = document.getElementById('start_button');
const splash = document.getElementById('splash');
const splashFadeTime = 800;

splash.style.transition = `opacity ${splashFadeTime / 1000}s ease`;
splash.style.opacity = 0;

setTimeout(() =>
{
    splash.remove();
    start.addEventListener('click', () =>
    {
        overlay.remove();
        document.getElementById('menuContainer').classList.remove('hidden');
        document.getElementById('menuToggleDesktop').classList.remove('hidden');
        document.getElementById('ar-ui').classList.remove('hidden');
        document.getElementById('exit-button').classList.remove('hidden');
        document.getElementById('clear-objects').classList.remove('hidden');
        Camera.Initialize(config).then(media => demo(media)).catch(error => alert('Camera ' + error));
    }, { once: true });
}, splashFadeTime);

async function demo(media)
{
    const video = media.el;
    const size = resize2cover(video.videoWidth, video.videoHeight, container.clientWidth, container.clientHeight);

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    video.style.width = size.width + 'px';
    video.style.height = size.height + 'px';

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const alva = await AlvaAR.Initialize(canvas.width, canvas.height);

    const applyPose = AlvaARConnectorTHREE.Initialize(THREE);

    // URLから店舗情報を取得
    const params = new URLSearchParams(window.location.search);
    const storeName = params.get('') || params.get('store') || 'kaishu';
    const store = storeInfo.find(s => s.use_name === storeName) || storeInfo[0];
    const defaultModel = store.firstEnvironment.defaultModel;
    const scaleAlvaAR = store.firstEnvironment.modelDisplaySettings.scaleAlvaAR;

    // Three.js 部分（別ファイルに分離したものを呼ぶ）
    const three = await createThreeApp(container, canvas.width, canvas.height);
    const scene = three.scene;
    const camera = three.camera;     // 以降の applyPose が使う camera はこれ
    const renderer = three.renderer; // insertBefore で使うなら
    const labelRenderer = three.labelRenderer;
    const loadModel = three.loadModel;
    const clearModels = three.clearModels;
    const checkReticleCollision = three.checkReticleCollision;

    // カメラ映像キャンバスを3Dモデルキャンバスより前へ置く
    container.insertBefore(canvas, renderer.domElement);

    // 平面可視化用レティクルの作成（水平平面に表示するためX軸で-90度回転）
    const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.065, 32).rotateY( Math.PI / 20),
        new THREE.MeshBasicMaterial({side: THREE.DoubleSide, transparent: true, opacity: 1.0}),
    );
    reticle.visible = false;
    reticle.scale.set(100, 100, 100);
    scene.add(reticle);

    // // デバッグ用: XYZ軸ヘルパーをレティクルに追加
    // // 赤=X, 緑=Y, 青=Z
    // const axesHelper = new THREE.AxesHelper(0.1);
    // axesHelper.scale.set(100, 100, 100); // レティクルのスケールを打ち消す

    // reticle.add(axesHelper);

    // ui.js のメニュークリックから呼び出せるようにグローバルに公開（reticleとスケールをバインド）
    window.loadModel = function(modelPath, modelName, modelDetail, modelPrice) {
        return loadModel(modelPath, modelName, modelDetail, modelPrice, reticle, scaleAlvaAR);
    };

    // モデルクリア関数をグローバルに公開
    window.clearModels = clearModels;

    Stats.add('total');
    Stats.add('video');
    Stats.add('slam');

    document.body.appendChild(Stats.el);
    document.body.addEventListener("click", () => alva.reset(), false);

    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;

        const newSize = resize2cover(video.videoWidth, video.videoHeight, newWidth, newHeight);
        canvas.width = newWidth;
        canvas.height = newHeight;
        video.style.width = newSize.width + 'px';
        video.style.height = newSize.height + 'px';

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
        labelRenderer.setSize(newWidth, newHeight);
    });

    const f = 0.5 * canvas.height / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    let dots = null;

    // 初回オブジェクト表示用の変数
    let reticleShowTime = null;  // reticle.visible になった瞬間のタイムスタンプ
    let viewNum = 0;             // 表示回数

    // 平面認識の頻度制限（0.5秒に1回）
    let lastPlaneTime = 0;

    onFrame(() =>
    {
        const now = performance.now();
        Stats.next();
        Stats.start('total');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!document['hidden'])
        {
            Stats.start('video');
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, size.x, size.y, size.width, size.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            Stats.stop('video');

            Stats.start('slam');
            const pose = alva.findCameraPose(frame);
            Stats.stop('slam');

            if (pose)
            {
                applyPose(pose, camera.quaternion, camera.position);

                // 平面検出を0.2秒に1回実行
                if (now - lastPlaneTime > 300) {
                    lastPlaneTime = now;
                    const planeMatrix = alva.findPlane();
                    if (planeMatrix)
                    {
                        // 検出した平面のマトリックスを適用（座標系変換込み）
                        applyPlaneMatrix(planeMatrix, reticle);
                        reticle.visible = true;
                    }
                }
                // ポイントの表示
                dots = alva.getFramePoints();
                for (const p of dots)
                {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(p.x, p.y, 2, 2);
                }
            }
            else
            {
                reticle.visible = false;
                dots = alva.getFramePoints();
                for (const p of dots)
                {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(p.x, p.y, 2, 2);
                }
            }

            // レティクル表示後の自動モデル配置
            if (reticle.visible && reticleShowTime === null) {
                reticleShowTime = now;
            }
            if (!reticle.visible) {
                reticleShowTime = null;
            }
            // レティクルが見えてから1.5秒後にモデルを一度だけ表示（店舗のデフォルトモデル）
            if (viewNum === 0 && reticleShowTime !== null && now - reticleShowTime > 1500) {
                loadModel(defaultModel.path, defaultModel.name, defaultModel.detail, defaultModel.price, reticle, scaleAlvaAR);
                viewNum = 1;
                reticleShowTime = null;
            }

            // モデルとレティクルの当たり判定
            if (reticle.visible) {
                const colliding = checkReticleCollision(reticle);
                reticle.material.opacity = colliding ? 0.1 : 1.0;
            }

            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        }

        Stats.stop('total');
        Stats.render();

        return true;
    }, 30);
}

    // 平面マトリックスをTHREE.js座標系に変換する関数
    function applyPlaneMatrix(matrix, mesh) {
        const m = new THREE.Matrix4().fromArray(matrix);
        const r = new THREE.Quaternion().setFromRotationMatrix(m);
        const t = new THREE.Vector3(matrix[12], matrix[13], matrix[14]);

        // AlvaAR -> THREE.js 座標系変換
        mesh.quaternion.set(-r.x, r.y, r.z, r.w);
        mesh.position.set(t.x, -t.y, -t.z);
    }
