const WirenboardHelper = require('../lib/WirenboardHelper.js');
var mqtt = require('mqtt');

module.exports = function(RED) {
    class WirenboardNodeMotor {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.runningTimer = null;
            node.runningInterval = null;
            node.percent = 0; //close by default
            node.dir = null;
            node.contact_open_flag = null;
            node.contact_close_flag = null;
            //homekit: 0 close, 100 open

            node.status({});

            //get server node
            node.server = RED.nodes.getNode(node.config.server);

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

                node.on('input', function (message_in) {
                    clearTimeout(node.cleanTimer);
                    clearTimeout(node.runningTimer);
                    clearInterval(node.runningInterval);

                    //homekit format
                    if (typeof(message_in.payload) == "object") {
                        if ("TargetPosition" in message_in.payload) {
                            node.goCurtain(message_in.payload.TargetPosition);
                        }
                    } else {
                        if ("open" === message_in.payload) {
                            node.goCurtain(100);
                        } else if ("close" === message_in.payload) {
                            node.goCurtain(0);
                        } else if ("stop" === message_in.payload) {
                            node.stopCurtain();
                        } else if ("toggle" === message_in.payload) {
                            if (node.percent === 0) {
                                node.goCurtain(100);
                            } else if (node.percent === 100) {
                                node.goCurtain(0);
                            } else {
                                node.goCurtain(node.dir?0:100);
                            }
                        } else if (parseInt(message_in.payload) >= 0 && parseInt(message_in.payload) <= 100) {
                            node.goCurtain(message_in.payload);
                        }
                    }
                });

            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "node-red-contrib-wirenboard/motor:status.no_server"
                });
            }

        }

        goCurtain(percent) {
            var node = this;
            percent = parseInt(percent);

            var absPercent = Math.abs(node.percent-percent);
            var timeEnd = node.config.max_running_time/100*absPercent;
            if (percent === 100 || percent === 0) { //open
                timeEnd = node.config.max_running_time;
            }

            if (node.config.contact_close && node.config.contact_close in node.server.devices) {
                if (parseInt(node.server.devices[node.config.contact_close].payload)) { //is closed
                    node.percent = 0;
                }
            } else if (node.config.contact_open && node.config.contact_open in node.server.devices) {
                if (parseInt(node.server.devices[node.config.contact_open].payload)) { //is opened
                    node.percent = 100;
                }
            }

            if (!node.config.contact_close && !node.config.contact_open) {
                if (percent === node.percent) {
                    node.percent = percent===100?0:100;
                }
            }

            // console.log("From: "+node.percent+" to "+percent + '  -> '+timeEnd+'ms');

            if (percent === node.percent) return;

            node.moveCurtain(percent<node.percent);

            node.send({
                payload: {
                    on: true,
                    target: percent,
                    position: node.percent,
                    inverse: node.config.inverse,
                    elementId:WirenboardHelper.generateElementId(node.config.channel)
                },
                topic: node.config.channel,
                homekit: {
                    CurrentPosition: node.percent,
                    PositionState: percent>node.percent?0:1,
                    TargetPosition: percent
                }
            });

            node.runningInterval = setInterval(function () {
                if (percent > node.percent) {
                    node.percent++;
                    if (node.percent > 100) node.percent = 100;
                } else if (percent < node.percent) {
                    node.percent--;
                    if (node.percent < 0) node.percent = 0;
                }

                if (percent !== node.percent) {
                    node.nodeStatus((percent > node.percent ? "opening" : "closing") + ": " + node.percent + "%");
                }
            }, node.config.max_running_time/100);

            //disable
            node.runningTimer = setTimeout(function () {
                node.percent = percent;
                node.stopCurtain();
            }, timeEnd);
        }

        stopCurtain() {
            var node = this;

            clearTimeout(node.runningTimer);
            clearInterval(node.runningInterval);

            node.server.mqtt.publish(node.config.channel + '/on', "0");
            node.log('Published to mqtt topic: ' + node.config.channel + '/on : 0');

            node.send({
                payload: {
                    on: false,
                    dir: null,
                    position: node.percent,
                    inverse: node.config.inverse,
                    elementId:WirenboardHelper.generateElementId(node.config.channel)
                },
                topic: node.config.channel,
                homekit: {
                    CurrentPosition: node.percent,
                    PositionState: 2,
                    TargetPosition: node.percent
                }
            });

            node.nodeStatus("node-red-contrib-wirenboard/motor:status.stopped");
        }

        nodeStatus(text) {
            var node = this;
            node.status({fill: "green",shape: "dot",text: text});
            clearTimeout(node.cleanTimer);
            node.cleanTimer = setTimeout(function () {
                node.status({fill: "grey",shape: "ring",text: node.percent+"%"});
            }, 3000);
        }

        onMQTTMessage(data) {
            var node = this;

            //функция доводчика: усилие мотора намного сильнее на старте
            //как только датчик контакта замкнулся, останавливаем мотор, выжидаем пару секунд и дожимаем окно
            if (node.config.contact_close && data.topic === node.config.contact_close) {
                var isClose = parseInt(data.payload);

                //fix incorrect status
                if (isClose === 0 && node.percent === 0) { //sensor open BUT percent in close
                    node.percent = 100;
                }

                if (isClose) {
                    node.percent = 0;
                    node.stopCurtain();
                }

                if (node.contact_close_flag !== isClose) {
                    if (isClose && node.contact_close_flag != null) {
                        if (node.config.extra_close_push_delay && node.config.extra_close_push_time) {
                            setTimeout(function () {
                                node.closeCurtain();

                                setTimeout(function () {
                                    node.percent = 0;
                                    node.stopCurtain();
                                }, node.config.extra_close_push_time);

                            }, node.config.extra_close_push_delay);
                        }
                    }
                    node.contact_close_flag = isClose;
                }
            }
        }

        openCurtain() {
            this.moveCurtain(false);
        }

        closeCurtain() {
            this.moveCurtain(true);
        }

        moveCurtain(direction) {
            var node = this;

            if (node.config.inverse) direction = !direction;
            direction = direction?"1":"0";
            node.dir = parseInt(direction);

            //disable - we need it to save module, enable after small timeout
            node.server.mqtt.publish(node.config.channel + '/on', "0");
            node.log('Published to mqtt topic: ' + node.config.channel + '/on : 0');

            //set direction
            node.server.mqtt.publish(node.config.channel_dir + '/on', direction);
            node.log('Published to mqtt topic: ' + node.config.channel_dir + '/on : ' + direction);

            //enable
            setTimeout(()=>{
                node.server.mqtt.publish(node.config.channel + '/on', "1");
                node.log('Published to mqtt topic: ' + node.config.channel + '/on : 1');
            }, 100);
        }

        onConnectError(status = null) {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: "node-red-contrib-wirenboard/motor:status.no_connection"
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
        }

    }
    RED.nodes.registerType('wirenboard-motor', WirenboardNodeMotor);
};







