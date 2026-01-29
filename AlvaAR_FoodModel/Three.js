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

    const object = new THREE.Mesh( new THREE.IcosahedronGeometry( 1, 0 ), new THREE.MeshNormalMaterial( { flatShading: true } ) );
    object.scale.set( 1, 1, 1 );
    object.position.set(0, 0, -10);
    scene.add(object);

    return {
        renderer,
        scene,
        camera,
    };
}
