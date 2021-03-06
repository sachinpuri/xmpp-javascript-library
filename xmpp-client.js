/* 
 * @project: xmpp-javascript-library
 * @author: Sachin Puri
 * @website: http://www.sachinpuri.com
 * @repository URL: https://github.com/sachinpuri/xmpp-javascript-library
 *  
 */

var xmppClient={
    username:null,
    password:null,
    host:null,
    resource:'web',    
    http_ws_url:null,
    onFailure:null,
    onSuccess:null,
    onDisconnect:null,
    onMessageReceive:null,
    onPresenceReceive:null,
    onSubscriptionRequestReceive:null,
    onSubscriptionRequestAccept:null,
    onSubscriptionRequestRejectOrCancel:null,
    onUnSubscribe:null,
    onTypingStatusChange:null,
    onRosterReceive:null,
    onDelivered:null,
    onArchiveReceive:null,
    onRosterPush:null, //This function can be called multiple times for same user
    onRosterEntryRemove:null,
    onBlockListReceive:null,
    onBlocked:null,
    onUnblocked:null,
    bareJid:null,
    fullJid:null,
    archiveLimit:10,
    archiveFirstId:{},
    archiveLastRequestedFor:0,
    socket:null,
    debug:0,
    connect:function(params){
        
        for(var property in params){
            this[property]=params[property];
        }
        
        this.fullJid = this.username + "@" + this.host + '/' + this.resource;
        this.bareJid = this.username + "@" + this.host;
        this.socket = new WebSocket(this.http_ws_url, "xmpp");
        
        this.socket.onopen = function (event) {
            xmppClient.start();
        };
        
        this.socket.onmessage = function (event) {            
            log("Received", event.data);
            parser.parseServerResponse(event.data);
        };
        
        this.socket.onerror = function (event) {            
            log("socket error");
            log(event);
        };
        
    },    
    start:function(){
        var data = xmlGenerator.start("open", {xmlns:'urn:ietf:params:xml:ns:xmpp-framing', to:this.host, version:'1.0'}, true).toString();
        this.sendToServer(data);
    },
    auth:function(){
        var auth = Base64.encode(this.bareJid + "\u0000" + this.username + "\u0000" + this.password);
        var data = xmlGenerator.start("auth", {xmlns:'urn:ietf:params:xml:ns:xmpp-sasl', mechanism:'PLAIN'}).text(auth).end("auth").toString();
        this.sendToServer(data);
    },
    restart:function(){
        var data = xmlGenerator.start("open", {xmlns:'urn:ietf:params:xml:ns:xmpp-framing', to:this.host, version:'1.0'}, true).toString();
        this.sendToServer(data);
    },
    bindResource:function(){
        var data = xmlGenerator
                .start("iq", {id:'_bind_auth_2', type:'set', xmlns:'jabber:client'})
                    .start("bind", {xmlns:'urn:ietf:params:xml:ns:xmpp-bind'})
                        .start("resource").text(this.resource).end()
                    .end()
                .end().toString();
        this.sendToServer(data);
    },
    session:function(){
        var data = xmlGenerator
                .start("iq", {id:'_session_auth_2', type:'set', xmlns:'jabber:client'})
                    .start("session", {xmlns:'urn:ietf:params:xml:ns:xmpp-session'}, true)
                .end().toString();
        this.sendToServer(data, "session");
    },
    sendPingResponse:function(from, to, id){
        var data = xmlGenerator
                    .start("iq", {id:id, xmlns:'jabber:client', from:from, to:to, type:'result'})
                        .start("ping", {xmlns:'urn:xmpp:ping'}, true)
                    .end().toString();
        this.sendToServer(data);
    },
    sendMessage:function(message, toJID){      
        var messageId = this.getMessageId();

        var data = xmlGenerator
                .start("message", {id:messageId, from:this.fullJid, to:toJID, type:'chat'})
                    .start("body").text(message).end()
                        .start("active", {xmlns:'http://jabber.org/protocol/chatstates'}, true)
                    .start("request", {xmlns:'urn:xmpp:receipts'}, true)
                .end().toString();
        this.sendToServer(data);
        return messageId;
    },
    sendReceipt:function(messageId, toJID){
        toJID = toJID.split("/")[0];

        var data = xmlGenerator
                .start("message", {id:this.getMessageId(), xmlns:'jabber:client', from:this.fullJid, to:toJID, type:'chat'})
                    .start("received", {id:messageId, xmlns:'urn:xmpp:receipts'}, true)
                .end().toString();
        this.sendToServer(data);
    },
    generateStanza:function(elementName, elementAttributes, elementText){
        return new XMLGenerator(elementName, elementAttributes, elementText).toString();
    },
    sendToServer:function(stanza){
        log("Sent", stanza);
        xmppClient.socket.send(stanza);
    },
    getMessageId:function(){
        return "msg_" + new Date().getTime();
    },
    getArchive:function(jid, isFirstPage){
        xmppClient.archiveLastRequestedFor = jid;
        
        xmlGenerator.start("iq", {id:this.getMessageId(), type:'set'})
                .start('query', {xmlns:'urn:xmpp:mam:1', queryid:'f27'})
                    .start('x', {xmlns:'jabber:x:data', type:'submit'})
                        .start('field', {var:'with'})
                            .start('value').text(jid).end()
                        .end()
                    .end()
                    .start('set', {xmlns:'http://jabber.org/protocol/rsm'})
                        .start('max').text(xmppClient.archiveLimit).end();
                        if(isFirstPage){
                            xmlGenerator.start('before', {}, true);
                        }else{
                            xmlGenerator.start('before').text(xmppClient.archiveFirstId[jid]).end();
                        }
                    xmlGenerator.end().end().end();
        
        this.sendToServer(xmlGenerator.toString());
    },
    blockUser:function(jid){
        var data = xmlGenerator
                    .start("iq", {id:'block1', from:this.fullJid, type:'set'})
                        .start("block", {xmlns:'urn:xmpp:blocking'})
                            .start('item', {jid:jid}, true)
                        .end()
                    .end().toString();
                       
        this.sendToServer(data);
    },
    unblockUser:function(jid){
        var data = xmlGenerator
                    .start("iq", {id:'unblock1', type:'set'})
                        .start("unblock", {xmlns:'urn:xmpp:blocking'})
                            .start('item', {jid:jid}, true)
                        .end()
                    .end().toString();
        this.sendToServer(data);
    },
    getBlockList:function(){
        var data = xmlGenerator
                    .start("iq", {id:'blocklist1', type:'get'})
                        .start("blocklist", {xmlns:'urn:xmpp:blocking'}, true)
                    .end().toString();
        this.sendToServer(data);
    },
    serviceDiscovery:function(){
        var data = xmlGenerator
                    .start("iq", {id:'disco1', from:this.fullJid, type:'get'})
                        .start("query", {'xmlns':'http://jabber.org/protocol/disco#info'}, true)
                    .end().toString();
        this.sendToServer(data);
    }
};

