RED.nodes.registerType('wb-button', {
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
        },
        eventTypes: {
            value: [],
            required: true,
        },
        longPressDelay: {
            value: 2000,
        },
        doubleClickDelay: {
            value: 600,
        }
    },
    inputs: 0,
    outputs: 1,
    outputLabels: ["event"],
    paletteLabel: 'button',
    icon: "wirenboard.png",
    label: function () {
        var label = 'wb-button';
        if (this.name) {
            label = this.name;
        } else if (typeof(this.filter) == 'string' && this.filter.length) {
            var device_name = (this.filter).split('/').slice(1)[1];
            var control_name = (this.filter).split('/').slice(-1)[0];

            label = device_name+'/'+control_name;
        }

        return label;
    },
    oneditprepare: function () {
        var node = this;
        $('#node-input-longPressDelay').val(node.longPressDelay);
        $('#node-input-doubleClickDelay').val(node.doubleClickDelay);
        setTimeout(function(){
            WB_getItemList(node.filter, '#node-input-filter', {filterType:'switch'}); //filterType:'switch'


            var selectedEventsElement = $('#node-input-eventTypes');
            var selectedEvents = selectedEventsElement.val();
            // Initialize bootstrap multiselect form
            selectedEventsElement.multiselect({
                enableFiltering: false,
                numberDisplayed: 1,
                maxHeight: 300,
                disableIfEmpty: true,
                nSelectedText: 'selected',
                nonSelectedText: 'None selected',
                buttonWidth: '70%',
            });


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
