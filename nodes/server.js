const EventEmitter = require('events');
var mqtt = require('mqtt');


module.exports = function (RED) {
    class ServerNode {
        constructor(n) {
            RED.nodes.createNode(this, n);

            var node = this;
            node.config = n;
            // node.state = [];
            // node.status = {};
            //
            // node.setMaxListeners(255);
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

            this.connectToEventSource = function() {
                var EventSource = require("eventsource");
                var eventSourceInitDict = {
                    rejectUnauthorized: false
                };

                node.log("Connecting to URL " + node.config.host);
                var es = new EventSource(node.config.host, eventSourceInitDict);
                return es;
            }

            this.doRequest = function(urlpart, options, callback) {
                options.rejectUnauthorized = node.rejectUnauthorized;
                options.uri = node.config.host + urlpart;
                node.log("Requesting URI " + options.uri + " with method " + options.method);
                request(options, callback);
            }
        }

        connectMQTT() {
            var node = this;

            var options = {
                port: node.config.mqtt_port||1883,
                username: node.config.mqtt_username||null,
                password: node.config.mqtt_password||null
            };
            console.log(options);
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
                            callback(that.items);
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
            } else {
                node.log('Using cached devices');
                callback(node.items);
                return node.items;
            }

        }
        // find(callback) {
        //     var node = this;
        //
        //     const devices = miio.devices({
        //         cacheTime: 300 // 5 minutes. Default is 1800 seconds (30 minutes)
        //     });
        //
        //     devices.on('available', device => {
        //         console.log('available');
        //         console.log(device);
        //         if(device.matches('placeholder')) {
        //             // This device is either missing a token or could not be connected to
        //         } else {
        //             // Do something useful with device
        //         }
        //     });
        //
        //
        // }
        //
        // onClose() {
        //     var that = this;
        //     clearInterval(that.refreshStatusTimer);
        //
        //     if (that.device) {
        //         that.device.destroy();
        //         that.device = null;
        //     }
        // }
        //
        // connect() {
        //     var node = this;
        //
        //     return new Promise(function (resolve, reject) {
        //         node.miio = miio.device({
        //             address: node.config.ip,
        //             token: node.config.token
        //         }).then(device => {
        //             node.device = device;
        //             node.device.updateMaxPollFailures(0);
        //
        //             node.device.on('thing:initialized', () => {
        //                 node.log('Miio Roborock: Initialized');
        //             });
        //
        //             node.device.on('thing:destroyed', () => {
        //                 node.log('Miio Roborock: Destroyed');
        //             });
        //
        //             resolve(device);
        //
        //         }).catch(err => {
        //             node.warn('Miio Roborock Error: ' + err.message);
        //             reject(err);
        //         });
        //     });
        // }
        //
        //

    }

    RED.nodes.registerType('wirenboard-server', ServerNode, {});
};

