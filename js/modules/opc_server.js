/*
* Author: Robin Garbe
* Version: 2.0.0
*/

module.exports = {
    init: () => {
        init();
    },
    close: () => {
        close();
    }
}

const fs = require('fs');
let sprint = process.sprint;
let show_error = process.show_error;
var shared = global.sharedObj;
let activity_indicator = process.activity_indicator;

// const activity_indicator = require("./activity_indicator");
const opcua = require("node-opcua");
let server;


process.setStatus("Initializing Snapmaker...",undefined,"deviceStatus_sm1","1");
const snapmaker = require("./devices/snapmaker");
const plc = require("./devices/plc");
const marlin_printer = require("./devices/marlin_printer");

for (let i = 0; i < shared.settings.opc.server.devices.length; i++) {
    let thisDevice = shared.settings.opc.server.devices[i];
    let wait_time = 2000 * (i + 1);
    if ( thisDevice.type == "snapmaker" ) {
        setTimeout(() => { snapmaker.init(thisDevice); },wait_time);
    } else if ( thisDevice.type == "plc" ) {
        setTimeout(() => { plc.init(thisDevice); },wait_time);
    } else if ( thisDevice.type == "marlin_printer" ) {
        setTimeout(() => { marlin_printer.init(thisDevice); },wait_time);
    } else {
        process.setStatus("unknown type",undefined,`deviceStatus_${thisDevice.id}`,0);
        sprint(`Unsupported device: ${thisDevice.name} (Type: ${thisDevice.type}; ID: ${thisDevice.id})`,"byellow");
        show_error(`Unsupported device: <code>${thisDevice.name}</code> (Type: <code>${thisDevice.type}</code>)`,"error noFade");
    }
}

/*
var device_type = {};
for (let i = 0; i < shared.settings.opc.server.devices.length; i++) {
    let thisDevice = shared.settings.opc.server.devices[i];
    let wait_time = 2000 * (i + 1);  // Wait time between the initialization of each device

    if ( fs.existsSync(`./js/modules/devices/${thisDevice.type}.js`) ) {
        process.setStatus("initializing...",undefined,`deviceStatus_${thisDevice.id}`,1);
        if ( device_type[thisDevice.type] == undefined ) device_type[thisDevice.type] = require("./devices/" + thisDevice.type);
        setTimeout(() => { device_type[thisDevice.type].init(thisDevice) }, wait_time);
    } else {
        process.setStatus("unknown type",undefined,`deviceStatus_${thisDevice.id}`,0);
        sprint(`Unsupported device: ${thisDevice.name} (Type: ${thisDevice.type}; ID: ${thisDevice.id})`,"byellow");
        show_error(`Unsupported device: <code>${thisDevice.name}</code> (Type: <code>${thisDevice.type}</code>)`,"error noFade");
    }
}
*/

