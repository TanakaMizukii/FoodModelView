const storeInfo = [
    {
        id: 1,
        use_name: 'kaishu',
        true_name: 'ホルモン屋 海州',
        logo: '海州ロゴ.png',
        right_top: 'ファミリーセット切り抜き.png',
        left_bottom: 'カルビ盛り切り抜き.png',
        menuDisplayMode: 'standard',
        firstEnvironment: {
            hdrPath: '/hdr/kaishu/',
            hdrFile: 'kaisyu_73_small.hdr',
            defaultModel: {
                name: 'カルビ盛り',
                path: '/models/kaishu/calbee_set_comp.glb',
                detail: '特上カルビ・上カルビ・並みカルビ・切り落としカルビがワンプレートでまとめて食べられます！！',
                price: '2,400 (税込 2,640)',
            },
            modelDisplaySettings: {
                scale: 1,
                scaleARjs: 0.09,
                scaleWebXR: 0.0085,
                scale3DViewer: 1,
                detailPosition: [2, 6, -7],
                detailCenter: [0, 0.8],
            },
            cameraPosition: [17, 42, 36],
            lightIntensity: 1,
        }
    },
    {
        id: 2,
        use_name: 'denden',
        true_name: 'でんでん',
        logo: 'でんでんロゴ.png',
        right_top: null,
        left_bottom: null,
        menuDisplayMode: 'compact',
        firstEnvironment: {
            hdrPath: '/hdr/denden/',
            hdrFile: 'dndn_2.1_small.hdr',
            defaultModel: {
                name: '2種の鶏唐コンビ丼（特盛）',
                path: '/models/denden/chicken_combo_large_comp.glb',
                detail: '2種類の鶏唐揚げが通常盛りの倍の量で楽しめます！。',
                price: '税込み:1250',
            },
            modelDisplaySettings: {
                scale: 1,
                scaleARjs: 7,
                scaleWebXR: 0.7,
                scale3DViewer: 1,
                detailPosition: [0, 0.22, -0.24],
                detailCenter: [0, 0.08],
            },
            cameraPosition: [0.34, 0.77, 0.49],
            lightIntensity: 2,
        }
    },
];

export default storeInfo;

export function findStoreBySlug(slug) {
    return storeInfo.find((s) => s.use_name === slug) ?? null;
}