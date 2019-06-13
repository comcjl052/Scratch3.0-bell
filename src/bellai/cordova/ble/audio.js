var BellAudioManager = {
  AUDIO_BLE_CONNECT: 'ble_connect',
  AUDIO_BLE_DISCONNECT: 'ble_disconnect',
  AUDIO_RUN: 'run',
  AUDIO_TAP: 'tap',

  playAudio: function (audio) {
    // var a = new Audio(window.AppDir + '/www/blockly/media/' + audio + '.mp3');
    // a.play();
  },

  playAudioConnect: function () {
    this.playAudio(this.AUDIO_BLE_CONNECT);
  },

  playAudioDisconnect: function () {
    this.playAudio(this.AUDIO_BLE_DISCONNECT);
  },

  playAudioRun: function () {
    this.playAudio(this.AUDIO_RUN);
  },

  playAudioTap: function () {
    this.playAudio(this.AUDIO_TAP);
  },
};
