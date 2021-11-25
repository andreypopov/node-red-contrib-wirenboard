const WirenboardHelper = require('../lib/WirenboardHelper.js');
var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.server = RED.nodes.getNode(node.config.server);
            node.last_change = null;

            if (typeof(node.config.channel) == 'string') node.config.channel = [node.config.channel]; //for compatible

            if (node.server) {
                node.status({}); //clean

                node.on('input', function(message) {
                    clearTimeout(node.cleanTimer);

                    var channels = [];

                    //overwrite with elementId
                    if (!(node.config.channel).length && "elementId" in message) {
                        message.topic = node.server.getTopicByElementId(message.elementId);
                    }
                    //overwrite with topic
                    if (!(node.config.channel).length && "topic" in message) {
                        if (typeof(message.topic) == 'string' ) message.topic = [message.topic];
                        if (typeof(message.topic) == 'object') {
                            for (var i in message.topic) {
                                var topic = message.topic[i];
                                if (typeof(topic) == 'string' && topic in node.server.devices) {
                                    channels.push(topic);
                                }
                            }
                        }
                    } else {
                        channels = node.config.channel;
                    }


                    if (typeof (channels) == 'object'  && channels.length) {
                        var payload;
                        switch (node.config.payloadType) {
                            case 'flow':
                            case 'global': {
                                RED.util.evaluateNodeProperty(node.config.payload, node.config.payloadType, this, message, function (error, result) {
                                    if (error) {
                                        node.error(error, message);
                                    } else {
                                        payload = result;
                                    }
                                });
                                break;
                            }
                            case 'date': {
                                payload = Date.now();
                                break;
                            }

                            case 'num': {
                                payload = parseInt(node.config.payload);
                                break;
                            }

                            case 'str': {
                                payload = node.config.payload;
                                break;
                            }

                            case 'object': {
                                payload = node.config.payload;
                                break;
                            }

                            case 'msg':
                            default: {
                                payload = message[node.config.payload];
                                break;
                            }

                            case 'wb_payload':
                                payload = node.config.payload;
                                break;
                        }

                        var command;
                        switch (node.config.commandType) {
                            case 'msg': {
                                command = message[node.config.command];
                                break;
                            }

                            case 'str':
                            default: {
                                command = node.config.command;
                                break;
                            }
                        }


                        var rbe = "rbe" in node.config && node.config.rbe;

                        if (payload !== undefined) {

                            var updateStatus = false;
                            for (var i in channels) {
                                var device = node.server.getDeviceByTopic(channels[i]);
                                if (device) {
                                    if ('error' in device && device.error) {
                                        node.status({
                                            fill: "red",
                                            shape: "dot",
                                            text: "node-red-contrib-wirenboard/out:status.no_connection"
                                        });
                                    }

                                    var lastValue = device ? device.payload.toString() : null;

                                    if (node.config.payloadType === 'wb_payload' && payload === 'toggle') {
                                        payload = parseInt(lastValue) ? 0 : 1;
                                    }

                                    if (!rbe || (rbe && lastValue !== payload.toString())) {
                                        node.log('Published to mqtt topic: ' + (channels[i] + command) + ' : ' + payload.toString());
                                        node.server.mqtt.publish(channels[i] + command, payload.toString(), {retain: true});
                                        updateStatus = true;
                                        node.last_change = new Date().getTime();
                                    }
                                }
                            }

                            var text = payload.toString() + ' [' + new Date(node.last_change).toLocaleDateString('ru-RU') + ' ' + new Date(node.last_change).toLocaleTimeString('ru-RU')+']';
                            if (updateStatus) {
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: text
                                });

                                node.cleanTimer = setTimeout(function() {
                                    node.status({
                                        fill: "green",
                                        shape: "ring",
                                        text: text
                                    });
                                }, 3000);
                            } else {
                                // node.status({
                                //     fill: "yellow",
                                //     shape: "dot",
                                //     text: "node-red-contrib-wirenboard/out:status.rbe"
                                // });
                                //
                                // node.cleanTimer = setTimeout(function() {
                                //     node.status({
                                //         fill: "green",
                                //         shape: "ring",
                                //         text: text
                                //     });
                                // }, 3000);
                            }


                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/out:status.no_payload"
                            });
                        }
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-wirenboard/out:status.no_device"
                        });
                    }
                });

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-wirenboard/out:status.no_server"
                });
            }
        }
    }
    RED.nodes.registerType('wirenboard-out', WirenboardNodeOut);
};






