import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Three.js アプリを作って返す（初期化はここ）
 * @param {HTMLElement} container
 * @param {number} width
 * @param {number} height
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

    // CSS2DRenderer for labels
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.id = 'label';
    container.appendChild(labelRenderer.domElement);

    // Model loader setup
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath('../basis');
    ktx2.detectSupport(renderer);
    const loader = new GLTFLoader();
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    // State variables
    let nowModel = null;
    let detailNum = 0;
    const objectList = [];

    // Mouse and raycaster for click detection
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    /**
     * Load and place model at reticle position
     * @param {string} modelPath
     * @param {string} modelDetail
     * @param {THREE.Mesh} reticle
     */
    async function loadModel(modelPath, modelDetail, reticle) {
        try {
            if (nowModel) {
                scene.remove(nowModel);
                disposeModel(nowModel);
                objectList.length = 0;
            }

            // Show loading indicator
            const loadingOverlay = document.getElementById('loading');
            if (loadingOverlay) {
                loadingOverlay.classList.add('visible');
            }

            // Load model
            const gltf = await loader.loadAsync(modelPath);
            const model = gltf.scene;
            model.scale.set(90, 90, 90);
            model.userData.isDetail = true;

            // Place model at reticle position
            model.position.copy(reticle.position);
            model.quaternion.copy(reticle.quaternion);
            model.rotateX( Math.PI / 2);

            scene.add(model);
            objectList.push(model);
            nowModel = model;

            // Add all meshes to objectList for raycasting
            model.traverse(function(child) {
                if (child instanceof THREE.Mesh) {
                    objectList.push(child);
                }
            });

            // Create detail label
            const detailDiv = document.createElement('div');
            detailDiv.className = 'detail';
            detailDiv.textContent = modelDetail;

            const detail = new CSS2DObject(detailDiv);
            detail.position.set(0.1, 0.08, -0.03);
            detail.center = new THREE.Vector2();
            detail.center.set(0, 0.8);
            model.add(detail);
            detail.layers.set(1);

            // Hide loading and enable detail layer
            if (loadingOverlay) {
                setTimeout(() => {
                    loadingOverlay.classList.remove('visible');
                    if (detailNum === 0) {
                        camera.layers.enable(1);
                        detailNum += 1;
                    }
                }, 100);
            }

            return true;
        } catch (error) {
            const loadingOverlay = document.getElementById('loading');
            if (loadingOverlay) {
                setTimeout(() => {
                    loadingOverlay.classList.remove('visible');
                }, 100);
            }
            console.log(error);
            alert('モデルの読み込みに失敗しました。');
            return false;
        }
    }

    // Dispose model and free memory
    function disposeModel(targetModel) {
        const detailElement = document.querySelector('.detail');
        if (detailElement) {
            detailElement.remove();
        }
        targetModel.traverse(function (obj) {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (obj.material.isMaterial) {
                    obj.material.dispose();
                } else if (Array.isArray(obj.material)) {
                    for (const material of obj.material) {
                        material.dispose();
                    }
                }
                if (obj.material.map) {
                    obj.material.map.dispose();
                }
            }
        });
    }

    // Handle click on model to toggle detail visibility
    function handleClick(event) {
        const element = event.currentTarget;
        const x = event.clientX - element.offsetLeft;
        const y = event.clientY - element.offsetTop;
        const w = element.offsetWidth;
        const h = element.offsetHeight;

        mouse.x = (x / w) * 2 - 1;
        mouse.y = -(y / h) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objectList, true);

        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;
            while (clickedObject.parent && clickedObject !== nowModel) {
                clickedObject = clickedObject.parent;
            }

            if (clickedObject.userData.isDetail === undefined) {
                clickedObject.userData.isDetail = true;
            }
            clickedObject.userData.isDetail = !clickedObject.userData.isDetail;
            const detailElement = document.querySelector('.detail');

            if (detailElement) {
                if (clickedObject.userData.isDetail) {
                    detailElement.style.visibility = 'visible';
                } else {
                    detailElement.style.visibility = 'hidden';
                }
            }
        }
    }

    // Add click event listener
    renderer.domElement.addEventListener('click', handleClick);

    return {
        renderer,
        scene,
        camera,
        labelRenderer,
        loadModel,
        objectList,
    };
}
