// const indicator = require('./js/modules/activity_indicator.js');

$(document).ready(() => {

    $(".app-type").text("Device-End");

    $(".content").append($('<button class="btn btn-secondary btn-topRight btn-addDevice">Add Device</button>')); // create btn to add devices
    $(".btn-addDevice").click(() => {
        $("body").addClass("show_addDevice");
    });

    $(".content").append($('<div class="listbox_box"> <div class="listbox"> <h4>Connected Devices</h4> <ul class="list-group mb-3"></ul> </div> </div>')); // create the empty server-list

    function createDeviceList() {
        $(".listbox > .noDevices").remove();
        $(".listbox > ul > *").remove();
        if ( shared.settings.opc.server.devices.length > 0 ) {
            for (let i = 0; i < shared.settings.opc.server.devices.length; i++) {
                $(".listbox > ul").append(`<li class="list-group-item">${shared.settings.opc.server.devices[i].name}<code class="device_nameMinus">${shared.settings.opc.server.devices[i].type.toUpperCase()} - </code><code class="device_id">${shared.settings.opc.server.devices[i].id}</code><span class="deviceStatus_${shared.settings.opc.server.devices[i].id}"></span><span class="activity_indicator ai-${shared.settings.opc.server.devices[i].id}"></span><div class="device_menu_btn"></div></li>`);
            }
        } else {
            $(".listbox").append(`
                <div class="noDevices" style="font-size:150%;">
                    <div style="text-align:right; padding-right:42px; margin-top:-24px; opacity: 0.6; font-family: Comic Sans MS, Lato, Arial, sans-serif;">
                        <span style="display:inline-block; transform:translateY(54px); padding-right:10px;">Click here to<br>add a device</span>
                        <svg xmlns="http://www.w3.org/2000/svg"viewBox="0 0 64 64" style="width:80px;"><path fill="#FFFFFF" d="M47.4,1.1l-8,13.5c-0.6,1-0.1,2.2,1,2.8c1.2,0.5,2.6,0.1,3.2-0.9l5.1-8.6c1.2,7.8-0.5,16-0.6,16.1 C44,46.5,23.7,62.4,2.7,59.6c-1.3-0.2-2.5,0.6-2.7,1.7c0,0.1,0,0.2,0,0.3c0,1,0.8,1.9,2,2c23.5,3.2,46.3-14.2,50.7-38.9 c0.1-0.4,1.8-8.4,0.7-16.5l6.5,5.6c0.9,0.8,2.4,0.8,3.3,0c0.9-0.8,0.9-2.1,0-2.9L51.1,0.6c0,0-0.1,0-0.1,0 c-0.2-0.1-0.4-0.3-0.6-0.4c0,0,0,0-0.1,0C50.1,0.1,49.9,0,49.7,0c0,0-0.1,0-0.1,0c-0.1,0-0.1,0-0.2,0c-0.2,0-0.4,0-0.6,0.1 c-0.1,0-0.1,0-0.2,0.1c-0.2,0.1-0.5,0.2-0.7,0.4c0,0,0,0,0,0l0,0C47.6,0.8,47.5,0.9,47.4,1.1z"/></svg>
                    </div>
                    <div style="text-align:center;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width:100px; margin-top:110px; margin-bottom:20px;"><circle style="fill:#484444;" cx="256" cy="256" r="180"/><path style="fill:#E74C3C;" d="M256,96c42.7,0,82.9,16.6,113.1,46.9S416,213.3,416,256s-16.6,82.9-46.9,113.1S298.7,416,256,416 s-82.9-16.6-113.1-46.9S96,298.7,96,256s16.6-82.9,46.9-113.1S213.3,96,256,96 M256,56C145.5,56,56,145.5,56,256s89.5,200,200,200 s200-89.5,200-200S366.5,56,256,56L256,56z"/><path style="fill:#E74C3C;" d="M492.2,48.1L48.1,492.2c-7.8,7.8-20.5,7.8-28.3,0l0,0c-7.8-7.8-7.8-20.5,0-28.3L463.9,19.8 c7.8-7.8,20.5-7.8,28.3,0l0,0C500,27.6,500,40.3,492.2,48.1z"/></svg>
                        <div>No devices configured</div>
                    </div>
                </div>
            `);
        }

    }
    createDeviceList();

    let this_device_index;
    let this_device;
    $(".listbox").on("click", ".device_menu_btn", function() {
        let this_deviceID = $(this).parent().children(".device_id").text();
        for (let i = 0; i < shared.settings.opc.server.devices.length; i++) {
            let device = shared.settings.opc.server.devices[i];
            if ( device.id == this_deviceID ) {
                this_device_index = i;
                this_device = device;
                break;
            }
        }
        // Device Information:
        $(".deviceSettings-info-name").text(this_device.name);
        $(".deviceSettings-info-id").text(this_device.id);
        $(".deviceSettings-info-type").text(this_device.type);
        // Orders:
        $(".btn_openDeviceOrderDir").attr("data-devicedir", `${this_device.type} ${this_device.id}`);
        $(".deviceSettings-ordersTitle > span").text(this_device.orders.length);
        // Type Specific Settings:
        if ( (this_device.type == "snapmaker") || (this_device.type == "marlin_printer") ) {
            $(".deviceSettings-typeSpecific").html(`
                <div class="radio_box">
                    <label class="settings-radioLabel" for="deviceSettings-snapmaker-radio1">
                        <input id="deviceSettings-snapmaker-radio1" type="radio" name="deviceSettings-snapmaker-radio" checked="checked"/>
                        <span class="radio-outer"><span class="radio-inner"></span></span>
                        <span>Manual Port</span>
                    </label>
                    <label class="settings-radioLabel" for="deviceSettings-snapmaker-radio2">
                        <input id="deviceSettings-snapmaker-radio2" type="radio" name="deviceSettings-snapmaker-radio"/>
                        <span class="radio-outer"><span class="radio-inner"></span></span>
                        <span>Detect Port</span>
                    </label>
                </div>
                <input type="text" class="form-control" id="deviceSettings-manualPort" placeholder="COM..." value="" />
            `);
            if ( this_device.config.detectPort ) {
                $("#deviceSettings-snapmaker-radio1").removeAttr("checked");
                $("#deviceSettings-snapmaker-radio2").attr("checked","checked");
            }
            $("#deviceSettings-manualPort").val(this_device.config.comPort);
            $("#deviceSettings-manualPort").attr("data-showport",this_device.config.detectPort ? "2" : "1");
            $('.settings-radioLabel[for="deviceSettings-snapmaker-radio1"]').click(() => {
                shared.settings.opc.server.devices[this_device_index].config.detectPort = false;
                $("#deviceSettings-manualPort").attr("data-showport","1");
            });
            $('.settings-radioLabel[for="deviceSettings-snapmaker-radio2"]').click(() => {
                shared.settings.opc.server.devices[this_device_index].config.detectPort = true;
                $("#deviceSettings-manualPort").attr("data-showport","2");
            });
            $("#deviceSettings-manualPort").on("input", function() {
                shared.settings.opc.server.devices[this_device_index].config.comPort = $(this).val();
            });
        } else if ( this_device.type == "plc" ) {
            $(".deviceSettings-typeSpecific").html(`
                <table class="deviceSettings-infobox">
                    <tr><td>Endpoint: </td><td><input type="text" class="form-control" id="deviceSettings-plc-endpointURL" placeholder="e.g.: DIK-ZBOX:4334/OPC-UA" value="" /></td></tr>
                    <tr><td>Node ID: </td><td><input type="text" class="form-control" id="deviceSettings-plc-nodeID" placeholder="e.g.: ns=3;s=PLC_VAR_NAME" value="" /></td></tr>
                </table>
            `);
            $("#deviceSettings-plc-endpointURL").val(this_device.config.endpointURL);
            $("#deviceSettings-plc-endpointURL").on("input", function() {
                shared.settings.opc.server.devices[this_device_index].config.endpointURL = $(this).val();
            });
            $("#deviceSettings-plc-nodeID").val(this_device.config.nodeID);
            $("#deviceSettings-plc-nodeID").on("input", function() {
                shared.settings.opc.server.devices[this_device_index].config.nodeID = $(this).val();
            });
        } else {
            $(".deviceSettings-typeSpecific").html("");
        }
        // Show the popup:
        $("body").addClass("show_deviceSettings");
    });

    $(".btn-removeDevice").click(function() {
        this_id = $(".deviceSettings-info-id").text();
        let this_device;
        for (var i = 0; i < shared.settings.opc.server.devices.length; i++) {
            let device = shared.settings.opc.server.devices[i];
            if ( device.id == this_id ) {
                this_device = device;
                break;
            }
        }
        let temp = shared.settings.opc.server.devices;
        temp.splice(i, 1);
        shared.settings.opc.server.devices = temp;

        console.log( shared.settings.opc.server.devices );

        $(".deviceStatus_" + this_id).siblings(".device_menu_btn").parent().remove();
        setTimeout(() => {
            show_error(`Successfully removed <code>${this_device.name}</code>`,"success");
            ipcRenderer.send('saveSettings');
        },100);
    });

    $(".btn_add").click(function() {
        let newName = $("#addDevice-name").val();
        let newType = $("#addDevice-type").val().replace(" ","").toLowerCase();
        if ( newType == "" ) newType = "no_type";
        let newID = "D_" + Math.random().toString(36).substr(2).substr(0, 10) + Math.random().toString(36).substr(2).substr(0, 10);
        let newDevice = {};
        newDevice.name = newName;
        newDevice.type = newType;
        newDevice.id = newID;
        newDevice.config = {};
        if ( newType == "snapmaker" ) {
            newDevice.config.detectPort = false;
            newDevice.config.comPort = "COM3";
        } else if ( newType == "plc" ) {
            newDevice.config.endpointURL = "192.168.0.0:4840";
            newDevice.config.nodeID = "ns=3;s=PLC_VAR_NAME";
        }
        newDevice.orders = [];
        let newDeviceArray = shared.settings.opc.server.devices;
        newDeviceArray.push(newDevice);
        shared.settings.opc.server.devices = newDeviceArray;

        createDeviceList();
        $(document.body).addClass("show_background");
        setTimeout(() => {
            console.log( $(".deviceStatus_" + newID).siblings(".device_menu_btn")[0] );
            $(".deviceStatus_" + newID).siblings(".device_menu_btn").click();
            $(document.body).removeClass("show_background");
            $("#addDevice-name").val("");
            $("#addDevice-type").val("");
        },400);
    });

    $(".btn_openDeviceOrderDir").click(function() {
        let deviceOrderDir = shared.app_path + "\\" + "orders" + "\\" + $(this).attr("data-devicedir");
        // console.log( deviceOrderDir );
        require("child_process").exec(`start "" "${deviceOrderDir}"`)
    });
});
