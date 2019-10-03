var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeOut {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                // node.server.on('onClose', () => this.onClose());
                // node.server.on('onStateChanged', (data) => node.onStateChanged(data));
                // node.server.on('onStateChangedError', (error) => node.onStateChangedError(error));



                node.status({}); //clean

                node.on('input', function(message) {
                    if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                        clearTimeout(node.cleanTimer);

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


                        if (payload !== undefined) {
                            var client = mqtt.connect('mqtt://' + node.server.config.host);

                            client.on('connect', function () {
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: payload.toString()
                                });

                                node.cleanTimer = setTimeout(function(){
                                    node.status({}); //clean
                                }, 3000);


                                client.publish(node.config.channel + command, payload.toString());
                                client.end();

                                node.log('Published to mqtt topic: ' + (node.config.channel + command) + ' : ' + payload.toString());
                            })

                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "node-red-contrib-wirenboard/out:status.no_payload"
                            });
                        }
                    }
                });


                if (typeof (node.config.channel) != 'string' || !(node.config.channel).length) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "node-red-contrib-wirenboard/out:status.no_device"
                    });
                }
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






