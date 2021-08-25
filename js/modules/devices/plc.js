/*
* Author: Robin Garbe
* Version: 0.1.0
*/

module.exports = {
    init: (device) => {
        init(device);
    },
	exec: (this_deviceID, data) => {
        exec(this_deviceID, data);
    }
}

const fs = require('fs');
let sprint = process.sprint;
let show_error = process.show_error;
var shared = global.sharedObj;
const orderDir = shared.app_path + "/orders/";  // path to the orders folder
let deviceData = {};  // This is where most of the device specific data will be stored

const opcua = require("node-opcua");

/// @param: Link to the plc in the settings file. (Example: "shared.settings.opc.server.devices[1]")
function init(device) {
	let this_deviceID = device.id;
    let plc = device;
	deviceData[this_deviceID] = {  // Create an entry for this device in deviceData
		status: "init", // the connection status of this device ("init" | "can't connect" | "connected")
		client: null,
		endpointUrl: "opc.tcp://" + plc.config.endpointURL,
		nodeId: plc.config.nodeID,
		session: null,
		client_ready: false,
		cachequeue: [], // The order queue
		io_busy: false
	};
	deviceData[this_deviceID].client = new opcua.OPCUAClient({
	    connectionStrategy: {
	        maxRetry: 3,
	        initialDelay: 1000,
	        maxDelay: 4 * 1000
	    },
	    keepSessionAlive: true,
	    endpoint_must_exist: false
	});

    process.setStatus("connecting...",undefined,`deviceStatus_${device.id}`,"1");
    async function connectClient() {
        try {
            deviceData[this_deviceID].client.on("backoff", () => {
                sprint("Retrying connection to PLC...","bred")
                show_error(`Wasn't able to connect to the PLC <code>${device.name}</code>!<br>Retrying connection<span class='dotdotdot'></span>`,"warning");
            });
            await deviceData[this_deviceID].client.connect(deviceData[this_deviceID].endpointUrl);
            deviceData[this_deviceID].session = await deviceData[this_deviceID].client.createSession();
            return true;
        } catch (err) {
            sprint("Error while connecting to the PLC! [" + err + "]","bred","black","bwhite","red");
            // show_error("Error while connecting to the PLC!<br><code>" + err + "</code>");
        }
    }
    connectClient().then((result) => {
        if ( result == true ) {
            deviceData[this_deviceID].client_ready = true;
			deviceData[this_deviceID].status = "connected";
            sprint(`Connected to PLC ${device.name}`,"green","bwhite","bwhite","green");
            show_error(`Connected to PLC <code>${device.name}</code>`,"success");
            process.setStatus("connected",undefined,`deviceStatus_${device.id}`,"2");
        } else {
            sprint(`Warning: The client didn't connect correctly to the PLC ${device.name}!`,"byellow","black","black","byellow");
            show_error(`Can't connect to the PLC <code>${device.name}</code>`,"error noFade");
			deviceData[this_deviceID].status = "can't connect";
            process.setStatus("can't connect",undefined,`deviceStatus_${device.id}`,"0");
        }
    });

	checkOrderDir(device);
}

function checkOrderDir(device) {
    let this_deviceID = device.id;
    deviceData[this_deviceID].orderDir_thisDevice = orderDir + device.type + " " + device.id;
    if ( !fs.existsSync(deviceData[this_deviceID].orderDir_thisDevice) ) {
        fs.mkdirSync(deviceData[this_deviceID].orderDir_thisDevice);
        show_error(`The PLC <code>${device.name}</code> has no available orders. Open the configuration window of this device to add orders.`,"warning noFade");
    } else {
        let order_Array = fs.readdirSync(deviceData[this_deviceID].orderDir_thisDevice);
        if ( order_Array.length === 0 ) {
            show_error(`The PLC <code>${device.name}</code> has no available orders. Open the configuration window of this device to add orders.`,"warning noFade");
        }
    }
}

