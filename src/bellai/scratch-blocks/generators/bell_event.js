
export default function (Blockly) {
    // 接收消息 msg
    Blockly.Lua['bell_event_get_msg'] = function (block) {
        var msg = block.getFieldValue('msg');
        var code = 'msg_def("' + msg + '", function()\n';
        var nextBlock = block.getNextBlock();
        if (nextBlock) {
            code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
        }
        code += 'end)\n';
        return code;
    }
    // 发送消息 msg
    Blockly.Lua['bell_event_send_msg'] = function (block) {
        var msg = block.getFieldValue('msg');
        var code = 'msg_fire("' + msg + '")\n';
        var nextBlock = block.getNextBlock();
        if (nextBlock) {
            code += Blockly.Lua.blockToCode(nextBlock, true);
        }
        return code;
    }
    // 当颜色传感器（1） [=>,=,<=] (1)
    Blockly.Lua['bell_event_color_type'] = function (block) {
        var code = '--Start\n';
        code += 'cg_def("Start",function ()\n';
        code += 'repeat\n';
        var dropdown_index = block.getFieldValue('index');
        var operator = block.getFieldValue('op');
        var colorValue = block.getFieldValue('color');
        var colorSpace = ['#737373', '#000000', '#0050dc', '#78fa00', '#ffff00', '#ff1428', '#ffffff', '#c81eff', '#ff9800'];
        var colorIndex = colorSpace.indexOf(colorValue);
        var callBack = `Get_color_data(${dropdown_index}) ${operator} ${colorIndex}`;
        code += `if (${callBack}) then\n`;
        var nextBlock = block.getNextBlock();
        if (nextBlock) {
            code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
        }
        code += 'end\n';
        code += Blockly.Lua.INDENT + 'mg_yield()\n';
        code += 'until (false)\n'
        code += 'end)\n\n';
        return code;
    };

    // 当红外传感器（1） [=>,=,<=] 距离 [0,0,20]
    Blockly.Lua['bell_event_infrared_cm'] = function (block) {
        var code = '--Start\n';
        code += 'cg_def("Start",function ()\n';
        code += 'repeat\n';
        var dropdown_index = block.getFieldValue('index');
        var operator = block.getFieldValue('op');
        var distance = block.getFieldValue('dis');
        if (distance == 0) {
            distance = 5;
        }
        var callBack = `Get_infrared_data(${dropdown_index}) ${operator} ${distance}`;
        code += `if (${callBack}) then\n`;
        var nextBlock = block.getNextBlock();
        if (nextBlock) {
            code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
        }
        code += 'end\n';
        code += Blockly.Lua.INDENT + 'mg_yield()\n';
        code += 'until (false)\n'
        code += 'end)\n\n';
        return code;
    };
    // 当触控球（1）的状态为 [按下，没按下]
    Blockly.Lua['bell_event_touch_press'] = function (block) {
        var code = '--Start\n';
        code += 'cg_def("Start",function ()\n';
        code += 'repeat\n';
        var dropdown_index = block.getFieldValue('index');
        var state = block.getFieldValue('state');
        var callBack = `Get_touch_state(${dropdown_index}) == ${state}`;
        code += `if (${callBack}) then\n`;
        var nextBlock = block.getNextBlock();
        if (nextBlock) {
            code += '  ' + Blockly.Lua.blockToCode(nextBlock, true);
        }
        code += 'end\n';
        code += Blockly.Lua.INDENT + 'mg_yield()\n';
        code += 'until (false)\n'
        code += 'end)\n\n';
        return code;
    };
    // 陀螺仪

}
// goog.provide('Blockly.Lua.bell_event');
// goog.require('Blockly.Lua');