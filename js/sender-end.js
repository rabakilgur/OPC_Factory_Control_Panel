// const shared = remote.getGlobal('sharedObj');

$(document).ready(() => {

    $(".app-type").text("Sender");
    $("#app-title").append(`<div class="title-banner">Sending Mode</div>`); // create title-banner

    $(".content").prepend($(`<div class="my_breadcrumbs"><a class="my_breadcrumb breadcrumb-server"><i class="icon-server"></i><span>Select a Server</span></a></div>`)); // create the breadcrumb container

    $(".content").append($('<button class="btn btn-secondary btn-topRight btn-reloadList">Refresh List</button>')); // create the btn to reload the list
    $(".btn-reloadList").click(() => {
        $(".my_breadcrumbs").remove();
        $(".listbox_box").remove();
        $(".content").prepend($(`<div class="my_breadcrumbs"><a class="my_breadcrumb breadcrumb-server"><i class="icon-server"></i><span>Select a Server</span></a></div>`)); // create the breadcrumb container
        getListData();
    });

    $(".content").append($('<div class="loader loader-SDO_list"></div>')); // create the btn to reload the list

    function mk_listboxes(json) {
        $(".loader-SDO_list").remove();
        function count(obj) {
            return Object.keys(obj).length;
        }
        $(".content").append($('<div class="listbox_box"> <div class="listbox listbox-s"> <h4>Select a <b>Server</b></h4> <ul class="list-group list-buttons mb-3"></ul> </div> </div>')); // create the empty server-list
        $.each(json.servers, (s_key, s_val) => {
            $(".listbox-s > ul").append(`<li class="list-group-item" data-connectOPC="${s_val.address}" data-device_nbr="${s_val.devices.length}">${s_val.name}<code>${s_val.address}</code></li>`); // create server-buttons

            $(".listbox_box").append($(`<div class="listbox listbox-d listbox-s${s_key} listbox-toRight"> <span class="listbox-back"></span> <h4>Select a <b>Device</b> on <span class="server_name">${s_val.name}</span></h4> <ul class="list-group list-buttons mb-3"></ul> </div>`)); // create the empty device-lists
            $.each(s_val.devices, (d_key, d_val) => {
                $(".listbox-s" + s_key + " > ul").append(`<li class="list-group-item" data-model_nbr="${d_val.orders.length}" data-deviceid="${d_val.id}">${d_val.name}<code>${d_val.type.toUpperCase()}</code></li>`); // create device-buttons

                $(".listbox_box").append($(`<div class="listbox listbox-m listbox-s${s_key}-d${d_key} listbox-toRight"> <span class="listbox-back"></span> <h4>Select an <b>Order</b> on <span class="device_name">${d_val.name}</span></h4> <ul class="list-group list-buttons mb-3"></ul> </div>`)); // create the empty model-lists
                $.each(d_val.orders, (m_key, m_val) => {
                    $(".listbox-s" + s_key + "-d" + d_key + " > ul").append(`<li class="list-group-item" data-modelid="${m_val.id}" data-sendOPC='{"order_name":"${m_val.name}", "device_id":"${d_val.id}"}'>${m_val.name}</li>`); // create model-buttons
                });
                $(".listbox-m").each(function (index) {
                    if ( $(this).children("ul").is(':empty') ) $(this).children("ul").append(`<li class="list-group-item list-empty">No Orders</li>`);
                });
            });
            $(".listbox-d").each(function (index) {
                if ( $(this).children("ul").is(':empty') ) $(this).children("ul").append(`<li class="list-group-item list-empty">No Devices</li>`);
            });
        });
        $(".listbox-s").each(function (index) {
            if ( $(this).children("ul").is(':empty') ) $(this).children("ul").append(`<li class="list-group-item list-empty">No Servers</li>`);
        });
        listboxFunctionality();
    }

    let connectedTo = "";

    function listboxFunctionality() {
        function toLeft(thisEl) {
            thisEl.parent().parent().addClass("listbox-toLeft");
        }
        $(".listbox-s .list-group-item").each(function(i) {  // server
            $(".listbox-s .list-group-item:nth-child(" + (i + 1) + ")").click(function() {
                $(".my_breadcrumbs").empty()
                                    .append($(`<a class="my_breadcrumb breadcrumb-server"><i class="icon-server"></i><span>${$(this).clone().children().remove().end().text()}</span></a>`))
                                    .append($(`<a class="my_breadcrumb breadcrumb-device"><i class="icon-device"></i><span>Select a Device</span></a>`));
                if ( !shared.settings.opc.client.connection.fixed ) {
                    let this_connection = $(this).attr("data-connectOPC");
                    if ( (connectedTo !== this_connection) && (connectedTo !== "") ) {
                        console.log( "other connection" );
                        // disconnect:
                        ipcRenderer.send('closeOPC');
                        // connect to new server after 0.3s:
                        setTimeout(() => {
                            shared.connectOPC = this_connection; // tell the client what he should send (server address)
                            ipcRenderer.send('connectOPC');
                        },300);
                        connectedTo = this_connection;
                    } else if ( connectedTo === "" ) {
                        console.log( "no connection" );
                        shared.connectOPC = this_connection; // tell the client what he should send (server address)
                        ipcRenderer.send('connectOPC');
                        connectedTo = this_connection;
                    } else {
                        console.log( "same connection" );
                    }
                }
                toLeft( $(this) );
                $(".listbox-s" + i).removeClass("listbox-toRight");
            });
            $(".listbox-s" + i + " .list-group-item").each(function(j) {  // devices
                $(".listbox-s" + i + " .list-group-item:nth-child(" + (j + 1) + ")").click(function() {
                    $(".my_breadcrumbs").children(":not(:first-child)").remove();
                    $(".my_breadcrumbs").append($(`<a class="my_breadcrumb breadcrumb-device"><i class="icon-device"></i><span>${$(this).clone().children().remove().end().text()}</span></a>`))
                                        .append($(`<a class="my_breadcrumb breadcrumb-order"><i class="icon-order"></i><span>Select an Order</span></a>`));
                    toLeft( $(this) );
                    $(".listbox-s" + i + "-d" + j).removeClass("listbox-toRight");
                });
                $(".listbox-s" + i + "-d" + j + " .list-group-item").each(function(k) {  // orders
                    $(".listbox-s" + i + "-d" + j + " .list-group-item:nth-child(" + (k + 1) + ")").click(function() {
                        shared.sendOPC = $(this).attr("data-sendOPC"); // tell the client what he should send (data that will be send)
                        ipcRenderer.send('sendOPC');
                    });
                });
            });
        });
        $(".content").on("click", ".listbox-d .listbox-back, .breadcrumb-server", () => {
            $(".listbox").removeClass("listbox-toLeft");
            $(".listbox-d, .listbox-m").addClass("listbox-toRight");
            $(".my_breadcrumbs").empty()
                                .append($(`<a class="my_breadcrumb breadcrumb-server"><i class="icon-server"></i><span>Select a Server</span></a>`));
        });
        $(".content").on("click", ".listbox-m .listbox-back, .breadcrumb-device", () => {
            let device = [...$(".listbox:not(.listbox-toLeft):not(.listbox-toRight)")[0].classList].find((el)=>{return el.match(/^listbox-s/);}).split("-s")[1].split("-d")[0];
            $(".listbox:not(.listbox-toLeft):not(.listbox-toRight)").addClass("listbox-toRight");
            $(".listbox-s" + device).removeClass("listbox-toLeft");
            $(".listbox-s" + device).removeClass("listbox-toRight");
            $(".my_breadcrumbs").children(":not(:first-child)").remove();
            $(".my_breadcrumbs").append($(`<a class="my_breadcrumb breadcrumb-device"><i class="icon-device"></i><span>Select a Device</span></a>`));
        });
    }

    function postAjax(url, data, success) {
        var params = typeof data == 'string' ? data : Object.keys(data).map(
                function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]) }
            ).join('&');

        var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        xhr.open('POST', url);
        xhr.onreadystatechange = function() {
            if (xhr.readyState>3 && xhr.status==200) { success(xhr.responseText); }
        };
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(params);
        return xhr;
    }

    function getListData() {
        let data_json;
        postAjax(shared.settings.dbserver + "getList.php", {}, data => {
            data_json = JSON.parse(data);
            if (shared.settings.devmode) console.log("HubServer & Devices & Orders", data_json);
            mk_listboxes(data_json);
        });
        // Check for timeout after 11s
        setTimeout(() => {
            if ( data_json === undefined ) {
                show_error("There seams to be a timeout while connecting to the DB-Server. Trying again in 5s...");
                setTimeout(() => { getListData(); },5000);
            }
        },11000);
    }
    setTimeout(() => { getListData() },100);  // Get the HubServer / Devices / Orders data after 0.1s
});
