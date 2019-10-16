var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.is_subscribed = false;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);

            node.listener_onMQTTConnect = function(data) { node.onMQTTConnect(); }
            node.server.on('onMQTTConnect', node.listener_onMQTTConnect);

            node.on('close', () => this.onMQTTClose());


            if (node.server)  {

                if (typeof(node.server.mqtt) === 'object') {
                    node.onMQTTConnect();
                }

                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);

                    if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                        if (node.config.channel in node.server.devices_values) {
                            var value = node.server.devices_values[node.config.channel];

                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: value
                            });

                            node.cleanTimer = setTimeout(function () {
                                node.status({}); //clean
                            }, 3000);

                            node.send({
                                payload: value,
                                payload_in: message_in.payload,
                                topic: node.config.channel
                            });
                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/get:status.no_value"
                            });

                            node.cleanTimer = setTimeout(function () {
                                node.status({}); //clean
                            }, 3000);
                        }
                    }
                });

                if (typeof (node.config.channel) != 'string' || !(node.config.channel).length) {
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

        onMQTTClose() {
            var node = this;
            node.server.unsubscribeMQTT(node);

            //remove listeners
            if (node.listener_onMQTTConnect) {
                node.server.removeListener('onMQTTConnect', node.listener_onMQTTConnect);
            }
        }

        onMQTTConnect() {
            var node = this;
            node.server.subscribeMQTT(node);
        }

        onMQTTMessage(data) {
            //do nothing
        }
    }
    RED.nodes.registerType('wirenboard-get', WirenboardNodeGet);
};




