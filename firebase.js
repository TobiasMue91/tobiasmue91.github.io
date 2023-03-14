const _0x250150 = _0x1ee2;

function _0x33b7() {
    const _0x5635a0 = ['1691244BqkUEX', '587688SFZgRT', 'ball-bouncing-game.appspot.com', 'AIzaSyB-baGEaQt17jorZVR5rUPG6NCpis3x7bU', '55OGsLOt', 'ball-bouncing-game.firebaseapp.com', '1600890KWOMjS', 'error', 'ball-bouncing-game', '3102939PwpYaa', '49539jjeifk', '1DMGMta', '6HPfyvs', '30240iPLXrS', '936726kQnAZg', '24pMcUTh', 'Anonymous\x20authentication\x20failed:', '274565600949'];
    _0x33b7 = function () {
        return _0x5635a0;
    };
    return _0x33b7();
}

(function (_0x1b3de6, _0x3f738d) {
    const _0x2a803d = _0x1ee2, _0x5e5bfd = _0x1b3de6();
    while (!![]) {
        try {
            const _0x3580b3 = -parseInt(_0x2a803d(0x169)) / 0x1 * (parseInt(_0x2a803d(0x16c)) / 0x2) + parseInt(_0x2a803d(0x168)) / 0x3 * (parseInt(_0x2a803d(0x16d)) / 0x4) + parseInt(_0x2a803d(0x16b)) / 0x5 + -parseInt(_0x2a803d(0x16a)) / 0x6 * (parseInt(_0x2a803d(0x167)) / 0x7) + parseInt(_0x2a803d(0x171)) / 0x8 + parseInt(_0x2a803d(0x170)) / 0x9 + parseInt(_0x2a803d(0x176)) / 0xa * (parseInt(_0x2a803d(0x174)) / 0xb);
            if (_0x3580b3 === _0x3f738d) break; else _0x5e5bfd['push'](_0x5e5bfd['shift']());
        } catch (_0x366d1d) {
            _0x5e5bfd['push'](_0x5e5bfd['shift']());
        }
    }
}(_0x33b7, 0x3e54c));
import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js';
import {getAuth, signInAnonymously} from 'https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js';

const app = initializeApp({
    'apiKey': _0x250150(0x173),
    'authDomain': _0x250150(0x175),
    'databaseURL': 'https://ball-bouncing-game-default-rtdb.europe-west1.firebasedatabase.app',
    'projectId': _0x250150(0x166),
    'storageBucket': _0x250150(0x172),
    'messagingSenderId': _0x250150(0x16f),
    'appId': '1:274565600949:web:0c0cd51a223ec0226550fc'
}), auth = getAuth();

function _0x1ee2(_0x2db1d7, _0x1d880f) {
    const _0x33b70e = _0x33b7();
    return _0x1ee2 = function (_0x1ee210, _0x5c72f0) {
        _0x1ee210 = _0x1ee210 - 0x166;
        let _0x5912e3 = _0x33b70e[_0x1ee210];
        return _0x5912e3;
    }, _0x1ee2(_0x2db1d7, _0x1d880f);
}

signInAnonymously(auth)['catch'](_0x194ccb => {
    const _0x4e1470 = _0x250150;
    console[_0x4e1470(0x177)](_0x4e1470(0x16e), _0x194ccb);
});
const db = getFirestore(app);
export {app, db};