function init() {
    server = new opcua.OPCUAServer({ // Creates an instance of OPCUAServer
        port: 4334, // the port of the listening socket of the server
        resourcePath: "OPC-UA", // this path will be added to the endpoint resource name
        buildInfo : {
            productName: "OPCUA_Server-BPI_WS18/19_Group46",
            buildNumber: "7658",
            buildDate: new Date(2018, 11, 28)
        }
    });

    server.initialize(() => {
        sprint("OPC-server initialized","green","black","black","byellow");
        construct_my_address_space(server);
        server.start(() => {
            if ( server.endpoints[0] === undefined ) {
                sprint("Can't start server! Maybe a server is already running on this computer?","bred","black","bwhite","red");
                show_error("Can't start the OPC server! Maybe a server is already running on this computer?","error noFade");
                process.setStatus("can't start the OPC server",undefined,undefined,0);
            } else {
                updateOrders();
                heythere();
                setTimeout(() => { keepalive() }, 10000);  // Start sending keepalives after 10s
                sprint("Now listening at port " + server.endpoints[0].port + " (press CTRL+C to stop)","white","black","black","byellow");
                const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                sprint("The primary server endpoint URL is " + endpointUrl,"white","black","black","byellow"); // display endpoint url
                sprint("OPC-server is running ...","green","bwhite","bwhite","green");
                show_error("OPC-server started","success");
            }
        });
    });

    function construct_my_address_space(server) {
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();
        const myDevice = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "MyDevice"
        });

        let startup = true; // Stop spamming the console on startup

        // Create the OPC variables:
        for (var i = 0; i < shared.settings.opc.server.devices.length; i++) {
            let thisDevice = shared.settings.opc.server.devices[i];
            let name = thisDevice.name;
            let id = thisDevice.id;
            let indicator = ".ai-" + id;
            eval(`
                let variable${i} = "";
                server.nodeVariable${i} = namespace.addVariable({
                    componentOf: myDevice,
                    nodeId: "ns=1;s=${id}",
                    browseName: "${id}",
                    dataType: "String",
                    value: {
                        get: function() {
                            let value = new opcua.Variant({dataType: opcua.DataType.String, value: variable${i}});
                            log = "Request: <-- get ${name} - value: " + String(value);
                            if (!startup) sprint(log,"cyan");
                            return value;
                        },
                        set: function(variant) {
                            let value = String(variant.value);
                            let newVariant = new opcua.Variant({dataType: opcua.DataType.String, value: value});
                            log = "Request: set --> ${name} - value: " + value;
                            if (!startup) sprint(log,"bcyan");
                            variable${i} = value; // Set the value
                            activity_indicator("${indicator}");
                            // show_error("Received the order <code>" + JSON.parse(value).order_name + "</code> for <i>${name}</i>","success");
                            ${thisDevice.type}.exec("${id}", value);
                            return opcua.StatusCodes.Good;
                        }
                    }
                });
            `);
        }


        // --------------------- Testing with NodeRed: -------------------------

        // This is a test variable that is ment to be used for testing with Node-Red:
        let variableRED = "This is a test with Node-Red. This is the initial value of the third variable.";
        let variableRED_name = "NodeRedTest";
        server.nodeVariableRED = namespace.addVariable({
            componentOf: myDevice,
            nodeId: "ns=1;i=1234",
            browseName: variableRED_name,
            dataType: "String",
            value: {
                get: function() {
                    let value = new opcua.Variant({dataType: opcua.DataType.String, value: variableRED});
                    log = "Request from NodeRed: <-- get " + variableRED_name + " - " + String(value).slice(8, -1);
                    if (!startup) sprint(log,"cyan");
                    return value;
                },
                set: function(variant) {
                    let value = String(variant.value);
                    let newVariant = new opcua.Variant({dataType: opcua.DataType.String, value: value});
                    log = "Request from NodeRed: set --> " + variableRED_name + " - " + String(newVariant).slice(8, -1);
                    if (!startup) sprint(log,"bcyan");
                    variableRED = value; // Set the value
                    return opcua.StatusCodes.Good;
                }
            }
        });

        // ---------------------------------------------------------------------


        startup = false;
    }
}

function close() {
    server.shutdown(0, (err) => {
        if(err){
            sprint("Error while shutting down the server [" + err + "]","bred","black","bwhite","red");
            show_error("Error while shutting down the server:<br><code>" + err + "</code>");
        } else {
			snapmaker.close();
            sprint("Successfully shut down the server","green")
            show_error("OPC-server shut down","warning");
        }
    });

}

const axios = require('axios');

function updateOrders() {
    sprint("Updating orders");
    orderDir = shared.app_path + "/orders/";
    // let orderDir_path = orderDir + device.type + " " + device.id;
    if ( !fs.existsSync(orderDir) ) {
        fs.mkdirSync(orderDir);
        show_error(`There are no oders yet. Open the configuration window of a device to add orders for it.`,"warning noFade");
    } else {
        let devices = shared.settings.opc.server.devices;
        let devicesWithOrders = fs.readdirSync(orderDir);
        for (let i = 0; i < devices.length; i++) {
            let thisFolder = devices[i].type + " " + devices[i].id;
            if ( devicesWithOrders.includes(thisFolder) ) {
                // console.log( "There is a order folder called ", thisFolder );
                let orderFiles = fs.readdirSync(orderDir + "\\" + thisFolder);
                orderFiles = orderFiles.map((val) => { return val.replace(/\.[^/.]+$/, "") });  // remove the file extension

				// Reset the order list:
				shared.settings.opc.server.devices[i].orders = [];
				// Create it again:
				for (let k = 0; k < orderFiles.length; k++) {
                    let newOrder_name = orderFiles[k];
                    let newOrder_id = "O_" + Math.random().toString(36).substr(2).substr(0, 10) + Math.random().toString(36).substr(2).substr(0, 10);
                    shared.settings.opc.server.devices[i].orders.push({
                        name: newOrder_name,
                        id: newOrder_id
                    });
                }
                // Save it:
                fs.writeFile(shared.app_path + "/settings.json", JSON.stringify(shared.settings, null, 4), (err) => { if (err) console.log("Error while saving the settings! [" + err + "]","bred","black","bwhite","red"); });
            } else {
                console.log( "There is NO order folder called ", thisFolder, ". Creating it" );
                fs.mkdirSync(orderDir + "\\" + thisFolder);  // If the folder doesn't exist, create it...
                shared.settings.opc.server.devices[i].orders = [];  // ... and set the order list of this device to []
            }
        }
    }
}

