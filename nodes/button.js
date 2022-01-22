const WirenboardHelper = require('../lib/WirenboardHelper.js');
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
            node.timerLongPress = null;
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
            node.longpressTimerValueStep = parseInt(node.config.longpressTimerValueStep)||5;
            node.longpressTimerValueMin = parseInt(node.config.longpressTimerValueMin)||0;
            node.longpressTimerValueMax = parseInt(node.config.longpressTimerValueMax)||100;
            node.longpressTimerChangeDelayMs = parseInt(node.config.longpressTimerChangeDelayMs)||100;


            if (node.server) {
                node.listener_onMQTTConnect = function(data) { node.onMQTTConnect(); }
                node.server.on('onMQTTConnect', node.listener_onMQTTConnect);

                node.listener_onConnectError = function(data) { node.onConnectError(); }
                node.server.on('onConnectError', node.listener_onConnectError);

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
                text: "node-red-contrib-wirenboard/button:status.connected"
            });

            node.cleanTimer = setTimeout(function () {
                node.status({}); //clean
            }, 3000);
        }

        onMQTTMessage(data) {
            var node = this;

            if (data.topic === node.config.channel) {
                clearTimeout(node.refreshfunc);
                var val = parseInt(data.payload) ? true : false;
                var event = '';

                // console.log('Input: '+val);
                if (node.val != val) {
                    node.val = val;
                    if (val) { // value == 1
                        node.clickcounter++;
                        node.timerclick = new Date().getTime();

                        if (node.eventTypes.indexOf('Press') != -1) {
                            node.eventHandler(null, 'press');
                        }

                        if (node.eventTypes.indexOf('LongPress') != -1) {
                            node.timerLongPress = setTimeout(function () {
                                node.longpressStarted = true;
                                node.longPressClickCnt++;

                                if (node.config.longPressRange) {
                                    node.longpressInterval = setInterval(function () {
                                        if (!node.longpressStarted || !node.val) { //отпущена кнопка
                                            clearInterval(node.longpressInterval);
                                            return;
                                        }
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

                                        // console.log(node.val + ' = ' + node.longpressStarted + ' = '+ node.longpressTimerValue);
                                        // node.status({fill: "green", shape: "ring", text: node.longpressTimerValue});
                                        // node.send({payload: node.longpressTimerValue, event:"longpress"});

                                        node.eventHandler(node.longpressTimerValue,'longpress',{
                                            text:node.longpressTimerValue
                                        });
                                    }, node.longpressTimerChangeDelayMs);
                                } else {
                                    node.eventHandler(true,'longpress', {
                                        counter:node.longPressClickCnt,
                                        toggle: node.longPressClickCnt % 2 === 0
                                    });
                                }

                            }, node.config.longPressDelay);
                        }

                    } else { //value == 0

                        if (node.clickcounter) {

                            if (node.eventTypes.indexOf('Release') != -1) {
                                node.eventHandler(null,'release');
                            }

                            clearTimeout(node.timerLongPress);
                            clearInterval(node.longpressInterval);
                            clearTimeout(node.clickfunc);

                            //longpress fired earlier
                            if (node.longpressStarted) {
                                if (node.eventTypes.indexOf('LongPressRelease') != -1) {
                                    node.eventHandler(null,'longpress_release');
                                }
                                node.timerclick = node.clickcounter = node.longpressStarted = 0;
                                node.status({});

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
                                    node.clearAllTimers();
                                    return true;
                                } else {
                                    node.clickfunc = setTimeout(function () {
                                        node.timerclick = node.clickcounter = 0;

                                        node.singleClickCnt++;
                                        node.eventHandler(null,'click', {
                                            counter:node.singleClickCnt,
                                            toggle: node.singleClickCnt % 2 === 0
                                        });
                                        node.clearAllTimers();

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
                                    node.clearAllTimers();
                                    return true;
                                }
                                setTimeout(function () {
                                    clearTimeout(node.clickfunc);
                                    node.timerclick = node.clickcounter = 0;
                                }, node.config.doubleClickDelay);
                            }


                        } else {
                            node.status({});
                        }

                    }
                }
            }
        }


        eventHandler(payload, event = null, options = {}) {
            // console.log("======> EVENT: " + event);
            var node = this;
            clearTimeout(node.refreshfunc);
            node.refreshfunc = setTimeout(function () {
                node.status({});
            }, 1500);

            node.status({fill: "green", shape: "dot", text: "text" in options?options.text:event});

            node.send(Object.assign({
                payload: payload,
                event: event,
                topic: node.config.channel,
                elementId:WirenboardHelper.generateElementId(node.config.channel)
            }, options));
        }

        clearAllTimers() {
            var node = this;
            clearTimeout(node.clickfunc);
            clearTimeout(node.timerLongPress);
            clearInterval(node.longpressInterval);
            clearTimeout(node.clickfunc);
            node.timerclick = node.clickcounter = 0;
        }

    }
    RED.nodes.registerType('wirenboard-button', WirenboardNodeButton);
};







