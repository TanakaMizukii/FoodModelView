const rad2deg = 180.0 / Math.PI;
const deg2rad = Math.PI / 180;

function onFrame( frameTickFn, fps = 30 )
{
    // ~~は小数点以下を切り捨てて整数にする高速テク
    // Math.floorより軽い
    const fpsInterval = ~~(1000 / fps);

    let t1 = performance.now();

    const onAnimationFrame = async () =>
    {
        const t2 = performance.now();
        const td = t2 - t1;

        if( td > fpsInterval )
        {
            t1 = t2 - (td % fpsInterval);

            if( (await frameTickFn( t2 )) === false )
            {
                return;
            }
        }

        requestAnimationFrame( onAnimationFrame );
    };

    requestAnimationFrame( onAnimationFrame );
}

function isIOS()
{
    return /iPad|iPhone|iPod/.test( navigator.platform );
}

function isMobile()
{
    try
    {
        document.createEvent( 'TouchEvent' );
        return true;
    } catch( e )
    {
        return false;
    }
}

function getScreenOrientation()
{
    let angle = -1;

    if( window.screen && window.screen.orientation )
    {
        angle = window.screen.orientation.angle;
    }
    else if( 'orientation' in window )
    {
        angle = window.orientation;
    }

    switch( angle )
    {
        case 0:
            return 'portrait';
        case 90:
            return 'landscape_left';
        case 180:
            return 'portrait';
        case 270:
            return 'landscape_right';
        case -90:
            return 'landscape_right';
    }

    return 'unknown';
}

// 縦横比を保ったまま、中央寄せで全面に覆うための拡大・配置計算用関数
function resize2cover( srcW, srcH, dstW, dstH )
{
    const rect = {};

    if( dstW / dstH > srcW / srcH ) {
        const scale = dstW / srcW;
        rect.width = ~~(scale * srcW);
        rect.height = ~~(scale * srcH);
        rect.x = 0;
        rect.y = ~~((dstH - rect.height) * 0.5);
    } else {
        const scale = dstH / srcH;
        rect.width = ~~(scale * srcW);
        rect.height = ~~(scale * srcH);
        rect.x = ~~((dstW - rect.width) * 0.5);
        rect.y = 0;
    }

    return rect;
}

function createCanvas( width, height )
{
    const canvas = document.createElement( 'canvas' );

    canvas.width = width;
    canvas.height = height;

    return canvas;
}

class Camera {
    // カメラ初期化用の static メソッド
    // async なので、戻り値は Promise<Camera> になる
    static async Initialize( constraints = null ) {
        // facingMode('user'or'environment') と deviceId(ex:'abcd1234')は
        // どちらを使用してよいかわからず同時指定できないためエラー
        if( 'facingMode' in constraints && 'deviceId' in constraints ) {
            throw new Error(
                `Camera settings 'deviceId' and 'facingMode' are mutually exclusive.`
            );
        }

        // facingMode は environment（背面）か user（前面）のみ許可
        if( 'facingMode' in constraints && ['environment', 'user'].indexOf( constraints.facingMode ) === -1 ) {
            throw new Error(
                `Camera settings 'facingMode' can only be 'environment' or 'user'.`
            );
        }

        // 実際に getUserMedia を呼び出して
        // MediaStream → video 要素 → Camera インスタンス を生成する関数
        // permissionには管理者権限の状態が入っている。
        const setupUserMediaStream = ( permission ) => {
            // Promise を明示的に作成
            return new Promise( ( resolve, reject ) => {
                // getUserMedia が成功した場合の処理
                const onSuccess = ( stream ) => {
                    // stream.getVideoTracks()で取得した MediaStreamからvideoトラックを1つ取得
                    const track = stream.getVideoTracks()[0];

                    // トラックが取得できなかった場合は失敗
                    if ( typeof track === 'undefined' ) {
                        reject(
                            new Error(
                                `Failed to access camera: Permission denied (No track).`
                            )
                        );
                    } else {
                        // video 要素を動的に生成
                        const video = document.createElement( 'video' );
                        // 自動再生・iOS対策
                        video.setAttribute( 'autoplay', 'autoplay' );
                        video.setAttribute( 'playsinline', 'playsinline' );
                        video.setAttribute( 'webkit-playsinline', 'webkit-playsinline' );
                        // MediaStream を video に流し込む
                        video.srcObject = stream;

                        // メタデータ（解像度など）が読み込まれた後に実行
                        video.onloadedmetadata = () => {
                            // 実際のトラック設定を取得
                            const settings = track.getSettings();
                            // トラック設定上のサイズ
                            const tw = settings.width;
                            const th = settings.height;
                            // video 要素が認識しているサイズ
                            const vw = video.videoWidth;
                            const vh = video.videoHeight;
                            // サイズ不一致があれば警告
                            if( vw !== tw || vh !== th ) {
                                console.warn(
                                    `Video dimensions mismatch: width: ${ tw }/${ vw }, height: ${ th }/${ vh }`
                                );
                            }
                            // video 要素の表示サイズ・内部サイズを設定
                            video.style.width  = vw + 'px';
                            video.style.height = vh + 'px';
                            video.width  = vw;
                            video.height = vh;

                            // 再生開始!
                            video.play();

                            // Camera クラスのインスタンスを生成して resolve
                            resolve( new Camera( video ) );
                        };
                    }
                };

                // getUserMedia が失敗した場合のエラーハンドリング
                const onFailure = ( error ) => {
                    switch( error.name ) {
                        case 'NotFoundError':
                        case 'DevicesNotFoundError':
                            reject(
                                new Error( `Failed to access camera: Camera not found.` )
                            );
                            return;
                        case 'SourceUnavailableError':
                            reject(
                                new Error( `Failed to access camera: Camera busy.` )
                            );
                            return;
                        case 'PermissionDeniedError':
                        case 'SecurityError':
                            reject(
                                new Error( `Failed to access camera: Permission denied.` )
                            );
                            return;
                        default:
                            reject(
                                new Error( `Failed to access camera: Rejected.` )
                            );
                            return;
                    }
                };

                // Permissions API で既に拒否されている場合は即エラー
                if( permission && permission.state === 'denied' ) {
                    reject(
                        new Error( `Failed to access camera: Permission denied.` )
                    );
                    return;
                }

                // 実際にカメラを要求。成功すると[MediaStreamオブジェクト(カメラやマイクの 実際の映像・音声の流れ)]が渡される
                navigator.mediaDevices.getUserMedia( constraints )
                    .then( onSuccess ) // .then(stream => onSuccess(stream))と同義
                    .catch( onFailure ); // DOMException（エラーオブジェクト)が渡される
            });
        };

        // Permissions API(「ブラウザの各種“権限の状態”を事前に知れる」API) が使える場合
        // ブラウザによっては存在しない場合もあるため一応確認する。
        if( navigator.permissions && navigator.permissions.query ) {
            // カメラ権限を事前に確認(下のreturnの返り値は"granted"(すでに許可されている)"prompt"(これから許可ダイアログが出る)"denied"(すでに拒否されている)のどれか
            return navigator.permissions.query( { name: 'camera' } )
                .then( ( permission ) => {
                    // 成功したら権限情報を渡してカメラ初期化
                    return setupUserMediaStream( permission );
                } )
                .catch( error => {
                    // Permissions API が失敗しても
                    // 通常の getUserMedia を試みる
                    return setupUserMediaStream();
                } );
        } else {
            // Permissions API 非対応ブラウザ向け
            return setupUserMediaStream();
        }
    }

