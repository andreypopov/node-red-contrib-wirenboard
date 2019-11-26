var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeButton {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.is_subscribed = false;

            //get server node
            node.server = RED.nodes.getNode(node.config.server);


            node.timerclick = 0;
            node.timerfunc = null;
            node.refreshfunc = null; //func to refresh ndoe status
            node.clickfunc = null; //func to fire click event
            node.clickcounter = 0;
            node.singleClickCnt = 0;
            node.longPressClickCnt = 0;
            node.doubleClickCnt = 0;
            node.val = false;
            node.longPressDelay = config.longPressDelay;
            node.doubleClickDelay = config.doubleClickDelay;
            node.eventTypes = config.eventTypes.filter(String);
            node.longpressStarted = false;


            node.longpressInterval = false;
            node.longpressTimerValue = 0;
            node.longpressTimerValueStep = node.config.longpressTimerValueStep||5;
            node.longpressTimerValueMin = node.config.longpressTimerValueMin||0;
            node.longpressTimerValueMax = node.config.longpressTimerValueMax||100;
            node.longpressTimerChangeDelayMs = node.config.longpressTimerChangeDelayMs||100;



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
                    text: "node-red-contrib-wirenboard/button:status.no_server"
                });
            }

        }

        onConnectError(status) {
            var node = this;

            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/button:status.no_connection"
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
                var val = parseInt(data.payload) ? true : false;
                var event = '';

                if (node.val != val) {
                    node.val = val;
                    if (val) { // value == 1
                        clearTimeout(node.refreshfunc);
                        node.clickcounter++;
                        node.timerclick = new Date().getTime();

                        if (node.eventTypes.indexOf('Press') != -1) {
                            node.eventHandler(null, 'press');
                        }

                        if (node.eventTypes.indexOf('LongPress') != -1) {
                            node.timerfunc = setTimeout(function () {
                                node.longpressStarted = true;
                                node.longPressClickCnt++;

                                if (node.config.longPressRange) {
                                    node.longpressInterval = setInterval(function () {
                                        if (node.longPressClickCnt % 2 === 0) {
                                            node.longpressTimerValue -= node.longpressTimerValueStep;
                                            if (node.longpressTimerValue <= node.longpressTimerValueMin) {
                                                node.longpressTimerValue = node.longpressTimerValueMin;
                                                clearInterval(node.longpressInterval);
                                            }
                                        } else {
                                            node.longpressTimerValue += node.longpressTimerValueStep;
                                            if (node.longpressTimerValue >= node.longpressTimerValueMax) {
                                                node.longpressTimerValue = node.longpressTimerValueMax;
                                                clearInterval(node.longpressInterval);
                                            }
                                        }
                                        node.status({fill: "green", shape: "ring", text: node.longpressTimerValue});
                                        node.send({payload: node.longpressTimerValue});
                                    }, node.longpressTimerChangeDelayMs);
                                }

                                node.eventHandler(null,'longpress', {
                                    counter:node.longPressClickCnt,
                                    toggle: node.longPressClickCnt % 2 === 0
                                });
                            }, node.config.longPressDelay);
                        }

                    } else { //value == 0

                        if (node.clickcounter) {

                            clearTimeout(node.timerfunc);
                            clearTimeout(node.clickfunc);
                            clearInterval(node.longpressInterval); //release here

                            if (node.eventTypes.indexOf('Release') != -1) {
                                node.eventHandler(null,'release');
                            }


                            //longpress fired earlier
                            if (node.longpressStarted) {
                                node.timerclick = node.clickcounter = node.longpressStarted = 0;
                                return true;
                            }


                            if (node.eventTypes.indexOf('Click') != -1) {
                                if (((new Date().getTime()) - node.timerclick) > node.config.doubleClickDelay || node.eventTypes.indexOf('DoubleClick') == -1) { //80ms
                                    node.timerclick = node.clickcounter = 0;

                                    node.singleClickCnt++;
                                    node.eventHandler(null,'click', {
                                        counter:node.singleClickCnt,
                                        toggle: node.singleClickCnt % 2 === 0
                                    });
                                    return true;
                                } else {
                                    node.clickfunc = setTimeout(function () {
                                        node.timerclick = node.clickcounter = 0;

                                        node.singleClickCnt++;
                                        node.eventHandler(null,'click', {
                                            counter:node.singleClickCnt,
                                            toggle: node.singleClickCnt % 2 === 0
                                        });

                                    }, node.config.doubleClickDelay - ((new Date().getTime()) - node.timerclick));
                                }
                            }


                            if (node.eventTypes.indexOf('DoubleClick') != -1) {
                                if (node.clickcounter == 2 && ((new Date().getTime()) - node.timerclick) < node.config.doubleClickDelay) {
                                    clearTimeout(node.clickfunc);
                                    node.timerclick = node.clickcounter = 0;
                                    node.doubleClickCnt++;
                                    node.eventHandler(null, 'doubleclick',{
                                        counter:node.doubleClickCnt,
                                        toggle: node.doubleClickCnt % 2 === 0
                                    });
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


        eventHandler(payload, event = null, options = {}) {
            var node = this;
            clearTimeout(node.refreshfunc);
            node.refreshfunc = setTimeout(function () {
                node.status({});
            }, 1500);

            node.status({fill: "green", shape: "dot", text: event});

            node.send(Object.assign({
                payload: payload,
                event: event,
                topic: node.config.channel
            }, options));
        }

    }
    RED.nodes.registerType('wirenboard-button', WirenboardNodeButton);
};