function heythere() {
    sprint("Sending heythere");
    let this_server = shared.settings.opc.server;
    // Send server information:
    let s_params = new URLSearchParams();
    s_params.append('what', "hubServer");
    s_params.append('name', this_server.name);
    s_params.append('address', `${this_server.address}:${this_server.port}/${this_server.endpoint}`);
    s_params.append('id', shared.settings.id);
    axios.post(shared.settings.dbserver + 'updateEntry.php', s_params)
    .catch((err) => { sprint("Error while sending SERVER heythere: " + err.Error + " | Response: " + err.response,"bred"); });
    // Clean devices for this Server:
    let d_clean_params = new URLSearchParams();
    d_clean_params.append('what', "devices");
    d_clean_params.append('id', shared.settings.id);
    axios.post(shared.settings.dbserver + 'clean.php', d_clean_params)
    .catch((err) => { sprint("Error while cleaning DEVICES in heythere: " + err.Error + " | Response: " + err.response,"bred"); });
    setTimeout(() => {
        for (let i = 0; i < this_server.devices.length; i++) {
            setTimeout(() => {
                sprint(`Creating device [${this_server.devices[i].name}]`,"bwhite","magenta","magenta","black");
                let this_device = this_server.devices[i];
                // Send device information:
                let d_params = new URLSearchParams();
                d_params.append('what', "device");
                d_params.append('name', this_device.name);
                d_params.append('type', this_device.type);
                d_params.append('id', this_device.id);
                d_params.append('hubServer_id', shared.settings.id);
                axios.post(shared.settings.dbserver + 'updateEntry.php', d_params)
                .catch((err) => { sprint("Error while sending DEVICE heythere: " + err.Error + " | Response: " + err.response,"bred"); });
                // Clean orders for this device:
                let o_clean_params = new URLSearchParams();
                o_clean_params.append('what', "orders");
                o_clean_params.append('id', this_device.id);
                axios.post(shared.settings.dbserver + 'clean.php', o_clean_params)
                .catch((err) => { sprint("Error while cleaning ORDERS in heythere: " + err.Error + " | Response: " + err.response,"bred"); });
                setTimeout(() => {
                    for (let j = 0; j < this_device.orders.length; j++) {
                        setTimeout(() => {
                            sprint(`Creating order [${this_device.orders[j].name}]`,"bwhite","magenta","magenta","black");
                            let this_order = this_device.orders[j];
                            // Send order information:
                            let o_params = new URLSearchParams();
                            o_params.append('what', "order");
                            o_params.append('name', this_order.name);
                            o_params.append('id', this_order.id);
                            o_params.append('device_id', this_device.id);
                            axios.post(shared.settings.dbserver + 'updateEntry.php', o_params)
                            .catch((err) => { sprint("Error while sending ORDER heythere: " + err.Error + " | Response: " + err.response,"bred"); });
                        }, j*100);
                    }
                },1000);
            }, i*66);
        }
    },1000);
}

function keepalive() {
    let t = new Date();
    sprint(`Sending keepalive [${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}]`);
    let params = new URLSearchParams();
    params.append('id', shared.settings.id);
    axios.post(shared.settings.dbserver + 'updateLastOnline.php', params)
    .then((res) => {
        // console.log(`statusCode: ${res.statusCode}`);
        // console.log(res);
    })
    .catch((err) => { sprint("Error while sending keepalive: " + err.Error + " | Response: " + err.response,"bred"); })
    setTimeout(() => { keepalive() }, 10000);  // Send a keepalive every 10s
}
