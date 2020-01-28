var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeGet {
        constructor(config) {

            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.is_subscribed = false;
            node.server = RED.nodes.getNode(node.config.server);

            if (typeof(node.config.channel) == 'string') node.config.channel = [node.config.channel]; //for compatible

            if (node.server)  {
                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);

                    if (typeof (node.config.channel) == 'object'  && (node.config.channel).length) {
                        var isSingleChannel = (node.config.channel).length == 1;
                        var result = {};
                        var hasData = false;
                        if (isSingleChannel) {
                            message_in.topic = node.config.channel[0];
                            if (node.config.channel[0] in node.server.devices_values) {
                                result = node.server.devices_values[node.config.channel[0]];
                                hasData = true;
                            } else {
                                result = null;
                            }
                        } else {
                            var max = null;
                            var min = null;
                            var sum = 0;
                            var cnt = 0;
                            for (var index in node.config.channel) {
                                var topic = node.config.channel[index];

                                if (topic in node.server.devices_values) {
                                    result[topic] = node.server.devices_values[topic];
                                    hasData = true;

                                    let val = parseFloat(node.server.devices_values[topic]);
                                    cnt++;
                                    sum += val;
                                    if (min === null || min > val) min = val;
                                    if (max === null || max < val) max = val;
                                } else {
                                    result[topic] = null;
                                }
                            }
                            message_in.math = {
                                "count":cnt,
                                "avg":Math.round((sum/cnt) * 100) / 100,
                                "sum":sum,
                                "min":min,
                                "max":max
                            };
                        }

                        message_in.payload_in = message_in.payload;
                        message_in.payload = result;
                        // message_in.complete_payload = node.server.devices_values;
                        node.send(message_in);

                        if (hasData) {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: isSingleChannel?result:"ok"
                            });
                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/get:status.no_value"
                            });
                        }
                        node.cleanTimer = setTimeout(function () {
                            node.status({}); //clean
                        }, 3000);
                    }
                });

                if (typeof (node.config.channel) != 'object' && !(node.config.channel).length) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-wirenboard/get:status.no_device"
                    });
                }

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-wirenboard/get:status.no_server"
                });
            }
        }

    }
    RED.nodes.registerType('wirenboard-get', WirenboardNodeGet);
};




