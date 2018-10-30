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
                    res.json(items).end();
                    // res.json(items).end();
                // } else {
                //     res.status(404).end();
                }
            }, forceRefresh);
        } else {
            // res.status(404).end();
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
            console.log('Refreshing devices');
            var that = this;
            that.items = [];

            var client  = mqtt.connect('mqtt://'+node.url)

            client.on('connect', function () {
                client.subscribe(['/devices/+/controls/+', '/devices/+/controls/meta/+', '/tmp/items_list'], function (err) {})
                client.publish('/tmp/items_list', 'end_reading_items_list')
            })

            client.on('message', function (topic, message) {
                if (message.toString() == 'end_reading_items_list') {
                    client.unsubscribe(['/devices/+/controls/+', '/devices/+/controls/meta/+', '/tmp/items_list'], function (err) {})
                    client.end()
                    callback((that.items).sort(function (a, b) {
                        var aSize = a.device_name;
                        var bSize = b.device_name;
                        var aLow = a.control_name;
                        var bLow = b.control_name;
                        if (aSize == bSize) {
                            return (aLow < bLow) ? -1 : (aLow > bLow) ? 1 : 0;
                        } else {
                            return (aSize < bSize) ? -1 : 1;
                        }
                    }))
                }

                that.items.push({
                    topic:topic,
                    message:message.toString(),
                    control_name:topic.split('/').slice(-1)[0],
                    device_name:topic.split('/').slice(1)[1]
                });
            })
        } else {
            console.log('Using cached devices');
            callback(node.items);
        }

    }
  }
  RED.nodes.registerType("wb-server", WirenBoardServerNode);
}
