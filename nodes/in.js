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
                // node.server.on('onClose', () => this.onClose());
                // node.server.on('onSocketError', () => this.onSocketError());
                // node.server.on('onSocketClose', () => this.onSocketClose());
                // node.server.on('onSocketOpen', () => this.onSocketOpen());
                // node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
                // node.server.on('onNewDevice', (uniqueid) => this.onNewDevice(uniqueid));

                // node.sendLastState(); //tested for duplicate send with onSocketOpen


                var client = node.server.connectMQTT();

                client.on('connect', function () {
                    if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                        client.subscribe(node.config.channel, function (err) {
                            if (err) {
                                node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: "node-red-contrib-wirenboard/in:status.no_connection"
                                });
                                node.warn('Subscribe to "' + node.config.channel + '" error');
                            }
                        })
                    } else {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-wirenboard/in:status.no_device"
                        });
                    }
                });

                client.on('message', function (topic, message) {
                    if (node.firstMsg && !node.config.outputAtStartup) {
                        node.firstMsg = false;
                        return;
                    }

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: message.toString()
                    });

                    node.send({
                        payload: message.toString(),
                        topic: topic
                    });
                });

                node.on('close', function () {
                    node.log('Unsubscribe from mqtt topic: ' + node.config.channel);
                    client.unsubscribe(node.config.channel, function (err) {});
                    client.end();
                });

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-wirenboard/in:status.no_server"
                });
            }


        }
    }
    RED.nodes.registerType('wirenboard-input', WirenboardNodeIn);
};



