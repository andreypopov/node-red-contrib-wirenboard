'use strict';


class WirenboardHelper {
    static generateElementId(topic) {
        var arr = topic.split('/');
        return (arr[2]+'-'+arr[4]).replace(/[^a-zA-Z0-9_-]/g, '');
    }
    static statusUpdatedAt(serverNode, topic) {
        let textSuffix = '';
        if ('change' in serverNode.devices[topic] && serverNode.devices[topic].change.updated_at) {
            // if (new Date().toDateString() != new Date(serverNode.devices[topic].change.updated_at).toDateString()) {
                textSuffix += new Date(serverNode.devices[topic].change.updated_at).toLocaleDateString('ru-RU') + ' ';
            // }
            textSuffix += new Date(serverNode.devices[topic].change.updated_at).toLocaleTimeString('ru-RU');
            textSuffix = '['+textSuffix+']';
        }
        return textSuffix;
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
                result.data[topic] = serverNode.devices[topic].payload;
                result.data_full[topic] = serverNode.devices[topic];
                result.is_data = true;

                let val = parseFloat(serverNode.devices[topic].payload);
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

}


module.exports = WirenboardHelper;