    // Camera クラスのコンストラクタ
    // new Camera(video)が呼ばれた瞬間に実行
    constructor( videoElement ) {
        // video 要素を保持
        this.el = videoElement;

        // 映像サイズ
        this.width  = videoElement.videoWidth;
        this.height = videoElement.videoHeight;

        // フレーム取得用の canvas を作成
        this._canvas = createCanvas( this.width, this.height );

        // 頻繁に ImageData を読むので willReadFrequently を指定
        this._ctx = this._canvas.getContext(
            '2d',
            { willReadFrequently: true }
        );
    }

    // 現在のカメラ映像を ImageData として取得
    getImageData() {
        // 前フレームをクリア
        this._ctx.clearRect( 0, 0, this.width, this.height );

        // video の現在フレームを canvas に描画
        this._ctx.drawImage(
            this.el,
            0,
            0,
            this.width,
            this.height
        );

        // ImageData を返す
        return this._ctx.getImageData(
            0,
            0,
            this.width,
            this.height
        );
    }
}


class Video
{
    static async Initialize( url, timeout = 8000 )
    {
        return new Promise( ( resolve, reject ) =>
        {
            let tid = -1;

            const video = document.createElement( 'video' );

            video.src = url;
            video.setAttribute( 'autoplay', 'autoplay' );
            video.setAttribute( 'playsinline', 'playsinline' );
            video.setAttribute( 'webkit-playsinline', 'webkit-playsinline' );
            video.autoplay = true;
            video.muted = true;
            video.loop = true; // note: if loop is true, ended event will not fire
            video.load();

            tid = setTimeout( () =>
            {
                reject( new Error( `Failed to load video: Timed out after ${ timeout }ms.` ) );
            }, timeout );

            video.onerror = () =>
            {
                clearTimeout( tid );

                reject( new Error( `Failed to load video.` ) );
            };

            video.onabort = () =>
            {
                clearTimeout( tid );

                reject( new Error( `Failed to load video: Load aborted.` ) );
            };

            if( video.readyState >= 4 )
            {
                clearTimeout( tid );

                resolve( video );
            }
            else
            {
                video.oncanplaythrough = () =>
                {
                    clearTimeout( tid );

                    if( video.videoWidth === 0 || video.videoHeight === 0 )
                    {
                        reject( new Error( `Failed to load video: Invalid dimensions.` ) );
                    }
                    else
                    {
                        resolve( video );
                    }
                };
            }
        } ).then( video =>
        {
            video.onload = video.onabort = video.onerror = null;

            return new Video( video );
        } );
    }

    constructor( videoElement )
    {
        this.el = videoElement;
        this.width = videoElement.videoWidth;
        this.height = videoElement.videoHeight;

        this._canvas = createCanvas( this.width, this.height );
        this._ctx = this._canvas.getContext( '2d', { willReadFrequently: true } );

        this._lastTime = -1;
        this._imageData = null;
    }

    getImageData()
    {
        const t = this.el.currentTime;

        if( this._lastTime !== t )
        {
            this._lastTime = t;

            this._imageData = null;
        }

        if( this._imageData === null )
        {
            this._ctx.clearRect( 0, 0, this.width, this.height );
            this._ctx.drawImage( this.el, 0, 0, this.width, this.height );

            this._imageData = this._ctx.getImageData( 0, 0, this.width, this.height );
        }

        return this._imageData;
    }
}

export { Camera, Video, onFrame, isMobile, isIOS, getScreenOrientation, resize2cover, rad2deg, deg2rad }