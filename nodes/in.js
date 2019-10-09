var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.firstMsg = true;
            node.is_subscribed = false;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);

            node.status({}); //clean

            if (node.server) {
                node.server.on('onConnectError', () => this.onConnectError());
                node.server.on('onMQTT_Error_Connection', () => this.onMQTT_Error_Connection());
                node.server.on('onMQTTConnect', () => this.onMQTTConnect());
                node.server.on('onMQTTMessage', (data) => this.onMQTTMessage(data));

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

        onConnectError(status) {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/in:status.no_connection"
            });
        }

        onMQTT_Error_Connection() {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/in:status.no_connection"
            });
        }

        onMQTTClose() {
            var node = this;
            node.log('Unsubscribe from mqtt topic: ' + node.config.channel);
            node.server.mqtt.unsubscribe(node.config.channel, function (err) {});
            node.is_subscribed = false;
        }

        onMQTTConnect() {
            var node = this;

            if (!node.is_subscribed) {
                if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                    node.server.mqtt.subscribe(node.config.channel, function (err) {
                        if (err) {
                            console.log(err);
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/in:status.no_connection"
                            });
                            node.warn('Subscribe to "' + node.config.channel + '" error');
                        } else {
                            node.is_subscribed = true;
                            node.warn('Subscribed to: "' + node.config.channel);
                        }
                    })
                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-wirenboard/in:status.no_device"
                    });
                }
            }
        }

        onMQTTMessage(data) {
            var node = this;

            if (data.topic === node.config.channel) {
                // console.log('============='+data.topic);
                // console.log(node.firstMsg);
                // console.log(node.config.outputAtStartup);
                if (node.firstMsg && !node.config.outputAtStartup) {
                    node.firstMsg = false;
                    return;
                }

                node.status({
                    fill: "green",
                    shape: "dot",
                    text: data.payload
                });

                node.send({
                    payload: data.payload,
                    topic: data.topic
                });
            }
        }


    }
    RED.nodes.registerType('wirenboard-in', WirenboardNodeIn);
};