function exec(this_deviceID, data) {
    let data_json = JSON.parse(data);
    let this_device;
    for (let i = 0; i < shared.settings.opc.server.devices.length; i++) {
        let device = shared.settings.opc.server.devices[i];
        if ( device.id == this_deviceID ) {
            this_device = device;
            break;
        }
    }
    let this_deviceName = this_device.name;
    let this_deviceOrders = [];
    let order_exists = false;
    for (let j = 0; j < this_device.orders.length; j++) {
        if ( this_device.orders[j].name == data_json.order_name ) {
            if ( deviceData[this_deviceID].status === "connected" ) {
                show_error(`The PLC <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>`,"success");
                deviceData[this_deviceID].cachequeue.push(data_json); // put the new item in the queue
                if (!deviceData[this_deviceID].io_busy) check_and_exec(this_deviceID);
            } else if ( deviceData[this_deviceID].status === "init" ) {
                sprint(`The PLC ${this_deviceName} (DeviceID: ${this_deviceID}) received an order, but it is still initiating. Trying to execute this order again in 5s...`, "byellow","black","bwhite","blue");
                show_error(`The PLC <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>, but it is still initiating. Trying to execute this order again in 5s...`,"warning");
                setTimeout(() => { exec(this_deviceID, data) }, 5000);
            } else {
                sprint(`The PLC ${this_deviceName} (DeviceID: ${this_deviceID}) received an order, but the device is not connected`,"bred","black","bwhite","blue");
                show_error(`The PLC <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received an order, but the device is not connected`,"warning");
            }
            order_exists = true;
            break;
        }
    }
    if ( !order_exists ) {
        sprint(`The PLC ${this_deviceName} (DeviceID: ${this_deviceID}) received the order ${data_json.order_name}, but no such order exists for this device`, "bred","black","bwhite","blue");
        show_error(`The PLC <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>, but no such order exists for this device`);
    }
}

function check_and_exec(this_deviceID) {
    if ( deviceData[this_deviceID].cachequeue.length === 0 ) {
        // The queue is empty, nothing to do!
    } else if (deviceData[this_deviceID].io_busy) {
        // wait for 30s, then check_and_exec again:
        setTimeout(function() {
            check_and_exec(this_deviceID);
        }, 30000);
    } else {
        deviceData[this_deviceID].io_busy = true; // make sure that just one string can be streamed at any time
        let thisOrder = deviceData[this_deviceID].cachequeue[0]; // get the first item in the queue...
        deviceData[this_deviceID].cachequeue.shift(); // ... and then remove it from the queue

        sprint("Trying to send order to PLC...","bwhite","black","bwhite","blue");
        io_exec(thisOrder, this_deviceID); // execute this value

        deviceData[this_deviceID].io_busy = false;
        check_and_exec(this_deviceID);
    }
}

function io_exec(thisOrder, this_deviceID) {
	sprint("Sending to PLC...","bwhite","bblue","bwhite","blue");
	try {
        let device = shared.settings.opc.server.devices.filter((value, index, arr) => { return (value.id == thisOrder.device_id); })[0];
        let path = `${shared.app_path}\\orders\\${device.type} ${device.id}\\${thisOrder.order_name}.txt`;
		let start_script = fs.readFileSync(path, 'utf8');
        try {
            let nodeToWrite = [{
                nodeId: deviceData[this_deviceID].nodeId,
                attributeId: opcua.AttributeIds.Value,
                indexRange: null,
                value: {
                    value: {
                        dataType: opcua.DataType.String,
                        value: start_script
                    }
                }
            }];
            deviceData[this_deviceID].session.write(nodeToWrite, function(err,statusCode,diagnosticInfo) {
                if (!err) {
                    let status = String(statusCode);
                    if (status == "Good (0x00000)") {
                        sprint(`Changes on the PLC ${device.name} successful! - Status code: ${status}`, "green");
                        show_error(`Sending to the PLC <code>${device.name}</code> successful!`,"success");
                    } else {
                        sprint("Status code from PLC: " + status, "byellow");
                        show_error(`Something went wrong while sending to the PLC <code>${device.name}</code>!<br><code>Status code: ${status}</code>`,"warning");
                    }
                } else {
                    sprint("Error while writing to PLC! Write unsuccessful with error: [" + err + "]","bred","black","bwhite","red");
                    show_error(`Error while sending to the PLC <code>${device.name}</code>:<br><code>${err}</code>`);
                }
				if (diagnosticInfo != undefined) {
                    sprint("Diagnostic info from PLC:\n" + String(diagnosticInfo), "byellow");
                    show_error(`Diagnostic info from the PLC <code>${device.name}</code>:<br><code>${String(diagnosticInfo)}</code>`,"warning");
                }
            });
        } catch (err) {
            sprint("Error while writing to PLC! [" + err + "]","bred","black","bwhite","red");
            show_error(`Error while sending to the PLC <code>${device.name}</code>!<br><code>${err}</code>`);
        }
    } catch (err) { sprint("Error while writing to PLC! [" + err + "]","bred","black","bwhite","red"); }
}
