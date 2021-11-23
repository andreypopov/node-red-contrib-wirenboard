const WirenboardHelper = require('../lib/WirenboardHelper.js');
var mqtt = require('mqtt');

module.exports = function (RED) {
    class ServerNode{
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.config = n;
            node.connection = false;
            node.topic = '/devices/#';
            node.devices = {};
            node.devices_names = {};
            node.errorTimers = {};
            node.on('close', () => this.onClose());
            node.setMaxListeners(0);

            //mqtt
            node.mqtt = node.connectMQTT();
            node.mqtt.on('connect', () => this.onMQTTConnect());
            node.mqtt.on('message', (topic, message) => this.onMQTTMessage(topic, message));
            node.mqtt.on('close', () => this.onMQTTClose());
            node.mqtt.on('end', () => this.onMQTTEnd());
            node.mqtt.on('reconnect', () => this.onMQTTReconnect());
            node.mqtt.on('offline', () => this.onMQTTOffline());
            node.mqtt.on('disconnect', (error) => this.onMQTTDisconnect(error));
            node.mqtt.on('error', (error) => this.onMQTTError(error));
        }

        connectMQTT() {
            var node = this;
            var options = {
                port: node.config.mqtt_port||1883,
                username: node.config.mqtt_username||null,
                password: node.config.mqtt_password||null,
                clientId:"NodeRed-"+node.id+"-"+(Math.random() + 1).toString(36).substring(7)
            };
            return mqtt.connect('mqtt://' + node.config.host, options);
        }

        subscribeMQTT() {
            var node = this;
            node.mqtt.subscribe(node.topic, function (err) {
                if (err) {
                    node.warn('MQTT Error: Subscribe to "' + node.topic);
                    node.emit('onConnectError', err);
                } else {
                    node.log('MQTT Subscribed to: "' + node.topic);
                    node.getChannels();
                }
            })
        }

        unsubscribeMQTT() {
            var node = this;
            node.log('MQTT Unsubscribe from mqtt topic: ' + node.topic);
            node.mqtt.unsubscribe(node.topic, function (err) {});
            node.devices = {};
        }

        getDeviceByTopic(topic) {
            var result = null;
            var node = this;
            if (topic in node.devices) {
                result = {};
                Object.assign(result, node.devices[topic]);
            }

            return result;
        }


        getTopicByElementId(elementId) {
            var result = undefined;
            var node = this;
            for (var topic in node.devices) {
               if (node.devices[topic].elementId == elementId) {
                   result = topic;
                   break;
               }
            }

            return result;
        }

        getChannels(callback, forceRefresh = false) {
            var node = this;

            // Sort of singleton construct
            if (forceRefresh || !Object.keys(node.devices).length) {
                node.log('Refreshing devices');
                var that = this;
                that.devices = {};
                that.devices_names = {};
                that.end = false;

                var options = {
                    port: node.config.mqtt_port||1883,
                    username: node.config.mqtt_username||null,
                    password: node.config.mqtt_password||null,
                    clientId:"NodeRed-tmp-"+node.id
                };
                var client = mqtt.connect('mqtt://' + node.config.host, options);


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
                        that.devices_names = {};
// console.log(node.devices);
                        if (!Object.keys(that.devices).length) {
                            RED.log.warn("wirenboard: error code #0026: No items, check your settings");
                        } else {
                            //filter devices
                            for (var topic in that.devices) {
                                if (!('topic' in that.devices[topic])) {
                                    delete(that.devices[topic]);
                                }
                            }
                            // that.items = (that.items).sort(function (a, b) {
                            //     var aSize = a.device_name;
                            //     var bSize = b.device_name;
                            //     var aLow = a.control_name;
                            //     var bLow = b.control_name;
                            //     if (aSize == bSize) {
                            //         return (aLow < bLow) ? -1 : (aLow > bLow) ? 1 : 0;
                            //     } else {
                            //         return (aSize < bSize) ? -1 : 1;
                            //     }
                            // })
                        }

                        if (!that.end) {
                            that.end = true;

                            if (typeof(callback) === "function") {
                                callback(that.devices);
                            }
                        }
                        return node.devices;
                    } else {
                        //parse topic
                        var topicParts = topic.split('/');
                        var deviceName = topicParts[2];
                        // let deviceTopic = '/devices/'+deviceName+'/controls/'+controlName;

                        //meta device name
                        if (topicParts[3] === 'meta' && topicParts[4] === 'name') {
                            that.devices_names[deviceName] = message.toString();

                        //meta controls
                        } else if (topicParts[3] === 'controls' && topicParts[5] === 'meta') {
                            let controlName = topicParts[4];
                            let metaName = topicParts[6];
                            let deviceTopic = '/devices/'+deviceName+'/controls/'+controlName;
                            if (!(deviceTopic in node.devices)) node.devices[deviceTopic] = {};
                            if (!('meta' in node.devices[deviceTopic])) node.devices[deviceTopic].meta = {};
                            node.devices[deviceTopic].meta[metaName] = message.toString();
                        } else if (topicParts[3] === 'controls') {
                            var controlName = topicParts[4];
                            if (!(topic in node.devices)) node.devices[topic] = {};
                            that.devices[topic].topic = topic;
                            that.devices[topic].elementId = WirenboardHelper.generateElementId(topic);
                            that.devices[topic].payload = message.toString();
                            that.devices[topic].control_name = controlName;
                            that.devices[topic].device_name = deviceName;
                            if (deviceName in that.devices_names) {
                                that.devices[topic].device_friendly_name = that.devices_names[deviceName];
                            }
                        }
                    }
                })

            } else {
                node.log('Using cached devices');
                if (typeof(callback) === "function") {
                    callback(node.devices);
                }
                return node.devices;
            }
        }

        parseMetaData(topic, message) {
            var node = this;

            var topicParts = topic.split('/');
            var deviceName = topicParts[2];
            var controlName = topicParts[4];
            let deviceTopic = '/devices/'+deviceName+'/controls/'+controlName;
            if (!(deviceTopic in node.devices)) { //no such device
                return false;
            }

            //meta topic
            if (topicParts[3] === 'controls' && topicParts[5] === 'meta') {
                //devices/wb-msw-v3_37/controls/Buzzer/meta
                if (topicParts.length != 7) return false;

                //devices/wb-mrgbw-d3-02_172/controls/R (LED strip 2) enable/meta/type
                var metaName = topicParts[6];

                //save meta
                if (!('meta' in node.devices[deviceTopic])) node.devices[deviceTopic].meta = {};
                node.devices[deviceTopic].meta[metaName] = message.toString();

                if (metaName === 'error') {
                    if (message.toString()) {
                        if (deviceTopic in node.errorTimers) {
                            clearTimeout(node.errorTimers[deviceTopic]);
                            delete node.errorTimers[deviceTopic];
                        }
                        node.errorTimers[deviceTopic] = setTimeout(function(){
                            node.log('Read Error: '+deviceTopic)
                            node.devices[deviceTopic].error = true;
                            node.emit('onMetaError', {topic:deviceTopic, payload:true});
                        }, 60000);
                    } else {
                        // node.log('Error was removed! clean error: '+deviceTopic)
                        if (deviceTopic in node.errorTimers) {
                            clearTimeout(node.errorTimers[deviceTopic]);
                            delete node.errorTimers[deviceTopic];
                        }
                        if (node.devices[deviceTopic].error) {
                            node.devices[deviceTopic].error = false;
                            node.emit('onMetaError', {topic:deviceTopic, payload:false});
                        }
                    }
                }

            //device topic
            } else if (topicParts[3] === 'controls' && deviceName in node.devices) {
                if (deviceTopic in node.errorTimers) {
                    clearTimeout(node.errorTimers[deviceTopic]);
                    delete node.errorTimers[deviceTopic];
                    node.devices[deviceTopic].error = false;
                    node.emit('onMetaError', {topic:deviceTopic, payload:false});
                    // node.log('New value! clean error: '+deviceTopic)
                }
            }
        }

        onMQTTConnect() {
            var node = this;
            node.connection = true;
            node.log('MQTT Connected');
            node.emit('onMQTTConnect');
            node.subscribeMQTT();
        }

        onMQTTDisconnect(error) {
            var node = this;
            // node.connection = true;
            node.log('MQTT Disconnected');
            console.log(error);

        }

        onMQTTError(error) {
            var node = this;
            // node.connection = true;
            node.log('MQTT Error');
            console.log(error);

        }

        onMQTTOffline() {
            var node = this;
            // node.connection = true;
            node.log('MQTT Offline');
            // console.log();

        }

        onMQTTEnd() {
            var node = this;
            // node.connection = true;
            node.log('MQTT End');
            // console.log();

        }

        onMQTTReconnect() {
            var node = this;
            // node.connection = true;
            node.log('MQTT Reconnect');
            // console.log();

        }

        onMQTTClose() {
            var node = this;
            // node.connection = true;
            node.log('MQTT Close');
            // console.log(node.connection);

        }

        onMQTTMessage(topic, message) {
            var node = this;
            var messageString = message.toString();

            if (!(topic in node.devices)) node.devices[topic] = {};
            node.devices[topic].change = {
                'old':'payload' in node.devices[topic]?node.devices[topic].payload:null,
                'new':messageString,
                'updated_at': 'change' in node.devices[topic]?new Date().getTime():null
            };
            node.devices[topic].payload = messageString;
            node.devices[topic].topic = topic;

            node.emit('onMQTTMessage', {topic:topic, payload:messageString});

            node.parseMetaData(topic, message);
        }

        onClose() {
            var node = this;
            node.unsubscribeMQTT();
            node.mqtt.end();
            node.connection = false;
            node.emit('onClose');
            node.log('MQTT connection closed');
        }
    }

    RED.nodes.registerType('wirenboard-server', ServerNode, {});
};

