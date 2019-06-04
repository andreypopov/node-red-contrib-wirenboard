function WB_getItemList(nodeItem, selectedItemElementName, options = {}) {

    options = $.extend({
        filterType:'',
        disableReadonly:false,
        refresh:false,
        allowEmpty:false
    }, options);

    function WB_updateItemList(controller, selectedItemElement, itemName, refresh = false) {
        // Remove all previous and/or static (if any) elements from 'select' input element
        selectedItemElement.children().remove();


        if (controller) {
            $.getJSON('/wirenboard/itemlist', {
                controllerID: controller.id,
                forceRefresh: refresh
            })
                .done(function (data, textStatus, jqXHR) {
                    try {

                        if (options.allowEmpty) {
                            selectedItemElement.html('<option value="">--Select channel</option>');
                        }

                        var optgroup = '';
                        var disabled = '';
                        var nameSuffix = '';
                        // var selected = false;
                        var groupHtml = '';
                        $.each(data, function(index, value) {
                            disabled = '';
                            nameSuffix = '';


                            // selected = typeof(itemName) == 'string' && value.topic == itemName;


                            //readonly
                            if (typeof value.meta !== 'undefined'
                                && typeof value.meta.type !== 'undefined'
                                && options.disableReadonly
                                && parseInt(value.meta.readonly) == 1
                            ) {
                                disabled = 'disabled="disabled"';
                                nameSuffix = 'readonly';
                                return true;
                            }

                            //filter by type
                            if (typeof value.meta !== 'undefined'
                                && typeof value.meta.type !== 'undefined'
                                && options.filterType
                                && value.meta.type != options.filterType) {
                                disabled = 'disabled="disabled"';
                                nameSuffix = value.meta.type;
                                return true;
                            }

                            if (optgroup != value.device_name) {
                                groupHtml = $('<optgroup/>', { label: value.device_friendly_name});
                                groupHtml.appendTo(selectedItemElement);
                                optgroup = value.device_name;
                            }

                            // $('<option value="' + value.topic + '"'+(selected ? 'selected' : '')+'>' + value.control_name + '</option>').appendTo(groupHtml);
                            $('<option '+disabled+' value="' + value.topic +'">' +value.device_name +'/'+ value.control_name + (nameSuffix?' ('+nameSuffix+')':'') +'</option>').appendTo(groupHtml?groupHtml:selectedItemElement);
                        });

                        // Enable item selection
                        selectedItemElement.multiselect('enable');
                        // Finally, set the value of the input select to the selected value
                        selectedItemElement.val(itemName);
                        // // Rebuild bootstrap multiselect form
                        selectedItemElement.multiselect('rebuild');
                        // // Trim selected item string length with elipsis
                        var selectItemSpanElement = $(`span.multiselect-selected-text:contains("${itemName}")`);
                        var sHTML = selectItemSpanElement.html();
                        selectItemSpanElement.html(truncateWithEllipses(sHTML, 35));

                    } catch (error) {
                        console.error('Error #4534');
                        console.log(error);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    // Disable item selection if no items were retrieved
                    selectedItemElement.multiselect('disable');
                    selectedItemElement.multiselect('refresh');
                    //console.error(`Error: ${errorThrown}`);
                });

        } else {
            // Disable item selection if no (valid) controller was selected
            selectedItemElement.multiselect('disable');
            selectedItemElement.multiselect('refresh');
        }
    }


    var WbServerElement = $('#node-input-server');
    var refreshListElement = $('#force-refresh');
    var selectedItemElement = $(selectedItemElementName);


    // Initialize bootstrap multiselect form
    selectedItemElement.multiselect({
        enableFiltering: true,
        enableCaseInsensitiveFiltering: true,
        filterPlaceholder: 'Filter items...',
        includeResetOption: true,
        includeResetDivider: true,
        numberDisplayed: 1,
        maxHeight: 300,
        disableIfEmpty: true,
        nSelectedText: 'selected',
        nonSelectedText: 'None selected',
        buttonWidth: '70%',
    });

    // Initial call to populate item list
    WB_updateItemList(RED.nodes.node(WbServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, false);
    // onChange event handler in case a new controller gets selected
    WbServerElement.change(function (event) {
        WB_updateItemList(RED.nodes.node(WbServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
    refreshListElement.click(function (event) {
        // Force a refresh of the item list
        WB_updateItemList(RED.nodes.node(WbServerElement.val()), selectedItemElement, selectedItemElement.val() || nodeItem, true);
    });
}