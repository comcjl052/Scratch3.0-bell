var CmdBuffer = {
  // statics
  TAG: 'CmdBuffer',
  D: false,
  DEFAULT_SIZE: 4 * 20, // 4 frames buffer by default
  buffer: null,
  position: 0,
  size: 0,
  inited: false,

  // util func
  log: function () {
    if (this.D) console.log(this.TAG, arguments);
  },
  arrayCopy: function (src, srcBegin, dest, destBegin, length) {
    var copy = src.slice(srcBegin, length + srcBegin);
    for (var i = 0; i < copy.length; i++) {
      dest[destBegin + i] = copy[i];
    }
  },

  init: function (size) {
    this.size = size || this.DEFAULT_SIZE;
    this.buffer = new Array(this.size);
    this.position = -1;
    this.inited = true;
  },

  append: function (data, start, length) {
    if (!this.inited) return;
    this.log('append start=' + start + ' length=' + length);
    this.log('Buffer push: ' + data);

    if (this.position + 1 + length > this.size) {
      // this may not happen
      throw new Error('out of range position=' + this.positon + ' append length=' + length);
    } else {
      this.arrayCopy(data, start, this.buffer, this.position + 1, length);
      this.position += length;
    }
  },

  leftMove: function (index) {
    if (!this.inited) return;
    this.log('leftMove index=' + index);
    this.log('Buffer clean: ' + index + ' bytes.');

    if (this.position < 0) {
      this.log('Nothing to left move.');
      return;
    }

    for (var i = index; i <= this.position; i++) {
      this.buffer[i - index] = this.buffer[index];
    }
    this.position -= index;
  },

  check: function (data) {
    if (!this.inited) return;
    try {
      this.append(data, 0, data.length);
    } catch(e) {
      console.warn(e);
      this.position = -1;
      return null;
    }
    var start = this.buffer[0];
    var command = this.buffer[1];
    var count = this.position + 1;
    var frame = null;

    if (start == 'undefined') return null;
    if (command == 'undefined') return null;

    // init
    // @deprecated
    if (start === 0xfb && command === 0x01) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // get profile
    } else if (start === 0xfb && command === 0x02) {
      if (count < 4) {
        // wait
      } else {
        var color = this.buffer[2];
        var nickLength = this.buffer[3];
        var frameLength = 2 + 2 + nickLength + 2;
        if (count < frameLength) {
          // wait
        } else {
          frame = this.buffer.slice(0, frameLength);
          this.leftMove(frameLength);
        }
      }
    // set profile
    } else if (start === 0xfb && command === 0x03) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // get firmware version
    } else if (start === 0xff && command === 0xee) {
      if (count < 6) {
        // wait
      } else {
        frame = this.buffer.slice(0, 6);
        this.leftMove(6);
      }
    // firmware upgrade prepare
    } else if (start === 0xff && command === 0x0e) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // motion
    } else if (start === 0xb0 && command === 0xc0) {
      // no reponse
    // emotions
    } else if (start === 0xb0 && command === 0xac) {
      // no reponse
    // light
    } else if (start === 0xb0 && command === 0xed) {
      // no reponse
    // online balls
    } else if (start === 0xb0 && command === 0x00) {
      if (count < 12) {
        // wait
      } else {
        var moduleCount = this.buffer[2];
        if (moduleCount === 0x07) { // 不包含p2p的原7模块
          frame = this.buffer.slice(0, 12);
          this.leftMove(12);
        } else { // 包含p2p时的8模块,或者以上
          var N = moduleCount + 2 + 2 + 1; // header -2, footer -2
          if (count < N) {
            // wait
          } else {
            frame = this.buffer.slice(0, N);
            this.leftMove(N);
          }
        }
      }
    // debug battery
    } else if (start === 0xb0 && command === 0x01) {
      if (count < 6) {
        // wait
      } else {
        frame = this.buffer.slice(0, 6);
        this.leftMove(6);
      }
    // debug driver
    } else if (start === 0xb0 && command === 0x02) {
      if (count < 10) {
        // wait
      } else {
        frame = this.buffer.slice(0, 10);
        this.leftMove(10);
      }
    // debug color
    } else if (start === 0xb0 && command === 0x03) {
      if (count < 8) {
        // wait
      } else {
        frame = this.buffer.slice(0, 8);
        this.leftMove(8);
      }
    // debug infrared
    } else if (start === 0xb0 && command === 0x04) {
      if (count < 6) {
        // wait
      } else {
        frame = this.buffer.slice(0, 6);
        this.leftMove(6);
      }
    // debug mc
    } else if (start === 0xb0 && command === 0x10) {
      if (count < 10) {
        // wait
      } else {
        frame = this.buffer.slice(0, 10);
        this.leftMove(10);
      }
    // test driver
    } else if (start === 0xb1 && command === 0x02) {
      if (count < 6) {
        // wait
      } else {
        frame = this.buffer.slice(0, 6);
        this.leftMove(6);
      }
    // switch to run lua
    } else if (start === 0xc0 && command === 0x04) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // switch to run ble
    } else if (start === 0xc0 && command === 0x05) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // single driver light
    } else if (start === 0xb2 && command === 0x02) {
      // no reponse
    // set single driver polarity
    } else if (start === 0xb1 && command === 0xed) {
      if (count < 5) {

      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // file transfer
    } else if (start === 0x48 && command === 0x4a) {
      if (count < 6) {
        // wait
      } else {
        if (this.buffer[4] === 0x00 && this.buffer[5] === 0x00) {
          if (count < 8) {
            // wait
          } else {
            frame = this.buffer.slice(0, 8);
            this.leftMove(8);
          }
        } else {
          if (count < 8) {
            // wait
          } else {
            frame = this.buffer.slice(0, 8);
            this.leftMove(8);
          }
        }
      }
    // debug waist joint
    } else if (start === 0xb4 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // debug arm joint
    } else if (start === 0xb5 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // debug touch sensor
    } else if (start === 0xb8 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // set waist joint angle
    } else if (start === 0xb6 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // set arm joint angle
    } else if (start === 0xb7 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // get single driver polarity
    } else if (start === 0xb3 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // single driver reset
    } else if (start === 0xb9 && command === 0x02) {
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    // is lua running
    } else if (start === 0x05 && command === 0x06){
      if (count < 5) {
        // wait
      } else {
        frame = this.buffer.slice(0, 5);
        this.leftMove(5);
      }
    } else if (start === 0x06 && command === 0x06) {
      if (count < 35) {
        // wait
      } else {
        frame = this.buffer.slice(0, 35);
        this.leftMove(35);
      }
    } else if (start === 0x07 && command === 0x06) {
      if (count < 19) {
        // wait
      } else {
        frame = this.buffer.slice(0, 19);
        this.leftMove(19);
      }
    } else if (start === 0x08 && command === 0x06) {
      if (count < 19) {
        // wait
      } else {
        frame = this.buffer.slice(0, 19);
        this.leftMove(19);
      }
    } else if (start === 0x09 && command === 0x06) {
      if (count < 19) {
        // wait
      } else {
        frame = this.buffer.slice(0, 19);
        this.leftMove(19);
      }
    }  else if (start === 0x0a && command === 0x06) {
      if (count < 19) {
        // wait
      } else {
        frame = this.buffer.slice(0, 19);
        this.leftMove(19);
      }
    } else if (start === 0x0b && command === 0x06) {
      if (count < 19) {
        // wait
      } else {
        frame = this.buffer.slice(0, 19);
        this.leftMove(19);
      }
    } else if (start === 0x0c && command === 0x06) {
      if (count < 64) {
        //wait
      } else {
        frame = this.buffer.slice(0, 64);
        this.leftMove(64);
      }
    } else if (start === 0x0d && command === 0x06) {
      if (count < 8) {
        // wait
      } else {
        frame = this.buffer.slice(0, 8)
        this.leftMove(8)
      }
    } else {
      // unknown cmd
      if (this.position > 0) {
        this.position = -1;
        this.log('Unknown cmd', start, command, 'Clear all bytes in the buffer!');
      }
    }
    if (frame) {
      this.log('Buffer pop: ' + frame, this.buffer);
    } else {
      this.log('wait...', this.buffer);
    }
    return frame;
  },
};

CmdBuffer.init();
