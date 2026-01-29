import * as THREE from 'three';
import { Stats } from "./assets/stats.js";
import { AlvaAR } from './assets/alva_ar.js';
import { AlvaARConnectorTHREE } from './assets/alva_ar_three.js';
import { Camera, onFrame, resize2cover } from "./assets/utils.js";

import { createThreeApp } from './Three.js';

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

    // Three.js 部分（別ファイルに分離したものを呼ぶ）
    const three = await createThreeApp(container, canvas.width, canvas.height);
    const scene = three.scene;
    const camera = three.camera;     // 以降の applyPose が使う camera はこれ
    const renderer = three.renderer; // insertBefore で使うなら

    // カメラ映像キャンバスを3Dモデルキャンバスより前へ置く
    container.insertBefore(canvas, renderer.domElement);

    // 平面可視化用レティクルの作成
    const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.065, 32).rotateY( Math.PI / 20),
        new THREE.MeshBasicMaterial(),
    );
    reticle.visible = false;
    reticle.scale.set(100, 100, 100);
    scene.add(reticle);

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
    });

    const f = 0.5 * canvas.height / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    let dots = null;
    onFrame(() =>
    {
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

            let now = performance.now();
            let lastPlaneTime = 0;
            if (now - lastPlaneTime > 500) {
                lastPlaneTime = now;

                if (pose)
                {
                    applyPose(pose, camera.quaternion, camera.position);

                    // 平面検出を実行
                    const planeMatrix = alva.findPlane();
                    if (planeMatrix)
                    {
                        // 検出した平面のマトリックスを適用（座標系変換込み）
                        applyPlaneMatrix(planeMatrix, reticle);
                        reticle.visible = true;
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
            }
            renderer.render(scene, camera);
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