'use strict';


class WirenboardHelper {
    static generateElementId(topic) {
        var arr = topic.split('/');
        return (arr[2]+'-'+arr[4]).replace(/[^a-zA-Z0-9_-]/g, '');
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

            if (topic in serverNode.devices_values) {
                result.data[topic] = serverNode.devices_values[topic];
                result.data_full[topic] = {
                    payload: serverNode.devices_values[topic],
                    topic: topic,
                    selector: WirenboardHelper.generateElementId(topic)
                };
                result.is_data = true;

                let val = parseFloat(serverNode.devices_values[topic]);
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
                    selector: WirenboardHelper.generateElementId(topic)
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

}


module.exports = WirenboardHelper;