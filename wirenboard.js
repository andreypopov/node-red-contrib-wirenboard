//
//     Copyright (C) 2018  Andrey Popov
//
//     This program is free software: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.
//
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.
//
//     You should have received a copy of the GNU General Public License
//     along with this program.  If not, see <http://www.gnu.org/licenses/>.

var mqtt = require('mqtt');
var request = require('request');

var NODE_PATH = '/wirenboard/';

module.exports = function(RED) {

    /**
     * httpAdmin.get
     *
     * Enable http route to static files
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'static/*', function (req, res) {
        var options = {
            root: __dirname + '/static/',
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });


    /**
     * httpAdmin.get
     *
     * Enable http route to OpenHAB JSON itemlist for each controller (controller id passed as GET query parameter)
     *
     */
    RED.httpAdmin.get(NODE_PATH + 'itemlist', function (req, res) {
        var config = req.query;
        var controller = RED.nodes.getNode(config.controllerID);
        var forceRefresh = config.forceRefresh ? ['1', 'yes', 'true'].includes(config.forceRefresh.toLowerCase()) : false;

        if (controller && controller instanceof WirenBoardServerNode) {
            controller.getItemsList(function (items) {
                if (items) {
                    res.json(items);
                } else {
                    res.status(404).end();
                }
            }, forceRefresh);
        } else {
            res.status(404).end();
        }
    });





    //*************** Input Node ***************
    function WirenBoardItemIn(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.server = RED.nodes.getNode(config.server);
        var filter = config.filter;

        var client = mqtt.connect('mqtt://' + node.server.getUrl())

        client.on('connect', function () {
            if (typeof(filter) == 'string') {
                client.subscribe(filter, function (err) {
                    if (err) {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: 'Subscribe to "'+filter+'" error'
                        });
                    }
                })
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not set'
                });
            }
        })

        client.on('message', function (topic, message) {
            node.status({
                fill: "green",
                shape: "dot",
                text: message.toString()
            });

            var event = {topic: topic, payload: message.toString()};
            node.send(event);
        })

        this.on('close', function () {
            node.log('Unsubscribe from mqtt topic: ' + filter);
            client.unsubscribe(filter, function (err) {})
            client.end();
        });
    }
    RED.nodes.registerType("wb-input", WirenBoardItemIn);





    //*************** Button Node ***************
    function WirenBoardItemButton(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
        node.timerclick = 0;
        node.timerfunc = null;
        node.refreshfunc = null; //func to refresh ndoe status
        node.clickfunc = null; //func to fire click event
        node.clickcounter = 0;
        node.val = false;
        var filter = config.filter;

        node.longPressDelay = config.longPressDelay;
        node.doubleClickDelay = config.doubleClickDelay;
        node.eventTypes = config.eventTypes.filter(String);

        node.longpressStarted = false;





        var client = mqtt.connect('mqtt://' + node.server.getUrl())

        client.on('connect', function () {
            if (typeof(filter) == 'string') {
                client.subscribe(filter, function (err) {
                    if (err) {
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: 'Subscribe to "'+filter+'" error'
                        });
                    }
                })
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not set'
                });
            }
        })


        function eventHandler(event, topic) {
            clearTimeout(node.refreshfunc);
            node.refreshfunc = setTimeout(function () {
                node.status({});
            }, 1500);

            node.status({fill: "green", shape: "ring", text:event});
            node.send({topic: topic, payload: event});
        }

        client.on('message', function (topic, message) {
            var val = parseInt(message.toString())?true:false;
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
                        }, config.longPressDelay);
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
                            if (((new Date().getTime()) - node.timerclick) > config.doubleClickDelay || node.eventTypes.indexOf('DoubleClick') == -1) { //80ms
                                node.timerclick = node.clickcounter = 0;

                                eventHandler('click', topic);
                                return true;
                            } else {
                                node.clickfunc = setTimeout(function () {
                                    node.timerclick = node.clickcounter = 0;

                                    eventHandler('click', topic);

                                }, config.doubleClickDelay - ((new Date().getTime()) - node.timerclick));
                            }
                        }


                        if (node.eventTypes.indexOf('DoubleClick') != -1) {
                            if (node.clickcounter == 2 && ((new Date().getTime()) - node.timerclick) < config.doubleClickDelay) {
                                clearTimeout(node.clickfunc);
                                node.timerclick = node.clickcounter = 0;
                                eventHandler('doubleclick', topic);
                                return true;
                            }
                            setTimeout(function () {
                                clearTimeout(node.clickfunc);
                                node.timerclick = node.clickcounter = 0;
                            }, config.doubleClickDelay*2);
                        }
                        

                    } else {
                        node.status({});
                    }

                }
            }
        })

        this.on('close', function () {
            node.log('Unsubscribe from mqtt topic: ' + filter);
            client.unsubscribe(filter, function (err) {})
            client.end();
        });
    }
    RED.nodes.registerType("wb-button", WirenBoardItemButton);


    //*************** Input Node ***************
    function WirenBoardItemGet(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.server = RED.nodes.getNode(config.server);
        var filter = config.filter;



        this.on('input', function (message) {
            if (typeof(filter) == 'string') {
                var client = mqtt.connect('mqtt://' + node.server.getUrl())

                client.on('connect', function () {
                    client.subscribe(filter, function (err) {
                        if (err) {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: 'Subscribe to "' + filter + '" error'
                            });
                        }
                    })
                })

                client.on('message', function (topic, message) {
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: message.toString()
                    });

                    client.unsubscribe(filter, function (err) {})
                    client.end()

                    var event = {topic: topic, message_in: node.payload,payload: message.toString()};
                    node.send(event);
                })
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not set'
                });
            }
        })

    }

    RED.nodes.registerType("wb-get", WirenBoardItemGet);



    //*************** State Output Node ***************
    function WirenBoardOut(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.filter = config.filter;
        node.server = RED.nodes.getNode(config.server);
        node.payload = config.payload;
        node.payloadType = config.payloadType;
        node.command = config.command;
        node.commandType = config.commandType;


        this.on('input', function (message) {
            var item = config.filter;
            var payload = config.payload;
            var payloadType = config.payloadType;
            var command = config.command;

            switch (payloadType) {
                case 'msg': {
                    payload = message[payload];
                    break;
                }
                case 'flow':
                case 'global': {
                    RED.util.evaluateNodeProperty(payload, payloadType, this, message, function (error, result) {
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
                case 'num':
                case 'str':
                default: {
                    // Keep selected payload
                    break;
                }
            }

            if (item) {
                if (payload !== undefined) {
                    var client  = mqtt.connect('mqtt://'+node.server.url)

                    client.on('connect', function () {
                        client.publish(item+command, payload.toString())
                        client.end()

                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: payload.toString()
                        });

                        node.log('Publish mqtt topic: ' + (item+command) + ' : '+payload.toString());
                    })

                } else {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: 'No Payload'
                    });
                }
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'Device not set'
                });
            }
        });
    }

    RED.nodes.registerType("wb-output", WirenBoardOut);




  //*************** Server Node ***************
  function WirenBoardServerNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.url = n.url;
    this.name = n.name;
    this.items = undefined;
    this.rejectUnauthorized = !n.allowuntrusted;

    this.connectToEventSource = function() {
      var EventSource = require("eventsource");
      var eventSourceInitDict = {
        rejectUnauthorized: node.rejectUnauthorized
      };
      var url = node.getUrl();
      node.log("Connecting to URL " + url);
      var es = new EventSource(url, eventSourceInitDict);
      return es;
    }

    this.doRequest = function(urlpart, options, callback) {
      options.rejectUnauthorized = node.rejectUnauthorized;
      options.uri = node.url + urlpart;
      node.log("Requesting URI " + options.uri + " with method " + options.method);
      request(options, callback);
    }

    this.getUrl = function() {
      return node.url;
    };

    this.getItemsList = function(callback, forceRefresh = false) {

        // Sort of singleton construct
        if (forceRefresh || node.items === undefined) {
            node.log('Refreshing devices');
            var that = this;
            that.devices = [];
            that.items = [];
            that.end = false;

            var client  = mqtt.connect('mqtt://'+node.url);
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
  }
  RED.nodes.registerType("wb-server", WirenBoardServerNode);
}
