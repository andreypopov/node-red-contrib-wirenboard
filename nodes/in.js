const WirenboardHelper = require('../lib/WirenboardHelper.js');

var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.firstMsg = true;
            node.statusTimer = null;
            node.cleanTimer = null;
            node.meta = {};
            node.server = RED.nodes.getNode(node.config.server);
            if (typeof(node.config.channel) == 'string') node.config.channel = [node.config.channel]; //for compatible

            node.status({}); //clean

            if (node.server) {
                node.listener_onMQTTConnect = function(data) { node.onMQTTConnect(); }
                node.server.on('onMQTTConnect', node.listener_onMQTTConnect);

                node.listener_onConnectError = function(data) { node.onConnectError(); }
                node.server.on('onConnectError', node.listener_onConnectError);

                node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
                node.server.on('onMQTTMessage', node.listener_onMQTTMessage);

                node.listener_onMetaError = function(data) { node.onMetaError(data); }
                node.server.on('onMetaError', node.listener_onMetaError);

                node.on('close', () => this.onMQTTClose());

                if (typeof(node.server.mqtt) === 'object') {
                    node.onMQTTConnect();
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-wirenboard/in:status.no_server"
                });
            }
        }

        onConnectError(status = null) {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/in:status.no_connection"
            });
        }

        onMetaError(data) {
            var node = this;
            if (node.hasChannel(data.topic)) {

                node.send([null, {
                    payload: data.payload,
                    topic: data.topic,
                    elementId: WirenboardHelper.generateElementId(data.topic),
                    message:data.payload?RED._("node-red-contrib-wirenboard/in:status.no_connection"):RED._("node-red-contrib-wirenboard/in:status.connected")
                }]);

                if (node.isSingleChannelMode()) {
                    if (data.payload) {
                        let text = RED._("node-red-contrib-wirenboard/in:status.no_connection") + ' [' + new Date().toLocaleDateString('ru-RU') + ' ' +
                            new Date().toLocaleTimeString('ru-RU') + ']';
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: text
                        });

                    } else {
                        var device = node.server.getDeviceByTopic(data.topic);
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: (device) ? device.payload : "node-red-contrib-wirenboard/in:status.connected"
                        });
                    }
                }
            }
        }

        onMQTTClose() {
            var node = this;

            //remove listeners
            if (node.listener_onMQTTConnect) {
                node.server.removeListener('onMQTTConnect', node.listener_onMQTTConnect);
            }
            if (node.listener_onConnectError) {
                node.server.removeListener('onConnectError', node.listener_onConnectError);
            }
            if (node.listener_onMQTTMessage) {
                node.server.removeListener("onMQTTMessage", node.listener_onMQTTMessage);
            }

            node.onConnectError();
        }

        onMQTTConnect() {
            var node = this;

            node.status({
                fill: "green",
                shape: "dot",
                text: "node-red-contrib-wirenboard/in:status.connected"
            });

            //meta errors
            for (var i in node.config.channel) {
                var topic = node.config.channel[i];
                var device = node.server.getDeviceByTopic(topic);
                if (device && 'error' in device &&  device.error) {
                    node.onMetaError({topic:topic, payload:true});
                }
            }
        }

        onMQTTMessage(data) {
            var node = this;

            if (node.hasChannel(data.topic)) {
                let device = node.server.getDeviceByTopic(data.topic);
                clearTimeout(node.cleanTimer);
                clearTimeout(node.statusTimer);
                let timeout = 0;
                let payloadText =  WirenboardHelper.formatStatusValue(data.payload, device.meta);
                let textSuffix = WirenboardHelper.statusUpdatedAtSimple();

                node.status({
                    fill: "green",
                    shape: "dot",
                    text: payloadText
                });
                node.statusTimer = setTimeout(function () {

                    //todo: meta loads after value, this fixes unit on start
                    device = node.server.getDeviceByTopic(data.topic);
                    payloadText =  WirenboardHelper.formatStatusValue(data.payload, device.meta);

                    node.status({
                        fill: "green",
                        shape: "ring",
                        text: payloadText+(textSuffix?' '+textSuffix:'')
                    });
                }, 3000);

                if (node.isSingleChannelMode()) {
                    if (node.firstMsg) {
                        timeout = 1000; //hotfix, delay for the first message
                        node.firstMsg = false;
                        if (!node.config.outputAtStartup) {
                            return;
                        }
                    }

                    setTimeout(function() {
                        node.send(node.server.getDeviceByTopic(data.topic));
                    }, timeout);
                } else {
                    var data_array = WirenboardHelper.prepareDataArray(node.server, node.config.channel);
                    let timeout = 0;

                    if (node.firstMsg && data_array.has_null) {
                        return; //not full data, waiting for other topics
                    } else if (node.firstMsg && !data_array.has_null) {
                        node.firstMsg = false;
                        timeout = 1000; //hotfix, delay for the first message
                        if (!node.config.outputAtStartup) {
                            return;
                        }
                    }

                    setTimeout(function(){
                        node.send({
                            payload: data_array.data,
                            data_array: data_array.data_full,
                            math: data_array.math,
                            event: node.server.getDeviceByTopic(data.topic)
                        });
                    }, timeout);


                }
            }
        }

        isSingleChannelMode() {
            return (this.config.channel).length === 1;
        }

        hasChannel(channel) {
            var node = this;
            var result = false;

            for (var i in node.config.channel) {
                if (node.config.channel[i] === channel) {
                    result = true;
                    break;
                }
            }

            return result;
        }
    }
    RED.nodes.registerType('wirenboard-in', WirenboardNodeIn);
};



