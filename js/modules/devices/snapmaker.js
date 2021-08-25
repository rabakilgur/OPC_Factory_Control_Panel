/*
* Author: Robin Garbe, Krister Haas, Adriaan Mulder
* Version: 3.0.0
*/

module.exports = {
    init: (device) => {
        init(device);
    },
    exec: (this_deviceID, data) => {
        exec(this_deviceID, data);
    },
    close: () => {
        close();
    }
}

const fs = require('fs');
const serial = require('../serial');
let sprint = process.sprint;
let show_error = process.show_error;
var shared = global.sharedObj;
const orderDir = shared.app_path + "/orders/";  // path to the orders folder
let deviceData = {};  // This is where most of the device specific data will be stored

// Stuff we need for the serial transmission:
let SerialPort;  // the SerialPort package (will be required in the first init)
const device_title = "Snapmaker";  // This is how the device will be called in error/warning/console messages

/// @param: Link to the plc in the settings file. (Example: "shared.settings.opc.server.devices[0]")
function init(device) {
    let this_deviceID = device.id;

    deviceData[this_deviceID] = {  // Create an entry for this device in deviceData
        status: "init", // the connection status of this device ("init" | "can't connect" | "connected")
        portNames: [],  // List of ports that will be tried for this device
        cachequeue: [], // The order queue
        io_busy: false  // "true", if the device can't receive an order
    };
    if ( SerialPort == undefined ) SerialPort = require('serialport');
    if ( device.config.detectPort ) {
        deviceData[this_deviceID].portNames = ["COM3","COM2","COM4","COM5","COM6","COM7","COM8"];
        // deviceData[this_deviceID].portNames = ["COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","COM10","COM11","COM12","COM13","COM14","COM15","COM16","COM17","COM18","COM19","COM20"];
    } else {
        deviceData[this_deviceID].portNames = [device.config.comPort];
    }
    connectPort(device, error_connectPort);
	//deviceData[this_deviceID].SDevice = new serial(device.config.comPort, 115200);
    checkOrderDir(device);
}

function connectPort(device, callback) {
    let this_deviceID = device.id;
    let thisCallback = callback;
    try {
        process.setStatus("Trying port <code>" + deviceData[this_deviceID].portNames[0] + "</code>",undefined,`deviceStatus_${device.id}`,"1");
       /* deviceData[this_deviceID].port = new SerialPort(deviceData[this_deviceID].portNames[0], {
            baudRate: 115200  // The rate at which the gcode will be streamed to the device
        });
		*/
		deviceData[this_deviceID].SDevice = new serial(deviceData[this_deviceID].portNames[0], 115200);

        deviceData[this_deviceID].SDevice._serial.on("error", () => {
            let err = "No device found at port " + deviceData[this_deviceID].portNames[0];
            callback(device, err);
        });

		deviceData[this_deviceID].port = deviceData[this_deviceID].SDevice;
        let isCompatibleDevice = true;  // TODO: Check if the device is the right one here
        if ( !isCompatibleDevice ) {
            let err = `The device at port ${deviceData[this_deviceID].portNames[0]} is not a compatible ${device_title}`;
            callback(device, err);
        }
		callback(device);
    } catch (err) {
        sprint(`Can't connect to the ${device_title} ${device.name} on any of the specified ports!`,"bred","black","bwhite","red");
        show_error(`Can't connect to the ${device_title} <code>${device.name}</code>`,"error noFade");
        deviceData[this_deviceID].status = "can't connect";
        process.setStatus("can't connect",undefined,`deviceStatus_${device.id}`,"0");
    }
}

