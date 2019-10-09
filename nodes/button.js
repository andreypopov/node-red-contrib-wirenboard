var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeButton {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);




            node.timerclick = 0;
            node.timerfunc = null;
            node.refreshfunc = null; //func to refresh ndoe status
            node.clickfunc = null; //func to fire click event
            node.clickcounter = 0;
            node.val = false;
            node.longPressDelay = config.longPressDelay;
            node.doubleClickDelay = config.doubleClickDelay;
            node.eventTypes = config.eventTypes.filter(String);
            node.longpressStarted = false;

            function eventHandler(event, topic) {
                clearTimeout(node.refreshfunc);
                node.refreshfunc = setTimeout(function () {
                    node.status({});
                }, 1500);

                node.status({fill: "green", shape: "ring", text: event});
                node.send({topic: topic, payload: event});
            }


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
                    text: "node-red-contrib-wirenboard/button:status.no_server"
                });
            }
        }

        onConnectError(status) {
            var node = this;

            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/buttom:status.no_connection"
            });
        }

        onMQTT_Error_Connection() {
            var node = this;

            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/button:status.no_connection"
            });
        }

        onMQTTConnect() {
            var node = this;

            if (typeof (node.config.channel) == 'string' && (node.config.channel).length) {
                node.server.mqtt.subscribe(node.config.channel, function (err) {
                    if (err) {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "node-red-contrib-wirenboard/button:status.no_connection"
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
                    text: "node-red-contrib-wirenboard/button:status.no_device"
                });
            }
        }

        onMQTTMessage(data) {
            var node = this;

            if (data.topic === node.config.channel) {
                var val = parseInt(data.message) ? true : false;
                var event = '';

                if (node.val != val) {
                    node.val = val;
                    if (val) { // value == 1
                        clearTimeout(node.refreshfunc);
                        node.clickcounter++;
                        node.timerclick = new Date().getTime();

                        if (node.eventTypes.indexOf('Press') != -1) {
                            eventHandler('press', topic);
                        }

                        if (node.eventTypes.indexOf('LongPress') != -1) {
                            node.timerfunc = setTimeout(function () {
                                node.longpressStarted = true;
                                eventHandler('longpress', topic);
                            }, node.config.longPressDelay);
                        }

                    } else { //value == 0

                        if (node.clickcounter) {

                            clearTimeout(node.timerfunc);
                            clearTimeout(node.clickfunc);

                            if (node.eventTypes.indexOf('Release') != -1) {
                                eventHandler('release', topic);
                            }


                            //longpress fired earlier
                            if (node.longpressStarted) {
                                node.timerclick = node.clickcounter = node.longpressStarted = 0;
                                return true;
                            }


                            if (node.eventTypes.indexOf('Click') != -1) {
                                if (((new Date().getTime()) - node.timerclick) > node.config.doubleClickDelay || node.eventTypes.indexOf('DoubleClick') == -1) { //80ms
                                    node.timerclick = node.clickcounter = 0;

                                    eventHandler('click', topic);
                                    return true;
                                } else {
                                    node.clickfunc = setTimeout(function () {
                                        node.timerclick = node.clickcounter = 0;

                                        eventHandler('click', topic);

                                    }, node.config.doubleClickDelay - ((new Date().getTime()) - node.timerclick));
                                }
                            }


                            if (node.eventTypes.indexOf('DoubleClick') != -1) {
                                if (node.clickcounter == 2 && ((new Date().getTime()) - node.timerclick) < node.config.doubleClickDelay) {
                                    clearTimeout(node.clickfunc);
                                    node.timerclick = node.clickcounter = 0;
                                    eventHandler('doubleclick', topic);
                                    return true;
                                }
                                setTimeout(function () {
                                    clearTimeout(node.clickfunc);
                                    node.timerclick = node.clickcounter = 0;
                                }, node.config.doubleClickDelay * 2);
                            }


                        } else {
                            node.status({});
                        }

                    }
                }
            }
        }
    }
    RED.nodes.registerType('wirenboard-button', WirenboardNodeButton);
};







