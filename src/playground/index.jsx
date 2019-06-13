// Polyfills
import 'es6-object-assign/auto';
import 'core-js/fn/array/includes';
import 'core-js/fn/promise/finally';
import 'intl'; // For Safari 9

import React from 'react';
import ReactDOM from 'react-dom';

import analytics from '../lib/analytics';
import AppStateHOC from '../lib/app-state-hoc.jsx';
import BrowserModalComponent from '../components/browser-modal/browser-modal.jsx';
import supportedBrowser from '../lib/supported-browser';

import styles from './index.css';

// 蓝牙
var SCRIPTS_LIST = [
    // crc16
    'crc16modbus.js',
    // gbk encode/decode
    'gbk.js',
    // ble related
    'Cmd.js',
    'Beep.js',
    'Constants.js',
    'CmdQueue.js',
    'vectorCalc.js',
    'buffer.js',
    'BleApis.js',
    'MotionApis.js',
    'audio.js',
    'IdeApis.js',
];
var SCRIPTS_MOCK_LIST = [
    'mockApis.js',
];
var SCRIPTS_DIR = './bell/cordova/ble';

/*
    用于加载cordova目录下的js
    目前主要只是ble插件进行通信部分
    有2中情况：
    1）当判断浏览器环境下时，或者非cordova环境下时加载mock api；
    2）当在其它情况下（主要是iOS, Android），加载实际的api以及相关js；

    modified:
        add done callback when all the scripts loaded.
*/
 function resolveCordovaJs(done) {
    var withCordova = window.cordova;
    var withCordovaOnBrowser = withCordova && window.cordova.platformId === 'browser';
    var jsList = (!withCordova || withCordovaOnBrowser) ? SCRIPTS_MOCK_LIST : SCRIPTS_LIST;
    // 加载cordova目录js
    var loadedCount = 0
    var N = jsList.length
    loadJs(SCRIPTS_DIR, jsList, function (path) {
        console.log('app loadJs: ' + path);
        loadedCount++;
        if (loadedCount === N) {
            if (done) done();
        }
    });
}

function loadJs(dir, scriptsList, cb) {
    if (!dir || !scriptsList || scriptsList.length === 0) {
        cb(new Error('no js to load: ' + dir + ' ' + scriptsList));
        return;
    }
    _loadJsInternal(dir, scriptsList, cb);
}

function _loadJsInternal(dir, scriptsList, cb) {
    var that = this;
    var path = scriptsList.shift();
    var src = dir + '/' + path;
    // if (window.cordova && window.cordova.platformId !== 'browser') src = window.AppDir + '/' + src;
    var scriptDom = document.createElement('script');
    scriptDom.src = src;
    document.head.appendChild(scriptDom);
    var loadListener = function () {
        scriptDom.parentNode.removeChild(scriptDom);
        this.removeEventListener('load', loadListener, false);
        this.removeEventListener('error', errorListener, false);
        if (cb) cb(scriptDom.src);
        if (scriptsList.length > 0) that._loadJsInternal(dir, scriptsList, cb);
        else console.log('_loadJsInternal done! :)');
    };
    var errorListener = function () {
        scriptDom.parentNode.removeChild(scriptDom);
        this.removeEventListener('error', errorListener, false);
        this.removeEventListener('load', loadListener, false);
        if (cb) cb('failed:) ' + scriptDom.src);
    };
    scriptDom.addEventListener('load', loadListener, false);
    scriptDom.addEventListener('error', errorListener, false);
}

// Register "base" page view
analytics.pageview('/');

const appTarget = document.createElement('div');
appTarget.className = styles.app;
document.body.appendChild(appTarget);

if (supportedBrowser()) {
    // require needed here to avoid importing unsupported browser-crashing code
    // at the top level
    require('./render-gui.jsx').default(appTarget);
    resolveCordovaJs(); // 加载蓝牙模块

} else {
    BrowserModalComponent.setAppElement(appTarget);
    const WrappedBrowserModalComponent = AppStateHOC(BrowserModalComponent, true /* localesOnly */);
    const handleBack = () => {};
    // eslint-disable-next-line react/jsx-no-bind
    ReactDOM.render(<WrappedBrowserModalComponent onBack={handleBack} />, appTarget);
}