xmppClient.roster = {
    add:function(jid, name, group){
        xmlGenerator.start('iq', {id:'set1', from:xmppClient.fullJid, type:'set'})
                        .start('query', {xmlns:'jabber:iq:roster'})
                            .start('item', {jid:jid, name:name})
                                .start('group').text(group).end()
                            .end()
                        .end()
                    .end();
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    remove:function(jid){        
        xmlGenerator.start('iq', {id:'set1', from:xmppClient.fullJid, type:'set'})
                        .start('query', {xmlns:'jabber:iq:roster'})
                            .start('item', {jid:jid, subscription:'remove'}, true)
                        .end()
                    .end();
        
        xmppClient.sendToServer(xmlGenerator.toString());
        
    },
    get:function(){
        xmlGenerator.start('iq', {id:'1:roster', from:xmppClient.fullJid, type:'get', xmlns:'jabber:client'})
                        .start('query', {xmlns:'jabber:iq:roster'}, true)
                    .end();
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    rosterPushReply:function(id){
        xmlGenerator.start('iq', {id:id, from:xmppClient.fullJid, type:'result'}, true);
        xmppClient.sendToServer(xmlGenerator.toString());
    }
};

xmppClient.presence = {
    jid:null,
    type:null,
    status:null,
    available:function(){
        xmlGenerator.start('presence', {}, true);
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    unavailable:function(){
        xmlGenerator.start('presence', {type:'unavailable'}, true);
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    subscribe:function(jid, status){
        this.jid = jid;
        this.type = 'subscribe';
        if(status!==undefined) this.status = status;
        this.sendPresence();
    },
    unsubscribe:function(jid, status){
        this.jid = jid;
        this.type = 'unsubscribe';
        if(status!==undefined) this.status = status;
        this.sendPresence();
    },
    acceptSubscriptionRequest:function(toJID, status){
        this.jid = toJID;
        this.type = 'subscribed';
        if(status!==undefined) this.status = status;
        this.sendPresence();
    },
    rejectSubscriptionRequest:function(toJID, status){
        this.jid = toJID;
        this.type = 'unsubscribed';
        if(status!==undefined) this.status = status;
        this.sendPresence();
    },
    cancelSubscriptionRequest:function(toJID, status){
        this.jid = toJID; 
        this.type = 'unsubscribed';
        if(status!==undefined) this.status = status;
        this.sendPresence();
    },
    probe:function(toJID){
        xmlGenerator.start('presence', {id:'presence_' + new Date().getTime(),from:xmppClient.bareJid, to:toJID, type:'probe'}, true);
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    sendPresence:function(){
        if(this.status === null){
            xmlGenerator.start('presence', {id:'presence_' + new Date().getTime(), to:this.jid, type:this.type}, true);
        }else{
            xmlGenerator.start('presence', {id:'presence_' + new Date().getTime(), to:this.jid, type:this.type})
                            .start('status').text(this.status).end()
                        .end();
        }

        xmppClient.sendToServer(xmlGenerator.toString());
    }
};

xmppClient.ChatState = {
    toJid:null,
    thread:null,
    state:null,
    composing:function(toJid, thread){
        this.toJid = toJid;
        this.thread = thread;
        this.state = "composing";
        this.sendChatState();
    },
    paused:function(toJid, thread){
        this.toJid = toJid;
        this.thread = thread;
        this.state = "paused";
        this.sendChatState();
    },
    inactive:function(toJid, thread){
        this.toJid = toJid;
        this.thread = thread;
        this.state = "inactive";
        this.sendChatState();
    },
    gone:function(toJid, thread){
        this.toJid = toJid;
        this.thread = thread;
        this.state = "gone";
        this.sendChatState();
    },
    sendChatState:function(){
        xmlGenerator.start("message", {from:xmppClient.fullJid, to:this.toJid, type:'chat'});
        if(this.thread){
            xmlGenerator.thread(this.thread);
        }
        xmlGenerator.start(this.state, {xmlns:'http://jabber.org/protocol/chatstates'}, true);
        xmlGenerator.end("message");
        xmppClient.sendToServer(xmlGenerator.toString());
    }
};

var xmlGenerator = {
    tag:"",
    stack:[],
    thread:function(thread){
        this.tag += this.start("thread") + thread + this.end("thread");
    },
    start:function(tagName, attributes, isSelfClosing){
        if(!isSelfClosing){
            this.stack.push(tagName);
        }
        this.tag +=  "<" + tagName;
        
        if(typeof attributes === 'object'){
            for(var i in attributes){
                this.tag += " " + i + "='" + attributes[i] + "'";
            }
        }
        
        this.tag += (isSelfClosing)? "/>" : ">";
        
        return this;
    },
    end:function(){
        var tagName = this.stack.pop();
        this.tag += "</" + tagName + ">";
        return this;
    },
    text:function(text){
        this.tag += text;
        return this;
    },
    toString:function(){
        var tag = this.tag;
        this.tag = "";
        return tag;
    }
};

xmppClient.carbon = {
    enable:function(){
        xmlGenerator.start('iq', {id:'enable1', xmlns:'jabber:client', 'from':xmppClient.fullJid, type:'set'})
            .start('enable', {xmlns:'urn:xmpp:carbons:2'}, true)
            .end();
        xmppClient.sendToServer(xmlGenerator.toString());
    },
    disable:function(){
        xmlGenerator.start('iq', {id:'disable1', xmlns:'jabber:client', 'from':xmppClient.fullJid, type:'set'})
            .start('disable', {xmlns:'urn:xmpp:carbons:2'}, true)
            .end();
        xmppClient.sendToServer(xmlGenerator.toString());
    }
}

/******************************
 *Parsers
 ******************************/

var parser={
    parseServerResponse:function(xml){
        var rootTagName = $(xml)[0].tagName;
        xml = $.parseXML(xml);
        switch(rootTagName){
            case "STREAM:FEATURES":
                if($(xml).find("mechanism").length>0){
                    xmppClient.auth();
                }else if($(xml).find("bind").length>0){
                    xmppClient.bindResource();
                }
                break;
            case "SUCCESS":
                xmppClient.restart();
                break;
            case "IQ":
                if($(xml).find("bind").length>0){
                    xmppClient.session();
                }else if($(xml).find("iq").attr("id")==="_session_auth_2"){
                    xmppClient.roster.get();
                }else if($(xml).find("iq").attr("id")==="1:roster"){        
                    this.parseRosterEntries(xml);
                    xmppClient.onSuccess();
                    xmppClient.carbon.enable();
                    xmppClient.presence.available();
                    xmppClient.getBlockList();
                }else if($(xml).find("iq > ping").length>0){
                    var from = $(xml).find("iq").attr("to").split("/")[0];
                    var to = $(xml).find("iq").attr("from");
                    var id = $(xml).find("iq").attr("id");
                    xmppClient.sendPingResponse(from, to, id);
                }else if($(xml).find("iq > fin").length>0){
                    var obj = {};
                    obj['jid']=xmppClient.archiveLastRequestedFor;
                    obj['first']=$(xml).find("iq > fin > set > first").text();
                    obj['last']=$(xml).find("iq > fin > set > last").text();
                    obj['count']=$(xml).find("iq > fin > set > count").text();
                    obj['complete']=$(xml).find("iq > fin").attr("complete");
                    xmppClient.archiveFirstId[xmppClient.archiveLastRequestedFor] = $(xml).find("iq > fin > set > first").text();
                    xmppClient.onArchiveReceive(obj);                    
                }else if($(xml).find("iq > query > item").length>0){//Roster Push
                    
                    xmppClient.roster.rosterPushReply($(xml).find("iq").attr("id"));
                    
                    var obj = {};                    
                    obj['jid'] = $(xml).find("iq > query > item").attr("jid");
                    obj['subscription'] = $(xml).find("iq > query > item").attr("subscription");
                    
                    if(obj['subscription'] === "remove"){//Roster Entry Removed
                        xmppClient.onRosterEntryRemove(obj);
                    }else{
                            obj['name'] = $(xml).find("iq > query > item").attr("name");
                            if($(xml).find("iq > query > item > group").length>0){
                                var group = $(xml).find("iq > query > item > group").text();
                            }
                            obj['group'] = group;
                            obj['ask'] = $(xml).find("iq > query > item").attr("ask");
                            xmppClient.onRosterPush(obj);
                    }
                    
                }else if($(xml).find("iq").attr("id")==="blocklist1"){
                    var arr = [];
                    $(xml).find("iq > blocklist > item").each(function() {
                        if($(this).attr('jid').indexOf('@') !== -1) {
                            arr.push($(this).attr('jid'));
                        }
                    });
                    xmppClient.onBlockListReceive(arr);
                }else if($(xml).find("iq > block").length > 0 && $(xml).find("iq > block").attr("xmlns") === "urn:xmpp:blocking"){
                    xmppClient.onBlocked($(xml).find("iq > block > item").attr("jid"));
                }else if($(xml).find("iq > unblock").length > 0 && $(xml).find("iq > unblock").attr("xmlns") === "urn:xmpp:blocking"){
                    xmppClient.onUnblocked($(xml).find("iq > unblock > item").attr("jid"));
                }
                break;
            case "PRESENCE":    
                this.parsePresence(xml);
                break;
            case "MESSAGE":
                this.parseMessages(xml);
                break;
            case "FAILURE":
                if($(xml).find("not-authorized").length>0){
                    xmppClient.onFailure("not-authorized");
                }
                break;
        }
            
        if($(xml).find("body").attr("type")==="terminate"){
            if(xmppClient.onDisconnect){
                xmppClient.onDisconnect("connection terminated.");
            }else{
                
            }
        }
    },
    parseRosterEntries:function(xml){
        var jid=null;
        var name=null;
        var subscription=null;
        var roster=[];
        
        $(xml).find("query > item").each(function(){
            
            jid=$(this).attr("jid");
            name=$(this).attr("name");
            
            if(name===undefined){
                name=jid.split("@")[0];
            }
            
            subscription=$(this).attr("subscription");
            group=$(this).find("group").text();
            
            var obj = {jid:jid, name:name, subscription:subscription, group:group};
            
            if($(this).attr("ask") !== undefined){
                obj['ask'] = $(this).attr("ask");
            }
            
            roster.push(obj); 
            
        });
        
        if(xmppClient.onRosterReceive){
            xmppClient.onRosterReceive(roster);
        }
    },
    parseMessages:function(xml){
        if($(xml).find("sent").length>0 && $(xml).find("sent").attr("xmlns") === "urn:xmpp:carbons:2"){ //Carbon Messages
            if($(xml).find("body").length>0){
                var objMessage = {};
                objMessage['id'] = $(xml).find("forwarded > message").attr('id');
                objMessage['from'] = $(xml).find("forwarded > message").attr('from');
                objMessage['to'] = $(xml).find("forwarded > message").attr('to');
                objMessage['text'] = $(xml).find("forwarded > message > body").text();
                objMessage['type'] = 'carbon';

                xmppClient.onMessageReceive(objMessage);
            }
            
        }else if($(xml).find("forwarded").length>0){ //Archive

            var objMessage = {};
            objMessage['id'] = $(xml).find("forwarded > message").attr('id');
            objMessage['from'] = $(xml).find("forwarded > message").attr('from');
            objMessage['to'] = $(xml).find("forwarded > message").attr('to');
            objMessage['text'] = $(xml).find("forwarded > message > body").text();
            objMessage['type'] = 'archive';

            if($(xml).find("delay").length>0){
                objMessage['delay'] = {};
                objMessage['delay']['text'] = $(xml).find("delay").text();
                objMessage['delay']['time'] = $(xml).find("delay").attr("stamp");
            }

            xmppClient.onMessageReceive(objMessage);

        }else if($(xml).find("body").length>0){

            var objMessage = {};
            objMessage['id'] = $(xml).find("message").attr('id');
            objMessage['from'] = $(xml).find("message").attr('from');
            objMessage['to'] = $(xml).find("message").attr('to');
            objMessage['text'] = $(xml).find("message").find("body").text();

            if($(xml).find("message > delay").length>0){
                objMessage['type'] = 'offline';
                
                objMessage['delay'] = {};
                objMessage['delay']['text'] = $(xml).find("message > delay").text();
                objMessage['delay']['time'] = $(xml).find("message > delay").attr("stamp");
            }else{
                objMessage['type'] = 'chat';
            }

            if($(xml).find("result").length === 0 || $(xml).find("message > result").attr("xmlns") !== "urn:xmpp:mam:1"){
                if($(xml).find("request").length>0 && $(xml).find("message > request").attr("xmlns")==="urn:xmpp:receipts"){
                    xmppClient.sendReceipt($(xml).find("message").attr("id"), $(xml).find("message").attr("from"));
                }
            }

            xmppClient.onMessageReceive(objMessage);

        }else if($(xml).find("composing").length>0){
            xmppClient.onTypingStatusChange($(xml).find("message").attr('from'), "composing");
        }else if($(xml).find("paused").length>0){
            xmppClient.onTypingStatusChange($(xml).find("message").attr('from'), "paused");
        }else if($(xml).find("inactive").length>0){
            xmppClient.onTypingStatusChange($(xml).find("message").attr('from'), "inactive");
        }else if($(xml).find("gone").length>0){
            xmppClient.onTypingStatusChange($(xml).find("message").attr('from'), "gone");
        }else if($(xml).find("active").length>0 && $(xml).find("message > body").length===0){
            xmppClient.onTypingStatusChange($(xml).find("message").attr('from'), "active");
        }else if($(xml).find("received").length>0){
            xmppClient.onDelivered($(xml).find("message").attr("from"), $(xml).find("received").attr('id'));
        }
        
    },
    parsePresence:function(xml){
        $(xml).find("presence").each(function(){
            
            var from=$(this).attr("from");
            var type=$(this).attr("type"); //unavailable=offline,subscribe=subscribe request
            
            if(type===undefined){
                type="available";
            }
            
            if(this.jid !== from.split("/")[0]){// ignore if it is user's own presence
                
                var presence = {from:from, type:type};
                
                if($(this).find("status").length > 0 && $(this).find("status").text().length>0){
                    presence["status"] = $(this).find("status").text();
                }
                
                switch(type){
                    case "subscribe":
                        xmppClient.onSubscriptionRequestReceive(presence);
                        break;
                    case "unsubscribe":
                        xmppClient.onUnSubscribe(presence);
                        break;
                    case "subscribed":
                        xmppClient.onSubscriptionRequestAccept(presence);
                        break;
                    case "unsubscribed":
                        xmppClient.onSubscriptionRequestRejectOrCancel(presence);
                        break;        
                    case "available":
                    case "unavailable":
                        xmppClient.onPresenceReceive(presence);
                    default:
                        break;
                }
            }
            
        });
    }
};

function log(tag, data){
    if(xmppClient.debug) console.log(tag + ": " , data);
}

var Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", encode:function(e){var t = ""; var n, r, i, s, o, u, a; var f = 0; e = Base64._utf8_encode(e); while (f < e.length){n = e.charCodeAt(f++); r = e.charCodeAt(f++); i = e.charCodeAt(f++); s = n >> 2; o = (n & 3) << 4 | r >> 4; u = (r & 15) << 2 | i >> 6; a = i & 63; if (isNaN(r)){u = a = 64} else if (isNaN(i)){a = 64}t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a)}return t}, decode:function(e){var t = ""; var n, r, i; var s, o, u, a; var f = 0; e = e.replace(/[^A-Za-z0-9\+\/\=]/g, ""); while (f < e.length){s = this._keyStr.indexOf(e.charAt(f++)); o = this._keyStr.indexOf(e.charAt(f++)); u = this._keyStr.indexOf(e.charAt(f++)); a = this._keyStr.indexOf(e.charAt(f++)); n = s << 2 | o >> 4; r = (o & 15) << 4 | u >> 2; i = (u & 3) << 6 | a; t = t + String.fromCharCode(n); if (u != 64){t = t + String.fromCharCode(r)}if (a != 64){t = t + String.fromCharCode(i)}}t = Base64._utf8_decode(t); return t}, _utf8_encode:function(e){e = e.replace(/\r\n/g, "\n"); var t = ""; for (var n = 0; n < e.length; n++){var r = e.charCodeAt(n); if (r < 128){t += String.fromCharCode(r)} else if (r > 127 && r < 2048){t += String.fromCharCode(r >> 6 | 192); t += String.fromCharCode(r & 63 | 128)} else{t += String.fromCharCode(r >> 12 | 224); t += String.fromCharCode(r >> 6 & 63 | 128); t += String.fromCharCode(r & 63 | 128)}}return t}, _utf8_decode:function(e){var t = ""; var n = 0; var r = c1 = c2 = 0; while (n < e.length){r = e.charCodeAt(n); if (r < 128){t += String.fromCharCode(r); n++} else if (r > 191 && r < 224){c2 = e.charCodeAt(n + 1); t += String.fromCharCode((r & 31) << 6 | c2 & 63); n += 2} else{c2 = e.charCodeAt(n + 1); c3 = e.charCodeAt(n + 2); t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63); n += 3}}return t}};