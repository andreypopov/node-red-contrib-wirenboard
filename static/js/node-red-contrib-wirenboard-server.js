RED.nodes.registerType('wb-server', {
    category: 'config',
    defaults: {
        name: {
            value: null,
            required: false
        },
        url: {
            value: null,
            required: true
        },
        allowuntrusted: {
            value: false,
            required: true
        }

    },
    label: function() {
        return this.name ||  this.url;
    }
});