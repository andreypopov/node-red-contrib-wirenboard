RED.nodes.registerType('wb-output', {
    category: 'Wiren Board',
    color: '#5fb408',
    align: 'right',
    defaults: {
        name: {
            value: ""
        },
        server: {
            type: "wb-server",
            required: true
        },
        filter: {
            value: "",
            required: true
        },
        command: {
            value: '/on',
        },
        commandType: {
            value: 'wb_cmd',
        },
        payload: {
            value: 'payload',
        },
        payloadType: {
            value: 'msg',
        }
    },
    inputLabels: "event",
    paletteLabel: 'out',
    inputs: 1,
    outputs: 0,
    icon: "wirenboard.png",
    label: function() {
        var label = 'wb-output';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.filter) == 'string' && this.filter.length) {
            var device_name = (this.filter).split('/').slice(1)[1];
            var control_name = (this.filter).split('/').slice(-1)[0];

            label = device_name+'/'+control_name;
        }
        return label;
    },
    oneditprepare: function() {
        var node = this;

        var WbTypes = {
            value: 'wb_cmd',
            label: 'WB',
            icon: 'icons/node-red-contrib-wirenboard/wirenboard-color.png',
            options: ['/on']
        };
        $('#node-input-command').typedInput({
            types: [WbTypes, 'str', 'msg'],
            default: 'msg',
            value: 'topic',
            typeField: $('#node-input-commandType'),
        });
        $('#node-input-payload').typedInput({
            types: ['msg', 'flow', 'global', 'str', 'num', 'date'],
            default: 'msg',
            value: 'payload',
            typeField: $('#node-input-payloadType'),
        });
        $('#node-input-commandType').val(node.commandType);
        $('#node-input-payloadType').val(node.payloadType);


        setTimeout(function(){
            WB_getItemList(node.filter, '#node-input-filter', {disableReadonly:true, allowEmpty:true});
        }, 100); //we need small timeout, too fire change event for server select

    }
});