var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeGet {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);


            if (node.server)  {
                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);

                    if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                        var client = node.server.connectMQTT();

                        client.on('connect', function () {
                            client.subscribe(node.config.channel, function (err) {
                                node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: "node-red-contrib-wirenboard/get:status.no_connection"
                                });
                                node.warn('Subscribe to "' + node.config.channel + '" error');
                            })
                        });

                        client.on('message', function (topic, message) {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: message.toString()
                            });

                            node.cleanTimer = setTimeout(function(){
                                node.status({}); //clean
                            }, 3000);

                            node.send({
                                payload: message.toString(),
                                payload_in: message_in.payload,
                                topic: topic
                            });

                            client.unsubscribe(node.config.channel, function (err) {});
                            client.end();
                        })
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
    }
    RED.nodes.registerType('wirenboard-get', WirenboardNodeGet);
};




