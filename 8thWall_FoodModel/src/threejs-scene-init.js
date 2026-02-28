// 8th Wall FoodModel AR シーン初期化
// AlvaAR 版の機能を 8th Wall パイプラインモジュールとして実装

import storeInfo from '../data/storeInfo'

export const initScenePipelineModule = () => {
  // --- 状態変数 ---
  let scene, camera, renderer
  let labelRenderer
  let loader
  let nowModel = null
  let detailNum = 0
  const objectList = []
  const mouse = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()
  let reticle

  // 初回モデル自動配置用
  let reticleShowTime = null
  let viewNum = 0

  // 店舗情報
  const params = new URLSearchParams(window.location.search)
  const storeName = params.get('') || params.get('store') || 'kaishu'
  const store = storeInfo.find(s => s.use_name === storeName) || storeInfo[0]
  const defaultModel = store.firstEnvironment.defaultModel
  const scale = store.firstEnvironment.modelDisplaySettings.scaleWebXR

  // --- モデル破棄 ---
  function disposeModel(targetModel) {
    const detailElement = document.querySelector('.detail')
    if (detailElement) detailElement.remove()

    targetModel.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry.dispose()
        const mat = obj.material
        if (mat) {
          if (Array.isArray(mat)) {
            mat.forEach(m => { m.map && m.map.dispose(); m.dispose() })
          } else {
            mat.map && mat.map.dispose()
            mat.dispose()
          }
        }
      }
    })
  }

  // --- モデル読み込み ---
  async function loadModel(modelPath, modelName, modelDetail, modelPrice) {
    if (!loader || !reticle) return false

    try {
      if (nowModel) {
        scene.remove(nowModel)
        disposeModel(nowModel)
        nowModel = null
        objectList.length = 0
      }

      const loadingOverlay = document.getElementById('loading')
      if (loadingOverlay) loadingOverlay.classList.add('visible')

      const gltf = await loader.loadAsync(modelPath)
      const model = gltf.scene
      model.scale.set(scale, scale, scale)
      model.userData.isDetail = true

      // レティクル位置にモデルを配置
      model.position.copy(reticle.position)
      model.quaternion.copy(reticle.quaternion)
      model.rotateX(Math.PI / 2)
      model.rotateY(Math.PI / 2)

      scene.add(model)
      objectList.push(model)
      nowModel = model

      model.traverse(child => {
        if (child.isMesh) objectList.push(child)
      })

      // 詳細ラベル作成
      const detailDiv = document.createElement('div')
      detailDiv.className = 'detail'
      detailDiv.innerHTML = `
        <h3 class="panel__name">${modelName}</h3><hr>
        <p class="panel__desc">${modelDetail}</p>
        <div class="panel__price" aria-label="価格">
          <span class="panel__price-currency">￥</span>
          <span class="panel__price-value">${modelPrice} 円</span>
        </div>
      `

      const detail = new THREE.CSS2DObject(detailDiv)
      detail.position.set(0.1, 0.08, -0.03)
      detail.center = new THREE.Vector2(0, 0.8)
      model.add(detail)
      detail.layers.set(1)

      if (loadingOverlay) {
        setTimeout(() => {
          loadingOverlay.classList.remove('visible')
          if (detailNum === 0) {
            camera.layers.enable(1)
            detailNum++
          }
        }, 100)
      }

      return true
    } catch (error) {
      const loadingOverlay = document.getElementById('loading')
      if (loadingOverlay) {
        setTimeout(() => loadingOverlay.classList.remove('visible'), 100)
      }
      console.error(error)
      alert('モデルの読み込みに失敗しました。')
      return false
    }
  }

  // --- モデルクリア ---
  function clearModels() {
    if (nowModel) {
      scene.remove(nowModel)
      disposeModel(nowModel)
      nowModel = null
      objectList.length = 0
    }
  }

  // --- レティクルとモデルの当たり判定 ---
  const _modelBox = new THREE.Box3()
  function checkReticleCollision() {
    if (!nowModel || !reticle) return false
    _modelBox.setFromObject(nowModel)
    return _modelBox.containsPoint(reticle.position)
  }

  // --- ARシーン初期化 ---
  const initXrScene = ({ scene: s, camera: c, renderer: r }) => {
    scene = s
    camera = c
    renderer = r

    renderer.shadowMap.enabled = true

    // ライト
    scene.add(new THREE.AmbientLight(0xffffff, 1))
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // CSS2DRenderer（詳細ラベル用）
    labelRenderer = new THREE.CSS2DRenderer()
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.domElement.style.position = 'fixed'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.left = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    labelRenderer.domElement.style.zIndex = '10'
    document.body.appendChild(labelRenderer.domElement)

    // KTX2Loader + GLTFLoader セットアップ
    const ktx2Loader = new THREE.KTX2Loader()
    ktx2Loader.setTranscoderPath('./basis/')
    ktx2Loader.detectSupport(renderer)

    const dracoLoader = new THREE.DRACOLoader()
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.146.0/examples/js/libs/draco/')

    loader = new THREE.GLTFLoader()
    loader.setKTX2Loader(ktx2Loader)
    loader.setDRACOLoader(dracoLoader)

    // レティクル（平面インジケーター）
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.065, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 1.0 })
    )
    reticle.visible = false
    scene.add(reticle)

    // グローバル関数として公開
    window.loadModel = (path, name, detail, price) => loadModel(path, name, detail, price)
    window.clearModels = clearModels

    // AR UI 表示
    document.getElementById('ar-ui').classList.remove('hidden')
    document.getElementById('exit-button').classList.remove('hidden')
    document.getElementById('clear-objects').classList.remove('hidden')
    document.getElementById('menuContainer').classList.remove('hidden')
    document.getElementById('menuToggleDesktop').classList.remove('hidden')

    // リサイズ対応
    window.addEventListener('resize', () => {
      if (labelRenderer) {
        labelRenderer.setSize(window.innerWidth, window.innerHeight)
      }
    })
  }

  return {
    name: 'foodmodel-scene',

    onStart: ({ canvas }) => {
      const xrScene = XR8.Threejs.xrScene()
      initXrScene(xrScene)

      // タッチ操作（スクロール防止 + モデルクリック検出）
      canvas.addEventListener('touchmove', event => {
        event.preventDefault()
      }, { passive: false })

      canvas.addEventListener('touchstart', event => {
        if (event.touches.length !== 1) return

        const touch = event.touches[0]
        const rect = canvas.getBoundingClientRect()
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1

        mouse.set(x, y)
        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(objectList, true)

        if (intersects.length > 0) {
          // モデルをタップ → 詳細パネル表示/非表示トグル
          event.stopPropagation()
          let clickedObject = intersects[0].object
          while (clickedObject.parent && clickedObject !== nowModel) {
            clickedObject = clickedObject.parent
          }
          clickedObject.userData.isDetail = !clickedObject.userData.isDetail
          const detailElement = document.querySelector('.detail')
          if (detailElement) {
            detailElement.style.visibility = clickedObject.userData.isDetail ? 'visible' : 'hidden'
          }
        } else {
          // モデル以外をタップ → 再センタリング
          XR8.XrController.recenter()
        }
      }, true)

      // カメラと XrController を同期
      XR8.XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      })
    },

    onUpdate: () => {
      if (!scene || !camera || !reticle) return

      const now = performance.now()

      // 画面中央でヒットテスト → レティクル位置を更新
      const hitResults = XR8.XrController.hitTest(0.5, 0.5, ['FEATURE_POINT', 'ESTIMATED_SURFACE'])

      if (hitResults.length > 0) {
        const { position, rotation } = hitResults[0]
        reticle.position.set(position.x, position.y, position.z)
        reticle.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
        reticle.visible = true

        // レティクル表示後 1.5 秒でデフォルトモデルを自動配置
        if (reticleShowTime === null) reticleShowTime = now
        if (viewNum === 0 && now - reticleShowTime > 1500) {
          loadModel(defaultModel.path, defaultModel.name, defaultModel.detail, defaultModel.price)
          viewNum = 1
          reticleShowTime = null
        }

        // モデルとレティクルの当たり判定 → 透明度変更
        if (nowModel) {
          reticle.material.opacity = checkReticleCollision() ? 0.1 : 1.0
        }
      } else {
        reticle.visible = false
        reticleShowTime = null
      }

      // CSS2DRenderer レンダリング（詳細ラベル）
      labelRenderer.render(scene, camera)
    },
  }
}
