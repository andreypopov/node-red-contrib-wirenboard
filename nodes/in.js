var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeIn {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.firstMsg = true;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);

            node.status({}); //clean

            if (node.server) {
                node.server.on('onConnectError', () => this.onConnectError());
                node.server.on('onMQTT_Error_Connection', () => this.onMQTT_Error_Connection());
                node.server.on('onMQTTConnect', () => this.onMQTTConnect());
                node.server.on('onMQTTMessage', (data) => this.onMQTTMessage(data));


                node.on('close', function () {
                    node.log('Unsubscribe from mqtt topic: ' + node.config.channel);
                    node.server.mqtt.unsubscribe(node.config.channel, function (err) {});
                });
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

        onMQTTConnect() {
            var node = this;

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

        onMQTTMessage(data) {
            var node = this;

            if (data.topic === node.config.channel) {
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



