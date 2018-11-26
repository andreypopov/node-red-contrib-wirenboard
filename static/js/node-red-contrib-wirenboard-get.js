RED.nodes.registerType('wb-get', {
    category: 'Wiren Board',
    color: '#5fb408',
    defaults: {
        name: {
            value: ""
        },
        server: {
            type: "wb-server",
            required: true
        },
        filter: {
            value: null,
            required: true
        }
    },
    inputs: 1,
    outputs: 1,
    outputLabels: ["event"],
    paletteLabel: 'get',
    icon: "wirenboard.png",
    label: function () {
        var label = 'wb-get';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.filter) == 'string' && this.filter.length) {
            var device_name = (this.filter).split('/').slice(1)[1];
            var control_name = (this.filter).split('/').slice(-1)[0];

            label = device_name+'/'+control_name;
        }
        //console.log(this.items);

        return label;
    },
    oneditprepare: function () {
        var node = this;
        setTimeout(function(){
            WB_getItemList(node.filter, '#node-input-filter', false, true);
        }, 100); //we need small timeout, too fire change event for server select
    },
    oneditsave: function () {
        var selectedOptions = $('#node-input-filter option:selected');
        if (selectedOptions) {
            this.filter = selectedOptions.map(function () {
                return $(this).val();
            });
        } else {
            this.filter = null;
        }
    }
});