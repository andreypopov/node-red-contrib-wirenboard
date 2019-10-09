var mqtt = require('mqtt');


module.exports = function (RED) {
    class ServerNode{
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.config = n;
            // node.state = [];
            // node.status = {};
            //
            node.setMaxListeners(255);
            // node.refreshFindTimer = null;
            // node.refreshFindInterval = node.config.polling * 1000;
            // node.on('close', () => this.onClose());
            //
            // node.connect().then(result => {
            //     node.getStatus(true).then(result => {
            //         node.emit("onInitEnd", result);
            //     });
            // });
            //
            // node.refreshStatusTimer = setInterval(function () {
            //     node.getStatus(true);
            // }, node.refreshFindInterval);


            this.items = undefined;
            this.devices_values = [];


            node.mqtt = node.connectMQTT();
            node.mqtt.on('connect', () => this.onMQTTConnect());
            node.mqtt.on('message', (topic, message) => this.onMQTTMessage(topic, message));

            node.on('close', () => this.onClose());
        }

        connectMQTT() {
            var node = this;

            var options = {
                port: node.config.mqtt_port||1883,
                username: node.config.mqtt_username||null,
                password: node.config.mqtt_password||null
            };
            return mqtt.connect('mqtt://' + node.config.host, options);
        }

        getChannels(callback, forceRefresh = false) {
            var node = this;

            // Sort of singleton construct
            if (forceRefresh || node.items === undefined) {
                node.log('Refreshing devices');
                var that = this;
                that.devices = [];
                that.items = [];
                that.end = false;

                var client  = node.connectMQTT();
                client.on('connect', function () {
                    client.subscribe(['/devices/+/meta/name', '/devices/+/controls/+/meta/+', '/devices/+/controls/+', '/tmp/items_list'], function (err) {
                        if (!err) {
                            client.publish('/tmp/items_list', 'end_reading_items_list')
                        } else {
                            RED.log.error("wirenboard: error code #0023: "+err);
                        }
                    })
                });

                client.on('error', function (error) {
                    RED.log.error("wirenboard: error code #0024: "+error);
                });

                client.on('message', function (topic, message) {
                    if (message.toString() == 'end_reading_items_list') {
                        //client.unsubscribe(['/devices/+/meta/name', '/devices/+/controls/+/meta/+', '/devices/+/controls/+', '/tmp/items_list'], function (err) {})
                        client.end(true);

                        if (!that.items.length) {
                            RED.log.warn("wirenboard: error code #0026: No items, check your settings");
                        } else {
                            that.items = (that.items).sort(function (a, b) {
                                var aSize = a.device_name;
                                var bSize = b.device_name;
                                var aLow = a.control_name;
                                var bLow = b.control_name;
                                if (aSize == bSize) {
                                    return (aLow < bLow) ? -1 : (aLow > bLow) ? 1 : 0;
                                } else {
                                    return (aSize < bSize) ? -1 : 1;
                                }
                            })
                        }

                        if (!that.end) {
                            that.end = true;

                            if (typeof(callback) === "function") {
                                callback(that.items);
                            }
                        }
                        return node.items;
                    } else {
                        //parse topic
                        var topicParts = topic.split('/');
                        var deviceName = topicParts[2];

                        //meta device name
                        if (topicParts[3] == 'meta' && topicParts[4] == 'name') {
                            that.devices[deviceName] = {'friendly_name': message.toString(), 'controls': []}

                            //meta controls
                        } else if (topicParts[3] == 'controls' && topicParts[5] == 'meta') {
                            var controlName = topicParts[4]
                            if (typeof(that.devices[deviceName]['controls'][controlName]) == 'undefined')
                                that.devices[deviceName]['controls'][controlName] = {}

                            that.devices[deviceName]['controls'][controlName][topicParts[6]] = message.toString()

                            //devices
                        } else if (topicParts[3] == 'controls') {
                            var controlName = topicParts[4]
                            that.items.push({
                                topic: topic,
                                message: message.toString(),
                                control_name: controlName,
                                device_name: deviceName,
                                device_friendly_name: typeof(that.devices[deviceName]['friendly_name']) != 'undefined' ? that.devices[deviceName]['friendly_name'] : deviceName,
                                meta: that.devices[deviceName]['controls'][controlName]
                            });
                        }
                    }
                })

                if (!Object.keys(node.items).length) {
                    //node.emit('onConnectError');
                }

            } else {
                node.log('Using cached devices');
                if (typeof(callback) === "function") {
                    callback(node.items);
                }
                return node.items;
            }

        }

        onClose() {
            var node = this;

            node.mqtt.end();

            node.emit('onClose');
            node.warn('MQTT connection closed');
        }

        onMQTTConnect() {
            var node = this;

            node.emit('onMQTTConnect');
            node.warn('MQTT Connected');
        }

        onMQTTMessage(topic, message) {
            var node = this;

            var messageString = message.toString();
            node.devices_values[topic] = messageString;

            node.emit('onMQTTMessage', {topic:topic, payload:messageString});
        }
    }

    RED.nodes.registerType('wirenboard-server', ServerNode, {});
};

