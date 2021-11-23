const WirenboardHelper = require('../lib/WirenboardHelper.js');
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
            node.diff = {};

            if (typeof(node.config.channel) == 'string') node.config.channel = [node.config.channel]; //for compatible

            if (node.server)  {
                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);

                    var channels = [];

                    //overwrite with elementId
                    if (!node.config.channel.length && "elementId" in message_in) {
                        message_in.topic = node.server.getTopicByElementId(message_in.elementId);
                    }

                    //overwrite with topic
                    if (!node.config.channel.length && "topic" in message_in) {
                        if (typeof(message_in.topic) == 'string' ) message_in.topic = [message_in.topic];
                        if (typeof(message_in.topic) == 'object') {
                            for (var i in message_in.topic) {
                                var topic = message_in.topic[i];
                                if (typeof(topic) == 'string' && topic in node.server.devices) {
                                    channels.push(topic);
                                }
                            }
                        }
                    } else {
                        channels = node.config.channel;
                    }

                    if (typeof (channels) == 'object'  && channels.length) {
                        var result = {};
                        var hasData = false;
                        if (channels.length === 1) {
                            message_in.topic = channels[0];
                            message_in = Object.assign(message_in, node.server.devices[message_in.topic]);

                            if (node.server.devices[message_in.topic].error) {
                                result = node.server.devices[message_in.topic].payload; //last valid value
                                hasData = false;
                            } else if (message_in.topic in node.server.devices) {
                                result = node.server.devices[message_in.topic].payload;
                                hasData = true;
                            } else {
                                result = null;
                            }
                        } else {
                            var data_array = WirenboardHelper.prepareDataArray(node.server, channels);
                            hasData = data_array.is_data;
                            result = data_array.data;
                            message_in.data_array = data_array.data_full;
                            message_in.math = data_array.math;
                        }


                        message_in.payload_in = message_in.payload;
                        message_in.payload = result;
                        node.send(message_in);

                        if (hasData) {
                            if (channels.length === 1) {
                                let textSuffix = WirenboardHelper.statusUpdatedAt(node.server, message_in.topic);
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: result+(textSuffix?' '+textSuffix:'')
                                });
                            } else {
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: "ok"
                                });
                            }


                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/get:status.no_connection"
                            });
                        }
                        node.cleanTimer = setTimeout(function () {
                            node.status({}); //clean
                        }, 3000);
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-wirenboard/get:status.no_device"
                        });
                    }
                });

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




