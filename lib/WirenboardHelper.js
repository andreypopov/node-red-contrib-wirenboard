'use strict';


class WirenboardHelper {
    static isJson(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    static isNumber(n)
    {
        return WirenboardHelper.isInt(n) || WirenboardHelper.isFloat(n);
    }

    static isInt(n)
    {
        if (n === 'true' || n === true || n === 'false' || n === false) return false;
        return n !== "" && !isNaN(n) && Math.round(n) === n;
    }

    static isFloat(n){
        if (n === 'true' || n === true || n === 'false' || n === false) return false;
        return n !== "" && !isNaN(n) && Math.round(n) !== n;
    }

    static generateElementId(topic) {
        var arr = topic.split('/');
        return (arr[2]+'-'+arr[4]).replace(/[^a-zA-Z0-9_-]/g, '');
    }
    static statusUpdatedAt(serverNode, topic) {
        let textSuffix = '';
        if (topic in serverNode.devices && 'change' in serverNode.devices[topic] && serverNode.devices[topic].change.updated_at) {
            // if (new Date().toDateString() != new Date(serverNode.devices[topic].change.updated_at).toDateString()) {
                textSuffix += new Date(serverNode.devices[topic].change.updated_at).toLocaleDateString('ru-RU') + ' ';
            // }
            textSuffix += new Date(serverNode.devices[topic].change.updated_at).toLocaleTimeString('ru-RU');
            textSuffix = '['+textSuffix+']';
        }
        return textSuffix;
    }

    static statusUpdatedAtSimple() {
        return ' [' + new Date().toLocaleDateString('ru-RU') + ' ' + new Date().toLocaleTimeString('ru-RU') + ']'
    }

    static prepareDataArray(serverNode, channels) {
        var result = {};
        result.data = {};
        result.data_full = {};
        result.is_data = false;
        result.has_null = false;

        var max = null;
        var min = null;
        var sum = 0;
        var cnt = 0;
        for (var index in channels) {
            var topic = channels[index];

            if (topic in serverNode.devices) {
                var device = serverNode.getDeviceByTopic(topic);
                result.data[topic] = device.payload;
                result.data_full[topic] = device;
                result.is_data = true;

                let val = parseFloat(device.payload);
                cnt++;
                sum += val;
                if (min === null || min > val) min = val;
                if (max === null || max < val) max = val;
            } else {
                result.has_null = true;
                result.data[topic] = null;
                result.data_full[topic] = {
                    payload: null,
                    topic: topic,
                    elementId: WirenboardHelper.generateElementId(topic)
                };
            }
        }
        result.math = {
            "count":cnt,
            "avg":Math.round((sum/cnt) * 100) / 100,
            "sum":sum,
            "min":min,
            "max":max
        };

        return result;
    }

    static convertVarType(value) {
        if (typeof(value) == 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'on')) {
            value = true;
        } else if (typeof(value) == 'string' && (value.toLowerCase() === 'false' || value.toLowerCase() === 'off')) {
            value = false;
        } else if (WirenboardHelper.isNumber(value)) {
            value = parseFloat(value);
        }
        return value;
    }

    static formatValue(val, meta) {
        if (typeof(val) == 'object') return val;

        if (meta && 'type' in meta) {
            let format = meta.type;
            switch (format) {
                case 'switch':
                    val = !!this.convertVarType(val);
                    val = val?1:0;
                    break;
            }
        }

        return val;
    }

    static formatStatusValue(val, meta) {
        if (typeof(val) == 'object') return val;

        if (meta && 'type' in meta) {
            let format = meta.type;
            switch (format) {
                case 'switch':
                    val = !!this.convertVarType(val);
                    val = val?'on':'off';
                    break;
                case 'range':
                    if ('max' in meta && parseInt(meta.max) === 100) {
                        val = parseFloat(val) + '%';
                    }
                    break;
                case 'temperature':
                    val = parseFloat(val) + '°C';
                    break;
                case 'rel_humidity':
                    val = parseFloat(val) + '%';
                    break;
                case 'voltage':
                    val = parseFloat(val) + 'V';
                    break;
                case 'power':
                    val = parseFloat(val) + 'W';
                    break;
                case 'power_consumption':
                    val = parseFloat(val) + 'kWh';
                    break;
                case 'concentration':
                    val = parseFloat(val) + '';
                    break;
            }
        }

        return val;
    }
}


module.exports = WirenboardHelper;
