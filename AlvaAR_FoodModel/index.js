// 必要なモジュールのインポート
import { Stats } from "./assets/stats.js";           // パフォーマンス統計表示用
import { AlvaAR } from './assets/alva_ar.js';        // AR（拡張現実）処理用ライブラリ
import { ARCamView } from "./assets/view.js";        // AR表示ビュー管理用
import { Camera, onFrame, resize2cover } from "./assets/utils.js";  // カメラとユーティリティ関数


// ページ読み込み完了時にメイン関数を実行
window.addEventListener( 'load', main );

/**
 * メイン関数 - アプリケーションの初期化と起動
 */
function main()
{
    // カメラの設定
    const config = {
        video: {
            facingMode: 'environment',  // 背面カメラを使用
            aspectRatio: 16 / 9,        // アスペクト比を16:9に設定
            width: { ideal: 1280 }      // 理想的な横幅を1280pxに設定
        },
        audio: false  // 音声は使用しない
    }

    // DOM要素の取得・作成
    const $container = document.getElementById( 'container' );  // メインコンテナ
    const $view = document.createElement( 'div' );              // AR表示用のビュー要素
    const $canvas = document.createElement( 'canvas' );         // 映像描画用のキャンバス
    const $overlay = document.getElementById( 'overlay' );      // スタートボタンのオーバーレイ
    const $start = document.getElementById( 'start_button' );   // スタートボタン
    const $splash = document.getElementById( 'splash' );        // スプラッシュ画面
    const splashFadeTime = 800;  // スプラッシュ画面のフェードアウト時間（ミリ秒）

    // スプラッシュ画面のフェードアウトアニメーション設定
    $splash.style.transition = `opacity ${ splashFadeTime / 1000 }s ease`;
    $splash.style.opacity = 0;  // 透明度を0に設定してフェード開始

    // スプラッシュ画面のフェードアウト完了後の処理
    setTimeout( () =>
    {
        // スプラッシュ画面を削除
        $splash.remove();

        // スタートボタンのクリックイベント設定（一度だけ実行）
        $start.addEventListener( 'click', () =>
        {
            // オーバーレイを削除
            $overlay.remove();

            // カメラを初期化してデモを開始
            Camera.Initialize( config )
                .then( media => demo( media ) )  // 成功時：デモ実行
                .catch( error => alert( 'Camera ' + error ) );  // 失敗時：エラー表示

        }, { once: true } );  // 一度だけ実行されるイベントリスナー

    }, splashFadeTime );  // 800ms後に実行

    /**
     * ARデモの実行
     * @param {Object} media - カメラメディアオブジェクト
     */
    async function demo( media )
    {
        const $video = media.el;  // videoエレメントを取得

        // カメラ映像をコンテナにフィットさせるサイズを計算
        const size = resize2cover(
            $video.videoWidth,
            $video.videoHeight,
            $container.clientWidth,
            $container.clientHeight,
        );

        // キャンバスのサイズをコンテナに合わせて設定
        $canvas.width = $container.clientWidth;
        $canvas.height = $container.clientHeight;

        // ビデオのサイズを計算されたサイズに設定
        $video.style.width = size.width + 'px';
        $video.style.height = size.height + 'px';

        // 2Dコンテキストの取得（パフォーマンス最適化オプション付き）
        const ctx = $canvas.getContext( '2d', {
            alpha: false,           // アルファチャンネル不要（高速化）
            desynchronized: true    // 非同期描画を有効化（高速化）
        } );

        // AlvaAR（SLAM処理）の初期化
        const alva = await AlvaAR.Initialize( $canvas.width, $canvas.height );

        // ARカメラビューの初期化
        const view = new ARCamView( $view, $canvas.width, $canvas.height );

        // パフォーマンス統計の項目を追加
        Stats.add( 'total' );  // 全体の処理時間
        Stats.add( 'video' );  // 映像処理時間
        Stats.add( 'slam' );   // SLAM処理時間

        // DOM要素をコンテナに追加
        $container.appendChild( $canvas );
        $container.appendChild( $view );

        // 統計表示をbodyに追加
        document.body.appendChild( Stats.el );

        // 画面クリックでSLAMをリセット
        document.body.addEventListener( "click", () => alva.reset(), false );

        /**
         * メインループ - 毎フレーム実行される処理
         * 30FPSで実行
         */
        onFrame( () =>
        {
            Stats.next();            // 統計の次フレームへ
            Stats.start( 'total' );  // 全体の処理時間計測開始

            // キャンバスをクリア
            ctx.clearRect( 0, 0, $canvas.width, $canvas.height );

            // タブが非表示でない場合のみ処理を実行（バックグラウンド時の省電力化）
            if( !document['hidden'] )
            {
                // === 映像の描画処理 ===
                Stats.start( 'video' );
                // ビデオフレームをキャンバスに描画
                ctx.drawImage(
                    $video,
                    0, 0, $video.videoWidth, $video.videoHeight,  // ソース座標
                    size.x, size.y, size.width, size.height       // 描画先座標
                );
                // キャンバスから画像データを取得
                const frame = ctx.getImageData( 0, 0, $canvas.width, $canvas.height );
                Stats.stop( 'video' );

                // === SLAM処理（カメラポーズ推定） ===
                Stats.start( 'slam' );
                const pose = alva.findCameraPose( frame );  // カメラの位置・姿勢を推定
                Stats.stop( 'slam' );

                if( pose )
                {
                    // カメラポーズが取得できた場合、ARビューを更新
                    view.updateCameraPose( pose );
                }
                else
                {
                    // カメラポーズが取得できない場合（トラッキング失敗）
                    view.lostCamera();

                    // 特徴点を取得して描画（デバッグ用）
                    const dots = alva.getFramePoints();

                    for( const p of dots )
                    {
                        ctx.fillStyle = 'white';
                        ctx.fillRect( p.x, p.y, 2, 2 );  // 2x2ピクセルの白い点を描画
                    }
                }
            }

            Stats.stop( 'total' );  // 全体の処理時間計測終了
            Stats.render();         // 統計を画面に表示

            return true;  // ループを継続
        }, 30 );  // 30FPS（約33ms間隔）で実行
    }
}