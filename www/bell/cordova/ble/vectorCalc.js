function vectorCalc (x, y) {
  var MIN_REACT_NORM = 5;
  var norm = Math.sqrt(x * x + y * y);
  var v1 = 0, v2 = 0;
  if (norm > MIN_REACT_NORM) {
    if (y >= 0) {
      if (x > 0) {
        v1 = norm;
        v2 = norm - x;
      } else {
        v1 = norm + x;
        v2 = norm;
      }
    } else {
      if (x > 0) {
        v1 = -(norm - x);
        v2 = -norm;
      } else {
        v1 = -norm;
        v2 = -(norm + x);
      }
    }
  }

  v1 = Math.min(100, Math.max(-100, v1));
  v2 = Math.min(100, Math.max(-100, v2));

  return {
    v1: Number(v1),
    v2: -Number(v2)
  }
}

function vectorCalcPlus (x, y) {
  var MIN_REACT_NORM = 5;
  var DIFF_RATIO = 50; // 差速比 0-100
  var REDU_RATIO = 100; // 减速比 0-200
  var norm = Math.sqrt(x * x + y * y);
  var omega = Math.atan2(x, Math.abs(y));
  var v1 = 0, v2 = 0;
  if (norm > MIN_REACT_NORM) {
    if (y >= 0) {
      v1 = norm * (1 + DIFF_RATIO * omega / 157);
      v2 = norm * (1 - DIFF_RATIO * omega / 157);
    } else {
      v1 = -norm * (1 + DIFF_RATIO * omega / 157);
      v2 = -norm * (1 - DIFF_RATIO * omega / 157);
    }
  } else {
    v1 = 0;
    v2 = 0;
  }
  v1 /= (1 + REDU_RATIO * Math.abs(omega) / 157);
  v2 /= (1 + REDU_RATIO * Math.abs(omega) / 157);

  v1 = Math.min(100, Math.max(-100, v1));
  v2 = Math.min(100, Math.max(-100, v2));

  v1 = Number(v1.toFixed(0));
  v2 = Number(v2.toFixed(0));
  return {
    v1: v1,
    v2: -v2
  }
}
