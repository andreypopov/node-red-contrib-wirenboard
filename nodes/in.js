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
                node.listener_onConnectError = function(data) { node.onConnectError(); }
                node.server.on('onConnectError', node.listener_onConnectError);

                node.listener_onMQTT_Error_Connection = function(data) { node.onMQTT_Error_Connection(); }
                node.server.on('onMQTT_Error_Connection', node.listener_onMQTT_Error_Connection);

                node.listener_onMQTTConnect = function(data) { node.onMQTTConnect(); }
                node.server.on('onMQTTConnect', node.listener_onMQTTConnect);

                node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
                node.server.on('onMQTTMessage', node.listener_onMQTTMessage);

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
            node.server.unsubscribeMQTT(node);

            //remove listeners
            if (node.listener_onConnectError) {
                node.server.removeListener('onConnectError', node.listener_onConnectError);
            }

            if (node.listener_onMQTT_Error_Connection) {
                node.server.removeListener('onMQTT_Error_Connection', node.listener_onMQTT_Error_Connection);
            }

            if (node.listener_onMQTTConnect) {
                node.server.removeListener('onMQTTConnect', node.listener_onMQTTConnect);
            }

            if (node.listener_onMQTTMessage) {
                node.server.removeListener("onMQTTMessage", node.listener_onMQTTMessage);
            }
        }

        onMQTTConnect() {
            var node = this;
            node.server.subscribeMQTT(node);
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