function error_connectPort(device, err) {
    let this_deviceID = device.id;
    if (err) {
        if ( deviceData[this_deviceID].portNames[1] !== undefined ) {
            sprint('Error with port ' + deviceData[this_deviceID].portNames[0] + '! Next port: ' + deviceData[this_deviceID].portNames[1] + ' [' + err + ']',"yellow","black","black","yellow");
            // show_error("No device found at port <code>" + deviceData[this_deviceID].portNames[0] + "</code>! Trying port <code>" + deviceData[this_deviceID].portNames[1] + "</code> next...","warning");
        } else {
            sprint('Error with port ' + deviceData[this_deviceID].portNames[0] + '! [' + err + ']',"yellow","black","black","yellow");
            // show_error("No device found at port <code>" + deviceData[this_deviceID].portNames[0] + "</code>!","warning");
        }
        deviceData[this_deviceID].portNames.shift();
        setTimeout(() => { connectPort(device, error_connectPort) }, 200);
    } else {
        sprint(`Connected to port ${deviceData[this_deviceID].portNames[0]}`,"green");
        show_error(`Connected to ${device_title} at port <code>${deviceData[this_deviceID].portNames[0]}</code>`,"success");
        deviceData[this_deviceID].status = "connected";
        process.setStatus(`connected at port <code>${deviceData[this_deviceID].portNames[0]}</code>`,undefined,`deviceStatus_${device.id}`,"2");
    }
}

function checkOrderDir(device) {
    let this_deviceID = device.id;
    deviceData[this_deviceID].orderDir_thisDevice = orderDir + device.type + " " + device.id;
    if ( !fs.existsSync(deviceData[this_deviceID].orderDir_thisDevice) ) {
        fs.mkdirSync(deviceData[this_deviceID].orderDir_thisDevice);
        show_error(`The ${device_title} <code>${device.name}</code> has no available orders. Open the configuration window of this device to add orders.`,"warning noFade");
    } else {
        let order_Array = fs.readdirSync(deviceData[this_deviceID].orderDir_thisDevice);
        if ( order_Array.length === 0 ) {
            show_error(`The ${device_title} <code>${device.name}</code> has no available orders. Open the configuration window of this device to add orders.`,"warning noFade");
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
                show_error(`The ${device_title} <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>`,"success");
                deviceData[this_deviceID].cachequeue.push(data_json); // put the new item in the queue
                if (!deviceData[this_deviceID].io_busy) check_and_exec(this_deviceID);
            } else if ( deviceData[this_deviceID].status === "init" ) {
                sprint(`The ${device_title} ${this_deviceName} (DeviceID: ${this_deviceID}) received an order, but it is still initiating. Trying to execute this order again in 5s...`, "byellow","black","bwhite","blue");
                show_error(`The ${device_title} <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>, but it is still initiating. Trying to execute this order again in 5s...`,"warning");
                setTimeout(() => { exec(this_deviceID, data) }, 5000);
            } else {
                sprint(`The ${device_title} ${this_deviceName} (DeviceID: ${this_deviceID}) received an order, but the device is not connected`,"bred","black","bwhite","blue");
                show_error(`The ${device_title} <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received an order, but the device is not connected`,"warning");
            }
            order_exists = true;
            break;
        }
    }
    if ( !order_exists ) {
        sprint(`The ${device_title} ${this_deviceName} (DeviceID: ${this_deviceID}) received the order ${data_json.order_name}, but no such order exists for this device`, "bred","black","bwhite","blue");
        show_error(`The ${device_title} <code>${this_deviceName} (DeviceID: ${this_deviceID})</code> received the order <code>${data_json.order_name}</code>, but no such order exists for this device`);
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

        sprint(`Trying to send order to ${device_title}...`,"bwhite","black","bwhite","blue");
        io_exec(thisOrder, this_deviceID); // execute this value

        deviceData[this_deviceID].io_busy = false;
        check_and_exec(this_deviceID);
    }
}

function io_exec(thisOrder, this_deviceID) {
    sprint(`Streaming to ${device_title}...`,"bwhite","bblue","bwhite","blue");
    try {
        let device = shared.settings.opc.server.devices.filter((value, index, arr) => { return (value.id == thisOrder.device_id); })[0];
        let path = `${shared.app_path}\\orders\\${device.type} ${device.id}\\${thisOrder.order_name}.blub`;
        deviceData[this_deviceID].SDevice.printFile(path);  // Stream the GCode
    } catch (err) { sprint(`Error while streaming to ${device_title}! [${err}]`,"bred","black","bwhite","red"); }

	}

function close() {
		for (let this_device in deviceData) {
            deviceData[this_device].SDevice._serial.close();
            deviceData[this_device].status = "disconnected";
            process.setStatus(`disconnected`,undefined,`deviceStatus_${this_device}`,"0");
        }
}
